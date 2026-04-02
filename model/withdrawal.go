package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type Withdrawal struct {
	Id            int     `json:"id"`
	UserId        int     `json:"user_id" gorm:"index"`
	Username      string  `json:"username" gorm:"type:varchar(64)"`
	Amount        float64 `json:"amount" gorm:"type:decimal(10,2)"`
	AlipayAccount string  `json:"alipay_account" gorm:"type:varchar(128)"`
	AlipayName    string  `json:"alipay_name" gorm:"type:varchar(64)"`
	Status        string  `json:"status" gorm:"type:varchar(32);default:'pending';index"` // pending, approved, rejected
	Remark        string  `json:"remark" gorm:"type:varchar(255)"`
	ReviewedBy    int     `json:"reviewed_by" gorm:"type:int;default:0"`
	ReviewedAt    int64   `json:"reviewed_at" gorm:"type:bigint;default:0"`
	CreatedAt     int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

func CreateWithdrawal(withdrawal *Withdrawal) error {
	return DB.Create(withdrawal).Error
}

func GetWithdrawalsByUserId(userId int, pageInfo *common.PageInfo) (withdrawals []*Withdrawal, total int64, err error) {
	tx := DB.Where("user_id = ?", userId)
	err = tx.Model(&Withdrawal{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("id desc").Offset(pageInfo.GetStartIdx()).Limit(pageInfo.GetPageSize()).Find(&withdrawals).Error
	return withdrawals, total, err
}

func GetAllWithdrawals(status string, pageInfo *common.PageInfo) (withdrawals []*Withdrawal, total int64, err error) {
	tx := DB.Model(&Withdrawal{})
	if status != "" {
		tx = tx.Where("status = ?", status)
	}
	err = tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("id desc").Offset(pageInfo.GetStartIdx()).Limit(pageInfo.GetPageSize()).Find(&withdrawals).Error
	return withdrawals, total, err
}

func GetWithdrawalById(id int) (*Withdrawal, error) {
	var withdrawal Withdrawal
	err := DB.First(&withdrawal, id).Error
	return &withdrawal, err
}

// ProcessWithdrawal handles approval or rejection of a withdrawal request.
// On rejection, the commission_balance is refunded to the user.
func ProcessWithdrawal(id int, action string, remark string, reviewerId int) error {
	withdrawal, err := GetWithdrawalById(id)
	if err != nil {
		return errors.New("提现记录不存在")
	}
	if withdrawal.Status != common.WithdrawalStatusPending {
		return errors.New("该提现请求已处理")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		// Lock the withdrawal row
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&withdrawal, id).Error; err != nil {
			return err
		}
		if withdrawal.Status != common.WithdrawalStatusPending {
			return errors.New("该提现请求已处理")
		}

		now := common.GetTimestamp()

		switch action {
		case "approve":
			withdrawal.Status = common.WithdrawalStatusApproved
			withdrawal.Remark = remark
			withdrawal.ReviewedBy = reviewerId
			withdrawal.ReviewedAt = now
			if err := tx.Save(withdrawal).Error; err != nil {
				return err
			}
			RecordLog(withdrawal.UserId, LogTypeTopup,
				fmt.Sprintf("提现审核通过，金额: %.2f 元，支付宝账号: %s", withdrawal.Amount, withdrawal.AlipayAccount))

		case "reject":
			withdrawal.Status = common.WithdrawalStatusRejected
			withdrawal.Remark = remark
			withdrawal.ReviewedBy = reviewerId
			withdrawal.ReviewedAt = now
			if err := tx.Save(withdrawal).Error; err != nil {
				return err
			}
			// Refund commission_balance
			if err := tx.Model(&User{}).Where("id = ?", withdrawal.UserId).
				Update("commission_balance", gorm.Expr("commission_balance + ?", withdrawal.Amount)).Error; err != nil {
				return err
			}
			RecordLog(withdrawal.UserId, LogTypeTopup,
				fmt.Sprintf("提现被拒绝，金额: %.2f 元已退回返利余额，原因: %s", withdrawal.Amount, remark))

		default:
			return errors.New("无效的操作类型")
		}
		return nil
	})
}
