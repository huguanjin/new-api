package service

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

var exportStorageDir string

func InitExportStorageDir() {
	exportStorageDir = filepath.Join("data", "exports")
	if err := os.MkdirAll(exportStorageDir, 0750); err != nil {
		common.SysError("failed to create export storage directory: " + err.Error())
	}
}

const exportBatchSize = 1000
const maxExportRecords = 1000000

func ProcessExportTask(taskId int) {
	task, err := model.GetExportTaskById(taskId)
	if err != nil {
		common.SysError(fmt.Sprintf("export task %d not found: %v", taskId, err))
		return
	}

	// Update status to processing
	_ = model.UpdateExportTask(taskId, map[string]interface{}{
		"status":   model.ExportTaskStatusProcessing,
		"progress": 0,
	})

	// Parse params
	var params model.ExportTaskParams
	if task.Params != "" {
		if err := common.Unmarshal([]byte(task.Params), &params); err != nil {
			markExportFailed(taskId, "invalid params: "+err.Error())
			return
		}
	}

	// Determine target user
	userId := 0
	if params.TargetUserId > 0 {
		userId = params.TargetUserId
	} else if params.TargetUsername != "" {
		// Admin filtering by username: set username filter, userId stays 0 (all users)
		userId = 0
	} else if task.UserId > 0 {
		// Check if this is an admin user requesting all records
		user, err := model.GetUserById(task.UserId, false)
		if err != nil || user.Role < common.RoleAdminUser {
			userId = task.UserId // regular user, restrict to own data
		}
		// admin user with no target specified => userId = 0 (all)
	}

	// Create CSV file
	fileName := fmt.Sprintf("export_%d_%d.csv", taskId, time.Now().Unix())
	filePath := filepath.Join(exportStorageDir, fileName)

	file, err := os.Create(filePath)
	if err != nil {
		markExportFailed(taskId, "failed to create file: "+err.Error())
		return
	}
	defer file.Close()

	// Write UTF-8 BOM for Excel compatibility
	_, _ = file.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	header := []string{
		"ID", "时间", "用户名", "令牌名", "类型", "模型",
		"Prompt Tokens", "Completion Tokens", "额度",
		"耗时(秒)", "是否流式", "分组", "IP", "请求ID",
	}
	if err := writer.Write(header); err != nil {
		markExportFailed(taskId, "failed to write header: "+err.Error())
		return
	}

	offset := 0
	totalRecords := 0

	for {
		if totalRecords >= maxExportRecords {
			break
		}

		logs, err := model.GetLogsBatch(
			task.Type,
			params.StartTimestamp,
			params.EndTimestamp,
			params.ModelName,
			params.TargetUsername,
			params.TokenName,
			offset,
			exportBatchSize,
			params.Group,
			userId,
		)
		if err != nil {
			markExportFailed(taskId, "failed to query logs: "+err.Error())
			return
		}

		if len(logs) == 0 {
			break
		}

		for _, log := range logs {
			record := []string{
				strconv.Itoa(log.Id),
				time.Unix(log.CreatedAt, 0).Format("2006-01-02 15:04:05"),
				log.Username,
				log.TokenName,
				logTypeToString(log.Type),
				log.ModelName,
				strconv.Itoa(log.PromptTokens),
				strconv.Itoa(log.CompletionTokens),
				fmt.Sprintf("%.6f", float64(log.Quota)/common.QuotaPerUnit),
				strconv.Itoa(log.UseTime),
				strconv.FormatBool(log.IsStream),
				log.Group,
				log.Ip,
				log.RequestId,
			}
			if err := writer.Write(record); err != nil {
				markExportFailed(taskId, "failed to write record: "+err.Error())
				return
			}
			totalRecords++
		}

		offset += len(logs)

		// Update progress (estimate based on batch count, cap at 95%)
		progress := 95
		if totalRecords < maxExportRecords {
			progress = totalRecords * 95 / maxExportRecords
			if progress > 95 {
				progress = 95
			}
		}
		_ = model.UpdateExportTask(taskId, map[string]interface{}{
			"progress": progress,
		})

		if len(logs) < exportBatchSize {
			break
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		markExportFailed(taskId, "csv write error: "+err.Error())
		return
	}

	// Get file size
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		markExportFailed(taskId, "failed to stat file: "+err.Error())
		return
	}

	// Mark completed
	_ = model.UpdateExportTask(taskId, map[string]interface{}{
		"status":       model.ExportTaskStatusCompleted,
		"progress":     100,
		"file_path":    filePath,
		"file_name":    fileName,
		"file_size":    fileInfo.Size(),
		"record_count": totalRecords,
		"completed_at": common.GetTimestamp(),
	})
}

func markExportFailed(taskId int, errMsg string) {
	common.SysError(fmt.Sprintf("export task %d failed: %s", taskId, errMsg))
	_ = model.UpdateExportTask(taskId, map[string]interface{}{
		"status":        model.ExportTaskStatusFailed,
		"error_message": errMsg,
		"completed_at":  common.GetTimestamp(),
	})
}

func logTypeToString(logType int) string {
	switch logType {
	case model.LogTypeTopup:
		return "充值"
	case model.LogTypeConsume:
		return "消费"
	case model.LogTypeManage:
		return "管理"
	case model.LogTypeSystem:
		return "系统"
	case model.LogTypeError:
		return "错误"
	case model.LogTypeRefund:
		return "退款"
	default:
		return "未知"
	}
}

func StartExportCleanupTask() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			cleanupExpiredExports()
		}
	}()
}

func cleanupExpiredExports() {
	// Clean up tasks completed more than 7 days ago
	expireTime := common.GetTimestamp() - 7*24*3600
	tasks, err := model.GetExpiredExportTasks(expireTime)
	if err != nil {
		common.SysError("failed to get expired export tasks: " + err.Error())
		return
	}
	for _, task := range tasks {
		if task.FilePath != "" {
			_ = os.Remove(task.FilePath)
		}
		_ = model.DeleteExportTask(task.Id)
	}
	if len(tasks) > 0 {
		common.SysLog(fmt.Sprintf("cleaned up %d expired export tasks", len(tasks)))
	}
}
