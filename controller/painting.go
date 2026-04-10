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

var paintingStorageDir string

func init() {
	paintingStorageDir = filepath.Join("data", "paintings")
	if err := os.MkdirAll(paintingStorageDir, 0750); err != nil {
		common.SysError("failed to create painting storage directory: " + err.Error())
	}
}

type SavePaintingImageRequest struct {
	Base64Data     string `json:"base64_data" binding:"required"`
	MimeType       string `json:"mime_type" binding:"required"`
	Prompt         string `json:"prompt"`
	Model          string `json:"model"`
	AspectRatio    string `json:"aspect_ratio"`
	ImageSize      string `json:"image_size"`
	ReferenceCount int    `json:"reference_count"`
}

func SavePaintingImage(c *gin.Context) {
	userId := c.GetInt("id")

	var req SavePaintingImageRequest
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

	// Generate unique filename
	filename := uuid.New().String() + ext
	filePath := filepath.Join(paintingStorageDir, filename)

	// Write file
	if err := os.WriteFile(filePath, data, 0640); err != nil {
		common.SysError("failed to write painting image: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to save image",
		})
		return
	}

	now := time.Now().Unix()
	image := &model.PaintingImage{
		UserId:         userId,
		Filename:       filename,
		MimeType:       req.MimeType,
		Prompt:         req.Prompt,
		Model:          req.Model,
		AspectRatio:    req.AspectRatio,
		ImageSize:      req.ImageSize,
		ReferenceCount: req.ReferenceCount,
		FileSize:       int64(len(data)),
		CreatedAt:      now,
		ExpiresAt:      now + int64(model.PaintingImageTTL.Seconds()),
	}

	if err := model.CreatePaintingImage(image); err != nil {
		// Clean up file on DB error
		os.Remove(filePath)
		common.SysError("failed to create painting image record: " + err.Error())
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

func GetPaintingImages(c *gin.Context) {
	userId := c.GetInt("id")

	images, err := model.GetPaintingImagesByUserId(userId)
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

func GetPaintingImageFile(c *gin.Context) {
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

	image, err := model.GetPaintingImageById(id, userId)
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

	filePath := filepath.Join(paintingStorageDir, image.Filename)

	// Validate filename to prevent path traversal
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "invalid file path",
		})
		return
	}
	absDir, _ := filepath.Abs(paintingStorageDir)
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

func DeletePaintingImage(c *gin.Context) {
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

	image, err := model.GetPaintingImageById(id, userId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "image not found",
		})
		return
	}

	// Delete file
	filePath := filepath.Join(paintingStorageDir, image.Filename)
	os.Remove(filePath)

	// Delete DB record
	if err := model.DeletePaintingImage(id, userId); err != nil {
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

// StartPaintingCleanupTask starts a goroutine to periodically clean up expired painting images
func StartPaintingCleanupTask() {
	common.SysLog("painting image cleanup task started, TTL: 48 hours")
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			cleanupExpiredPaintingImages()
		}
	}()
}

func cleanupExpiredPaintingImages() {
	expired, err := model.DeleteExpiredPaintingImages()
	if err != nil {
		common.SysError("failed to delete expired painting images from DB: " + err.Error())
		return
	}
	if len(expired) == 0 {
		return
	}
	deletedFiles := 0
	for _, img := range expired {
		filePath := filepath.Join(paintingStorageDir, img.Filename)
		if err := os.Remove(filePath); err != nil {
			if !os.IsNotExist(err) {
				common.SysError("failed to remove expired painting file: " + filePath + " " + err.Error())
			}
		} else {
			deletedFiles++
		}
	}
	common.SysLog("cleaned up " + strconv.Itoa(len(expired)) + " expired painting records, " + strconv.Itoa(deletedFiles) + " files removed")
}

// isSubPath checks if child is under parent directory
func isSubPath(parent, child string) bool {
	rel, err := filepath.Rel(parent, child)
	if err != nil {
		return false
	}
	return !filepath.IsAbs(rel) && len(rel) >= 1 && rel != ".." && (len(rel) < 2 || rel[:2] != "..")
}
