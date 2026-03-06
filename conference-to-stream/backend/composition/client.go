package composition

import (
	"context"
	"fmt"
	"net/http"

	api "conference-to-stream/composition/generated"
)

// Client wraps the generated composition API client.
type Client struct {
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{httpClient: &http.Client{}}
}

func (c *Client) newAPI(apiURL string) (*api.ClientWithResponses, error) {
	return api.NewClientWithResponses(apiURL, api.WithHTTPClient(c.httpClient))
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

// RegisterWhepOutput registers a WHEP server output on the composition.
func (c *Client) RegisterWhepOutput(apiURL, compositionID, outputID string) error {
	cl, err := c.newAPI(apiURL)
	if err != nil {
		return err
	}

	var videoEncoder api.WhepVideoEncoderOptions
	if err := videoEncoder.FromWhepVideoEncoderOptions0(api.WhepVideoEncoderOptions0{
		Type: api.WhepVideoEncoderOptions0TypeFfmpegH264,
	}); err != nil {
		return fmt.Errorf("build video encoder: %w", err)
	}
	var initialVideoRoot api.Component
	if err := initialVideoRoot.FromComponent1(api.Component1{Type: api.Component1TypeView}); err != nil {
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
	if err := body.FromRegisterOutput4(api.RegisterOutput4{
		Type: api.WhepServer,
		Video: &api.OutputWhepVideoOptions{
			Encoder:    videoEncoder,
			Resolution: api.Resolution{Width: 1280, Height: 720},
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

// UpdateOutput updates a composition output with the given set of input stream IDs.
func (c *Client) UpdateOutput(apiURL, compositionID, outputID string, inputIDs []string) error {
	cl, err := c.newAPI(apiURL)
	if err != nil {
		return err
	}

	var videoRoot api.Component
	audioInputs := make([]api.AudioSceneInput, 0, len(inputIDs))

	if len(inputIDs) == 0 {
		if err := videoRoot.FromComponent1(api.Component1{Type: api.Component1TypeView}); err != nil {
			return fmt.Errorf("build video root: %w", err)
		}
	} else {
		children := make([]api.Component, 0, len(inputIDs))
		for _, id := range inputIDs {
			var child api.Component
			if err := child.FromComponent0(api.Component0{
				InputId: id,
				Type:    api.Component0TypeInputStream,
			}); err != nil {
				return fmt.Errorf("build child component: %w", err)
			}
			children = append(children, child)
			audioInputs = append(audioInputs, api.AudioSceneInput{InputId: id})
		}
		bgColor := api.RGBAColor("#000000FF")
		ratio := api.AspectRatio("16:9")
		if err := videoRoot.FromComponent3(api.Component3{
			Type:            api.Component3TypeTiles,
			Children:        &children,
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

// WhepURL returns the WHEP playback URL for the given output.
func (c *Client) WhepURL(apiURL, compositionID, outputID string) string {
	return fmt.Sprintf("%s/api/composition/%s/whep/%s", apiURL, compositionID, outputID)
}

// CompositionBaseURL returns the composition base URL used for track forwarding.
func (c *Client) CompositionBaseURL(apiURL, compositionID string) string {
	return fmt.Sprintf("%s/api/composition/%s", apiURL, compositionID)
}
