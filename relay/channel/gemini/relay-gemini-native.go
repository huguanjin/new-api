package gemini

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

// replaceJSONStringField rewrites a string field of a flat JSON object, leaving
// every other byte untouched. It returns body unchanged when the field is absent
// or already holds newValue.
//
// The native Gemini path forwards upstream bytes verbatim, so the replacement is
// done in place: a round trip through the response DTO would drop fields the DTO
// does not model.
func replaceJSONStringField(body []byte, key string, newValue string) []byte {
	prefix := []byte("\"" + key + "\":\"")
	keyAt := bytes.Index(body, prefix)
	if keyAt < 0 {
		return body
	}
	start := keyAt + len(prefix)
	end := bytes.IndexByte(body[start:], '"')
	if end < 0 || string(body[start:start+end]) == newValue {
		return body
	}
	replaced := make([]byte, 0, len(body))
	replaced = append(replaced, body[:start]...)
	replaced = append(replaced, newValue...)
	return append(replaced, body[start+end:]...)
}

func GeminiTextGenerationHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	// 读取响应体
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	logger.LogDebug(c, "Gemini native response body: %s", responseBody)

	// 解析为 Gemini 原生响应格式
	var geminiResponse dto.GeminiChatResponse
	err = common.Unmarshal(responseBody, &geminiResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if len(geminiResponse.Candidates) == 0 && geminiResponse.PromptFeedback != nil && geminiResponse.PromptFeedback.BlockReason != nil {
		common.SetContextKey(c, constant.ContextKeyAdminRejectReason, fmt.Sprintf("gemini_block_reason=%s", *geminiResponse.PromptFeedback.BlockReason))
	}

	if info.ChannelSetting.GeminiFilteredImageAsError &&
		model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		hasContent := false
		var finishMsg string
		for _, cand := range geminiResponse.Candidates {
			if len(cand.Content.Parts) > 0 {
				hasContent = true
				break
			}
			if cand.FinishMessage != nil && *cand.FinishMessage != "" && finishMsg == "" {
				finishMsg = *cand.FinishMessage
			}
		}
		if !hasContent {
			if finishMsg == "" {
				finishMsg = "image generation blocked by Gemini API"
			}
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "gemini_filtered_image_response")
			newAPIError := types.NewOpenAIError(
				errors.New(finishMsg),
				types.ErrorCodeImageContentFiltered,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
			service.ResetStatusCode(newAPIError, c.GetString("status_code_mapping"))
			return nil, newAPIError
		}
	}

	// 计算使用量（优先上游 UsageMetadata，缺失时本地估算并保留 Gemini 计费语义）
	usage := buildUsageFromGeminiResponse(c, info, &geminiResponse)

	if info.ChannelSetting.GeminiModelVersionUseMappedModel &&
		bytes.Contains(responseBody, []byte(`"modelVersion"`)) {
		responseBody = replaceJSONStringField(responseBody, "modelVersion", info.UpstreamModelName)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	return &usage, nil
}

func NativeGeminiEmbeddingHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	logger.LogDebug(c, "Gemini native embedding response body: %s", responseBody)

	usage := service.ResponseText2Usage(c, "", info.UpstreamModelName, info.GetEstimatePromptTokens())

	if info.IsGeminiBatchEmbedding {
		var geminiResponse dto.GeminiBatchEmbeddingResponse
		err = common.Unmarshal(responseBody, &geminiResponse)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	} else {
		var geminiResponse dto.GeminiEmbeddingResponse
		err = common.Unmarshal(responseBody, &geminiResponse)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	return usage, nil
}

func GeminiTextGenerationStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	helper.SetEventStreamHeaders(c)

	return geminiStreamHandler(c, info, resp, func(data string, geminiResponse *dto.GeminiChatResponse) bool {
		if info.ChannelSetting.GeminiModelVersionUseMappedModel &&
			bytes.Contains([]byte(data), []byte(`"modelVersion"`)) {
			data = string(replaceJSONStringField([]byte(data), "modelVersion", info.UpstreamModelName))
		}
		err := helper.StringData(c, data)
		if err != nil {
			logger.LogError(c, "failed to write stream data: "+err.Error())
			return false
		}
		info.SendResponseCount++
		return true
	})
}
