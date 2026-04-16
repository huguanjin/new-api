package dto

type CreateExportTaskRequest struct {
	Type           int    `json:"type"`            // log type: 0=all, 1=topup, 2=consume, etc.
	StartTimestamp int64  `json:"start_timestamp"` // required
	EndTimestamp   int64  `json:"end_timestamp"`   // required
	TargetUserId   int    `json:"target_user_id"`  // admin only, 0=all
	TargetUsername string `json:"target_username"` // admin only
	ModelName      string `json:"model_name"`
	TokenName      string `json:"token_name"`
	Group          string `json:"group"`
}
