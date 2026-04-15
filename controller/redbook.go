package controller

import (
	"encoding/base64"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var redBookStorageDir string

func init() {
	redBookStorageDir = filepath.Join("data", "redbook")
	if err := os.MkdirAll(redBookStorageDir, 0750); err != nil {
		common.SysError("failed to create redbook storage directory: " + err.Error())
	}
}

// === Project Endpoints ===

type SaveRedBookProjectRequest struct {
	Topic      string `json:"topic" binding:"required"`
	Outline    string `json:"outline"`
	PageCount  int    `json:"page_count"`
	TextModel  string `json:"text_model"`
	ImageModel string `json:"image_model"`
	Status     string `json:"status"`
}

func SaveRedBookProject(c *gin.Context) {
	userId := c.GetInt("id")

	var req SaveRedBookProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	now := time.Now().Unix()
	status := req.Status
	if status == "" {
		status = "draft"
	}

	project := &model.RedBookProject{
		UserId:     userId,
		Topic:      req.Topic,
		Outline:    req.Outline,
		PageCount:  req.PageCount,
		TextModel:  req.TextModel,
		ImageModel: req.ImageModel,
		Status:     status,
		CreatedAt:  now,
		ExpiresAt:  now + int64(model.RedBookImageTTL.Seconds()),
	}

	if err := model.CreateRedBookProject(project); err != nil {
		common.SysError("failed to create redbook project: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to save project",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    project,
	})
}

func UpdateRedBookProject(c *gin.Context) {
	userId := c.GetInt("id")
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid project id",
		})
		return
	}

	existing, err := model.GetRedBookProjectById(id, userId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "project not found",
		})
		return
	}

	var req SaveRedBookProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	existing.Topic = req.Topic
	existing.Outline = req.Outline
	existing.PageCount = req.PageCount
	existing.TextModel = req.TextModel
	existing.ImageModel = req.ImageModel
	if req.Status != "" {
		existing.Status = req.Status
	}

	if err := model.UpdateRedBookProject(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to update project",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    existing,
	})
}

func GetRedBookProjects(c *gin.Context) {
	userId := c.GetInt("id")

	projects, err := model.GetRedBookProjectsByUserId(userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to fetch projects",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    projects,
	})
}

func GetRedBookProject(c *gin.Context) {
	userId := c.GetInt("id")
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid project id",
		})
		return
	}

	project, err := model.GetRedBookProjectById(id, userId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "project not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    project,
	})
}

func DeleteRedBookProject(c *gin.Context) {
	userId := c.GetInt("id")
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid project id",
		})
		return
	}

	// Delete associated images first
	images, _ := model.GetRedBookImagesByProjectId(id, userId)
	for _, img := range images {
		filePath := filepath.Join(redBookStorageDir, img.Filename)
		os.Remove(filePath)
	}
	model.DeleteRedBookImagesByProjectId(id)

	if err := model.DeleteRedBookProject(id, userId); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to delete project",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "project deleted",
	})
}

// === Image Endpoints ===

type SaveRedBookImageRequest struct {
	Base64Data string `json:"base64_data" binding:"required"`
	MimeType   string `json:"mime_type" binding:"required"`
	ProjectId  int    `json:"project_id" binding:"required"`
	Prompt     string `json:"prompt"`
	Model      string `json:"model"`
	PageIndex  int    `json:"page_index"`
	PageType   string `json:"page_type"`
}

func SaveRedBookImage(c *gin.Context) {
	userId := c.GetInt("id")

	var req SaveRedBookImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request: " + err.Error(),
		})
		return
	}

	// Validate mime type
	allowedMimes := map[string]string{
		"image/png":  ".png",
		"image/jpeg": ".jpg",
		"image/webp": ".webp",
	}
	ext, ok := allowedMimes[req.MimeType]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "unsupported image type, allowed: png, jpeg, webp",
		})
		return
	}

	// Decode base64
	data, err := base64.StdEncoding.DecodeString(req.Base64Data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid base64 data",
		})
		return
	}

	// Limit file size to 20MB
	if len(data) > 20*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "image too large, max 20MB",
		})
		return
	}

	// Validate page type
	if req.PageType != "" && req.PageType != "cover" && req.PageType != "content" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid page_type, must be 'cover' or 'content'",
		})
		return
	}

	// Generate unique filename
	filename := uuid.New().String() + ext
	filePath := filepath.Join(redBookStorageDir, filename)

	// Write file
	if err := os.WriteFile(filePath, data, 0640); err != nil {
		common.SysError("failed to write redbook image: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to save image",
		})
		return
	}

	now := time.Now().Unix()
	image := &model.RedBookImage{
		UserId:    userId,
		ProjectId: req.ProjectId,
		Filename:  filename,
		MimeType:  req.MimeType,
		Prompt:    req.Prompt,
		Model:     req.Model,
		PageIndex: req.PageIndex,
		PageType:  req.PageType,
		FileSize:  int64(len(data)),
		CreatedAt: now,
		ExpiresAt: now + int64(model.RedBookImageTTL.Seconds()),
	}

	if err := model.CreateRedBookImage(image); err != nil {
		os.Remove(filePath)
		common.SysError("failed to create redbook image record: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to save image record",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    image,
	})
}

func GetRedBookImages(c *gin.Context) {
	userId := c.GetInt("id")
	projectIdStr := c.Query("project_id")

	if projectIdStr != "" {
		projectId, err := strconv.Atoi(projectIdStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "invalid project_id",
			})
			return
		}
		images, err := model.GetRedBookImagesByProjectId(projectId, userId)
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

	images, err := model.GetRedBookImagesByUserId(userId)
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
}

func GetRedBookImageFile(c *gin.Context) {
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

	image, err := model.GetRedBookImageById(id, userId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "image not found",
		})
		return
	}

	if time.Now().Unix() > image.ExpiresAt {
		c.JSON(http.StatusGone, gin.H{
			"success": false,
			"message": "image has expired",
		})
		return
	}

	filePath := filepath.Join(redBookStorageDir, image.Filename)

	// Validate filename to prevent path traversal
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "invalid file path",
		})
		return
	}
	absDir, _ := filepath.Abs(redBookStorageDir)
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

func DeleteRedBookImage(c *gin.Context) {
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

	image, err := model.GetRedBookImageById(id, userId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "image not found",
		})
		return
	}

	filePath := filepath.Join(redBookStorageDir, image.Filename)
	os.Remove(filePath)

	if err := model.DeleteRedBookImage(id, userId); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to delete image",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "image deleted",
	})
}

// === Cleanup Task ===

func StartRedBookCleanupTask() {
	common.SysLog("redbook image cleanup task started, TTL: 48 hours")
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			cleanupExpiredRedBookData()
		}
	}()
}

func cleanupExpiredRedBookData() {
	// Clean expired images
	expired, err := model.DeleteExpiredRedBookImages()
	if err != nil {
		common.SysError("failed to delete expired redbook images from DB: " + err.Error())
	} else if len(expired) > 0 {
		deletedFiles := 0
		for _, img := range expired {
			filePath := filepath.Join(redBookStorageDir, img.Filename)
			if err := os.Remove(filePath); err != nil {
				if !os.IsNotExist(err) {
					common.SysError("failed to remove expired redbook file: " + filePath + " " + err.Error())
				}
			} else {
				deletedFiles++
			}
		}
		common.SysLog("cleaned up " + strconv.Itoa(len(expired)) + " expired redbook images, " + strconv.Itoa(deletedFiles) + " files removed")
	}

	// Clean expired projects
	projectIds, err := model.DeleteExpiredRedBookProjects()
	if err != nil {
		common.SysError("failed to delete expired redbook projects from DB: " + err.Error())
	} else if len(projectIds) > 0 {
		common.SysLog("cleaned up " + strconv.Itoa(len(projectIds)) + " expired redbook projects")
	}
}
