package gemini

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func GeminiTextGenerationHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	// 读取响应体
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if common.DebugEnabled {
		println(string(responseBody))
	}

	// 解析为 Gemini 原生响应格式
	var geminiResponse dto.GeminiChatResponse
	err = common.Unmarshal(responseBody, &geminiResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if len(geminiResponse.Candidates) == 0 && geminiResponse.PromptFeedback != nil && geminiResponse.PromptFeedback.BlockReason != nil {
		common.SetContextKey(c, constant.ContextKeyAdminRejectReason, fmt.Sprintf("gemini_block_reason=%s", *geminiResponse.PromptFeedback.BlockReason))
	}

	// 审核拦截且无候选结果：使用零 usage，不扣费
	var usage dto.Usage
	if len(geminiResponse.Candidates) == 0 {
		usage = dto.Usage{}
	} else {
		// 计算使用量（基于 UsageMetadata）
		usage = buildUsageFromGeminiMetadata(geminiResponse.UsageMetadata, info.GetEstimatePromptTokens())
	}

	// 渠道级「生图空返视为错误」检测：仅对支持图片生成的模型生效
	if info.ChannelSetting.ImageEmptyResponseAsError &&
		model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) &&
		!nativeGeminiResponseHasImage(geminiResponse.Candidates) {
		common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "gemini_native_image_empty")
		msg := operation_setting.GetImagePolicyBlockMessage()
		if msg == "" {
			msg = "请求违反内容政策，图片生成被拦截"
		}
		statusCode := operation_setting.GetImagePolicyBlockStatusCode()
		return nil, types.NewOpenAIError(errors.New(msg), types.ErrorCodePromptBlocked, statusCode, types.ErrOptionWithSkipRetry())
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

	if common.DebugEnabled {
		println(string(responseBody))
	}

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

	var hasImage bool
	usage, apiErr := geminiStreamHandler(c, info, resp, func(data string, geminiResponse *dto.GeminiChatResponse) bool {
		if !hasImage && nativeGeminiResponseHasImage(geminiResponse.Candidates) {
			hasImage = true
		}
		err := helper.StringData(c, data)
		if err != nil {
			logger.LogError(c, "failed to write stream data: "+err.Error())
			return false
		}
		info.SendResponseCount++
		return true
	})

	// 渠道级「生图空返视为错误」检测：流式场景数据已写出，返回 error 仅影响日志分类和计费（不扣费）
	if apiErr == nil &&
		info.ChannelSetting.ImageEmptyResponseAsError &&
		model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) &&
		!hasImage {
		common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "gemini_native_image_empty")
		msg := operation_setting.GetImagePolicyBlockMessage()
		if msg == "" {
			msg = "请求违反内容政策，图片生成被拦截"
		}
		statusCode := operation_setting.GetImagePolicyBlockStatusCode()
		return nil, types.NewOpenAIError(errors.New(msg), types.ErrorCodePromptBlocked, statusCode, types.ErrOptionWithSkipRetry())
	}

	return usage, apiErr
}

// nativeGeminiResponseHasImage 检查 candidates 中是否含有至少一个图片 inline_data part。
func nativeGeminiResponseHasImage(candidates []dto.GeminiChatCandidate) bool {
	for i := range candidates {
		for j := range candidates[i].Content.Parts {
			p := &candidates[i].Content.Parts[j]
			if p.InlineData != nil && strings.HasPrefix(p.InlineData.MimeType, "image/") {
				return true
			}
		}
	}
	return false
}
