package foundry

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

const compositionBaseURL = "https://rtc.fishjam.io/api/composition"

type Client struct {
	httpClient *http.Client
}

type createCompositionResponse struct {
	CompositionURL string `json:"composition_url"`
}

// Scene component types for JSON marshaling

type inputStream struct {
	Type    string `json:"type"`
	InputID string `json:"input_id"`
}

type tilesComponent struct {
	Type            string        `json:"type"`
	BackgroundColor string        `json:"background_color"`
	TileAspectRatio string        `json:"tile_aspect_ratio"`
	Children        []inputStream `json:"children"`
}

type viewComponent struct {
	Type string `json:"type"`
}

type audioInput struct {
	InputID string  `json:"input_id"`
	Volume  float64 `json:"volume"`
}

type videoEncoder struct {
	Type   string `json:"type"`
	Preset string `json:"preset"`
}

type videoResolution struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type initialVideo struct {
	Root any `json:"root"`
}

type videoConfig struct {
	Resolution videoResolution `json:"resolution"`
	Encoder    videoEncoder    `json:"encoder"`
	Initial    initialVideo    `json:"initial"`
}

type audioEncoder struct {
	Type string `json:"type"`
}

type initialAudio struct {
	Inputs []audioInput `json:"inputs"`
}

type audioConfig struct {
	Encoder  audioEncoder `json:"encoder"`
	Channels string       `json:"channels"`
	Initial  initialAudio `json:"initial"`
}

type registerOutputRequest struct {
	Type  string      `json:"type"`
	Video videoConfig `json:"video"`
	Audio audioConfig `json:"audio"`
}

type updateVideoScene struct {
	Root any `json:"root"`
}

type updateAudioScene struct {
	Inputs []audioInput `json:"inputs"`
}

type updateOutputRequest struct {
	Video updateVideoScene `json:"video"`
	Audio updateAudioScene `json:"audio"`
}

func NewClient() *Client {
	return &Client{httpClient: &http.Client{}}
}

func (c *Client) CreateComposition() (string, error) {
	resp, err := c.httpClient.Post(compositionBaseURL, "application/json", bytes.NewBufferString("{}"))
	if err != nil {
		return "", fmt.Errorf("create composition: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return "", readError(resp)
	}

	var result createCompositionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode composition response: %w", err)
	}
	return result.CompositionURL, nil
}

func (c *Client) Start(compositionURL string) error {
	resp, err := c.doJSON(compositionURL+"/start", nil)
	if err != nil {
		return fmt.Errorf("start composition: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return readError(resp)
	}
	return nil
}

func (c *Client) RegisterWhepOutput(compositionURL, outputID string) error {
	body := registerOutputRequest{
		Type: "whep_server",
		Video: videoConfig{
			Resolution: videoResolution{Width: 640, Height: 360},
			Encoder:    videoEncoder{Type: "ffmpeg_h264", Preset: "ultrafast"},
			Initial:    initialVideo{Root: viewComponent{Type: "view"}},
		},
		Audio: audioConfig{
			Encoder:  audioEncoder{Type: "opus"},
			Channels: "stereo",
			Initial:  initialAudio{Inputs: []audioInput{}},
		},
	}

	url := fmt.Sprintf("%s/output/%s/register", compositionURL, outputID)
	resp, err := c.doJSON(url, body)
	if err != nil {
		return fmt.Errorf("register whep output: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return readError(resp)
	}
	return nil
}

func (c *Client) UpdateOutput(compositionURL, outputID string, inputIDs []string) error {
	children := make([]inputStream, 0, len(inputIDs))
	audioInputs := make([]audioInput, 0, len(inputIDs))

	for _, id := range inputIDs {
		children = append(children, inputStream{Type: "input_stream", InputID: id})
		audioInputs = append(audioInputs, audioInput{InputID: id, Volume: 1.0})
	}

	var videoRoot any
	if len(children) == 0 {
		videoRoot = viewComponent{Type: "view"}
	} else {
		videoRoot = tilesComponent{
			Type:            "tiles",
			BackgroundColor: "#000000FF",
			TileAspectRatio: "16:9",
			Children:        children,
		}
	}

	body := updateOutputRequest{
		Video: updateVideoScene{Root: videoRoot},
		Audio: updateAudioScene{Inputs: audioInputs},
	}

	url := fmt.Sprintf("%s/output/%s/update", compositionURL, outputID)
	resp, err := c.doJSON(url, body)
	if err != nil {
		return fmt.Errorf("update output: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return readError(resp)
	}

	return nil
}

func (c *Client) WhepURL(compositionURL, outputID string) string {
	return fmt.Sprintf("%s/whep/%s", compositionURL, outputID)
}

func (c *Client) doJSON(url string, body any) (*http.Response, error) {
	var jsonBytes []byte
	if body != nil {
		var err error
		jsonBytes, err = json.Marshal(body)
		if err != nil {
			log.Printf("foundry: marshal error for %s: %v (body: %+v)", url, err, body)
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
	} else {
		jsonBytes = []byte("{}")
	}

	log.Printf("foundry: POST %s body=%s", url, string(jsonBytes))

	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("foundry: request error for %s: %v", url, err)
		return nil, err
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("foundry: failed to read response body for %s: %v", url, err)
		return nil, fmt.Errorf("read response body: %w", err)
	}
	resp.Body = io.NopCloser(bytes.NewReader(respBody))

	log.Printf("foundry: POST %s -> %d body=%s", url, resp.StatusCode, string(respBody))

	return resp, nil
}

func readError(resp *http.Response) error {
	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
}
