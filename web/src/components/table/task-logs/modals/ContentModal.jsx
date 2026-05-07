/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect } from 'react';
import { Modal, Button, Typography, Spin } from '@douyinfe/semi-ui';
import { IconExternalOpen, IconCopy } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const ContentModal = ({
  isModalOpen,
  setIsModalOpen,
  modalContent,
  isVideo,
  isImage,
  imageUrls,
}) => {
  const { t } = useTranslation();
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isModalOpen && isVideo) {
      setVideoError(false);
      setIsLoading(true);
    }
  }, [isModalOpen, isVideo]);

  const handleVideoError = () => {
    setVideoError(true);
    setIsLoading(false);
  };

  const handleVideoLoaded = () => {
    setIsLoading(false);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(modalContent);
  };

  const handleOpenInNewTab = () => {
    window.open(modalContent, '_blank');
  };

  const renderImageContent = () => {
    const urls = Array.isArray(imageUrls) ? imageUrls : [];
    if (urls.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Text type='tertiary'>{t('暂无图片')}</Text>
        </div>
      );
    }
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'center',
          padding: '8px',
        }}
      >
        {urls.map((url, idx) => (
          <div
            key={idx}
            style={{
              position: 'relative',
              flex: urls.length === 1 ? '1 1 100%' : '0 1 calc(50% - 6px)',
              maxWidth: urls.length === 1 ? '100%' : 'calc(50% - 6px)',
            }}
          >
            <img
              src={url}
              alt={`${t('生成图片')} ${idx + 1}`}
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '60vh',
                objectFit: 'contain',
                borderRadius: '4px',
                display: 'block',
              }}
            />
            <div style={{ marginTop: '6px', textAlign: 'center' }}>
              <Button
                size='small'
                icon={<IconExternalOpen />}
                onClick={() => window.open(url, '_blank')}
                style={{ marginRight: '6px' }}
              >
                {t('在新标签页中打开')}
              </Button>
              <Button
                size='small'
                icon={<IconCopy />}
                onClick={() => navigator.clipboard.writeText(url)}
              >
                {t('复制链接')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderVideoContent = () => {
    if (videoError) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '16px' }}
          >
            {t('视频无法在当前浏览器中播放，这可能是由于：')}
          </Text>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}
          >
            {t('• 视频服务商的跨域限制')}
          </Text>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}
          >
            {t('• 需要特定的请求头或认证')}
          </Text>
          <Text
            type='tertiary'
            style={{ display: 'block', marginBottom: '16px', fontSize: '12px' }}
          >
            {t('• 防盗链保护机制')}
          </Text>

          <div style={{ marginTop: '20px' }}>
            <Button
              icon={<IconExternalOpen />}
              onClick={handleOpenInNewTab}
              style={{ marginRight: '8px' }}
            >
              {t('在新标签页中打开')}
            </Button>
            <Button icon={<IconCopy />} onClick={handleCopyUrl}>
              {t('复制链接')}
            </Button>
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '8px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
            }}
          >
            <Text
              type='tertiary'
              style={{ fontSize: '10px', wordBreak: 'break-all' }}
            >
              {modalContent}
            </Text>
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
          >
            <Spin size='large' />
          </div>
        )}
        <video
          src={modalContent}
          controls
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
          onLoadStart={() => setIsLoading(true)}
        />
      </div>
    );
  };

  const isImageMode = isImage && !isVideo;
  const isVideoMode = isVideo && !isImage;

  return (
    <Modal
      visible={isModalOpen}
      onOk={() => setIsModalOpen(false)}
      onCancel={() => setIsModalOpen(false)}
      closable={null}
      bodyStyle={{
        height: isVideoMode ? '70vh' : 'auto',
        maxHeight: '80vh',
        overflow: 'auto',
        padding: isVideoMode && videoError ? '0' : '24px',
      }}
      width={isVideoMode || isImageMode ? '90vw' : 800}
      style={isVideoMode || isImageMode ? { maxWidth: 960 } : undefined}
    >
      {isVideoMode ? (
        renderVideoContent()
      ) : isImageMode ? (
        renderImageContent()
      ) : (
        <p style={{ whiteSpace: 'pre-line' }}>{modalContent}</p>
      )}
    </Modal>
  );
};

export default ContentModal;
