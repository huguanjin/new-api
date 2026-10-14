package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
)

// TestFormatUserLogsStripsQuotaSaturation verifies the admin-only quota
// saturation marker (nested under other.admin_info) is removed for non-admin
// log views, since formatUserLogs strips the whole admin_info object.
func TestFormatUserLogsStripsQuotaSaturation(t *testing.T) {
	other := common.MapToJsonStr(map[string]interface{}{
		"model_price": 0.004,
		"admin_info": map[string]interface{}{
			"quota_saturation": map[string]interface{}{
				"op":      "QuotaFromDecimal",
				"kind":    "overflow",
				"clamped": common.MaxQuota,
			},
		},
	})
	logs := []*Log{{Other: other}}

	formatUserLogs(logs, 0)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	_, hasAdminInfo := parsed["admin_info"]
	require.False(t, hasAdminInfo, "admin_info (and nested quota_saturation) must be stripped for non-admin views")
	// Non-admin billing fields remain visible.
	require.Contains(t, parsed, "model_price")
}

// TestFormatUserLogsStripsModelMapping verifies the model-mapping details a
// channel's redirect reveals (is_model_mapped / upstream_model_name) are removed
// for non-admin views, so a regular user cannot tell that the requested model was
// rewritten to a different upstream one.
func TestFormatUserLogsStripsModelMapping(t *testing.T) {
	other := common.MapToJsonStr(map[string]interface{}{
		"model_price":         0.004,
		"is_model_mapped":     true,
		"upstream_model_name": "gemini-3.8-flash",
	})
	logs := []*Log{{Other: other, ChannelName: "internal-channel"}}

	formatUserLogs(logs, 0)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	require.NotContains(t, parsed, "is_model_mapped")
	require.NotContains(t, parsed, "upstream_model_name")
	// Other fields remain visible.
	require.Contains(t, parsed, "model_price")
	require.Equal(t, "", logs[0].ChannelName, "internal channel name must be blanked for non-admin views")
}

// TestFormatChannelOwnerLogsStripsModelMapping verifies the reseller-scoped
// channel-owner view applies the same admin-only stripping as the self-scoped
// views, since a reseller is not an admin.
func TestFormatChannelOwnerLogsStripsModelMapping(t *testing.T) {
	other := common.MapToJsonStr(map[string]interface{}{
		"model_price":         0.004,
		"is_model_mapped":     true,
		"upstream_model_name": "gemini-3.8-flash",
		"admin_info":          map[string]interface{}{"use_channel": []string{"1"}},
	})
	logs := []*Log{{Other: other, ChannelName: "internal-channel"}}

	FormatChannelOwnerLogs(logs)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	require.NotContains(t, parsed, "is_model_mapped")
	require.NotContains(t, parsed, "upstream_model_name")
	require.NotContains(t, parsed, "admin_info")
	require.Contains(t, parsed, "model_price")
	require.Equal(t, "", logs[0].ChannelName)
}
