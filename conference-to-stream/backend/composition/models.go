package composition

import (
	"encoding/json"
	"fmt"
)

// Common Types
type CompositionId = string
type ComponentId = string
type InputId = string
type OutputId = string
type RGBAColor string
type AspectRatio string

type Resolution struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

// Enums
type AudioChannels string

const (
	Mono   AudioChannels = "mono"
	Stereo AudioChannels = "stereo"
)

type AudioMixingStrategy string

const (
	SumClip  AudioMixingStrategy = "sum_clip"
	SumScale AudioMixingStrategy = "sum_scale"
)

type RescaleMode string

const (
	RescaleModeFit  RescaleMode = "fit"
	RescaleModeFill RescaleMode = "fill"
)

type HorizontalAlign string

const (
	HorizontalAlignLeft      HorizontalAlign = "left"
	HorizontalAlignRight     HorizontalAlign = "right"
	HorizontalAlignJustified HorizontalAlign = "justified"
	HorizontalAlignCenter   HorizontalAlign = "center"
)

type VerticalAlign string

const (
	VerticalAlignTop       VerticalAlign = "top"
	VerticalAlignCenter    VerticalAlign = "center"
	VerticalAlignBottom    VerticalAlign = "bottom"
	VerticalAlignJustified VerticalAlign = "justified"
)

type Overflow string

const (
	OverflowVisible Overflow = "visible"
	OverflowHidden  Overflow = "hidden"
	OverflowFit     Overflow = "fit"
)

type TextWeight string

const (
	TextWeightThin       TextWeight = "thin"
	TextWeightExtraLight TextWeight = "extra_light"
	TextWeightLight      TextWeight = "light"
	TextWeightNormal     TextWeight = "normal"
	TextWeightMedium     TextWeight = "medium"
	TextWeightSemiBold   TextWeight = "semi_bold"
	TextWeightBold       TextWeight = "bold"
	TextWeightExtraBold  TextWeight = "extra_bold"
	TextWeightBlack      TextWeight = "black"
)

type TextStyle string

const (
	TextStyleNormal  TextStyle = "normal"
	TextStyleItalic  TextStyle = "italic"
	TextStyleOblique TextStyle = "oblique"
)

type TextWrapMode string

const (
	TextWrapModeNone  TextWrapMode = "none"
	TextWrapModeGlyph TextWrapMode = "glyph"
	TextWrapModeWord  TextWrapMode = "word"
)

// API Requests & Responses
type CreateCompositionRequest struct {
	Autostart *bool `json:"autostart,omitempty"`
}

type CompositionCreatedResponse struct {
	CompositionId CompositionId `json:"composition_id"`
	ApiUrl        string        `json:"api_url"`
}

// Scenes
type AudioScene struct {
	Inputs []AudioSceneInput `json:"inputs"`
}

type AudioSceneInput struct {
	InputId InputId  `json:"input_id"`
	Volume  *float32 `json:"volume,omitempty"`
}

type VideoScene struct {
	Root Component `json:"root"`
}

// Components
type Component struct {
	Type            string      `json:"type"`
	InputStream     *InputStream `json:"-"`
	View            *View        `json:"-"`
	Text            *Text        `json:"-"`
	Tiles           *Tiles       `json:"-"`
	Rescaler        *Rescaler    `json:"-"`
}

func (c Component) MarshalJSON() ([]byte, error) {
	var data interface{}
	switch c.Type {
	case "input_stream":
		data = c.InputStream
	case "view":
		data = c.View
	case "text":
		data = c.Text
	case "tiles":
		data = c.Tiles
	case "rescaler":
		data = c.Rescaler
	default:
		return nil, fmt.Errorf("unknown component type: %s", c.Type)
	}

	b, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, err
	}
	m["type"] = c.Type
	return json.Marshal(m)
}

func (c *Component) UnmarshalJSON(data []byte) error {
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	t, ok := m["type"].(string)
	if !ok {
		return fmt.Errorf("missing component type")
	}
	c.Type = t
	switch t {
	case "input_stream":
		c.InputStream = &InputStream{}
		return json.Unmarshal(data, c.InputStream)
	case "view":
		c.View = &View{}
		return json.Unmarshal(data, c.View)
	case "text":
		c.Text = &Text{}
		return json.Unmarshal(data, c.Text)
	case "tiles":
		c.Tiles = &Tiles{}
		return json.Unmarshal(data, c.Tiles)
	case "rescaler":
		c.Rescaler = &Rescaler{}
		return json.Unmarshal(data, c.Rescaler)
	}
	return nil
}

func (c *Component) FromInputStream(v InputStream) error {
	c.Type = "input_stream"
	c.InputStream = &v
	return nil
}

func (c *Component) FromView(v View) error {
	c.Type = "view"
	c.View = &v
	return nil
}

func (c *Component) FromText(v Text) error {
	c.Type = "text"
	c.Text = &v
	return nil
}

func (c *Component) FromTiles(v Tiles) error {
	c.Type = "tiles"
	c.Tiles = &v
	return nil
}

func (c *Component) FromRescaler(v Rescaler) error {
	c.Type = "rescaler"
	c.Rescaler = &v
	return nil
}

type InputStream struct {
	Id      *ComponentId `json:"id,omitempty"`
	InputId InputId      `json:"input_id"`
}

type View struct {
	Id              *ComponentId     `json:"id,omitempty"`
	Children        *[]Component     `json:"children,omitempty"`
	Width           *float32         `json:"width,omitempty"`
	Height          *float32         `json:"height,omitempty"`
	Top             *float32         `json:"top,omitempty"`
	Left            *float32         `json:"left,omitempty"`
	Bottom          *float32         `json:"bottom,omitempty"`
	Right           *float32         `json:"right,omitempty"`
	Rotation        *float32         `json:"rotation,omitempty"`
	BackgroundColor *RGBAColor       `json:"background_color,omitempty"`
	Overflow        *Overflow        `json:"overflow,omitempty"`
	BorderRadius    *float32         `json:"border_radius,omitempty"`
	BorderWidth     *float32         `json:"border_width,omitempty"`
	BorderColor     *RGBAColor       `json:"border_color,omitempty"`
	Padding         *float32         `json:"padding,omitempty"`
}

type Text struct {
	Id              *ComponentId     `json:"id,omitempty"`
	Text            string           `json:"text"`
	FontSize        float32          `json:"font_size"`
	LineHeight      *float32         `json:"line_height,omitempty"`
	Color           *RGBAColor       `json:"color,omitempty"`
	BackgroundColor *RGBAColor       `json:"background_color,omitempty"`
	FontFamily      *string          `json:"font_family,omitempty"`
	Style           *TextStyle       `json:"style,omitempty"`
	Weight          *TextWeight      `json:"weight,omitempty"`
	Align           *HorizontalAlign `json:"align,omitempty"`
	Width           *float32         `json:"width,omitempty"`
	Height          *float32         `json:"height,omitempty"`
}

type Tiles struct {
	Id              *ComponentId     `json:"id,omitempty"`
	Children        *[]Component     `json:"children,omitempty"`
	Width           *float32         `json:"width,omitempty"`
	Height          *float32         `json:"height,omitempty"`
	BackgroundColor *RGBAColor       `json:"background_color,omitempty"`
	TileAspectRatio *AspectRatio     `json:"tile_aspect_ratio,omitempty"`
	Margin          *float32         `json:"margin,omitempty"`
	Padding         *float32         `json:"padding,omitempty"`
	HorizontalAlign *HorizontalAlign `json:"horizontal_align,omitempty"`
	VerticalAlign   *VerticalAlign   `json:"vertical_align,omitempty"`
}

type Rescaler struct {
	Id              *ComponentId     `json:"id,omitempty"`
	Child           Component        `json:"child"`
	Mode            *RescaleMode     `json:"mode,omitempty"`
	HorizontalAlign *HorizontalAlign `json:"horizontal_align,omitempty"`
	VerticalAlign   *VerticalAlign   `json:"vertical_align,omitempty"`
	Width           *float32         `json:"width,omitempty"`
	Height          *float32         `json:"height,omitempty"`
}

// Output Registration
type RegisterOutput struct {
	Type       string      `json:"type"`
	WhepOutput *WhepOutput `json:"-"`
}

func (r RegisterOutput) MarshalJSON() ([]byte, error) {
	var data interface{}
	switch r.Type {
	case "whep_server":
		data = r.WhepOutput
	default:
		return nil, fmt.Errorf("unknown register output type: %s", r.Type)
	}

	b, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, err
	}
	m["type"] = r.Type
	return json.Marshal(m)
}

func (r *RegisterOutput) FromWhepOutput(v WhepOutput) error {
	r.Type = "whep_server"
	r.WhepOutput = &v
	return nil
}

type OutputEndCondition struct {
	AnyOf     []InputId `json:"any_of,omitempty"`
	AllOf     []InputId `json:"all_of,omitempty"`
	AnyInput  *bool     `json:"any_input,omitempty"`
	AllInputs *bool     `json:"all_inputs,omitempty"`
}

type WhepOutput struct {
	Video *OutputWhepVideoOptions `json:"video,omitempty"`
	Audio *OutputWhepAudioOptions `json:"audio,omitempty"`
}

type OutputWhepVideoOptions struct {
	Resolution  Resolution          `json:"resolution"`
	Initial     VideoScene          `json:"initial"`
	SendEosWhen *OutputEndCondition `json:"send_eos_when,omitempty"`
}

type OutputWhepAudioOptions struct {
	MixingStrategy *AudioMixingStrategy     `json:"mixing_strategy,omitempty"`
	Channels       *AudioChannels           `json:"channels,omitempty"`
	Initial        AudioScene               `json:"initial"`
	Encoder        *WhepAudioEncoderOptions `json:"encoder,omitempty"`
	SendEosWhen    *OutputEndCondition      `json:"send_eos_when,omitempty"`
}

type WhepAudioEncoderOptions struct {
	Type string `json:"type"`
}

func (o *WhepAudioEncoderOptions) FromWhepAudioEncoderOptions0(v WhepAudioEncoderOptionsOpus) error {
	o.Type = "opus"
	return nil
}

type WhepAudioEncoderOptionsOpus struct {
	Type string `json:"type"`
}

const (
	WhepAudioEncoderOptions0TypeOpus = "opus"
)

type UpdateOutputRequest struct {
	Video *VideoScene `json:"video,omitempty"`
	Audio *AudioScene `json:"audio,omitempty"`
}
