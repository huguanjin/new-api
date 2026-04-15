package model

import (
	"time"
)

const RedBookImageTTL = 48 * time.Hour

type RedBookProject struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int    `json:"user_id" gorm:"index;not null"`
	Topic       string `json:"topic" gorm:"type:varchar(500);not null"`
	Outline     string `json:"outline" gorm:"type:text"`
	PageCount   int    `json:"page_count" gorm:"default:0"`
	TextModel   string `json:"text_model" gorm:"type:varchar(100)"`
	ImageModel  string `json:"image_model" gorm:"type:varchar(100)"`
	Status      string `json:"status" gorm:"type:varchar(20);default:'draft'"`
	CreatedAt   int64  `json:"created_at" gorm:"autoCreateTime"`
	ExpiresAt   int64  `json:"expires_at" gorm:"index;not null"`
}

func (RedBookProject) TableName() string {
	return "redbook_projects"
}

type RedBookImage struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"index;not null"`
	ProjectId int    `json:"project_id" gorm:"index;not null"`
	Filename  string `json:"filename" gorm:"type:varchar(100);not null"`
	MimeType  string `json:"mime_type" gorm:"type:varchar(50);not null"`
	Prompt    string `json:"prompt" gorm:"type:text"`
	Model     string `json:"model" gorm:"type:varchar(100)"`
	PageIndex int    `json:"page_index" gorm:"default:0"`
	PageType  string `json:"page_type" gorm:"type:varchar(20)"` // "cover" or "content"
	FileSize  int64  `json:"file_size" gorm:"default:0"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
	ExpiresAt int64  `json:"expires_at" gorm:"index;not null"`
}

func (RedBookImage) TableName() string {
	return "redbook_images"
}

// RedBookProject CRUD

func CreateRedBookProject(project *RedBookProject) error {
	return DB.Create(project).Error
}

func GetRedBookProjectsByUserId(userId int) ([]*RedBookProject, error) {
	var projects []*RedBookProject
	now := time.Now().Unix()
	err := DB.Where("user_id = ? AND expires_at > ?", userId, now).
		Order("created_at DESC").
		Find(&projects).Error
	return projects, err
}

func GetRedBookProjectById(id int, userId int) (*RedBookProject, error) {
	var project RedBookProject
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func UpdateRedBookProject(project *RedBookProject) error {
	return DB.Model(&RedBookProject{}).Where("id = ? AND user_id = ?", project.Id, project.UserId).
		Updates(map[string]interface{}{
			"topic":       project.Topic,
			"outline":     project.Outline,
			"page_count":  project.PageCount,
			"text_model":  project.TextModel,
			"image_model": project.ImageModel,
			"status":      project.Status,
		}).Error
}

func DeleteRedBookProject(id int, userId int) error {
	return DB.Where("id = ? AND user_id = ?", id, userId).Delete(&RedBookProject{}).Error
}

func DeleteExpiredRedBookProjects() ([]int, error) {
	var expired []*RedBookProject
	now := time.Now().Unix()
	err := DB.Where("expires_at <= ?", now).Find(&expired).Error
	if err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(expired))
	for _, p := range expired {
		ids = append(ids, p.Id)
	}
	if len(expired) > 0 {
		err = DB.Where("expires_at <= ?", now).Delete(&RedBookProject{}).Error
	}
	return ids, err
}

// RedBookImage CRUD

func CreateRedBookImage(image *RedBookImage) error {
	return DB.Create(image).Error
}

func GetRedBookImagesByProjectId(projectId int, userId int) ([]*RedBookImage, error) {
	var images []*RedBookImage
	now := time.Now().Unix()
	err := DB.Where("project_id = ? AND user_id = ? AND expires_at > ?", projectId, userId, now).
		Order("page_index ASC").
		Find(&images).Error
	return images, err
}

func GetRedBookImagesByUserId(userId int) ([]*RedBookImage, error) {
	var images []*RedBookImage
	now := time.Now().Unix()
	err := DB.Where("user_id = ? AND expires_at > ?", userId, now).
		Order("created_at DESC").
		Find(&images).Error
	return images, err
}

func GetRedBookImageById(id int, userId int) (*RedBookImage, error) {
	var image RedBookImage
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&image).Error
	if err != nil {
		return nil, err
	}
	return &image, nil
}

func DeleteRedBookImage(id int, userId int) error {
	return DB.Where("id = ? AND user_id = ?", id, userId).Delete(&RedBookImage{}).Error
}

func DeleteRedBookImagesByProjectId(projectId int) error {
	return DB.Where("project_id = ?", projectId).Delete(&RedBookImage{}).Error
}

func DeleteExpiredRedBookImages() ([]*RedBookImage, error) {
	var expired []*RedBookImage
	now := time.Now().Unix()
	err := DB.Where("expires_at <= ?", now).Find(&expired).Error
	if err != nil {
		return nil, err
	}
	if len(expired) > 0 {
		err = DB.Where("expires_at <= ?", now).Delete(&RedBookImage{}).Error
	}
	return expired, err
}
