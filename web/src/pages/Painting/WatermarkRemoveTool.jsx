import React, { useState, useCallback } from 'react';
import {
  Select,
  Button,
  TextArea,
  Card,
  Typography,
  Spin,
  Empty,
  Modal,
  Toast,
  Upload,
} from '@douyinfe/semi-ui';
import {
  IconImage,
  IconDelete,
  IconDownload,
  IconSave,
  IconRefresh,
  IconEyeOpened,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { usePaintingGenerate } from '../../hooks/painting/usePaintingGenerate';

const { Title, Text, Paragraph } = Typography;

const DEFAULT_WATERMARK_PROMPT =
  '去除画面中的水印和覆盖文字，自然补全被遮挡区域，尽量不改变原图内容';

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

const IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve({
        base64,
        mimeType: file.type || 'image/png',
        name: file.name,
        preview: dataUrl,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function WatermarkRemoveTool({
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
  const {
    generate,
    loading: generating,
    result,
    error: genError,
    reset,
  } = usePaintingGenerate();

  const [sourceImage, setSourceImage] = useState(null);
  const [prompt, setPrompt] = useState(DEFAULT_WATERMARK_PROMPT);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [savingIndex, setSavingIndex] = useState(-1);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');

  const handleUpload = useCallback(
    async ({ file }) => {
      try {
        const imgData = await fileToBase64(file.fileInstance);
        setSourceImage(imgData);
      } catch (_) {
        Toast.error(t('上传失败'));
      }
      return false;
    },
    [t]
  );

  const removeSourceImage = useCallback(() => {
    setSourceImage(null);
  }, []);

  const resetPrompt = useCallback(() => {
    setPrompt(DEFAULT_WATERMARK_PROMPT);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!sourceImage) {
      Toast.warning(t('请先上传图片'));
      return;
    }
    if (!tokenKey) {
      Toast.warning(t('请选择密钥'));
      return;
    }
    await generate({
      prompt: prompt.trim(),
      model,
      tokenKey,
      aspectRatio,
      imageSize,
      referenceImages: [sourceImage],
    });
  }, [sourceImage, tokenKey, prompt, model, aspectRatio, imageSize, generate, t]);

  const handleSave = useCallback(
    async (imageData, index) => {
      setSavingIndex(index);
      try {
        await saveImage({
          base64Data: imageData.base64,
          mimeType: imageData.mimeType,
          prompt: prompt.trim(),
          model,
          aspectRatio,
          imageSize,
          referenceCount: 1,
        });
        Toast.success(t('保存成功'));
      } catch (_) {
        Toast.error(t('保存失败'));
      } finally {
        setSavingIndex(-1);
      }
    },
    [saveImage, prompt, model, aspectRatio, imageSize, t]
  );

  const handleDownload = useCallback((imageData, filename) => {
    const link = document.createElement('a');
    link.href = `data:${imageData.mimeType};base64,${imageData.base64}`;
    link.download = filename || 'watermark-removed.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return (
    <div>
      {/* Tool header */}
      <div style={{ marginBottom: 16 }}>
        <Title heading={5} style={{ margin: 0 }}>
          {t('图片去水印')}
        </Title>
        <Text type='tertiary' size='small'>
          {t('上传含水印的图片，AI 自动去除水印并补全遮挡区域')}
        </Text>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Left Panel */}
        <div style={{ flex: '1 1 400px', minWidth: 340 }}>
          {/* Settings Card */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: '1 1 200px' }}>
                <Text
                  strong
                  size='small'
                  style={{ display: 'block', marginBottom: 4 }}
                >
                  {t('模型')}
                </Text>
                <Select
                  value={model}
                  onChange={setModel}
                  style={{ width: '100%' }}
                  optionList={paintingModels}
                  emptyContent={t('暂无可用模型，请在模型管理中配置')}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <Text
                  strong
                  size='small'
                  style={{ display: 'block', marginBottom: 4 }}
                >
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
              <div style={{ flex: '1 1 140px' }}>
                <Text
                  strong
                  size='small'
                  style={{ display: 'block', marginBottom: 4 }}
                >
                  {t('宽高比')}
                </Text>
                <Select
                  value={aspectRatio}
                  onChange={setAspectRatio}
                  style={{ width: '100%' }}
                  optionList={ASPECT_RATIOS}
                />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <Text
                  strong
                  size='small'
                  style={{ display: 'block', marginBottom: 4 }}
                >
                  {t('图片尺寸')}
                </Text>
                <Select
                  value={imageSize}
                  onChange={setImageSize}
                  style={{ width: '100%' }}
                  optionList={IMAGE_SIZES}
                />
              </div>
            </div>
          </Card>

          {/* Upload + Prompt Card */}
          <Card style={{ marginBottom: 16 }}>
            <Text
              strong
              size='small'
              style={{ display: 'block', marginBottom: 8 }}
            >
              {t('含水印图片')}
              <Text type='danger' size='small'>
                {' '}
                *
              </Text>
            </Text>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              {sourceImage ? (
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                  <img
                    src={sourceImage.preview}
                    alt={sourceImage.name}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setPreviewSrc(sourceImage.preview);
                      setPreviewVisible(true);
                    }}
                  />
                  <Button
                    icon={<IconDelete />}
                    type='danger'
                    theme='solid'
                    size='small'
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      padding: 0,
                      minWidth: 0,
                    }}
                    onClick={removeSourceImage}
                  />
                </div>
              ) : (
                <Upload
                  action=''
                  accept='image/png,image/jpeg,image/webp'
                  showUploadList={false}
                  customRequest={handleUpload}
                >
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      border: '2px dashed var(--semi-color-primary)',
                      borderRadius: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--semi-color-primary)',
                      gap: 4,
                    }}
                  >
                    <IconImage size='large' />
                    <Text
                      size='small'
                      style={{ color: 'var(--semi-color-primary)' }}
                    >
                      {t('上传')}
                    </Text>
                  </div>
                </Upload>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text strong size='small'>
                {t('处理提示词')}
              </Text>
              <Button
                size='small'
                icon={<IconRefresh />}
                theme='borderless'
                type='tertiary'
                onClick={resetPrompt}
              >
                {t('重置')}
              </Button>
            </div>
            <TextArea
              value={prompt}
              onChange={setPrompt}
              autosize={{ minRows: 3, maxRows: 6 }}
              style={{ marginBottom: 16 }}
            />

            <Button
              theme='solid'
              type='primary'
              size='large'
              loading={generating}
              onClick={handleGenerate}
              block
              icon={<IconEyeOpened />}
            >
              {generating ? t('处理中...') : t('开始去水印')}
            </Button>
          </Card>
        </div>

        {/* Right Panel: Results */}
        <div style={{ flex: '1 1 400px', minWidth: 340 }}>
          <Card
            title={t('处理结果')}
            style={{ minHeight: 400 }}
            headerExtraContent={
              result && (
                <Button size='small' icon={<IconRefresh />} onClick={reset}>
                  {t('清除')}
                </Button>
              )
            }
          >
            {generating && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: 200,
                }}
              >
                <Spin size='large' tip={t('处理中...')} />
              </div>
            )}

            {genError && !generating && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Text type='danger'>{genError}</Text>
              </div>
            )}

            {!generating && !result && !genError && (
              <Empty
                image={
                  <IconImage
                    size='extra-large'
                    style={{ color: 'var(--semi-color-text-3)' }}
                  />
                }
                description={t('上传含水印图片并点击开始去水印')}
                style={{ padding: '40px 0' }}
              />
            )}

            {result && !generating && (
              <div>
                {result.texts.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {result.texts.map((text, idx) => (
                      <Paragraph key={idx} style={{ marginBottom: 8 }}>
                        {text}
                      </Paragraph>
                    ))}
                  </div>
                )}

                {result.images.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {result.images.map((img, idx) => (
                      <div key={idx}>
                        <img
                          src={`data:${img.mimeType};base64,${img.base64}`}
                          alt={`Processed ${idx + 1}`}
                          style={{
                            maxWidth: '100%',
                            maxHeight: 500,
                            borderRadius: 8,
                            cursor: 'pointer',
                            display: 'block',
                          }}
                          onClick={() => {
                            setPreviewSrc(
                              `data:${img.mimeType};base64,${img.base64}`
                            );
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
                              handleDownload(
                                img,
                                `watermark-removed-${Date.now()}.${
                                  img.mimeType.split('/')[1] || 'png'
                                }`
                              )
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

                {result.images.length === 0 && result.texts.length === 0 && (
                  <Empty description={t('未生成内容')} />
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Image Preview Modal */}
      <Modal
        visible={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        closable
        width='auto'
        style={{ maxWidth: '90vw' }}
        bodyStyle={{
          padding: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <img
          src={previewSrc}
          alt='Preview'
          style={{
            maxWidth: '85vw',
            maxHeight: '85vh',
            objectFit: 'contain',
          }}
        />
      </Modal>
    </div>
  );
}
