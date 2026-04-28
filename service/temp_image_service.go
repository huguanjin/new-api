package service

import (
	"encoding/base64"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
)

const (
	// TempImageDefaultTTLSeconds is the default time-to-live for temp images (1 hour).
	TempImageDefaultTTLSeconds = 3600
)

var (
	tempImageStorageDir string
	// safeFilenameRe only allows UUID-based filenames with a simple extension, preventing path traversal.
	safeFilenameRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[a-zA-Z0-9]{1,10}$`)
)

// InitTempImageStorageDir creates the temporary image storage directory if it doesn't exist.
func InitTempImageStorageDir() {
	tempImageStorageDir = filepath.Join("data", "temp_images")
	if err := os.MkdirAll(tempImageStorageDir, 0750); err != nil {
		common.SysError("failed to create temp image storage directory: " + err.Error())
	}
}

// SaveTempImage decodes base64Data, writes it to disk with a UUID filename, and returns the filename.
// mimeType should be a valid MIME type like "image/jpeg".
func SaveTempImage(base64Data string, mimeType string) (string, error) {
	if tempImageStorageDir == "" {
		return "", fmt.Errorf("temp image storage not initialised; call InitTempImageStorageDir first")
	}

	raw, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		// Try URL-safe base64 as a fallback
		raw, err = base64.URLEncoding.DecodeString(base64Data)
		if err != nil {
			return "", fmt.Errorf("base64 decode failed: %w", err)
		}
	}

	ext := mimeTypeToExt(mimeType)
	filename := uuid.New().String() + ext

	path := filepath.Join(tempImageStorageDir, filename)
	if err := os.WriteFile(path, raw, 0640); err != nil {
		return "", fmt.Errorf("write temp image failed: %w", err)
	}
	return filename, nil
}

// GetTempImageFilePath returns the absolute file path for a temp image filename.
// Returns an error if the filename is not in the expected safe format.
func GetTempImageFilePath(filename string) (string, error) {
	if !safeFilenameRe.MatchString(filename) {
		return "", fmt.Errorf("invalid temp image filename: %s", filename)
	}
	return filepath.Join(tempImageStorageDir, filename), nil
}

// StartTempImageCleanupTask starts a background goroutine that deletes temp images
// older than TempImageDefaultTTLSeconds every hour.
func StartTempImageCleanupTask() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			cleanupExpiredTempImages()
		}
	}()
}

func cleanupExpiredTempImages() {
	if tempImageStorageDir == "" {
		return
	}
	entries, err := os.ReadDir(tempImageStorageDir)
	if err != nil {
		common.SysError("failed to read temp image directory: " + err.Error())
		return
	}
	now := time.Now()
	deleted := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if now.Sub(info.ModTime()) > TempImageDefaultTTLSeconds*time.Second {
			_ = os.Remove(filepath.Join(tempImageStorageDir, entry.Name()))
			deleted++
		}
	}
	if deleted > 0 {
		common.SysLog(fmt.Sprintf("cleaned up %d expired temp images", deleted))
	}
}

// mimeTypeToExt converts a MIME type to a file extension including the dot.
func mimeTypeToExt(mimeType string) string {
	// Handle common types explicitly for reliability
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
	return ".bin"
}
