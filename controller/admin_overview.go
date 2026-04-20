package controller

import (
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAdminOverview(c *gin.Context) {
	dateStr := c.Query("date")
	now := time.Now()
	var targetDate time.Time
	if dateStr != "" {
		parsed, err := time.ParseInLocation("2006-01-02", dateStr, now.Location())
		if err == nil {
			targetDate = parsed
		} else {
			targetDate = now
		}
	} else {
		targetDate = now
	}

	todayStart := time.Date(targetDate.Year(), targetDate.Month(), targetDate.Day(), 0, 0, 0, 0, targetDate.Location()).Unix()
	tomorrowStart := todayStart + 86400
	yesterdayStart := todayStart - 86400

	const rankLimit = 10

	var (
		todayTopupMoney     float64
		yesterdayTopupMoney float64
		todayConsumeQuota   int
		yesterdayConsumeQuota int
		todayRegisterCount    int64
		yesterdayRegisterCount int64
		modelRank     []model.UsageRankItem
		channelRank   []model.UsageRankItem
		userRank      []model.UsageRankItem
		errorModelRank []model.ErrorRankItem
	)

	var wg sync.WaitGroup
	var errs [10]error

	wg.Add(10)

	go func() {
		defer wg.Done()
		todayTopupMoney, errs[0] = model.SumTopUpMoneyByDate(todayStart, tomorrowStart)
	}()
	go func() {
		defer wg.Done()
		yesterdayTopupMoney, errs[1] = model.SumTopUpMoneyByDate(yesterdayStart, todayStart)
	}()
	go func() {
		defer wg.Done()
		todayConsumeQuota, errs[2] = model.SumConsumeQuotaByDate(todayStart, tomorrowStart)
	}()
	go func() {
		defer wg.Done()
		yesterdayConsumeQuota, errs[3] = model.SumConsumeQuotaByDate(yesterdayStart, todayStart)
	}()
	go func() {
		defer wg.Done()
		todayRegisterCount, errs[4] = model.CountNewUsersByDate(todayStart, tomorrowStart)
	}()
	go func() {
		defer wg.Done()
		yesterdayRegisterCount, errs[5] = model.CountNewUsersByDate(yesterdayStart, todayStart)
	}()
	go func() {
		defer wg.Done()
		modelRank, errs[6] = model.GetModelUsageRank(todayStart, tomorrowStart, rankLimit)
	}()
	go func() {
		defer wg.Done()
		channelRank, errs[7] = model.GetChannelUsageRank(todayStart, tomorrowStart, rankLimit)
	}()
	go func() {
		defer wg.Done()
		userRank, errs[8] = model.GetUserUsageRank(todayStart, tomorrowStart, rankLimit)
	}()
	go func() {
		defer wg.Done()
		errorModelRank, errs[9] = model.GetErrorModelRank(todayStart, tomorrowStart, rankLimit)
	}()

	wg.Wait()

	for _, e := range errs {
		if e != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": e.Error(),
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"today_topup_money":       todayTopupMoney,
			"yesterday_topup_money":   yesterdayTopupMoney,
			"today_consume_quota":     todayConsumeQuota,
			"yesterday_consume_quota": yesterdayConsumeQuota,
			"today_register_count":    todayRegisterCount,
			"yesterday_register_count": yesterdayRegisterCount,
			"model_rank":              modelRank,
			"channel_rank":            channelRank,
			"user_rank":               userRank,
			"error_model_rank":        errorModelRank,
		},
	})
}
