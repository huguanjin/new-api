package gemini

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const filteredImageModel = "gemini-3.1-flash-image-preview"

func newFilteredImageResponseBody(t *testing.T, finishMessage string) []byte {
	t.Helper()

	payload := dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content:       dto.GeminiChatContent{},
				FinishMessage: &finishMessage,
			},
		},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount: 264,
			TotalTokenCount:  264,
		},
	}

	body, err := common.Marshal(payload)
	require.NoError(t, err)
	return body
}

func TestGeminiChatHandlerFilteredImageReturnsErrorAndSkipsBilling(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/"+filteredImageModel+":generateContent", nil)

	finishMessage := "Unable to show the generated image. The image was filtered out because it violated Google's Generative AI Prohibited Use policy."
	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatGemini,
		OriginModelName: filteredImageModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: filteredImageModel,
			ChannelSetting: dto.ChannelSettings{
				GeminiFilteredImageAsError: true,
			},
		},
	}

	resp := &http.Response{
		Body: io.NopCloser(bytes.NewReader(newFilteredImageResponseBody(t, finishMessage))),
	}

	usage, newAPIError := GeminiChatHandler(c, info, resp)
	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	assert.Equal(t, http.StatusBadRequest, newAPIError.StatusCode)
	assert.Equal(t, types.ErrorCodeImageContentFiltered, newAPIError.GetErrorCode())
	assert.Contains(t, newAPIError.Error(), finishMessage)
}

func TestGeminiChatHandlerFilteredImageDisabledSettingBillsAsUsual(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/"+filteredImageModel+":generateContent", nil)

	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatGemini,
		OriginModelName: filteredImageModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: filteredImageModel,
		},
		// GeminiFilteredImageAsError left false (default/off).
	}

	resp := &http.Response{
		Body: io.NopCloser(bytes.NewReader(newFilteredImageResponseBody(t, "filtered"))),
	}

	usage, newAPIError := GeminiChatHandler(c, info, resp)
	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 264, usage.PromptTokens)
}

func TestGeminiChatHandlerFilteredImageNonImageModelBillsAsUsual(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-3-flash-preview:generateContent", nil)

	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatGemini,
		OriginModelName: "gemini-3-flash-preview",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-3-flash-preview",
			ChannelSetting: dto.ChannelSettings{
				GeminiFilteredImageAsError: true,
			},
		},
	}

	resp := &http.Response{
		Body: io.NopCloser(bytes.NewReader(newFilteredImageResponseBody(t, "filtered"))),
	}

	usage, newAPIError := GeminiChatHandler(c, info, resp)
	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 264, usage.PromptTokens)
}
