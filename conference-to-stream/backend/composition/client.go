package composition

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// InputEntry associates a composition input ID with a display name.
type InputEntry struct {
	InputID  string
	PeerName string
}

// Client wraps the composition API client.
type Client struct {
	httpClient *http.Client
	token      string
}

func NewClient(token string) *Client {
	return &Client{httpClient: &http.Client{}, token: token}
}

func (c *Client) doRequest(ctx context.Context, apiURL, method, path string, body interface{}) ([]byte, int, error) {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, 0, fmt.Errorf("marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, apiURL+path, bodyReader)
	if err != nil {
		return nil, 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("read response body: %w", err)
	}

	return respBody, resp.StatusCode, nil
}

// CreateComposition creates a new composition and returns its ID.
func (c *Client) CreateComposition(apiURL string) (string, error) {
	autostart := false
	reqBody := CreateCompositionRequest{
		Autostart: &autostart,
	}

	respBody, statusCode, err := c.doRequest(context.Background(), apiURL, "POST", "/api/composition", reqBody)
	if err != nil {
		return "", err
	}

	if statusCode != http.StatusCreated {
		return "", fmt.Errorf("create composition: unexpected status %d: %s", statusCode, string(respBody))
	}

	var resp CompositionCreatedResponse
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return "", fmt.Errorf("unmarshal response: %w", err)
	}

	return resp.CompositionId, nil
}

// Start starts a composition.
func (c *Client) Start(apiURL, compositionID string) error {
	path := fmt.Sprintf("/api/composition/%s/start", compositionID)
	respBody, statusCode, err := c.doRequest(context.Background(), apiURL, "POST", path, nil)
	if err != nil {
		return err
	}

	if statusCode < 200 || statusCode >= 300 {
		return fmt.Errorf("start composition: unexpected status %d: %s", statusCode, string(respBody))
	}

	return nil
}

// DeleteComposition deletes a composition by ID.
func (c *Client) DeleteComposition(apiURL, compositionID string) error {
	path := fmt.Sprintf("/api/composition/%s", compositionID)
	respBody, statusCode, err := c.doRequest(context.Background(), apiURL, "DELETE", path, nil)
	if err != nil {
		return err
	}

	if statusCode < 200 || statusCode >= 300 {
		return fmt.Errorf("delete composition: unexpected status %d: %s", statusCode, string(respBody))
	}

	return nil
}

// RegisterWhepOutput registers a WHEP server output on the composition.
func (c *Client) RegisterWhepOutput(apiURL, compositionID, outputID string) error {
	var initialVideoRoot Component
	if err := initialVideoRoot.FromView(View{}); err != nil {
		return fmt.Errorf("build initial video root: %w", err)
	}

	var audioEncoder WhepAudioEncoderOptions
	if err := audioEncoder.FromWhepAudioEncoderOptions0(WhepAudioEncoderOptionsOpus{
		Type: WhepAudioEncoderOptions0TypeOpus,
	}); err != nil {
		return fmt.Errorf("build audio encoder: %w", err)
	}

	stereo := Stereo

	var body RegisterOutput
	if err := body.FromWhepOutput(WhepOutput{
		Video: &OutputWhepVideoOptions{
			Resolution: Resolution{Width: 1920, Height: 1080},
			Initial:    VideoScene{Root: initialVideoRoot},
		},
		Audio: &OutputWhepAudioOptions{
			Encoder:  &audioEncoder,
			Channels: &stereo,
			Initial:  AudioScene{Inputs: []AudioSceneInput{}},
		},
	}); err != nil {
		return fmt.Errorf("build register output body: %w", err)
	}

	path := fmt.Sprintf("/api/composition/%s/output/%s/register", compositionID, outputID)
	respBody, statusCode, err := c.doRequest(context.Background(), apiURL, "POST", path, body)
	if err != nil {
		return err
	}

	if statusCode < 200 || statusCode >= 300 {
		return fmt.Errorf("register whep output: unexpected status %d: %s", statusCode, string(respBody))
	}

	return nil
}

// UpdateOutput updates a composition output with the given set of inputs.
func (c *Client) UpdateOutput(apiURL, compositionID, outputID string, inputs []InputEntry) error {
	var videoRoot Component
	audioInputs := make([]AudioSceneInput, 0, len(inputs))

	if len(inputs) == 0 {
		if err := videoRoot.FromView(View{}); err != nil {
			return fmt.Errorf("build video root: %w", err)
		}
	} else {
		tileChildren := make([]Component, 0, len(inputs))
		for _, entry := range inputs {
			tile, err := buildParticipantTile(entry)
			if err != nil {
				return err
			}
			tileChildren = append(tileChildren, tile)
			audioInputs = append(audioInputs, AudioSceneInput{InputId: entry.InputID})
		}
		bgColor := RGBAColor("#000000FF")
		ratio := AspectRatio("16:9")
		if err := videoRoot.FromTiles(Tiles{
			Children:        &tileChildren,
			BackgroundColor: &bgColor,
			TileAspectRatio: &ratio,
		}); err != nil {
			return fmt.Errorf("build tiles component: %w", err)
		}
	}

	req := UpdateOutputRequest{
		Video: &VideoScene{Root: videoRoot},
		Audio: &AudioScene{Inputs: audioInputs},
	}

	path := fmt.Sprintf("/api/composition/%s/output/%s/update", compositionID, outputID)
	respBody, statusCode, err := c.doRequest(context.Background(), apiURL, "POST", path, req)
	if err != nil {
		return err
	}

	if statusCode < 200 || statusCode >= 300 {
		return fmt.Errorf("update output: unexpected status %d: %s", statusCode, string(respBody))
	}

	return nil
}

// buildParticipantTile creates a Rescaler containing a View with the input stream
// and an optional name label overlay at the bottom.
func buildParticipantTile(entry InputEntry) (Component, error) {
	// InputStream
	var inputStream Component
	if err := inputStream.FromInputStream(InputStream{
		InputId: entry.InputID,
	}); err != nil {
		return Component{}, fmt.Errorf("build input stream: %w", err)
	}

	viewChildren := []Component{inputStream}

	// Name label overlay (only if name is non-empty)
	if entry.PeerName != "" {
		var textComp Component
		fontSize := float32(24)
		textColor := RGBAColor("#FFFFFFFF")
		weight := TextWeightBold
		align := HorizontalAlignCenter
		labelWidth := float32(1280)
		if err := textComp.FromText(Text{
			Text:     entry.PeerName,
			FontSize: fontSize,
			Color:    &textColor,
			Weight:   &weight,
			Align:    &align,
			Width:    &labelWidth,
		}); err != nil {
			return Component{}, fmt.Errorf("build text component: %w", err)
		}

		labelChildren := []Component{textComp}
		labelBg := RGBAColor("#00000088")
		bottom := float32(0)
		left := float32(0)
		labelHeight := float32(40)
		var labelView Component
		if err := labelView.FromView(View{
			Children:        &labelChildren,
			Bottom:          &bottom,
			Left:            &left,
			Width:           &labelWidth,
			Height:          &labelHeight,
			BackgroundColor: &labelBg,
		}); err != nil {
			return Component{}, fmt.Errorf("build label view: %w", err)
		}

		viewChildren = append(viewChildren, labelView)
	}

	// Outer View wrapping input + label
	overflow := OverflowHidden
	viewWidth := float32(1280)
	viewHeight := float32(720)
	var outerView Component
	if err := outerView.FromView(View{
		Children: &viewChildren,
		Width:    &viewWidth,
		Height:   &viewHeight,
		Overflow: &overflow,
	}); err != nil {
		return Component{}, fmt.Errorf("build outer view: %w", err)
	}

	// Rescaler
	mode := RescaleModeFit
	var rescaler Component
	if err := rescaler.FromRescaler(Rescaler{
		Child: outerView,
		Mode:  &mode,
	}); err != nil {
		return Component{}, fmt.Errorf("build rescaler: %w", err)
	}

	return rescaler, nil
}

// WhepURL returns the WHEP playback URL for the given output.
func (c *Client) WhepURL(apiURL, compositionID, outputID string) string {
	return fmt.Sprintf("%s/api/composition/%s/whep/%s", apiURL, compositionID, outputID)
}

// CompositionBaseURL returns the composition base URL used for track forwarding.
func (c *Client) CompositionBaseURL(apiURL, compositionID string) string {
	return fmt.Sprintf("%s/api/composition/%s", apiURL, compositionID)
}
