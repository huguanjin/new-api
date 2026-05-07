package controller

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// imageTaskURLItem is one entry in the image task data field.
type imageTaskURLItem struct {
	URL string `json:"url"`
}

// GetImageTask returns the persisted URL list for a grsai image generation task.
// Users can only query their own tasks (userId comes from token auth context).
func GetImageTask(c *gin.Context) {
	taskID := c.Param("task_id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"message": "task_id is required",
				"type":    "invalid_request_error",
			},
		})
		return
	}

	userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)

	task, exists, err := model.GetByTaskId(userId, taskID)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("GetImageTask: failed to query task %s: %v", taskID, err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "Failed to query task",
				"type":    "server_error",
			},
		})
		return
	}
	if !exists || task == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"message": "Task not found",
				"type":    "invalid_request_error",
			},
		})
		return
	}

	if task.Platform != constant.TaskPlatformGrsaiImage {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"message": "Task not found",
				"type":    "invalid_request_error",
			},
		})
		return
	}

	var urlItems []imageTaskURLItem
	if err := task.GetData(&urlItems); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("GetImageTask: failed to decode task data for %s: %v", taskID, err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "Failed to decode task data",
				"type":    "server_error",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task_id":    task.TaskID,
		"status":     "completed",
		"created_at": task.CreatedAt,
		"model":      task.Properties.OriginModelName,
		"data":       urlItems,
	})
}
