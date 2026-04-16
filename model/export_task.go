package model

import (
	"gorm.io/gorm"
)

const (
	ExportTaskStatusQueued     = 0
	ExportTaskStatusProcessing = 1
	ExportTaskStatusCompleted  = 2
	ExportTaskStatusFailed     = 3
)

type ExportTask struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"index"`
	Username     string `json:"username" gorm:"index;default:''"`
	Type         int    `json:"type" gorm:"default:2"`          // log type: 0=all, 1=topup, 2=consume, etc.
	Status       int    `json:"status" gorm:"default:0;index"`  // 0=queued, 1=processing, 2=completed, 3=failed
	Progress     int    `json:"progress" gorm:"default:0"`      // 0-100
	Params       string `json:"params" gorm:"type:text"`        // JSON: filters
	FilePath     string `json:"-" gorm:"default:''"`            // server file path, hidden from API
	FileName     string `json:"file_name" gorm:"default:''"`    // download file name
	FileSize     int64  `json:"file_size" gorm:"default:0"`
	RecordCount  int    `json:"record_count" gorm:"default:0"`
	ErrorMessage string `json:"error_message" gorm:"type:text"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index"`
	CompletedAt  int64  `json:"completed_at" gorm:"bigint"`
}

type ExportTaskParams struct {
	StartTimestamp int64  `json:"start_timestamp"`
	EndTimestamp   int64  `json:"end_timestamp"`
	TargetUserId   int    `json:"target_user_id"`
	TargetUsername string `json:"target_username"`
	ModelName      string `json:"model_name"`
	TokenName      string `json:"token_name"`
	Group          string `json:"group"`
}

func CreateExportTask(task *ExportTask) error {
	return DB.Create(task).Error
}

func GetExportTaskById(id int) (*ExportTask, error) {
	var task ExportTask
	err := DB.Where("id = ?", id).First(&task).Error
	return &task, err
}

func GetExportTasksByUserId(userId int, startIdx int, num int) ([]*ExportTask, int64, error) {
	var tasks []*ExportTask
	var total int64
	tx := DB.Where("user_id = ?", userId)
	err := tx.Model(&ExportTask{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
	return tasks, total, err
}

func GetAllExportTasks(startIdx int, num int) ([]*ExportTask, int64, error) {
	var tasks []*ExportTask
	var total int64
	err := DB.Model(&ExportTask{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = DB.Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
	return tasks, total, err
}

func UpdateExportTask(id int, updates map[string]interface{}) error {
	return DB.Model(&ExportTask{}).Where("id = ?", id).Updates(updates).Error
}

func DeleteExportTask(id int) error {
	return DB.Where("id = ?", id).Delete(&ExportTask{}).Error
}

func CountUserPendingExportTasks(userId int) (int64, error) {
	var count int64
	err := DB.Model(&ExportTask{}).Where("user_id = ? AND status IN ?", userId, []int{ExportTaskStatusQueued, ExportTaskStatusProcessing}).Count(&count).Error
	return count, err
}

func GetExpiredExportTasks(beforeTimestamp int64) ([]*ExportTask, error) {
	var tasks []*ExportTask
	err := DB.Where("status = ? AND completed_at > 0 AND completed_at < ?", ExportTaskStatusCompleted, beforeTimestamp).Find(&tasks).Error
	return tasks, err
}

func GetLogsBatch(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, offset int, limit int, group string, userId int) ([]*Log, error) {
	var tx *gorm.DB
	if userId > 0 {
		if logType == LogTypeUnknown {
			tx = LOG_DB.Where("user_id = ?", userId)
		} else {
			tx = LOG_DB.Where("user_id = ? AND type = ?", userId, logType)
		}
	} else {
		if logType == LogTypeUnknown {
			tx = LOG_DB.Model(&Log{})
		} else {
			tx = LOG_DB.Where("type = ?", logType)
		}
	}

	if modelName != "" {
		tx = tx.Where("model_name LIKE ?", modelName+"%")
	}
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if group != "" {
		tx = tx.Where(logGroupCol+" = ?", group)
	}

	var logs []*Log
	err := tx.Order("created_at asc").Limit(limit).Offset(offset).Find(&logs).Error
	return logs, err
}
