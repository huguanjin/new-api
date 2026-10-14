package model_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiSafetySettingsReadNormalization(t *testing.T) {
	original := geminiSettings.SafetySettings
	t.Cleanup(func() {
		geminiSettings.SafetySettings = original
	})

	tests := []struct {
		name     string
		settings map[string]string
		key      string
		want     string
	}{
		{
			name:     "nil map gets OFF default",
			settings: nil,
			key:      "HARM_CATEGORY_HATE_SPEECH",
			want:     "OFF",
		},
		{
			name: "missing default gets OFF without replacing existing values",
			settings: map[string]string{
				"HARM_CATEGORY_HATE_SPEECH": "BLOCK_SOME",
			},
			key:  "HARM_CATEGORY_HATE_SPEECH",
			want: "BLOCK_SOME",
		},
		{
			name: "empty default gets OFF",
			settings: map[string]string{
				"default": "",
			},
			key:  "HARM_CATEGORY_HATE_SPEECH",
			want: "OFF",
		},
		{
			name: "empty override falls back to configured default",
			settings: map[string]string{
				"default":                   "BLOCK_ONLY_HIGH",
				"HARM_CATEGORY_HATE_SPEECH": "",
			},
			key:  "HARM_CATEGORY_HATE_SPEECH",
			want: "BLOCK_ONLY_HIGH",
		},
		{
			name: "historical invalid nonempty default is preserved",
			settings: map[string]string{
				"default": "BLOCK_SOME",
			},
			key:  "HARM_CATEGORY_HATE_SPEECH",
			want: "BLOCK_SOME",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			geminiSettings.SafetySettings = test.settings

			assert.Equal(t, test.want, GetGeminiSafetySetting(test.key))
		})
	}
}

func TestValidateGeminiSafetySettings(t *testing.T) {
	valid := []string{
		`{}`,
		`{"default":""}`,
		`{"HARM_CATEGORY_HATE_SPEECH":""}`,
		`{"default":"OFF"}`,
		`{"default":"BLOCK_NONE"}`,
		`{"default":"BLOCK_ONLY_HIGH"}`,
		`{"default":"BLOCK_MEDIUM_AND_ABOVE"}`,
		`{"default":"BLOCK_LOW_AND_ABOVE"}`,
		`{"default":"HARM_BLOCK_THRESHOLD_UNSPECIFIED"}`,
	}
	for _, value := range valid {
		require.NoError(t, ValidateGeminiSafetySettings(value), value)
	}

	invalid := []string{
		`null`,
		`[]`,
		`{"default":1}`,
		`{"default":"BLOCK_SOME"}`,
		`{"default":" off "}`,
		`{"default":`,
	}
	for _, value := range invalid {
		assert.Error(t, ValidateGeminiSafetySettings(value), value)
	}
}

// TestGeminiModelVersionRoundTrip pins the persisted option key of the global
// modelVersion switch. The key is a contract with the admin UI, which writes and
// reads the literal "gemini.model_version_use_requested_model_enabled": neither
// the Go build nor the frontend typecheck can detect a renamed json tag, and a
// mismatch would silently leave the switch unreadable at relay time.
func TestGeminiModelVersionRoundTrip(t *testing.T) {
	const optionKey = "gemini.model_version_use_requested_model_enabled"

	settings := &GeminiSettings{}
	manager := config.NewConfigManager()
	manager.Register("gemini", settings)

	settings.ModelVersionUseRequestedModelEnabled = true
	saved := make(map[string]string)
	require.NoError(t, manager.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	require.Equal(t, "true", saved[optionKey])

	// A fresh module reading the persisted map gets the switch back.
	reloaded := &GeminiSettings{}
	reloadManager := config.NewConfigManager()
	reloadManager.Register("gemini", reloaded)
	require.NoError(t, reloadManager.LoadFromDB(saved))
	assert.True(t, reloaded.ModelVersionUseRequestedModelEnabled)
}
