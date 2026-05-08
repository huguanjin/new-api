package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// ─── 代理端接口 ─────────────────────────────────────────────────────────────

// AgentOverview GET /api/agent/overview
// 返回代理的汇总信息：下级数、历史分红总额、可提现余额、本月预估已结算分红
func AgentOverview(c *gin.Context) {
	agentId := c.GetInt("id")
	agent, err := model.GetUserById(agentId, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取用户信息失败"})
		return
	}

	invitees, err := model.GetInviteesByAgentId(agentId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取下级列表失败"})
		return
	}

	// 本月已结算分红
	thisMonth := time.Now().Format("2006-01")
	thisMonthCommission, _ := model.GetSettlementSummaryByAgent(agentId, thisMonth)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"invitee_count":         len(invitees),
			"aff_code":              agent.AffCode,
			"commission_balance":    agent.CommissionBalance,
			"commission_total":      agent.CommissionTotal,
			"this_month_commission": thisMonthCommission,
		},
	})
}

// AgentInvitees GET /api/agent/users
// 返回该代理的下级用户列表（含注册时间、本月使用额度等）
func AgentInvitees(c *gin.Context) {
	agentId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	invitees, err := model.GetInviteesByAgentId(agentId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取下级列表失败"})
		return
	}

	// 手动分页（invitees 数量一般不大）
	total := len(invitees)
	start := pageInfo.GetStartIdx()
	end := start + pageInfo.GetPageSize()
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}
	page := invitees[start:end]

	// 脱敏：只返回必要字段
	type inviteeInfo struct {
		Id          int    `json:"id"`
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		CreatedAt   int64  `json:"created_at"`
		UsedQuota   int    `json:"used_quota"`
	}
	var result []inviteeInfo
	for _, u := range page {
		result = append(result, inviteeInfo{
			Id:          u.Id,
			Username:    u.Username,
			DisplayName: u.DisplayName,
			CreatedAt:   u.CreatedAt,
			UsedQuota:   u.UsedQuota,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": result,
			"total": total,
		},
	})
}

// AgentSettlements GET /api/agent/settlements
// 返回该代理的历史月度结算明细
func AgentSettlements(c *gin.Context) {
	agentId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	settlements, total, err := model.GetSettlementsByAgent(agentId, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取结算记录失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": settlements,
			"total": total,
		},
	})
}

// AgentInviteeTopups GET /api/agent/topups
// 返回下级用户的充值记录
func AgentInviteeTopups(c *gin.Context) {
	agentId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	invitees, err := model.GetInviteesByAgentId(agentId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取下级列表失败"})
		return
	}

	userIds := make([]int, 0, len(invitees))
	for _, u := range invitees {
		userIds = append(userIds, u.Id)
	}

	topups, total, err := model.GetTopUpsByInviterUserIds(userIds, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取充值记录失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": topups,
			"total": total,
		},
	})
}

// ─── 管理员接口 ──────────────────────────────────────────────────────────────

// AdminListAgents GET /api/admin/agents
// 列出所有代理用户
func AdminListAgents(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	agents, err := model.GetUsersByRole(common.RoleAgentUser)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取代理列表失败"})
		return
	}

	total := len(agents)
	start := pageInfo.GetStartIdx()
	end := start + pageInfo.GetPageSize()
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": agents[start:end],
			"total": total,
		},
	})
}

// AdminPromoteAgent POST /api/admin/agent/promote
// 将普通用户提升为代理
func AdminPromoteAgent(c *gin.Context) {
	var req struct {
		UserId int `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	user, err := model.GetUserById(req.UserId, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户不存在"})
		return
	}
	if user.Role >= common.RoleAgentUser {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户已经是代理或更高角色"})
		return
	}

	if err := model.DB.Model(&model.User{}).Where("id = ?", req.UserId).Update("role", common.RoleAgentUser).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "设置代理失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已设置为代理"})
}

// AdminDemoteAgent POST /api/admin/agent/demote
// 将代理降级为普通用户
func AdminDemoteAgent(c *gin.Context) {
	var req struct {
		UserId int `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	user, err := model.GetUserById(req.UserId, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户不存在"})
		return
	}
	if user.Role != common.RoleAgentUser {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "该用户当前不是代理"})
		return
	}

	if err := model.DB.Model(&model.User{}).Where("id = ?", req.UserId).Update("role", common.RoleCommonUser).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "取消代理失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已取消代理资格"})
}

// AdminTriggerSettlement POST /api/admin/commission/settle
// 手动触发指定月份的结算（参数: month=2026-05）
func AdminTriggerSettlement(c *gin.Context) {
	month := c.Query("month")
	if month == "" {
		// 默认结算上个月
		month = time.Now().AddDate(0, -1, 0).Format("2006-01")
	}
	// 简单格式校验
	if _, err := time.Parse("2006-01", month); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "month 格式错误，应为 YYYY-MM"})
		return
	}
	go service.RunMonthlyUsageCommission(month)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "结算任务已提交，month=" + month})
}

// AdminGetAgentInvitees GET /api/admin/agent/:id/users
// 管理员查看某代理的下级列表
func AdminGetAgentInvitees(c *gin.Context) {
	agentIdStr := c.Param("id")
	agentId, err := strconv.Atoi(agentIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "id 格式错误"})
		return
	}
	invitees, err := model.GetInviteesByAgentId(agentId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取下级列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": invitees,
			"total": len(invitees),
		},
	})
}
