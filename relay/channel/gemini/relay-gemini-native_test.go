package gemini

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReplaceJSONStringField(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		expected string
	}{
		{
			name:     "plain value",
			body:     `{"modelVersion":"gemini-3.7-flash","responseId":"x"}`,
			expected: `{"modelVersion":"gemini-3.5-flash","responseId":"x"}`,
		},
		{
			name:     "empty value",
			body:     `{"modelVersion":"","responseId":"x"}`,
			expected: `{"modelVersion":"gemini-3.5-flash","responseId":"x"}`,
		},
		{
			name:     "whitespace around colon",
			body:     "{\"modelVersion\" : \"gemini-3.7-flash\"}",
			expected: "{\"modelVersion\" : \"gemini-3.5-flash\"}",
		},
		{
			name:     "value already correct",
			body:     `{"modelVersion":"gemini-3.5-flash"}`,
			expected: `{"modelVersion":"gemini-3.5-flash"}`,
		},
		{
			name:     "field absent",
			body:     `{"responseId":"x"}`,
			expected: `{"responseId":"x"}`,
		},
		{
			name:     "only the first occurrence is rewritten",
			body:     `{"modelVersion":"a","nested":{"modelVersion":"b"}}`,
			expected: `{"modelVersion":"gemini-3.5-flash","nested":{"modelVersion":"b"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, string(replaceJSONStringField([]byte(tt.body), "modelVersion", "gemini-3.5-flash")))
		})
	}
}
