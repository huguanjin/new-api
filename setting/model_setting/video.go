package model_setting

import "github.com/QuantumNous/new-api/setting/config"

type VideoProvider struct {
	Key             string   `json:"key"`
	Label           string   `json:"label"`
	Models          []string `json:"models"`
	Sizes           []string `json:"sizes,omitempty"`
	SecondsRange    []int    `json:"seconds_range,omitempty"`
	DefaultSeconds  int      `json:"default_seconds,omitempty"`
	AspectRatios    []string `json:"aspect_ratios,omitempty"`
	APIFormat       string   `json:"api_format,omitempty"`
	Endpoint        string   `json:"endpoint,omitempty"`
	SupportImages   bool     `json:"support_images,omitempty"`
	SupportExtend   bool     `json:"support_extend,omitempty"`
	UseOutputConfig bool     `json:"use_output_config,omitempty"`
}

type VideoSettings struct {
	Providers []VideoProvider `json:"providers"`
}

var defaultVideoSettings = VideoSettings{
	Providers: []VideoProvider{
		{
			Key:            "sora",
			Label:          "OpenAI Sora",
			Models:         []string{},
			Sizes:          []string{"1280x720", "720x1280", "1024x1792", "1792x1024"},
			SecondsRange:   []int{1, 20},
			DefaultSeconds: 5,
		},
		{
			Key:    "veo",
			Label:  "Google Veo",
			Models: []string{},
			Sizes:          []string{"1280x720", "720x1280"},
			SecondsRange:   []int{5, 8},
			DefaultSeconds: 8,
		},
		{
			Key:            "grok",
			Label:          "XAI Grok",
			Models:         []string{},
			Sizes:          []string{"1280x720", "720x1280", "1024x1024"},
			SecondsRange:   []int{5, 10},
			DefaultSeconds: 5,
			AspectRatios:   []string{"16:9", "9:16", "1:1"},
			SupportExtend:  true,
		},
		{
			Key:    "doubao",
			Label:  "字节跳动 豆包",
			Models: []string{},
			Sizes:          []string{"1280x720", "720x1280", "960x960"},
			SecondsRange:   []int{5, 10},
			DefaultSeconds: 5,
		},
		{
			Key:             "hailuo",
			Label:           "海螺AI",
			Models:          []string{},
			Sizes:           []string{"768P", "1080P"},
			SecondsRange:    []int{6, 10},
			DefaultSeconds:  6,
			APIFormat:       "json",
			Endpoint:        "/v1/videos",
			SupportImages:   true,
			UseOutputConfig: true,
		},
		{
			Key:    "kling",
			Label:  "可灵 Kling",
			Models: []string{},
			Sizes:           []string{"720P", "1080P"},
			SecondsRange:    []int{5, 10},
			DefaultSeconds:  5,
			AspectRatios:    []string{"16:9", "9:16", "1:1"},
			APIFormat:       "json",
			Endpoint:        "/v1/videos",
			SupportImages:   true,
			UseOutputConfig: true,
		},
		{
			Key:             "gv",
			Label:           "GV",
			Models:          []string{},
			SecondsRange:    []int{8, 8},
			DefaultSeconds:  8,
			AspectRatios:    []string{"16:9", "9:16", "1:1"},
			APIFormat:       "json",
			Endpoint:        "/v1/videos",
			SupportImages:   true,
			UseOutputConfig: true,
		},
		{
			Key:             "os",
			Label:           "OS",
			Models:          []string{},
			SecondsRange:    []int{4, 12},
			DefaultSeconds:  8,
			APIFormat:       "json",
			Endpoint:        "/v1/videos",
			SupportImages:   true,
			UseOutputConfig: true,
		},
		{
			Key:             "hunyuan",
			Label:           "混元 Hunyuan",
			Models:          []string{},
			Sizes:           []string{"720P", "1080P"},
			APIFormat:       "json",
			Endpoint:        "/v1/videos",
			SupportImages:   true,
			UseOutputConfig: true,
		},
		{
			Key:             "mingmou",
			Label:           "明眸 Mingmou",
			Models:          []string{},
			Sizes:           []string{"720P", "1080P"},
			APIFormat:       "json",
			Endpoint:        "/v1/videos",
			SupportImages:   true,
			UseOutputConfig: true,
		},
		{
			Key:            "vidu",
			Label:          "Vidu",
			Models:         []string{},
			Sizes:          []string{"720p", "1080p"},
			SecondsRange:   []int{1, 10},
			DefaultSeconds: 5,
			AspectRatios:   []string{"16:9", "9:16", "1:1", "3:4", "4:3"},
			APIFormat:      "json",
			Endpoint:       "/v1/video/generations",
			SupportImages:  true,
		},
	},
}

var videoSettings = defaultVideoSettings

func init() {
	config.GlobalConfig.Register("video", &videoSettings)
}

func GetVideoSettings() *VideoSettings {
	return &videoSettings
}
