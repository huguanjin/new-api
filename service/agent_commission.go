package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	agentCommissionTickInterval = 1 * time.Hour // 每小时检查一次是否到结算时间
)

var (
	agentCommissionOnce    sync.Once
	agentCommissionRunning atomic.Bool
)

// StartAgentCommissionTask 启动代理月度使用量分红结算后台任务（仅主节点运行）
func StartAgentCommissionTask() {
	agentCommissionOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), "agent commission task started")
			ticker := time.NewTicker(agentCommissionTickInterval)
			defer ticker.Stop()

			// 启动时检查一次（处理服务重启错过的结算）
			checkAndRunCommission()
			for range ticker.C {
				checkAndRunCommission()
			}
		})
	})
}

// checkAndRunCommission 检查是否需要执行月度结算（每月 1 日 00:05~01:00 触发）
func checkAndRunCommission() {
	if common.UsageCommissionRate <= 0 {
		return
	}
	now := time.Now()
	if now.Day() != 1 {
		return
	}
	if now.Hour() != 0 {
		return
	}
	// 结算上个月
	lastMonth := now.AddDate(0, -1, 0)
	month := lastMonth.Format("2006-01")
	RunMonthlyUsageCommission(month)
}

// RunMonthlyUsageCommission 执行指定月份的代理使用量分红结算
// month 格式: "2026-05"
// 对外暴露以便管理员手动触发
func RunMonthlyUsageCommission(month string) {
	if !agentCommissionRunning.CompareAndSwap(false, true) {
		logger.LogWarn(context.Background(), fmt.Sprintf("agent commission settlement already running, skip month=%s", month))
		return
	}
	defer agentCommissionRunning.Store(false)

	ctx := context.Background()
	logger.LogInfo(ctx, fmt.Sprintf("agent commission settlement started: month=%s", month))

	rate := common.UsageCommissionRate
	if rate <= 0 {
		logger.LogInfo(ctx, "agent commission rate is 0, skip settlement")
		return
	}
	price := operation_setting.Price
	if price <= 0 {
		logger.LogWarn(ctx, "operation_setting.Price is 0, skip agent commission settlement")
		return
	}

	minAgeDays := common.UsageCommissionMinAccountAgeDays
	maxPerInvitee := common.UsageCommissionMaxPerInviteePerMonth
	now := time.Now().Unix()
	minCreateAt := int64(0)
	if minAgeDays > 0 {
		minCreateAt = now - int64(minAgeDays)*86400
	}

	// 查询所有代理用户
	agents, err := model.GetUsersByRole(common.RoleAgentUser)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("agent commission: get agents failed: %v", err))
		return
	}

	settled := 0
	for _, agent := range agents {
		if err := settleAgentMonth(ctx, agent, month, rate, price, minCreateAt, maxPerInvitee); err != nil {
			logger.LogError(ctx, fmt.Sprintf("agent commission: settle agent %d failed: %v", agent.Id, err))
		} else {
			settled++
		}
	}
	logger.LogInfo(ctx, fmt.Sprintf("agent commission settlement done: month=%s, agents=%d", month, settled))
}

// settleAgentMonth 结算单个代理某月的使用量分红
func settleAgentMonth(ctx context.Context, agent *model.User, month string, rate, price float64, minCreateAt int64, maxPerInvitee float64) error {
	// 查询该代理的所有下级
	invitees, err := model.GetInviteesByAgentId(agent.Id)
	if err != nil {
		return fmt.Errorf("get invitees: %w", err)
	}
	if len(invitees) == 0 {
		return nil
	}

	var totalCommission float64
	var settlements []*model.CommissionSettlement

	for _, invitee := range invitees {
		// 防套利：跳过注册天数不足的账号
		if minCreateAt > 0 && invitee.CreatedAt > minCreateAt {
			continue
		}
		// 防重复结算
		exists, err := model.ExistsSettlement(agent.Id, invitee.Id, month)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("agent commission: check exists failed agent=%d invitee=%d: %v", agent.Id, invitee.Id, err))
			continue
		}
		if exists {
			continue
		}

		// 取上次结算的 EndUsedQuota 作为起始值
		var startUsed int64
		last, err := model.GetLastSettlement(agent.Id, invitee.Id)
		if err == nil {
			startUsed = last.EndUsedQuota
		} // 无记录则从 0 起算

		endUsed := int64(invitee.UsedQuota)
		delta := endUsed - startUsed
		if delta <= 0 {
			continue
		}

		// 计算金额: delta quota / QuotaPerUnit * Price * rate
		quotaValue := (float64(delta) / common.QuotaPerUnit) * price
		commission := quotaValue * rate

		// 应用每下级月度上限
		if maxPerInvitee > 0 && commission > maxPerInvitee {
			commission = maxPerInvitee
		}
		if commission <= 0 {
			continue
		}

		settlements = append(settlements, &model.CommissionSettlement{
			AgentId:        agent.Id,
			InviteeId:      invitee.Id,
			Month:          month,
			StartUsedQuota: startUsed,
			EndUsedQuota:   endUsed,
			UsedQuotaDelta: delta,
			QuotaValue:     quotaValue,
			CommissionRate: rate,
			Commission:     commission,
		})
		totalCommission += commission
	}

	if len(settlements) == 0 || totalCommission <= 0 {
		return nil
	}

	// 事务内写入结算记录 + 更新代理余额
	return model.DB.Transaction(func(tx *gorm.DB) error {
		for _, s := range settlements {
			if err := tx.Create(s).Error; err != nil {
				return fmt.Errorf("create settlement: %w", err)
			}
		}
		if err := tx.Model(&model.User{}).Where("id = ?", agent.Id).Updates(map[string]interface{}{
			"commission_balance": gorm.Expr("commission_balance + ?", totalCommission),
			"commission_total":   gorm.Expr("commission_total + ?", totalCommission),
		}).Error; err != nil {
			return fmt.Errorf("update commission_balance: %w", err)
		}
		return nil
	})
}
