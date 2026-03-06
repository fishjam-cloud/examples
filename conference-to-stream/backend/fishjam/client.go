package fishjam

import (
	"context"
	"fmt"
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
	return &resp.JSON201.Data.Room, nil
}

func (c *Client) CreatePeer(roomID string, metadata map[string]string) (peerToken string, peerWebsocketURL string, err error) {
	cl, err := c.newAPI()
	if err != nil {
		return "", "", err
	}
	meta := make(api.WebRTCMetadata, len(metadata))
	for k, v := range metadata {
		meta[k] = v
	}
	var opts api.PeerOptions
	if err := opts.FromPeerOptionsWebRTC(api.PeerOptionsWebRTC{Metadata: &meta}); err != nil {
		return "", "", fmt.Errorf("build peer options: %w", err)
	}
	resp, err := cl.AddPeerWithResponse(context.Background(), roomID, api.PeerConfig{
		Type:    api.Webrtc,
		Options: opts,
	})
	if err != nil {
		return "", "", fmt.Errorf("create peer: %w", err)
	}
	if resp.JSON201 == nil {
		return "", "", fmt.Errorf("create peer: unexpected status %d", resp.StatusCode())
	}
	wsURL := ""
	if resp.JSON201.Data.PeerWebsocketUrl != nil {
		wsURL = *resp.JSON201.Data.PeerWebsocketUrl
	}
	return resp.JSON201.Data.Token, wsURL, nil
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
	return nil
}
