package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ---- List ----

func GetAllExternalSites(c *gin.Context) {
	sites, err := model.GetAllExternalSites()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.MaskedSites(sites))
}

// ---- Create ----

func CreateExternalSite(c *gin.Context) {
	var site model.ExternalSiteConfig
	if err := c.ShouldBindJSON(&site); err != nil {
		common.ApiError(c, err)
		return
	}
	if site.Name == "" || site.Url == "" || site.Token == "" {
		common.ApiErrorMsg(c, "名称、URL 和 Token 不能为空")
		return
	}
	site.Id = 0
	if err := model.CreateExternalSite(&site); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": map[string]any{
			"id":           site.Id,
			"name":         site.Name,
			"url":          site.Url,
			"token":        site.MaskedToken(),
			"user_id_ext":  site.UserIdExt,
			"remark":       site.Remark,
			"created_time": site.CreatedTime,
		},
	})
}

// ---- Update ----

func UpdateExternalSite(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	existing, err := model.GetExternalSiteById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var req model.ExternalSiteConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	existing.Name = req.Name
	existing.Url = req.Url
	existing.UserIdExt = req.UserIdExt
	existing.Remark = req.Remark
	// Only update token if a real (non-masked) value is provided
	if req.Token != "" && req.Token != existing.MaskedToken() {
		existing.Token = req.Token
	}

	if err := model.UpdateExternalSite(existing); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// ---- Delete ----

func DeleteExternalSite(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteExternalSiteById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

// ---- Query balance (proxy) ----

type siteQueryResult struct {
	Id           int     `json:"id"`
	Name         string  `json:"name"`
	Url          string  `json:"url"`
	Username     string  `json:"username"`
	Group        string  `json:"group"`
	Quota        int64   `json:"quota"`
	UsedQuota    int64   `json:"used_quota"`
	RequestCount int     `json:"request_count"`
	BalanceUSD   float64 `json:"balance_usd"`
	UpdatedTime  int64   `json:"updated_time"`
	Error        string  `json:"error,omitempty"`
}

type selfResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Username     string `json:"username"`
		Group        string `json:"group"`
		Quota        int64  `json:"quota"`
		UsedQuota    int64  `json:"used_quota"`
		RequestCount int    `json:"request_count"`
	} `json:"data"`
	Message string `json:"message"`
}

func querySiteBalance(site *model.ExternalSiteConfig) *siteQueryResult {
	result := &siteQueryResult{
		Id:   site.Id,
		Name: site.Name,
		Url:  site.Url,
	}

	// SSRF protection — only allow public IPs
	if err := common.DefaultSSRFProtection.ValidateURL(site.Url); err != nil {
		result.Error = fmt.Sprintf("URL 安全校验失败: %v", err)
		return result
	}

	targetURL := site.Url + "/api/user/self"

	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	req.Header.Set("Authorization", "Bearer "+site.Token)
	if site.UserIdExt != "" {
		req.Header.Set("New-Api-User", site.UserIdExt)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		result.Error = err.Error()
		return result
	}

	var selfResp selfResponse
	if err := common.Unmarshal(body, &selfResp); err != nil {
		result.Error = fmt.Sprintf("解析响应失败: %v", err)
		return result
	}
	if !selfResp.Success {
		result.Error = selfResp.Message
		return result
	}

	result.Username = selfResp.Data.Username
	result.Group = selfResp.Data.Group
	result.Quota = selfResp.Data.Quota
	result.UsedQuota = selfResp.Data.UsedQuota
	result.RequestCount = selfResp.Data.RequestCount
	result.BalanceUSD = float64(selfResp.Data.Quota) / 500000.0
	result.UpdatedTime = time.Now().Unix()
	return result
}

func QueryExternalSiteBalance(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	site, err := model.GetExternalSiteById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result := querySiteBalance(site)
	common.ApiSuccess(c, result)
}

func QueryAllExternalSitesBalance(c *gin.Context) {
	sites, err := model.GetAllExternalSites()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	results := make([]*siteQueryResult, len(sites))
	for i, site := range sites {
		results[i] = querySiteBalance(site)
	}
	common.ApiSuccess(c, results)
}

// ---- Import / Export ----

type importSiteItem struct {
	Name   string `json:"name"`
	Url    string `json:"url"`
	Token  string `json:"token"`
	UserId string `json:"userId"` // quoteseach format
}

func ImportExternalSites(c *gin.Context) {
	var items []importSiteItem
	if err := c.ShouldBindJSON(&items); err != nil {
		common.ApiError(c, err)
		return
	}

	sites := make([]*model.ExternalSiteConfig, 0, len(items))
	for _, item := range items {
		if item.Url == "" || item.Token == "" {
			continue
		}
		name := item.Name
		if name == "" {
			name = item.Url
		}
		sites = append(sites, &model.ExternalSiteConfig{
			Name:      name,
			Url:       item.Url,
			Token:     item.Token,
			UserIdExt: item.UserId,
		})
	}

	if err := model.BatchImportExternalSites(sites); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "count": len(sites)})
}

func ExportExternalSites(c *gin.Context) {
	sites, err := model.GetAllExternalSites()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]importSiteItem, 0, len(sites))
	for _, s := range sites {
		items = append(items, importSiteItem{
			Name:   s.Name,
			Url:    s.Url,
			Token:  s.Token, // export plaintext so user can re-import elsewhere
			UserId: s.UserIdExt,
		})
	}
	common.ApiSuccess(c, items)
}
