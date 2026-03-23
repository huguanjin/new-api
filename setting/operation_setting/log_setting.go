package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type LogSetting struct {
	// HideUpstreamModel 开启后，普通用户的使用日志中不展示上游（实际）模型名称
	HideUpstreamModel bool `json:"hide_upstream_model"`
}

var logSetting = LogSetting{
	HideUpstreamModel: false,
}

func init() {
	config.GlobalConfig.Register("log_setting", &logSetting)
}

func GetLogSetting() *LogSetting {
	return &logSetting
}
