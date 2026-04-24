package operation_setting

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

type BillingSetting struct {
	// 无输出不扣费的模型列表（逗号分隔，支持 * 通配符前缀匹配，例如 "gemini-*-image-*,gpt-image-*"）
	NoOutputNoBillingModels string `json:"no_output_no_billing_models"`
	// 任务按次计费模型列表（逗号分隔，支持 * 通配符，例如 "sora-*,veo-*"）
	// 列表中的模型提交视频任务时跳过 OtherRatios（时长、分辨率）乘算，仅按模型固定价格计费
	TaskPerCallBillingModels string `json:"task_per_call_billing_models"`
	// 图片生成政策拦截时返回给下游的自定义提示消息；留空则禁用此功能（保持原有行为）
	ImagePolicyBlockMessage string `json:"image_policy_block_message"`
	// 图片生成政策拦截时返回给下游的 HTTP 状态码；0 表示使用默认值 400
	ImagePolicyBlockStatusCode int `json:"image_policy_block_status_code"`
}

var billingSetting = BillingSetting{
	NoOutputNoBillingModels:    "",
	TaskPerCallBillingModels:   "",
	ImagePolicyBlockMessage:    "",
	ImagePolicyBlockStatusCode: 0,
}

// 缓存解析后的模型列表
var (
	parsedNoOutputModels []string
	parsedModelsMu       sync.RWMutex
	lastParsedValue      string

	parsedTaskPerCallModels []string
	parsedTaskPerCallMu     sync.RWMutex
	lastTaskPerCallValue    string
)

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

func GetBillingSetting() *BillingSetting {
	return &billingSetting
}

// GetImagePolicyBlockMessage 返回图片生成政策拦截时向下游发送的自定义提示消息。
// 返回空字符串表示功能未启用。
func GetImagePolicyBlockMessage() string {
	return billingSetting.ImagePolicyBlockMessage
}

// GetImagePolicyBlockStatusCode 返回图片生成政策拦截时的 HTTP 状态码。
// 若未配置（值为 0）则返回默认值 400。
func GetImagePolicyBlockStatusCode() int {
	code := billingSetting.ImagePolicyBlockStatusCode
	if code == 0 {
		return 400
	}
	return code
}

// IsNoOutputNoBillingModel 检查指定模型是否在「无输出不扣费」列表中
func IsNoOutputNoBillingModel(modelName string) bool {
	raw := billingSetting.NoOutputNoBillingModels
	if raw == "" {
		return false
	}

	patterns := getParsedNoOutputModels(raw)
	modelLower := strings.ToLower(modelName)

	for _, pattern := range patterns {
		if matchPattern(modelLower, pattern) {
			return true
		}
	}
	return false
}

// getParsedNoOutputModels 懒解析并缓存模型列表
func getParsedNoOutputModels(raw string) []string {
	parsedModelsMu.RLock()
	if raw == lastParsedValue {
		result := parsedNoOutputModels
		parsedModelsMu.RUnlock()
		return result
	}
	parsedModelsMu.RUnlock()

	parsedModelsMu.Lock()
	defer parsedModelsMu.Unlock()

	// double check
	if raw == lastParsedValue {
		return parsedNoOutputModels
	}

	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, strings.ToLower(p))
		}
	}
	parsedNoOutputModels = result
	lastParsedValue = raw
	return result
}

// IsTaskPerCallBillingModel 检查指定模型是否在「任务按次计费」列表中（DB 配置）。
// 注意：调用方应同时检查 constant.TaskPricePatches（环境变量）以保持向后兼容。
func IsTaskPerCallBillingModel(modelName string) bool {
	raw := billingSetting.TaskPerCallBillingModels
	if raw == "" {
		return false
	}

	patterns := getParsedTaskPerCallModels(raw)
	modelLower := strings.ToLower(modelName)

	for _, pattern := range patterns {
		if matchPattern(modelLower, pattern) {
			return true
		}
	}
	return false
}

// getParsedTaskPerCallModels 懒解析并缓存按次计费模型列表
func getParsedTaskPerCallModels(raw string) []string {
	parsedTaskPerCallMu.RLock()
	if raw == lastTaskPerCallValue {
		result := parsedTaskPerCallModels
		parsedTaskPerCallMu.RUnlock()
		return result
	}
	parsedTaskPerCallMu.RUnlock()

	parsedTaskPerCallMu.Lock()
	defer parsedTaskPerCallMu.Unlock()

	// double check
	if raw == lastTaskPerCallValue {
		return parsedTaskPerCallModels
	}

	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, strings.ToLower(p))
		}
	}
	parsedTaskPerCallModels = result
	lastTaskPerCallValue = raw
	return result
}

// matchPattern 支持简单通配符匹配：
//   - "gemini-*" 匹配以 "gemini-" 开头的所有模型
//   - "*-image-*" 匹配包含 "-image-" 的所有模型（通过 strings.Contains 实现）
//   - "exact-model-name" 精确匹配
//   - 完整的 path.Match 风格通配符
func matchPattern(name, pattern string) bool {
	// 精确匹配
	if name == pattern {
		return true
	}

	// 如果没有通配符，只做精确匹配
	if !strings.Contains(pattern, "*") {
		return false
	}

	// 仅末尾通配符：prefix*
	if strings.HasSuffix(pattern, "*") && !strings.Contains(pattern[:len(pattern)-1], "*") {
		prefix := pattern[:len(pattern)-1]
		return strings.HasPrefix(name, prefix)
	}

	// 仅开头通配符：*suffix
	if strings.HasPrefix(pattern, "*") && !strings.Contains(pattern[1:], "*") {
		suffix := pattern[1:]
		return strings.HasSuffix(name, suffix)
	}

	// 两端通配符或中间通配符：*middle* 或 prefix*suffix
	parts := strings.Split(pattern, "*")
	// 过滤掉空的部分
	nonEmpty := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			nonEmpty = append(nonEmpty, p)
		}
	}

	// 所有非空部分必须按顺序出现在 name 中
	searchStart := 0
	for _, part := range nonEmpty {
		idx := strings.Index(name[searchStart:], part)
		if idx < 0 {
			return false
		}
		searchStart += idx + len(part)
	}

	// 如果 pattern 不以 * 开头，第一部分必须是前缀
	if !strings.HasPrefix(pattern, "*") && len(nonEmpty) > 0 {
		if !strings.HasPrefix(name, nonEmpty[0]) {
			return false
		}
	}

	// 如果 pattern 不以 * 结尾，最后一部分必须是后缀
	if !strings.HasSuffix(pattern, "*") && len(nonEmpty) > 0 {
		if !strings.HasSuffix(name, nonEmpty[len(nonEmpty)-1]) {
			return false
		}
	}

	return true
}
