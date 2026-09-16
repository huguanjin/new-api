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

// modelVersionForResponse is the model name a client should see in the
// modelVersion field of a native Gemini response: the model it requested, not
// the upstream name the channel mapped it to.
func modelVersionForResponse(info *relaycommon.RelayInfo) string {
	if info.OriginModelName != "" {
		return info.OriginModelName
	}
	return info.UpstreamModelName
}

// replaceJSONStringField rewrites a string field of a flat JSON object, leaving
// every other byte untouched. It returns body unchanged when the field is absent
// or already holds newValue.
//
// The native Gemini path forwards upstream bytes verbatim, so the replacement is
// done in place: a round trip through the response DTO would drop fields the DTO
// does not model.
//
// Upstream providers serialize the same field differently — whitespace around the
// colon, an empty value, or a nested object whose quotes arrive escaped — so the
// value is located structurally rather than by one exact byte prefix. Only the
// bytes between the quotes are substituted, which keeps the replacement valid
// inside an escaped fragment too.
func replaceJSONStringField(body []byte, key string, newValue string) []byte {
	start, end, ok := jsonStringFieldSpan(body, key)
	if !ok || string(body[start:end]) == newValue {
		return body
	}
	replaced := make([]byte, 0, len(body))
	replaced = append(replaced, body[:start]...)
	replaced = append(replaced, newValue...)
	return append(replaced, body[end:]...)
}

// jsonStringFieldSpan returns the byte range holding the value of key, without
// its surrounding quotes. A fragment whose quotes arrive escaped — the whole
// response nested inside a JSON string — is matched too, and the colon may carry
// whitespace on either side.
// jsonStringFieldSpan returns the byte range holding the value of key, excluding
// its surrounding quotes. The colon may carry whitespace on either side and the
// value may be empty, so the field is located structurally rather than by one
// exact byte prefix.
func jsonStringFieldSpan(body []byte, key string) (int, int, bool) {
	skipSpace := func(i int) int {
		for i < len(body) && (body[i] == ' ' || body[i] == '\t' || body[i] == '\n' || body[i] == '\r') {
			i++
		}
		return i
	}

	keyAt := bytes.Index(body, []byte(`"`+key+`"`))
	if keyAt < 0 {
		return 0, 0, false
	}
	i := skipSpace(keyAt + len(key) + 2)
	if i >= len(body) || body[i] != ':' {
		return 0, 0, false
	}
	i = skipSpace(i + 1)
	if i >= len(body) || body[i] != '"' {
		return 0, 0, false
	}
	start := i + 1
	for end := start; end < len(body); end++ {
		if body[end] != '"' {
			continue
		}
		backslashes := 0
		for j := end - 1; j >= start && body[j] == '\\'; j-- {
			backslashes++
		}
		if backslashes%2 == 1 {
			continue
		}
		return start, end, true
	}
	return 0, 0, false
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
		responseBody = replaceJSONStringField(responseBody, "modelVersion", modelVersionForResponse(info))
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

	loggedModelVersion := false
	return geminiStreamHandler(c, info, resp, func(data string, geminiResponse *dto.GeminiChatResponse) bool {
		if !loggedModelVersion {
			if start, end, ok := jsonStringFieldSpan([]byte(data), "modelVersion"); ok {
				loggedModelVersion = true
				logger.LogInfo(c, fmt.Sprintf("modelVersion rewrite: channel_id=%d, channel_type=%d, relay_mode=%d, is_stream=%v, switch=%v, is_model_mapped=%v, origin_model_name=%q, upstream_model_name=%q, upstream_model_version=%q",
					info.ChannelId, info.ChannelType, info.RelayMode, info.IsStream,
					info.ChannelSetting.GeminiModelVersionUseMappedModel, info.IsModelMapped,
					info.OriginModelName, info.UpstreamModelName, string([]byte(data)[start:end])))
			}
		}
		if info.ChannelSetting.GeminiModelVersionUseMappedModel {
			data = string(replaceJSONStringField([]byte(data), "modelVersion", modelVersionForResponse(info)))
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
