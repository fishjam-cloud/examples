package fishjam

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

type Client struct {
	baseURL         string
	managementToken string
	httpClient      *http.Client
}

type RoomConfig struct {
	RoomType string `json:"roomType,omitempty"`
}

type Room struct {
	ID     string   `json:"id"`
	Config any      `json:"config"`
	Peers  []Peer   `json:"peers"`
}

type Peer struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}

type PeerConfig struct {
	Type    string         `json:"type"`
	Options PeerOptionsWeb `json:"options"`
}

type PeerOptionsWeb struct {
	Metadata map[string]string `json:"metadata,omitempty"`
}

type TrackForwardingRequest struct {
	CompositionURL string `json:"compositionURL"`
	Selector       string `json:"selector"`
}

type createRoomResponse struct {
	Data struct {
		Room Room `json:"room"`
	} `json:"data"`
}

type createPeerResponse struct {
	Data struct {
		Peer           Peer   `json:"peer"`
		Token          string `json:"token"`
		PeerWebsocketURL string `json:"peer_websocket_url"`
	} `json:"data"`
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

func (c *Client) BaseURL() string {
	return c.baseURL
}

func (c *Client) ManagementToken() string {
	return c.managementToken
}

func (c *Client) CreateRoom() (*Room, error) {
	body := RoomConfig{RoomType: "conference"}
	resp, err := c.doJSON("POST", "/room", body)
	if err != nil {
		return nil, fmt.Errorf("create room: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, readError(resp)
	}

	var result createRoomResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode create room response: %w", err)
	}
	return &result.Data.Room, nil
}

func (c *Client) CreatePeer(roomID string, metadata map[string]string) (peerToken string, peerWebsocketURL string, err error) {
	body := PeerConfig{
		Type:    "webrtc",
		Options: PeerOptionsWeb{Metadata: metadata},
	}
	resp, err := c.doJSON("POST", fmt.Sprintf("/room/%s/peer", roomID), body)
	if err != nil {
		return "", "", fmt.Errorf("create peer: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return "", "", readError(resp)
	}

	var result createPeerResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", fmt.Errorf("decode create peer response: %w", err)
	}
	return result.Data.Token, result.Data.PeerWebsocketURL, nil
}

func (c *Client) CreateTrackForwarding(roomID, compositionURL string) error {
	body := TrackForwardingRequest{
		CompositionURL: compositionURL,
		Selector:       "all",
	}
	resp, err := c.doJSON("POST", fmt.Sprintf("/room/%s/track_forwardings", roomID), body)
	if err != nil {
		return fmt.Errorf("create track forwarding: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return readError(resp)
	}
	return nil
}

func (c *Client) doJSON(method, path string, body any) (*http.Response, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		log.Printf("fishjam: marshal error for %s %s: %v (body: %+v)", method, path, err, body)
		return nil, fmt.Errorf("marshal request body: %w", err)
	}

	fullURL := c.baseURL + path
	log.Printf("fishjam: %s %s body=%s", method, fullURL, string(jsonBody))

	req, err := http.NewRequest(method, fullURL, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.managementToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("fishjam: request error for %s %s: %v", method, fullURL, err)
		return nil, err
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("fishjam: failed to read response body for %s %s: %v", method, fullURL, err)
		return nil, fmt.Errorf("read response body: %w", err)
	}
	resp.Body = io.NopCloser(bytes.NewReader(respBody))

	log.Printf("fishjam: %s %s -> %d body=%s", method, fullURL, resp.StatusCode, string(respBody))

	return resp, nil
}

func readError(resp *http.Response) error {
	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
}
