package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type LogSetting struct{}

var logSetting = LogSetting{}

func init() {
	config.GlobalConfig.Register("log_setting", &logSetting)
}

func GetLogSetting() *LogSetting {
	return &logSetting
}
