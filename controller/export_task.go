package controller

import (
	"net/http"
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const maxPendingExportTasks = 5
const maxExportTimeRangeSeconds = 90 * 24 * 3600 // 90 days

func CreateExportTask(c *gin.Context) {
	var req dto.CreateExportTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request: "+err.Error())
		return
	}

	// Validate time range
	if req.StartTimestamp <= 0 || req.EndTimestamp <= 0 {
		common.ApiErrorMsg(c, "请选择导出时间范围")
		return
	}
	if req.EndTimestamp <= req.StartTimestamp {
		common.ApiErrorMsg(c, "结束时间必须大于开始时间")
		return
	}
	if req.EndTimestamp-req.StartTimestamp > maxExportTimeRangeSeconds {
		common.ApiErrorMsg(c, "时间范围不能超过90天")
		return
	}

	userId := c.GetInt("id")
	role := c.GetInt("role")
	username := c.GetString("username")

	// Permission check: regular users can only export their own consume/topup logs
	if role < common.RoleAdminUser {
		if req.Type != model.LogTypeConsume && req.Type != model.LogTypeTopup && req.Type != model.LogTypeUnknown {
			common.ApiErrorMsg(c, "普通用户仅可导出消费或充值记录")
			return
		}
		req.TargetUserId = 0
		req.TargetUsername = ""
	}

	// Check pending task limit
	pendingCount, err := model.CountUserPendingExportTasks(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if pendingCount >= maxPendingExportTasks {
		common.ApiErrorMsg(c, "当前有太多未完成的导出任务，请稍后再试")
		return
	}

	// Build params JSON
	params := model.ExportTaskParams{
		StartTimestamp: req.StartTimestamp,
		EndTimestamp:   req.EndTimestamp,
		TargetUserId:   req.TargetUserId,
		TargetUsername: req.TargetUsername,
		ModelName:      req.ModelName,
		TokenName:      req.TokenName,
		Group:          req.Group,
	}
	paramsBytes, err := common.Marshal(params)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	task := &model.ExportTask{
		UserId:    userId,
		Username:  username,
		Type:      req.Type,
		Status:    model.ExportTaskStatusQueued,
		Params:    string(paramsBytes),
		CreatedAt: common.GetTimestamp(),
	}

	if err := model.CreateExportTask(task); err != nil {
		common.ApiError(c, err)
		return
	}

	// Async processing
	taskId := task.Id
	gopool.Go(func() {
		service.ProcessExportTask(taskId)
	})

	common.ApiSuccess(c, task)
}

func GetExportTasks(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId := c.GetInt("id")

	tasks, total, err := model.GetExportTasksByUserId(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tasks)
	common.ApiSuccess(c, pageInfo)
}

func GetAllExportTasks(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

	tasks, total, err := model.GetAllExportTasks(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tasks)
	common.ApiSuccess(c, pageInfo)
}

func DownloadExportTask(c *gin.Context) {
	idStr := c.Param("id")
	taskId, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "invalid task id")
		return
	}

	task, err := model.GetExportTaskById(taskId)
	if err != nil {
		common.ApiErrorMsg(c, "任务不存在")
		return
	}

	// Permission check
	userId := c.GetInt("id")
	role := c.GetInt("role")
	if role < common.RoleAdminUser && task.UserId != userId {
		common.ApiErrorMsg(c, "无权下载此任务")
		return
	}

	if task.Status != model.ExportTaskStatusCompleted {
		common.ApiErrorMsg(c, "任务尚未完成")
		return
	}

	if task.FilePath == "" {
		common.ApiErrorMsg(c, "文件不存在")
		return
	}

	// Validate the file path is inside the exports directory
	if _, err := os.Stat(task.FilePath); os.IsNotExist(err) {
		common.ApiErrorMsg(c, "文件已过期或不存在")
		return
	}

	downloadName := task.FileName
	if downloadName == "" {
		downloadName = "export.csv"
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.FileAttachment(task.FilePath, downloadName)
}

func DeleteExportTask(c *gin.Context) {
	idStr := c.Param("id")
	taskId, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "invalid task id")
		return
	}

	task, err := model.GetExportTaskById(taskId)
	if err != nil {
		common.ApiErrorMsg(c, "任务不存在")
		return
	}

	// Permission check
	userId := c.GetInt("id")
	role := c.GetInt("role")
	if role < common.RoleAdminUser && task.UserId != userId {
		common.ApiErrorMsg(c, "无权删除此任务")
		return
	}

	// Delete file if exists
	if task.FilePath != "" {
		_ = os.Remove(task.FilePath)
	}

	if err := model.DeleteExportTask(taskId); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
