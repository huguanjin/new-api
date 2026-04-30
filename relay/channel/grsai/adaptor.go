package grsai

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

// ── grsai request / response types ───────────────────────────────────────────

type drawRequest struct {
	Model        string   `json:"model"`
	Prompt       string   `json:"prompt"`
	AspectRatio  string   `json:"aspectRatio,omitempty"`
	Quality      string   `json:"quality,omitempty"`
	Urls         []string `json:"urls,omitempty"`
	ShutProgress bool     `json:"shutProgress"`
}

type drawResult struct {
	URL string `json:"url"`
}

type streamChunk struct {
	ID            string       `json:"id"`
	Progress      int          `json:"progress"`
	Results       []drawResult `json:"results"`
	Status        string       `json:"status"`
	FailureReason string       `json:"failure_reason"`
	Error         string       `json:"error"`
}

// ── Adaptor interface ─────────────────────────────────────────────────────────

func (a *Adaptor) Init(_ *relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	base := strings.TrimRight(info.ChannelBaseUrl, "/")
	return base + "/v1/draw/completions", nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	req.Set("Content-Type", "application/json")
	return nil
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	model := request.Model
	if model == "" {
		model = "gpt-image-2"
	}
	body := drawRequest{
		Model:        model,
		Prompt:       request.Prompt,
		AspectRatio:  convertSize(request.Size, model),
		Quality:      request.Quality,
		ShutProgress: false,
	}

	// Collect reference image URLs for grsai's urls[] field.
	// Supported for both generations (optional) and edits (required) modes.
	var imageURLs []string

	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		// Case 1 (edits only): multipart/form-data — read uploaded files as base64 data URIs
		mf := c.Request.MultipartForm
		if mf != nil && mf.File != nil {
			var fileHeaders []*multipart.FileHeader
			for _, key := range []string{"image", "image[]", "images"} {
				if fhs, ok := mf.File[key]; ok {
					fileHeaders = append(fileHeaders, fhs...)
				}
			}
			for fieldName, fhs := range mf.File {
				if strings.HasPrefix(fieldName, "image[") {
					fileHeaders = append(fileHeaders, fhs...)
				}
			}
			for _, fh := range fileHeaders {
				f, err := fh.Open()
				if err != nil {
					continue
				}
				data, readErr := io.ReadAll(f)
				_ = f.Close()
				if readErr != nil || len(data) == 0 {
					continue
				}
				mime := http.DetectContentType(data)
				b64 := base64.StdEncoding.EncodeToString(data)
				imageURLs = append(imageURLs, "data:"+mime+";base64,"+b64)
			}
		}
	}

	// Case 2: JSON body with extra "urls" field — applies to both generations and edits.
	// For generations: optional reference images sent as data URIs or HTTP URLs.
	// For edits: fallback when no multipart files were provided.
	if len(imageURLs) == 0 {
		if urlsRaw, ok := request.Extra["urls"]; ok {
			var urls []string
			if err := common.Unmarshal(urlsRaw, &urls); err == nil {
				imageURLs = urls
			}
		}
	}

	if info.RelayMode == relayconstant.RelayModeImagesEdits && len(imageURLs) == 0 {
		return nil, errors.New("image edit request requires at least one reference image (upload a file or pass urls[] in JSON body)")
	}
	if len(imageURLs) > 0 {
		body.Urls = imageURLs
	}

	return body, nil
}

// convertSize maps OpenAI pixel sizes to grsai ratio strings.
// If the value already looks like a ratio (contains ":"), pass it through.
// For gpt-image-2-vip, non-standard pixel sizes (e.g. "2048x2048") are passed
// through directly so the upstream can handle 2k+ resolutions.
func convertSize(size string, model string) string {
	if strings.Contains(size, ":") {
		return size
	}
	switch size {
	case "1024x1024", "512x512", "256x256":
		return "1:1"
	case "1792x1024", "1536x1024":
		return "3:2"
	case "1024x1792", "1024x1536":
		return "2:3"
	case "1280x720":
		return "16:9"
	case "720x1280":
		return "9:16"
	default:
		// For pixel-format sizes not in the standard map (e.g. "2048x2048"),
		// pass through directly — gpt-image-2-vip supports 2k+ pixel values.
		if strings.Contains(size, "x") {
			return size
		}
		return "auto"
	}
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

// DoResponse reads the grsai stream until status="succeeded" or "failed",
// then writes an OpenAI-compatible image response to the client.
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, apiErr *types.NewAPIError) {
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, types.NewOpenAIError(
			fmt.Errorf("image generation upstream error %d: %s", resp.StatusCode, string(body)),
			types.ErrorCodeInvalidRequest,
			resp.StatusCode,
		)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	var last streamChunk
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		if bytes.HasPrefix(line, []byte("data: ")) {
			line = bytes.TrimPrefix(line, []byte("data: "))
			line = bytes.TrimSpace(line)
		}
		if len(line) == 0 || bytes.Equal(line, []byte("[DONE]")) {
			continue
		}
		var chunk streamChunk
		if err := common.Unmarshal(line, &chunk); err != nil {
			continue
		}
		last = chunk
	}
	if err := scanner.Err(); err != nil {
		return nil, types.NewOpenAIError(
			fmt.Errorf("failed to read image generation stream: %w", err),
			types.ErrorCodeDoRequestFailed,
			http.StatusInternalServerError,
		)
	}

	if last.Status == "failed" || last.Status == "error" {
		// Log full details so admin can diagnose upstream issues.
		common.LogError(c.Request.Context(), fmt.Sprintf(
			"image generation upstream failure: status=%s failure_reason=%q error=%q",
			last.Status, last.FailureReason, last.Error,
		))
		var humanMsg string
		switch last.FailureReason {
		case "output_moderation":
			humanMsg = "image generation failed: output content violated moderation policy"
		case "input_moderation":
			humanMsg = "image generation failed: input prompt violated moderation policy"
		case "error":
			if last.Error != "" {
				humanMsg = "image generation failed: " + last.Error
			} else {
				humanMsg = "image generation failed: upstream error, please retry"
			}
		default:
			if last.FailureReason != "" {
				humanMsg = "image generation failed: " + last.FailureReason
			} else if last.Error != "" {
				humanMsg = "image generation failed: " + last.Error
			} else {
				humanMsg = "image generation failed"
			}
		}
		return nil, types.NewOpenAIError(
			fmt.Errorf("%s", humanMsg),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
		)
	}

	if (last.Status != "succeeded" && last.Status != "success") || len(last.Results) == 0 {
		return nil, types.NewOpenAIError(
			fmt.Errorf("image generation returned no results"),
			types.ErrorCodeDoRequestFailed,
			http.StatusInternalServerError,
		)
	}

	// Download each result image and return as b64_json (frontend requires base64)
	type imageItem struct {
		B64Json string `json:"b64_json"`
	}
	type imageResponse struct {
		Created int64       `json:"created"`
		Data    []imageItem `json:"data"`
	}
	items := make([]imageItem, 0, len(last.Results))
	for _, r := range last.Results {
		if r.URL == "" {
			continue
		}
		_, b64, err := service.GetImageFromUrl(r.URL)
		if err != nil {
			common.LogError(c.Request.Context(), fmt.Sprintf("image generation: failed to download result image: %v", err))
			continue
		}
		items = append(items, imageItem{B64Json: b64})
	}
	if len(items) == 0 {
		return nil, types.NewOpenAIError(
			fmt.Errorf("image generation: failed to download any result images"),
			types.ErrorCodeDoRequestFailed,
			http.StatusInternalServerError,
		)
	}

	info.SetFirstResponseTime()
	c.JSON(http.StatusOK, imageResponse{
		Created: time.Now().Unix(),
		Data:    items,
	})

	// Estimate token counts for log display (upstream never returns token usage).
	// Input:  rough character-to-token ratio (1 token ≈ 4 chars) from the prompt text.
	// Output: per-image token count derived from requested size (based on OpenAI gpt-image-2 pricing).
	promptTokens := 0
	outputTokensPerImage := imageSizeTokens("") // default
	if imageReq, ok := info.Request.(*dto.ImageRequest); ok && imageReq != nil {
		promptTokens = (len(imageReq.Prompt) + 3) / 4
		if promptTokens < 1 {
			promptTokens = 1
		}
		outputTokensPerImage = imageSizeTokens(imageReq.Size)
	}
	completionTokens := len(items) * outputTokensPerImage

	return &dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      promptTokens + completionTokens,
	}, nil
}

// ── Unsupported methods ───────────────────────────────────────────────────────

func (a *Adaptor) ConvertOpenAIRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("this channel only supports image generation, please use POST /v1/images/generations instead of /v1/chat/completions")
}

func (a *Adaptor) ConvertAudioRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not available")
}

func (a *Adaptor) ConvertEmbeddingRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not available")
}

// imageSizeTokens returns the estimated output token count per generated image
// based on the requested size, following OpenAI gpt-image-2 pricing tiers.
// size may be an OpenAI pixel string ("1024x1024") or a grsai ratio ("1:1").
func imageSizeTokens(size string) int {
	switch size {
	// square
	case "256x256":
		return 258
	case "512x512":
		return 522
	case "1024x1024", "1:1", "auto", "":
		return 1056
	// landscape / portrait (1.5× ratio)
	case "1536x1024", "1792x1024", "3:2", "16:9":
		return 1584
	case "1024x1536", "1024x1792", "2:3", "9:16":
		return 1584
	default:
		return 1056
	}
}

func (a *Adaptor) ConvertRerankRequest(_ *gin.Context, _ int, _ dto.RerankRequest) (any, error) {
	return nil, errors.New("not available")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not available")
}

func (a *Adaptor) ConvertClaudeRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not available")
}

func (a *Adaptor) ConvertGeminiRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not available")
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
