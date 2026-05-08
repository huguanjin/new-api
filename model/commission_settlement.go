package model

import (
	"github.com/QuantumNous/new-api/common"
)

// CommissionSettlement 记录代理每月对每个下级用户的使用量分红结算明细
type CommissionSettlement struct {
	Id              int     `json:"id"`
	AgentId         int     `json:"agent_id" gorm:"type:int;index"`
	InviteeId       int     `json:"invitee_id" gorm:"type:int;index"`
	Month           string  `json:"month" gorm:"type:varchar(7);index"` // 格式: "2026-05"
	StartUsedQuota  int64   `json:"start_used_quota" gorm:"type:bigint;default:0"`
	EndUsedQuota    int64   `json:"end_used_quota" gorm:"type:bigint;default:0"`
	UsedQuotaDelta  int64   `json:"used_quota_delta" gorm:"type:bigint;default:0"` // EndUsedQuota - StartUsedQuota
	QuotaValue      float64 `json:"quota_value" gorm:"type:decimal(10,4);default:0"`     // 消耗额度对应的金额（元）
	CommissionRate  float64 `json:"commission_rate" gorm:"type:decimal(6,4);default:0"`  // 结算时使用的费率
	Commission      float64 `json:"commission" gorm:"type:decimal(10,2);default:0"`      // 本次结算金额（元）
	CreatedAt       int64   `json:"created_at" gorm:"autoCreateTime"`
}

// GetLastSettlement 获取某代理对某下级的最近一次结算记录（用于取上次 EndUsedQuota 作为本次起始值）
func GetLastSettlement(agentId, inviteeId int) (*CommissionSettlement, error) {
	var s CommissionSettlement
	err := DB.Where("agent_id = ? AND invitee_id = ?", agentId, inviteeId).
		Order("id DESC").
		First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ExistsSettlement 检查某月的结算记录是否已存在（防重复结算）
func ExistsSettlement(agentId, inviteeId int, month string) (bool, error) {
	var count int64
	err := DB.Model(&CommissionSettlement{}).
		Where("agent_id = ? AND invitee_id = ? AND month = ?", agentId, inviteeId, month).
		Count(&count).Error
	return count > 0, err
}

// CreateSettlement 写入结算记录
func CreateSettlement(s *CommissionSettlement) error {
	return DB.Create(s).Error
}

// GetSettlementsByAgent 查询某代理的历史结算明细（分页）
func GetSettlementsByAgent(agentId int, pageInfo *common.PageInfo) ([]*CommissionSettlement, int64, error) {
	var settlements []*CommissionSettlement
	var total int64
	tx := DB.Where("agent_id = ?", agentId)
	if err := tx.Model(&CommissionSettlement{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := tx.Order("id DESC").
		Offset(pageInfo.GetStartIdx()).
		Limit(pageInfo.GetPageSize()).
		Find(&settlements).Error
	return settlements, total, err
}

// GetSettlementSummaryByAgent 汇总某代理某月的分红总额
func GetSettlementSummaryByAgent(agentId int, month string) (float64, error) {
	var total float64
	err := DB.Model(&CommissionSettlement{}).
		Select("COALESCE(SUM(commission), 0)").
		Where("agent_id = ? AND month = ?", agentId, month).
		Scan(&total).Error
	return total, err
}
