package model

import (
	"strconv"
	"time"
)

const GeneratedImageTTL = 24 * time.Hour

type GeneratedImage struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId     int    `json:"user_id" gorm:"index;not null"`
	RequestId  string `json:"request_id" gorm:"type:varchar(64);index:idx_gen_img_request_id;not null"`
	Filename   string `json:"filename" gorm:"type:varchar(100);not null"`
	MimeType   string `json:"mime_type" gorm:"type:varchar(50);not null"`
	Model      string `json:"model" gorm:"type:varchar(100)"`
	Prompt     string `json:"prompt,omitempty" gorm:"type:text"`
	ImageIndex int    `json:"image_index" gorm:"default:0"`
	FileSize   int64  `json:"file_size" gorm:"default:0"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime"`
	ExpiresAt  int64  `json:"expires_at" gorm:"index;not null"`
}

func (GeneratedImage) TableName() string {
	return "generated_images"
}

func CreateGeneratedImage(image *GeneratedImage) error {
	return DB.Create(image).Error
}

func GetGeneratedImagesByUserId(userId int, page int, pageSize int) ([]*GeneratedImage, int64, error) {
	var images []*GeneratedImage
	var total int64
	now := time.Now().Unix()

	tx := DB.Where("user_id = ? AND expires_at > ?", userId, now)
	tx.Model(&GeneratedImage{}).Count(&total)

	err := tx.Order("created_at DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&images).Error
	return images, total, err
}

func GetGeneratedImagesByRequestId(requestId string, userId int) ([]*GeneratedImage, error) {
	var images []*GeneratedImage
	now := time.Now().Unix()
	err := DB.Where("request_id = ? AND user_id = ? AND expires_at > ?", requestId, userId, now).
		Order("image_index ASC").
		Find(&images).Error
	return images, err
}

func GetGeneratedImageById(id int, userId int) (*GeneratedImage, error) {
	var image GeneratedImage
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&image).Error
	if err != nil {
		return nil, err
	}
	return &image, nil
}

func DeleteExpiredGeneratedImages() ([]*GeneratedImage, error) {
	var expired []*GeneratedImage
	now := time.Now().Unix()
	err := DB.Where("expires_at <= ?", now).Find(&expired).Error
	if err != nil {
		return nil, err
	}
	if len(expired) > 0 {
		err = DB.Where("expires_at <= ?", now).Delete(&GeneratedImage{}).Error
	}
	return expired, err
}

func CountGeneratedImagesByRequestId(requestId string) int64 {
	var count int64
	DB.Model(&GeneratedImage{}).Where("request_id = ?", requestId).Count(&count)
	return count
}

func GetGeneratedImageCountByUserId(userId int) string {
	var count int64
	now := time.Now().Unix()
	DB.Model(&GeneratedImage{}).Where("user_id = ? AND expires_at > ?", userId, now).Count(&count)
	return strconv.FormatInt(count, 10)
}
