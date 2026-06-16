package controller

import (
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetGeneratedImages(c *gin.Context) {
	userId := c.GetInt("id")

	requestId := c.Query("request_id")

	// If request_id is specified, return images for that request
	if requestId != "" {
		images, err := model.GetGeneratedImagesByRequestId(requestId, userId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "failed to fetch images",
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    images,
		})
		return
	}

	// Otherwise, return paginated list
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	images, total, err := model.GetGeneratedImagesByUserId(userId, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to fetch images",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"data":      images,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func GetGeneratedImageFile(c *gin.Context) {
	userId := c.GetInt("id")
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid image id",
		})
		return
	}

	image, err := model.GetGeneratedImageById(id, userId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "image not found",
		})
		return
	}

	// Check if expired
	if time.Now().Unix() > image.ExpiresAt {
		c.JSON(http.StatusGone, gin.H{
			"success": false,
			"message": "image has expired",
		})
		return
	}

	storageDir := service.GetGeneratedImageStorageDir()
	filePath := filepath.Join(storageDir, image.Filename)

	// Validate filename to prevent path traversal
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "invalid file path",
		})
		return
	}
	absDir, _ := filepath.Abs(storageDir)
	if !isSubPath(absDir, absPath) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "access denied",
		})
		return
	}

	c.Header("Cache-Control", "private, max-age=3600")
	c.File(filePath)
}
