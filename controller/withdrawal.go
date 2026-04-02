package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreateWithdrawalRequest struct {
	Amount        float64 `json:"amount"`
	AlipayAccount string  `json:"alipay_account"`
	AlipayName    string  `json:"alipay_name"`
}

// RequestWithdrawal creates a new withdrawal request for the current user.
func RequestWithdrawal(c *gin.Context) {
	var req CreateWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}
	if req.Amount <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "提现金额必须大于0"})
		return
	}
	if req.AlipayAccount == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请输入支付宝账号"})
		return
	}
	if req.AlipayName == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请输入支付宝实名"})
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户不存在"})
		return
	}

	// Atomically deduct commission_balance using a transaction
	var insufficientBalance bool
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		// Lock and re-read
		var u model.User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&u, userId).Error; err != nil {
			return err
		}
		if u.CommissionBalance < req.Amount {
			insufficientBalance = true
			return nil
		}
		u.CommissionBalance -= req.Amount
		if err := tx.Model(&u).Update("commission_balance", u.CommissionBalance).Error; err != nil {
			return err
		}
		withdrawal := &model.Withdrawal{
			UserId:        userId,
			Username:      user.Username,
			Amount:        req.Amount,
			AlipayAccount: req.AlipayAccount,
			AlipayName:    req.AlipayName,
			Status:        common.WithdrawalStatusPending,
			CreatedAt:     common.GetTimestamp(),
			UpdatedAt:     common.GetTimestamp(),
		}
		return tx.Create(withdrawal).Error
	})

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "提现失败: " + err.Error()})
		return
	}
	if insufficientBalance {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "可提现余额不足"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "提现申请已提交，请等待管理员审核"})
}

// GetCommissionInfo returns the current user's commission balance and total.
func GetCommissionInfo(c *gin.Context) {
	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"commission_balance": user.CommissionBalance,
			"commission_total":   user.CommissionTotal,
		},
	})
}

// AdminGetWithdrawals returns all withdrawal requests for admin review.
func AdminGetWithdrawals(c *gin.Context) {
	status := c.Query("status")
	pageInfo := common.GetPageQuery(c)
	withdrawals, total, err := model.GetAllWithdrawals(status, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(withdrawals)
	common.ApiSuccess(c, pageInfo)
}

type ProcessWithdrawalRequest struct {
	Action string `json:"action"` // approve or reject
	Remark string `json:"remark"`
}

// AdminProcessWithdrawal processes (approve/reject) a withdrawal request.
func AdminProcessWithdrawal(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的提现ID"})
		return
	}

	var req ProcessWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}
	if req.Action != "approve" && req.Action != "reject" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的操作，请使用 approve 或 reject"})
		return
	}

	reviewerId := c.GetInt("id")
	if err = model.ProcessWithdrawal(id, req.Action, req.Remark, reviewerId); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "操作成功"})
}

// GetInvitedSubscriptions returns subscriptions of users invited by the current user.
func GetInvitedSubscriptions(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.DefaultQuery("status", "all")

	items, total, err := model.GetInvitedUserSubscriptions(userId, page, pageSize, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":     items,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}
