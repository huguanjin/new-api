package ratio_setting

import (
	"github.com/QuantumNous/new-api/types"
)

// defaultResolutionRatio maps model name → { resolution → billing multiplier }.
var defaultResolutionRatio = map[string]map[string]float64{
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

var resolutionRatioMap = types.NewRWMap[string, map[string]float64]()

func InitResolutionRatioSettings() {
	resolutionRatioMap.AddAll(defaultResolutionRatio)
}

func ResolutionRatio2JSONString() string {
	return resolutionRatioMap.MarshalJSONString()
}

func UpdateResolutionRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(resolutionRatioMap, jsonStr)
}

// GetModelResolutionRatios returns the resolution → ratio map for a given model.
// Returns nil if the model has no resolution-based pricing.
func GetModelResolutionRatios(model string) map[string]float64 {
	ratios, ok := resolutionRatioMap.Get(model)
	if !ok {
		return nil
	}
	return ratios
}

// GetAllResolutionRatios returns a copy of all resolution ratios.
func GetAllResolutionRatios() map[string]map[string]float64 {
	return resolutionRatioMap.ReadAll()
}
