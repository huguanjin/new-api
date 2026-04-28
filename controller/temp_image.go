package controller

import (
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// ServeTempImage serves a temporary image file uploaded during Gemini relay.
// The route is public (no auth) so that upstream AI providers can fetch the image.
// Filename is validated inside service.GetTempImageFilePath to prevent path traversal.
func ServeTempImage(c *gin.Context) {
	filename := c.Param("filename")

	filePath, err := service.GetTempImageFilePath(filename)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid filename",
		})
		return
	}

	// Derive Content-Type from extension
	ext := strings.ToLower(filepath.Ext(filename))
	ct := mime.TypeByExtension(ext)
	if ct != "" {
		c.Header("Content-Type", ct)
	}

	// Cache briefly – upstream servers may hit this URL once; TTL on server is 1h
	c.Header("Cache-Control", "public, max-age=3600")

	c.File(filePath)
}
