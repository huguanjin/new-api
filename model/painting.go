package model

import (
	"time"
)

const PaintingImageTTL = 48 * time.Hour

type PaintingImage struct {
	Id             int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId         int    `json:"user_id" gorm:"index;not null"`
	Filename       string `json:"filename" gorm:"type:varchar(100);not null"`
	MimeType       string `json:"mime_type" gorm:"type:varchar(50);not null"`
	Prompt         string `json:"prompt" gorm:"type:text"`
	Model          string `json:"model" gorm:"type:varchar(100)"`
	AspectRatio    string `json:"aspect_ratio" gorm:"type:varchar(20)"`
	ImageSize      string `json:"image_size" gorm:"type:varchar(20)"`
	ReferenceCount int    `json:"reference_count" gorm:"default:0"`
	FileSize       int64  `json:"file_size" gorm:"default:0"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime"`
	ExpiresAt      int64  `json:"expires_at" gorm:"index;not null"`
}

func (PaintingImage) TableName() string {
	return "painting_images"
}

func CreatePaintingImage(image *PaintingImage) error {
	return DB.Create(image).Error
}

func GetPaintingImagesByUserId(userId int) ([]*PaintingImage, error) {
	var images []*PaintingImage
	now := time.Now().Unix()
	err := DB.Where("user_id = ? AND expires_at > ?", userId, now).
		Order("created_at DESC").
		Find(&images).Error
	return images, err
}

func GetPaintingImageById(id int, userId int) (*PaintingImage, error) {
	var image PaintingImage
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&image).Error
	if err != nil {
		return nil, err
	}
	return &image, nil
}

func DeletePaintingImage(id int, userId int) error {
	return DB.Where("id = ? AND user_id = ?", id, userId).Delete(&PaintingImage{}).Error
}

func DeleteExpiredPaintingImages() ([]*PaintingImage, error) {
	var expired []*PaintingImage
	now := time.Now().Unix()
	err := DB.Where("expires_at <= ?", now).Find(&expired).Error
	if err != nil {
		return nil, err
	}
	if len(expired) > 0 {
		err = DB.Where("expires_at <= ?", now).Delete(&PaintingImage{}).Error
	}
	return expired, err
}
