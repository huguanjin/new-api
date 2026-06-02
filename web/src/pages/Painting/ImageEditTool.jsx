import React, { useState, useCallback } from 'react';
import {
  Select,
  Button,
  TextArea,
  Card,
  Typography,
  Spin,
  Empty,
  Toast,
  Upload,
  Modal,
} from '@douyinfe/semi-ui';
import {
  IconImage,
  IconDelete,
  IconDownload,
  IconSave,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { usePaintingEdit } from '../../hooks/painting/usePaintingEdit';

const { Text } = Typography;

const GPT_IMAGE_SIZES_STANDARD = [
  { value: '1024x1024', label: '1:1 (1024×1024 · 1K)' },
  { value: '1280x720',  label: '16:9 (1280×720 · 1K)' },
  { value: '720x1280',  label: '9:16 (720×1280 · 1K)' },
  { value: '1152x864',  label: '4:3 (1152×864 · 1K)' },
  { value: '864x1152',  label: '3:4 (864×1152 · 1K)' },
  { value: '1248x832',  label: '3:2 (1248×832 · 1K)' },
  { value: '832x1248',  label: '2:3 (832×1248 · 1K)' },
  { value: '1120x896',  label: '5:4 (1120×896 · 1K)' },
  { value: '896x1120',  label: '4:5 (896×1120 · 1K)' },
  { value: '1456x624',  label: '21:9 (1456×624 · 1K)' },
  { value: 'auto',      label: 'auto' },
];

// VIP 模型平铺列表，每项标注比例、像素尺寸和分辨率档位
const GPT_IMAGE_SIZES_VIP = [
  { value: 'auto',      label: 'auto' },
  { value: '1024x1024', label: '1:1 (1024×1024 · 1K)' },
  { value: '2048x2048', label: '1:1 (2048×2048 · 2K)' },
  { value: '2880x2880', label: '1:1 (2880×2880 · 4K)' },
  { value: '1280x720',  label: '16:9 (1280×720 · 1K)' },
  { value: '2560x1440', label: '16:9 (2560×1440 · 2K)' },
  { value: '3840x2160', label: '16:9 (3840×2160 · 4K)' },
  { value: '720x1280',  label: '9:16 (720×1280 · 1K)' },
  { value: '1440x2560', label: '9:16 (1440×2560 · 2K)' },
  { value: '2160x3840', label: '9:16 (2160×3840 · 4K)' },
  { value: '1152x864',  label: '4:3 (1152×864 · 1K)' },
  { value: '2304x1728', label: '4:3 (2304×1728 · 2K)' },
  { value: '3264x2448', label: '4:3 (3264×2448 · 4K)' },
  { value: '864x1152',  label: '3:4 (864×1152 · 1K)' },
  { value: '1728x2304', label: '3:4 (1728×2304 · 2K)' },
  { value: '2448x3264', label: '3:4 (2448×3264 · 4K)' },
  { value: '1248x832',  label: '3:2 (1248×832 · 1K)' },
  { value: '2496x1664', label: '3:2 (2496×1664 · 2K)' },
  { value: '3504x2336', label: '3:2 (3504×2336 · 4K)' },
  { value: '832x1248',  label: '2:3 (832×1248 · 1K)' },
  { value: '1664x2496', label: '2:3 (1664×2496 · 2K)' },
  { value: '2336x3504', label: '2:3 (2336×3504 · 4K)' },
  { value: '1120x896',  label: '5:4 (1120×896 · 1K)' },
  { value: '2240x1792', label: '5:4 (2240×1792 · 2K)' },
  { value: '3200x2560', label: '5:4 (3200×2560 · 4K)' },
  { value: '896x1120',  label: '4:5 (896×1120 · 1K)' },
  { value: '1792x2240', label: '4:5 (1792×2240 · 2K)' },
  { value: '2560x3200', label: '4:5 (2560×3200 · 4K)' },
  { value: '1456x624',  label: '21:9 (1456×624 · 1K)' },
  { value: '3024x1296', label: '21:9 (3024×1296 · 2K)' },
  { value: '3696x1584', label: '21:9 (3696×1584 · 4K)' },
];

const GPT_IMAGE_QUALITY = [
  { value: 'auto', label: 'auto' },
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
];

export default function ImageEditTool({
  model,
  setModel,
  tokenKey,
  setTokenKey,
  tokens,
  tokensLoading,
  paintingModels,
  saveImage,
}) {
  const { t } = useTranslation();
  const { edit, loading: editing, result, error: editError, reset } = usePaintingEdit();
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [editSize, setEditSize] = useState('1024x1024');
  const [editQuality, setEditQuality] = useState('auto');
  const [savingIndex, setSavingIndex] = useState(-1);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');

  // Only show openai_image provider models
  const editableModels = paintingModels.filter((m) => m.provider === 'openai_image');
  const editModel = editableModels.some((m) => m.value === model)
    ? model
    : editableModels[0]?.value || '';

  const handleImageUpload = useCallback(({ file }) => {
    const f = file.fileInstance;
    if (!f) return false;
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(f);
    return false;
  }, []);

  const handleEdit = useCallback(async () => {
    if (!prompt.trim()) {
      Toast.warning(t('请输入提示词'));
      return;
    }
    if (!imageFile) {
      Toast.warning(t('请上传需要编辑的图片'));
      return;
    }
    if (!tokenKey) {
      Toast.warning(t('请选择密钥'));
      return;
    }
    if (!editModel) {
      Toast.warning(t('请先在模型管理中配置 GPT Image 绘画模型'));
      return;
    }
    await edit({ prompt: prompt.trim(), model: editModel, tokenKey, imageFile, size: editSize, quality: editModel === 'gpt-image-2-vip' ? editQuality : undefined });
  }, [prompt, imageFile, tokenKey, editModel, editSize, editQuality, edit, t]);

  const handleSave = useCallback(
    async (imageData, index) => {
      setSavingIndex(index);
      try {
        await saveImage({
          base64Data: imageData.base64,
          mimeType: imageData.mimeType,
          prompt: prompt.trim(),
          model: editModel,
        });
        Toast.success(t('保存成功'));
      } catch {
        Toast.error(t('保存失败'));
      } finally {
        setSavingIndex(-1);
      }
    },
    [saveImage, prompt, editModel, t],
  );

  const handleDownload = useCallback((imageData, filename) => {
    const link = document.createElement('a');
    link.href = imageData.base64
      ? `data:${imageData.mimeType};base64,${imageData.base64}`
      : (imageData.url || '');
    link.download = filename || 'edited.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  if (editableModels.length === 0) {
    return (
      <Empty
        image={<IconImage size='extra-large' style={{ color: 'var(--semi-color-text-3)' }} />}
        description={t('请先在模型管理中将模型的绘画接口设置为 GPT Image')}
        style={{ padding: '60px 0' }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      {/* Left Panel */}
      <div style={{ flex: '1 1 400px', minWidth: 340 }}>
        {/* Settings Card */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {/* Model */}
            <div style={{ flex: '1 1 200px' }}>
              <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>
                {t('模型')}
              </Text>
              <Select
                value={editModel}
                onChange={setModel}
                style={{ width: '100%' }}
                optionList={editableModels}
              />
            </div>
            {/* Token */}
            <div style={{ flex: '1 1 200px' }}>
              <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>
                {t('密钥')}
              </Text>
              <Select
                value={tokenKey}
                onChange={setTokenKey}
                style={{ width: '100%' }}
                loading={tokensLoading}
                placeholder={t('选择密钥')}
                emptyContent={t('暂无可用密钥')}
                optionList={tokens.map((tk) => ({
                  value: tk.key,
                  label: tk.name
                    ? `${tk.name} (${tk.key.slice(0, 8)}...)`
                    : `${tk.key.slice(0, 16)}...`,
                }))}
              />
            </div>
            {/* Size */}
            <div style={{ flex: '1 1 160px' }}>
              <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>
                {t('图片尺寸')}
              </Text>
              <Select
                value={editSize}
                onChange={setEditSize}
                style={{ width: '100%' }}
                optionList={editModel === 'gpt-image-2-vip' ? GPT_IMAGE_SIZES_VIP : GPT_IMAGE_SIZES_STANDARD}
              />
            </div>
            {/* Quality (vip only) */}
            {editModel === 'gpt-image-2-vip' && (
              <div style={{ flex: '1 1 120px' }}>
                <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>
                  {t('图片质量')}
                </Text>
                <Select
                  value={editQuality}
                  onChange={setEditQuality}
                  style={{ width: '100%' }}
                  optionList={GPT_IMAGE_QUALITY}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Image Upload + Prompt Card */}
        <Card style={{ marginBottom: 16 }}>
          <Text strong size='small' style={{ display: 'block', marginBottom: 8 }}>
            {t('原始图片')}
          </Text>
          {imagePreview ? (
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <img
                src={imagePreview}
                alt='source'
                style={{
                  maxWidth: '100%',
                  maxHeight: 200,
                  borderRadius: 8,
                  display: 'block',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setPreviewSrc(imagePreview);
                  setPreviewVisible(true);
                }}
              />
              <Button
                icon={<IconDelete />}
                type='danger'
                theme='solid'
                size='small'
                style={{ position: 'absolute', top: 4, right: 4 }}
                onClick={() => {
                  setImageFile(null);
                  setImagePreview('');
                }}
              >
                {t('移除')}
              </Button>
            </div>
          ) : (
            <Upload
              action=''
              accept='image/png,image/jpeg,image/webp'
              showUploadList={false}
              customRequest={handleImageUpload}
              style={{ marginBottom: 12 }}
            >
              <div
                style={{
                  width: '100%',
                  height: 120,
                  border: '1px dashed var(--semi-color-border)',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--semi-color-text-2)',
                  gap: 8,
                }}
              >
                <IconImage size='large' />
                <Text type='tertiary' size='small'>
                  {t('点击或拖拽上传图片')}
                </Text>
              </div>
            </Upload>
          )}

          <Text strong size='small' style={{ display: 'block', marginBottom: 8 }}>
            {t('编辑提示词')}
          </Text>
          <TextArea
            value={prompt}
            onChange={setPrompt}
            placeholder={t('描述你希望对图片做的修改...')}
            autosize={{ minRows: 3, maxRows: 6 }}
            style={{ marginBottom: 12 }}
          />
          <Button
            theme='solid'
            type='primary'
            size='large'
            loading={editing}
            onClick={handleEdit}
            block
            icon={<IconImage />}
          >
            {editing ? t('正在编辑...') : t('编辑图片')}
          </Button>
        </Card>
      </div>

      {/* Right Panel: Results */}
      <div style={{ flex: '1 1 400px', minWidth: 340 }}>
        <Card
          title={t('编辑结果')}
          style={{ minHeight: 400 }}
          headerExtraContent={
            result && (
              <Button size='small' icon={<IconRefresh />} onClick={reset}>
                {t('清除')}
              </Button>
            )
          }
        >
          {editing && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 200,
              }}
            >
              <Spin size='large' tip={t('正在编辑...')} />
            </div>
          )}

          {editError && !editing && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Text type='danger'>{editError}</Text>
            </div>
          )}

          {!editing && !result && !editError && (
            <Empty
              image={
                <IconImage size='extra-large' style={{ color: 'var(--semi-color-text-3)' }} />
              }
              description={t('上传图片并输入提示词后点击编辑')}
              style={{ padding: '40px 0' }}
            />
          )}

          {result && !editing && (
            <div>
              {result.images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {result.images.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img
                        src={img.base64
                          ? `data:${img.mimeType};base64,${img.base64}`
                          : (img.url || '')}
                        alt={`Edited ${idx + 1}`}
                        style={{
                          maxWidth: '100%',
                          maxHeight: 500,
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'block',
                        }}
                        onClick={() => {
                          setPreviewSrc(img.base64
                            ? `data:${img.mimeType};base64,${img.base64}`
                            : (img.url || ''));
                          setPreviewVisible(true);
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <Button
                          icon={<IconSave />}
                          loading={savingIndex === idx}
                          onClick={() => handleSave(img, idx)}
                          size='small'
                        >
                          {t('保存到画廊')}
                        </Button>
                        <Button
                          icon={<IconDownload />}
                          onClick={() =>
                            handleDownload(img, `edited-${Date.now()}.png`)
                          }
                          size='small'
                        >
                          {t('下载')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {result.images.length === 0 && <Empty description={t('未生成内容')} />}
            </div>
          )}
        </Card>
      </div>

      {/* Image Preview Modal */}
      <Modal
        visible={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        closable
        width='auto'
        style={{ maxWidth: '90vw' }}
        bodyStyle={{ padding: 0, display: 'flex', justifyContent: 'center' }}
      >
        <img
          src={previewSrc}
          alt='Preview'
          style={{ maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain' }}
        />
      </Modal>
    </div>
  );
}
