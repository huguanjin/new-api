package model

import "gorm.io/gorm"

type ExternalSiteConfig struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Name        string `json:"name" gorm:"type:varchar(64);not null"`
	Url         string `json:"url" gorm:"type:varchar(256);not null"`
	Token       string `json:"token" gorm:"type:text;not null"`
	UserIdExt   string `json:"user_id_ext" gorm:"type:varchar(32);default:''"`
	Remark      string `json:"remark" gorm:"type:varchar(255);default:''"`
	CreatedTime int64  `json:"created_time" gorm:"bigint;autoCreateTime"`
}

func (ExternalSiteConfig) TableName() string {
	return "external_site_configs"
}

// MaskedToken returns the token with most characters hidden
func (s *ExternalSiteConfig) MaskedToken() string {
	if len(s.Token) <= 8 {
		return "****"
	}
	return s.Token[:4] + "****" + s.Token[len(s.Token)-4:]
}

func GetAllExternalSites() ([]*ExternalSiteConfig, error) {
	var sites []*ExternalSiteConfig
	err := DB.Order("id asc").Find(&sites).Error
	return sites, err
}

func GetExternalSiteById(id int) (*ExternalSiteConfig, error) {
	var site ExternalSiteConfig
	err := DB.Where("id = ?", id).First(&site).Error
	return &site, err
}

func CreateExternalSite(site *ExternalSiteConfig) error {
	return DB.Create(site).Error
}

func UpdateExternalSite(site *ExternalSiteConfig) error {
	return DB.Save(site).Error
}

func DeleteExternalSiteById(id int) error {
	return DB.Where("id = ?", id).Delete(&ExternalSiteConfig{}).Error
}

// MaskedSites returns a copy of the slice with tokens masked
func MaskedSites(sites []*ExternalSiteConfig) []map[string]any {
	result := make([]map[string]any, 0, len(sites))
	for _, s := range sites {
		result = append(result, map[string]any{
			"id":           s.Id,
			"name":         s.Name,
			"url":          s.Url,
			"token":        s.MaskedToken(),
			"user_id_ext":  s.UserIdExt,
			"remark":       s.Remark,
			"created_time": s.CreatedTime,
		})
	}
	return result
}

// BatchImportExternalSites deletes all existing sites and inserts the new ones (for JSON import)
func BatchImportExternalSites(sites []*ExternalSiteConfig) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("1 = 1").Delete(&ExternalSiteConfig{}).Error; err != nil {
			return err
		}
		if len(sites) == 0 {
			return nil
		}
		return tx.Create(&sites).Error
	})
}
