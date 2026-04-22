package model

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	NameRuleExact = iota
	NameRulePrefix
	NameRuleContains
	NameRuleSuffix
)

type BoundChannel struct {
	Name string `json:"name"`
	Type int    `json:"type"`
}

type Model struct {
	Id           int            `json:"id"`
	ModelName    string         `json:"model_name" gorm:"size:128;not null;uniqueIndex:uk_model_name_delete_at,priority:1"`
	Description  string         `json:"description,omitempty" gorm:"type:text"`
	Icon         string         `json:"icon,omitempty" gorm:"type:varchar(128)"`
	Tags         string         `json:"tags,omitempty" gorm:"type:varchar(255)"`
	VendorID      int            `json:"vendor_id,omitempty" gorm:"index"`
	Endpoints     string         `json:"endpoints,omitempty" gorm:"type:text"`
	VideoProvider   string         `json:"video_provider,omitempty" gorm:"size:64;index"`
	ImageProvider   string         `json:"image_provider,omitempty" gorm:"size:64;index"`
	RedBookProvider string         `json:"red_book_provider,omitempty" gorm:"size:64;index"`
	Status        int            `json:"status" gorm:"default:1"`
	SyncOfficial int            `json:"sync_official" gorm:"default:1"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime  int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_model_name_delete_at,priority:2"`

	BoundChannels []BoundChannel `json:"bound_channels,omitempty" gorm:"-"`
	EnableGroups  []string       `json:"enable_groups,omitempty" gorm:"-"`
	QuotaTypes    []int          `json:"quota_types,omitempty" gorm:"-"`
	NameRule      int            `json:"name_rule" gorm:"default:0"`

	MatchedModels []string `json:"matched_models,omitempty" gorm:"-"`
	MatchedCount  int      `json:"matched_count,omitempty" gorm:"-"`
}

func (mi *Model) Insert() error {
	now := common.GetTimestamp()
	mi.CreatedTime = now
	mi.UpdatedTime = now

	// 保存原始值（因为 Create 后可能被 GORM 的 default 标签覆盖为 1）
	originalStatus := mi.Status
	originalSyncOfficial := mi.SyncOfficial

	// 先创建记录（GORM 会对零值字段应用默认值）
	if err := DB.Create(mi).Error; err != nil {
		return err
	}

	// 使用保存的原始值进行更新，确保零值能正确保存
	return DB.Model(&Model{}).Where("id = ?", mi.Id).Updates(map[string]interface{}{
		"status":        originalStatus,
		"sync_official": originalSyncOfficial,
	}).Error
}

func IsModelNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&Model{}).Where("model_name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

func (mi *Model) Update() error {
	mi.UpdatedTime = common.GetTimestamp()
	// 使用 Select 强制更新所有字段，包括零值
	return DB.Model(&Model{}).Where("id = ?", mi.Id).
		Select("model_name", "description", "icon", "tags", "vendor_id", "endpoints", "video_provider", "image_provider", "red_book_provider", "status", "sync_official", "name_rule", "updated_time").
		Updates(mi).Error
}

func (mi *Model) Delete() error {
	return DB.Delete(mi).Error
}

func GetModelsByVideoProvider() (map[string][]string, error) {
	var results []struct {
		VideoProvider string
		ModelName     string
	}
	err := DB.Model(&Model{}).
		Select("video_provider, model_name").
		Where("video_provider <> '' AND status = 1").
		Find(&results).Error
	if err != nil {
		return nil, err
	}
	m := make(map[string][]string)
	for _, r := range results {
		m[r.VideoProvider] = append(m[r.VideoProvider], r.ModelName)
	}
	return m, nil
}

type PaintingModelInfo struct {
	Name     string `json:"name"`
	Provider string `json:"provider"`
}

func GetPaintingModels() ([]PaintingModelInfo, error) {
	var results []struct {
		ModelName     string
		ImageProvider string
	}
	err := DB.Model(&Model{}).
		Select("model_name, image_provider").
		Where("image_provider <> '' AND status = 1").
		Find(&results).Error
	if err != nil {
		return nil, err
	}
	infos := make([]PaintingModelInfo, 0, len(results))
	for _, r := range results {
		provider := r.ImageProvider
		if provider == "painting" {
			provider = "gemini" // backward compatibility
		}
		infos = append(infos, PaintingModelInfo{Name: r.ModelName, Provider: provider})
	}
	return infos, nil
}

func GetRedBookTextModels() ([]string, error) {
	var results []struct {
		ModelName string
	}
	err := DB.Model(&Model{}).
		Select("model_name").
		Where("red_book_provider = 'text' AND status = 1").
		Find(&results).Error
	if err != nil {
		return nil, err
	}
	models := make([]string, 0, len(results))
	for _, r := range results {
		models = append(models, r.ModelName)
	}
	return models, nil
}

func GetRedBookImageModels() ([]string, error) {
	var results []struct {
		ModelName string
	}
	err := DB.Model(&Model{}).
		Select("model_name").
		Where("red_book_provider = 'image' AND status = 1").
		Find(&results).Error
	if err != nil {
		return nil, err
	}
	models := make([]string, 0, len(results))
	for _, r := range results {
		models = append(models, r.ModelName)
	}
	return models, nil
}

func GetVendorModelCounts() (map[int64]int64, error) {
	var stats []struct {
		VendorID int64
		Count    int64
	}
	if err := DB.Model(&Model{}).
		Select("vendor_id as vendor_id, count(*) as count").
		Group("vendor_id").
		Scan(&stats).Error; err != nil {
		return nil, err
	}
	m := make(map[int64]int64, len(stats))
	for _, s := range stats {
		m[s.VendorID] = s.Count
	}
	return m, nil
}

func GetAllModels(offset int, limit int) ([]*Model, error) {
	var models []*Model
	err := DB.Order("id DESC").Offset(offset).Limit(limit).Find(&models).Error
	return models, err
}

func GetBoundChannelsByModelsMap(modelNames []string) (map[string][]BoundChannel, error) {
	result := make(map[string][]BoundChannel)
	if len(modelNames) == 0 {
		return result, nil
	}
	type row struct {
		Model string
		Name  string
		Type  int
	}
	var rows []row
	err := DB.Table("channels").
		Select("abilities.model as model, channels.name as name, channels.type as type").
		Joins("JOIN abilities ON abilities.channel_id = channels.id").
		Where("abilities.model IN ? AND abilities.enabled = ?", modelNames, true).
		Distinct().
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.Model] = append(result[r.Model], BoundChannel{Name: r.Name, Type: r.Type})
	}
	return result, nil
}

func SearchModels(keyword string, vendor string, hasIcon, hasDescription, hasVendor, hasTags string, offset int, limit int) ([]*Model, int64, error) {
	var models []*Model
	db := DB.Model(&Model{})
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("model_name LIKE ? OR description LIKE ? OR tags LIKE ?", like, like, like)
	}
	if vendor != "" {
		if vid, err := strconv.Atoi(vendor); err == nil {
			db = db.Where("models.vendor_id = ?", vid)
		} else {
			db = db.Joins("JOIN vendors ON vendors.id = models.vendor_id").Where("vendors.name LIKE ?", "%"+vendor+"%")
		}
	}
	if hasIcon == "1" {
		db = db.Where("models.icon != ''")
	} else if hasIcon == "0" {
		db = db.Where("models.icon = ''")
	}
	if hasDescription == "1" {
		db = db.Where("models.description != ''")
	} else if hasDescription == "0" {
		db = db.Where("models.description = ''")
	}
	if hasVendor == "1" {
		db = db.Where("models.vendor_id > 0")
	} else if hasVendor == "0" {
		db = db.Where("models.vendor_id = 0")
	}
	if hasTags == "1" {
		db = db.Where("models.tags != ''")
	} else if hasTags == "0" {
		db = db.Where("models.tags = ''")
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := db.Order("models.id DESC").Offset(offset).Limit(limit).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	return models, total, nil
}
