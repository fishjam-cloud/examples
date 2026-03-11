package composition

import (
	"context"
	"fmt"
	"net/http"

	api "conference-to-stream/composition/generated"
)

// InputEntry associates a composition input ID with a display name.
type InputEntry struct {
	InputID  string
	PeerName string
}

// Client wraps the generated composition API client.
type Client struct {
	httpClient *http.Client
	token      string
}

func NewClient(token string) *Client {
	return &Client{httpClient: &http.Client{}, token: token}
}

func (c *Client) newAPI(apiURL string) (*api.ClientWithResponses, error) {
	authHeader := api.WithRequestEditorFn(func(ctx context.Context, req *http.Request) error {
		req.Header.Set("Authorization", "Bearer "+c.token)
		return nil
	})
	return api.NewClientWithResponses(apiURL, api.WithHTTPClient(c.httpClient), authHeader)
}

// CreateComposition creates a new composition and returns its ID.
func (c *Client) CreateComposition(apiURL string) (string, error) {
	cl, err := c.newAPI(apiURL)
	if err != nil {
		return "", err
	}
	autostart := false
	resp, err := cl.CreateCompositionWithResponse(context.Background(), api.CreateCompositionRequest{
		Autostart: &autostart,
	})
	if err != nil {
		return "", fmt.Errorf("create composition: %w", err)
	}
	if resp.JSON201 == nil {
		return "", fmt.Errorf("create composition: unexpected status %d", resp.StatusCode())
	}
	return resp.JSON201.CompositionId, nil
}

// Start starts a composition.
func (c *Client) Start(apiURL, compositionID string) error {
	cl, err := c.newAPI(apiURL)
	if err != nil {
		return err
	}
	resp, err := cl.StartWithResponse(context.Background(), compositionID)
	if err != nil {
		return fmt.Errorf("start composition: %w", err)
	}
	if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
		return fmt.Errorf("start composition: unexpected status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	return nil
}

// DeleteComposition deletes a composition by ID.
func (c *Client) DeleteComposition(apiURL, compositionID string) error {
	cl, err := c.newAPI(apiURL)
	if err != nil {
		return err
	}
	resp, err := cl.DeleteCompositionWithResponse(context.Background(), compositionID)
	if err != nil {
		return fmt.Errorf("delete composition: %w", err)
	}
	if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
		return fmt.Errorf("delete composition: unexpected status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	return nil
}

// RegisterWhepOutput registers a WHEP server output on the composition.
func (c *Client) RegisterWhepOutput(apiURL, compositionID, outputID string) error {
	cl, err := c.newAPI(apiURL)
	if err != nil {
		return err
	}

	var videoEncoder api.WhepVideoEncoderOptions
	if err := videoEncoder.FromWhepVideoEncoderOptions3(api.WhepVideoEncoderOptions3{
		Type: api.WhepVideoEncoderOptions3TypeVulkanH264,
	}); err != nil {
		return fmt.Errorf("build video encoder: %w", err)
	}
	var initialVideoRoot api.Component
	if err := initialVideoRoot.FromView(api.View{}); err != nil {
		return fmt.Errorf("build initial video root: %w", err)
	}

	var audioEncoder api.WhepAudioEncoderOptions
	if err := audioEncoder.FromWhepAudioEncoderOptions0(api.WhepAudioEncoderOptions0{
		Type: api.WhepAudioEncoderOptions0TypeOpus,
	}); err != nil {
		return fmt.Errorf("build audio encoder: %w", err)
	}
	stereo := api.Stereo

	var body api.RegisterOutput
	if err := body.FromWhepOutput(api.WhepOutput{
		Video: &api.OutputWhepVideoOptions{
			Encoder:    videoEncoder,
			Resolution: api.Resolution{Width: 1920, Height: 1080},
			Initial:    api.VideoScene{Root: initialVideoRoot},
		},
		Audio: &api.OutputWhepAudioOptions{
			Encoder:  audioEncoder,
			Channels: &stereo,
			Initial:  api.AudioScene{Inputs: []api.AudioSceneInput{}},
		},
	}); err != nil {
		return fmt.Errorf("build register output body: %w", err)
	}
	resp, err := cl.RegisterOutputWithResponse(context.Background(), compositionID, outputID, body)
	if err != nil {
		return fmt.Errorf("register whep output: %w", err)
	}
	if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
		return fmt.Errorf("register whep output: unexpected status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	return nil
}

// UpdateOutput updates a composition output with the given set of inputs.
func (c *Client) UpdateOutput(apiURL, compositionID, outputID string, inputs []InputEntry) error {
	cl, err := c.newAPI(apiURL)
	if err != nil {
		return err
	}

	var videoRoot api.Component
	audioInputs := make([]api.AudioSceneInput, 0, len(inputs))

	if len(inputs) == 0 {
		if err := videoRoot.FromView(api.View{}); err != nil {
			return fmt.Errorf("build video root: %w", err)
		}
	} else {
		tileChildren := make([]api.Component, 0, len(inputs))
		for _, entry := range inputs {
			tile, err := buildParticipantTile(entry)
			if err != nil {
				return err
			}
			tileChildren = append(tileChildren, tile)
			audioInputs = append(audioInputs, api.AudioSceneInput{InputId: entry.InputID})
		}
		bgColor := api.RGBAColor("#000000FF")
		ratio := api.AspectRatio("16:9")
		if err := videoRoot.FromTiles(api.Tiles{
			Children:        &tileChildren,
			BackgroundColor: &bgColor,
			TileAspectRatio: &ratio,
		}); err != nil {
			return fmt.Errorf("build tiles component: %w", err)
		}
	}

	req := api.UpdateOutputRequest{
		Video: &api.VideoScene{Root: videoRoot},
		Audio: &api.AudioScene{Inputs: audioInputs},
	}
	resp, err := cl.UpdateOutputWithResponse(context.Background(), compositionID, outputID, req)
	if err != nil {
		return fmt.Errorf("update output: %w", err)
	}
	if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
		return fmt.Errorf("update output: unexpected status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	return nil
}

// buildParticipantTile creates a Rescaler containing a View with the input stream
// and an optional name label overlay at the bottom.
func buildParticipantTile(entry InputEntry) (api.Component, error) {
	// InputStream
	var inputStream api.Component
	if err := inputStream.FromInputStream(api.InputStream{
		InputId: entry.InputID,
	}); err != nil {
		return api.Component{}, fmt.Errorf("build input stream: %w", err)
	}

	viewChildren := []api.Component{inputStream}

	// Name label overlay (only if name is non-empty)
	if entry.PeerName != "" {
		var textComp api.Component
		fontSize := float32(24)
		textColor := api.RGBAColor("#FFFFFFFF")
		weight := api.TextWeightBold
		align := api.HorizontalAlignCenter
		labelWidth := float32(1280)
		if err := textComp.FromText(api.Text{
			Text:     entry.PeerName,
			FontSize: fontSize,
			Color:    &textColor,
			Weight:   &weight,
			Align:    &align,
			Width:    &labelWidth,
		}); err != nil {
			return api.Component{}, fmt.Errorf("build text component: %w", err)
		}

		labelChildren := []api.Component{textComp}
		labelBg := api.RGBAColor("#00000088")
		bottom := float32(0)
		left := float32(0)
		labelHeight := float32(40)
		var labelView api.Component
		if err := labelView.FromView(api.View{
			Children:        &labelChildren,
			Bottom:          &bottom,
			Left:            &left,
			Width:           &labelWidth,
			Height:          &labelHeight,
			BackgroundColor: &labelBg,
		}); err != nil {
			return api.Component{}, fmt.Errorf("build label view: %w", err)
		}

		viewChildren = append(viewChildren, labelView)
	}

	// Outer View wrapping input + label
	overflow := api.OverflowHidden
	viewWidth := float32(1280)
	viewHeight := float32(720)
	var outerView api.Component
	if err := outerView.FromView(api.View{
		Children: &viewChildren,
		Width:    &viewWidth,
		Height:   &viewHeight,
		Overflow: &overflow,
	}); err != nil {
		return api.Component{}, fmt.Errorf("build outer view: %w", err)
	}

	// Rescaler
	mode := api.RescaleModeFit
	var rescaler api.Component
	if err := rescaler.FromRescaler(api.Rescaler{
		Child: outerView,
		Mode:  &mode,
	}); err != nil {
		return api.Component{}, fmt.Errorf("build rescaler: %w", err)
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
