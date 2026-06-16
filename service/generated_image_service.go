package service

import (
	"encoding/base64"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/google/uuid"
)

var generatedImageStorageDir string

// InitGeneratedImageStorageDir creates the generated image storage directory if it doesn't exist.
func InitGeneratedImageStorageDir() {
	generatedImageStorageDir = filepath.Join("data", "generated_images")
	if err := os.MkdirAll(generatedImageStorageDir, 0750); err != nil {
		common.SysError("failed to create generated image storage directory: " + err.Error())
	}
}

// GetGeneratedImageStorageDir returns the generated image storage directory path.
func GetGeneratedImageStorageDir() string {
	return generatedImageStorageDir
}

// SaveGeneratedImage decodes base64 image data, writes it to disk, and creates a DB record.
// This function is designed to be called from a goroutine — it does not block the API response.
func SaveGeneratedImage(userId int, requestId, modelName, prompt, b64Data, mimeType string, index int) error {
	if generatedImageStorageDir == "" {
		return fmt.Errorf("generated image storage not initialised; call InitGeneratedImageStorageDir first")
	}

	if b64Data == "" {
		return nil
	}

	// Decode base64
	raw, err := base64.StdEncoding.DecodeString(b64Data)
	if err != nil {
		// Try URL-safe base64 as a fallback
		raw, err = base64.URLEncoding.DecodeString(b64Data)
		if err != nil {
			return fmt.Errorf("base64 decode failed: %w", err)
		}
	}

	// Limit file size to 20MB
	if len(raw) > 20*1024*1024 {
		return fmt.Errorf("image too large: %d bytes, max 20MB", len(raw))
	}

	// Detect MIME type if not provided
	if mimeType == "" {
		mimeType = http.DetectContentType(raw)
		if !strings.HasPrefix(mimeType, "image/") {
			mimeType = "image/png" // fallback
		}
	}

	ext := generatedImageMimeToExt(mimeType)
	filename := uuid.New().String() + ext
	filePath := filepath.Join(generatedImageStorageDir, filename)

	// Write file
	if err := os.WriteFile(filePath, raw, 0640); err != nil {
		return fmt.Errorf("write generated image failed: %w", err)
	}

	now := time.Now().Unix()
	image := &model.GeneratedImage{
		UserId:     userId,
		RequestId:  requestId,
		Filename:   filename,
		MimeType:   mimeType,
		Model:      modelName,
		Prompt:     prompt,
		ImageIndex: index,
		FileSize:   int64(len(raw)),
		CreatedAt:  now,
		ExpiresAt:  now + int64(model.GeneratedImageTTL.Seconds()),
	}

	if err := model.CreateGeneratedImage(image); err != nil {
		// Clean up file on DB error
		os.Remove(filePath)
		return fmt.Errorf("failed to create generated image record: %w", err)
	}

	return nil
}

// StartGeneratedImageCleanupTask starts a goroutine to periodically clean up expired generated images.
func StartGeneratedImageCleanupTask() {
	common.SysLog("generated image cleanup task started, TTL: 24 hours")
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			cleanupExpiredGeneratedImages()
		}
	}()
}

func cleanupExpiredGeneratedImages() {
	expired, err := model.DeleteExpiredGeneratedImages()
	if err != nil {
		common.SysError("failed to delete expired generated images from DB: " + err.Error())
		return
	}
	if len(expired) == 0 {
		return
	}
	deletedFiles := 0
	for _, img := range expired {
		filePath := filepath.Join(generatedImageStorageDir, img.Filename)
		if err := os.Remove(filePath); err != nil {
			if !os.IsNotExist(err) {
				common.SysError("failed to remove expired generated image file: " + filePath + " " + err.Error())
			}
		} else {
			deletedFiles++
		}
	}
	common.SysLog("cleaned up " + strconv.Itoa(len(expired)) + " expired generated image records, " + strconv.Itoa(deletedFiles) + " files removed")
}

// generatedImageMimeToExt converts a MIME type to a file extension including the dot.
func generatedImageMimeToExt(mimeType string) string {
	switch strings.ToLower(mimeType) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/bmp":
		return ".bmp"
	case "image/tiff":
		return ".tiff"
	}
	// Fall back to the mime package
	exts, err := mime.ExtensionsByType(mimeType)
	if err == nil && len(exts) > 0 {
		return exts[0]
	}
	return ".png"
}
