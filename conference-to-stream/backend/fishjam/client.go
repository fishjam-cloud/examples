package fishjam

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"

	api "conference-to-stream/fishjam/generated"
)

// Client wraps the generated Fishjam API client.
type Client struct {
	baseURL         string
	managementToken string
	httpClient      *http.Client
}

func NewClient(fishjamID, managementToken string) *Client {
	baseURL := fishjamID
	if _, err := url.ParseRequestURI(fishjamID); err != nil || !strings.HasPrefix(fishjamID, "http") {
		baseURL = fmt.Sprintf("https://fishjam.io/api/v1/connect/%s", fishjamID)
	}
	baseURL = strings.TrimRight(baseURL, "/")
	log.Printf("fishjam: base URL: %s", baseURL)

	return &Client{
		baseURL:         baseURL,
		managementToken: managementToken,
		httpClient:      &http.Client{},
	}
}

func (c *Client) newAPI() (*api.ClientWithResponses, error) {
	authHeader := api.WithRequestEditorFn(func(ctx context.Context, req *http.Request) error {
		req.Header.Set("Authorization", "Bearer "+c.managementToken)
		return nil
	})
	return api.NewClientWithResponses(c.baseURL, api.WithHTTPClient(c.httpClient), authHeader)
}

func (c *Client) BaseURL() string {
	return c.baseURL
}

func (c *Client) ManagementToken() string {
	return c.managementToken
}

func (c *Client) CreateRoom() (*api.Room, error) {
	cl, err := c.newAPI()
	if err != nil {
		return nil, err
	}
	roomType := api.Conference
	resp, err := cl.CreateRoomWithResponse(context.Background(), api.RoomConfig{
		RoomType: &roomType,
	})
	if err != nil {
		return nil, fmt.Errorf("create room: %w", err)
	}
	if resp.JSON201 == nil {
		return nil, fmt.Errorf("create room: unexpected status %d", resp.StatusCode())
	}
	log.Printf("fishjam: created room: id=%s", resp.JSON201.Data.Room.Id)
	return &resp.JSON201.Data.Room, nil
}

func (c *Client) CreatePeer(roomID string, metadata map[string]string) (peerID, peerToken, peerWebsocketURL string, err error) {
	cl, err := c.newAPI()
	if err != nil {
		return "", "", "", err
	}
	meta := make(api.WebRTCMetadata, len(metadata))
	for k, v := range metadata {
		meta[k] = v
	}
	var opts api.PeerOptions
	if err := opts.FromPeerOptionsWebRTC(api.PeerOptionsWebRTC{Metadata: &meta}); err != nil {
		return "", "", "", fmt.Errorf("build peer options: %w", err)
	}
	resp, err := cl.AddPeerWithResponse(context.Background(), roomID, api.PeerConfig{
		Type:    api.Webrtc,
		Options: opts,
	})
	if err != nil {
		return "", "", "", fmt.Errorf("create peer: %w", err)
	}
	if resp.JSON201 == nil {
		return "", "", "", fmt.Errorf("create peer: unexpected status %d", resp.StatusCode())
	}
	wsURL := ""
	if resp.JSON201.Data.PeerWebsocketUrl != nil {
		wsURL = *resp.JSON201.Data.PeerWebsocketUrl
	}
	log.Printf("fishjam: created peer: id=%s room=%s websocket=%s", resp.JSON201.Data.Peer.Id, roomID, wsURL)
	return resp.JSON201.Data.Peer.Id, resp.JSON201.Data.Token, wsURL, nil
}

func (c *Client) CreateStream() (*api.Stream, error) {
	cl, err := c.newAPI()
	if err != nil {
		return nil, err
	}
	pub := true
	resp, err := cl.CreateStreamWithResponse(context.Background(), api.StreamConfig{
		Public: &pub,
	})
	if err != nil {
		return nil, fmt.Errorf("create stream: %w", err)
	}
	if resp.JSON201 == nil {
		return nil, fmt.Errorf("create stream: unexpected status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	log.Printf("fishjam: created stream: %v", resp.JSON201)
	log.Printf("fishjam: created stream: id=%s whep=%s", resp.JSON201.Data.Id, c.LiveWhepURL(resp.JSON201.Data.Id))
	return &resp.JSON201.Data, nil
}

func (c *Client) CreateStreamer(streamID string) (string, error) {
	cl, err := c.newAPI()
	if err != nil {
		return "", err
	}
	resp, err := cl.CreateStreamerWithResponse(context.Background(), streamID)
	if err != nil {
		return "", fmt.Errorf("create streamer: %w", err)
	}
	if resp.JSON201 == nil {
		return "", fmt.Errorf("create streamer: unexpected status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	log.Printf("fishjam: created streamer for stream: id=%s whip=%s", streamID, c.LiveWhipURL())
	return resp.JSON201.Data.Token, nil
}

func (c *Client) DeleteStream(streamID string) error {
	cl, err := c.newAPI()
	if err != nil {
		return err
	}
	resp, err := cl.DeleteStreamWithResponse(context.Background(), streamID)
	if err != nil {
		return fmt.Errorf("delete stream: %w", err)
	}
	if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
		return fmt.Errorf("delete stream: unexpected status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	log.Printf("fishjam: deleted stream: id=%s", streamID)
	return nil
}

// LiveWhipURL returns the WHIP endpoint URL for composition → Fishjam livestream.
func (c *Client) LiveWhipURL() string {
	base := strings.TrimRight(c.baseURL, "/")
	// Replace /connect/{id} suffix with /live
	if idx := strings.Index(base, "/connect/"); idx != -1 {
		base = base[:idx]
	}
	return base + "/live/api/whip"
}

// LiveWhepURL returns the public WHEP playback URL for a livestream.
func (c *Client) LiveWhepURL(streamID string) string {
	base := strings.TrimRight(c.baseURL, "/")
	if idx := strings.Index(base, "/connect/"); idx != -1 {
		base = base[:idx]
	}
	return base + "/live/api/whep/" + streamID
}

func (c *Client) CreateTrackForwarding(roomID, compositionURL string) error {
	cl, err := c.newAPI()
	if err != nil {
		return err
	}
	selector := "all"
	resp, err := cl.CreateTrackForwardingWithResponse(context.Background(), roomID, api.TrackForwarding{
		CompositionURL: compositionURL,
		Selector:       &selector,
	})
	if err != nil {
		return fmt.Errorf("create track forwarding: %w", err)
	}
	if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
		return fmt.Errorf("create track forwarding: unexpected status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	log.Printf("fishjam: created track forwarding: room=%s composition=%s", roomID, compositionURL)
	return nil
}
