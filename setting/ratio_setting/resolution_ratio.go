package ratio_setting

// ResolutionRatios maps model name → resolution → billing multiplier.
// Base resolution (ratio=1.0) is the default; other resolutions scale the price.
// Used by task adaptors during billing and by the pricing API for display.
var ResolutionRatios = map[string]map[string]float64{
	// HUBAGI Vidu models – 720p is base, 1080p costs 2x
	"TC-vidu-q2": {
		"720p":  1,
		"1080p": 2,
	},
	"TC-vidu-q2-pro": {
		"720p":  1,
		"1080p": 2,
	},
	"TC-vidu-q2-turbo": {
		"720p":  1,
		"1080p": 2,
	},
	"TC-vidu-q3-pro": {
		"720p":  1,
		"1080p": 2,
	},
	"TC-vidu-q3-turbo": {
		"720p":  1,
		"1080p": 2,
	},
}

// GetModelResolutionRatios returns the resolution → ratio map for a given model.
// Returns nil if the model has no resolution-based pricing.
func GetModelResolutionRatios(model string) map[string]float64 {
	if ratios, ok := ResolutionRatios[model]; ok {
		return ratios
	}
	return nil
}
