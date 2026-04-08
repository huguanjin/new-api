package controller

import (
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// getEnabledSeedanceChannel finds an enabled Seedance channel from DB.
func getEnabledSeedanceChannel() (*model.Channel, error) {
	channels, err := model.GetChannelsByType(0, 10, false, constant.ChannelTypeSeedance)
	if err != nil {
		return nil, fmt.Errorf("query seedance channels failed: %w", err)
	}
	for _, ch := range channels {
		fullCh, err := model.CacheGetChannel(ch.Id)
		if err != nil {
			continue
		}
		if fullCh.Status == common.ChannelStatusEnabled {
			return fullCh, nil
		}
	}
	return nil, fmt.Errorf("no enabled seedance channel found")
}

// AssetCreate proxies POST /api/asset/createMedia to the upstream Seedance service.
func AssetCreate(c *gin.Context) {
	channel, err := getEnabledSeedanceChannel()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("AssetCreate: %s", err.Error()))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{
				"message": "no available seedance channel",
				"type":    "server_error",
			},
		})
		return
	}

	baseURL := channel.GetBaseURL()
	if baseURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "seedance channel base URL not configured",
				"type":    "server_error",
			},
		})
		return
	}

	upstreamURL := fmt.Sprintf("%s/api/asset/createMedia", baseURL)
	proxyAssetRequest(c, channel, upstreamURL, http.MethodPost, c.Request.Body)
}

// AssetGet proxies GET /api/asset/get to the upstream Seedance service.
func AssetGet(c *gin.Context) {
	channel, err := getEnabledSeedanceChannel()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("AssetGet: %s", err.Error()))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{
				"message": "no available seedance channel",
				"type":    "server_error",
			},
		})
		return
	}

	baseURL := channel.GetBaseURL()
	if baseURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "seedance channel base URL not configured",
				"type":    "server_error",
			},
		})
		return
	}

	assetID := c.Query("id")
	if assetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"message": "query parameter 'id' is required",
				"type":    "invalid_request_error",
			},
		})
		return
	}

	upstreamURL := fmt.Sprintf("%s/api/asset/get?id=%s", baseURL, assetID)
	proxyAssetRequest(c, channel, upstreamURL, http.MethodGet, nil)
}

func proxyAssetRequest(c *gin.Context, channel *model.Channel, upstreamURL string, method string, body io.Reader) {
	proxy := channel.GetSetting().Proxy
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("proxyAssetRequest: create proxy client failed: %s", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "failed to create proxy client",
				"type":    "server_error",
			},
		})
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), method, upstreamURL, body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": "failed to create upstream request",
				"type":    "server_error",
			},
		})
		return
	}

	req.Header.Set("Authorization", "Bearer "+channel.Key)
	if method == http.MethodPost {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "*/*")

	resp, err := client.Do(req)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("proxyAssetRequest: upstream request failed: %s", err.Error()))
		c.JSON(http.StatusBadGateway, gin.H{
			"error": gin.H{
				"message": "upstream request failed",
				"type":    "server_error",
			},
		})
		return
	}
	defer resp.Body.Close()

	for key, values := range resp.Header {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}
	c.Writer.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(c.Writer, resp.Body); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("proxyAssetRequest: stream response failed: %s", err.Error()))
	}
}
