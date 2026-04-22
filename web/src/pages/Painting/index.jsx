import React, { useState, useCallback, useEffect } from 'react';
import {
  Layout,
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
  RadioGroup,
  Radio,
  Tag,
  Popconfirm,
  Image,
  Tooltip,
  Divider,
} from '@douyinfe/semi-ui';
import {
  IconImage,
  IconDelete,
  IconDownload,
  IconPlus,
  IconSave,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { usePaintingGenerate } from '../../hooks/painting/usePaintingGenerate';
import { usePaintingEdit } from '../../hooks/painting/usePaintingEdit';
import { usePaintingGallery } from '../../hooks/painting/usePaintingGallery';
import { API } from '../../helpers/api';
import ProductRetouchTool from './ProductRetouchTool';
import WatermarkRemoveTool from './WatermarkRemoveTool';
import ProductReplaceTool from './ProductReplaceTool';
import ClothingReplaceTool from './ClothingReplaceTool';
import SmartCutoutTool from './SmartCutoutTool';
import ModelGenerateTool from './ModelGenerateTool';
import ImageEditTool from './ImageEditTool';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

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

const GPT_IMAGE_SIZES = [
  { value: '1024x1024', label: '1024×1024' },
  { value: '1536x1024', label: '1536×1024 横版' },
  { value: '1024x1536', label: '1024×1536 竖版' },
  { value: 'auto', label: 'auto' },
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

function formatTimeLeft(expiresAt) {
  const now = Math.floor(Date.now() / 1000);
  const diff = expiresAt - now;
  if (diff <= 0) return '已过期';
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function Painting() {
  const { t } = useTranslation();
  const { generate, loading: generating, result, error: genError, reset } = usePaintingGenerate();
  const { images: galleryImages, loading: galleryLoading, blobUrls, saveImage, deleteImage, fetchImageBlob, fetchImages } = usePaintingGallery();

  // State
  const [paintingModels, setPaintingModels] = useState([]);
  const [model, setModel] = useState('');
  const [tokenKey, setTokenKey] = useState('');
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [gptImageSize, setGptImageSize] = useState('1024x1024');
  const [referenceImages, setReferenceImages] = useState([]);
  const [savingIndex, setSavingIndex] = useState(-1);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');
  const [activeTab, setActiveTab] = useState('generate');

  const selectedProvider = paintingModels.find((m) => m.value === model)?.provider || 'gemini';

  // Load painting models: show localStorage cache first, then fetch fresh data
  useEffect(() => {
    // 1. Immediately show cached models to avoid blank dropdown
    try {
      const stored = localStorage.getItem('painting_models');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const models = parsed.map((item) =>
            typeof item === 'string'
              ? { value: item, label: item, provider: 'gemini' }
              : { value: item.name, label: item.name, provider: item.provider || 'gemini' },
          );
          setPaintingModels(models);
          setModel(models[0].value);
        }
      }
    } catch (_) {}

    // 2. Fetch latest painting models from server
    const fetchPaintingModels = async () => {
      try {
        const res = await API.get('/api/status');
        const { success, data } = res.data;
        if (success && data) {
          const freshModels = data.painting_models || [];
          localStorage.setItem('painting_models', JSON.stringify(freshModels));
          if (freshModels.length > 0) {
            const models = freshModels.map((item) =>
              typeof item === 'string'
                ? { value: item, label: item, provider: 'gemini' }
                : { value: item.name, label: item.name, provider: item.provider || 'gemini' },
            );
            setPaintingModels(models);
            setModel((prev) => (prev && models.some((m) => m.value === prev) ? prev : models[0].value));
          } else {
            setPaintingModels([]);
            setModel('');
          }
        }
      } catch (_) {}
    };
    fetchPaintingModels();
  }, []);

  // Fetch user tokens
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await API.get('/api/token/?p=1&size=100');
        const { success, data } = res.data;
        if (success) {
          const tokenItems = Array.isArray(data) ? data : data.items || [];
          const activeTokens = tokenItems.filter((tk) => tk.status === 1);
          setTokens(activeTokens);
          if (activeTokens.length > 0) {
            setTokenKey(activeTokens[0].key);
          }
        }
      } catch (err) {
        console.error('Failed to fetch tokens:', err);
      } finally {
        setTokensLoading(false);
      }
    };
    fetchTokens();
  }, []);

  // Handle reference image upload
  const handleUpload = useCallback(async ({ file }) => {
    try {
      const imgData = await fileToBase64(file.fileInstance);
      setReferenceImages((prev) => [...prev, imgData]);
    } catch (err) {
      Toast.error(t('上传失败'));
    }
    return false; // prevent default upload
  }, [t]);

  const removeRefImage = useCallback((index) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Generate image
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() && referenceImages.length === 0) {
      Toast.warning(t('请输入提示词或上传参考图'));
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
      imageSize: selectedProvider === 'openai_image' ? gptImageSize : imageSize,
      referenceImages,
      imageProvider: selectedProvider,
    });
  }, [prompt, model, tokenKey, aspectRatio, imageSize, referenceImages, generate, t]);

  // Save image to gallery
  const handleSave = useCallback(async (imageData, index) => {
    setSavingIndex(index);
    try {
      await saveImage({
        base64Data: imageData.base64,
        mimeType: imageData.mimeType,
        prompt: prompt.trim(),
        model,
        aspectRatio,
        imageSize,
        referenceCount: referenceImages.length,
      });
      Toast.success(t('保存成功'));
    } catch (err) {
      Toast.error(t('保存失败'));
    } finally {
      setSavingIndex(-1);
    }
  }, [saveImage, prompt, model, aspectRatio, imageSize, referenceImages, t]);

  // Download image
  const handleDownload = useCallback((imageData, filename) => {
    const link = document.createElement('a');
    link.href = `data:${imageData.mimeType};base64,${imageData.base64}`;
    link.download = filename || 'painting.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Delete gallery image
  const handleDelete = useCallback(async (id) => {
    const ok = await deleteImage(id);
    if (ok) {
      Toast.success(t('删除成功'));
    } else {
      Toast.error(t('删除失败'));
    }
  }, [deleteImage, t]);

  // Download gallery image
  const handleDownloadGallery = useCallback(async (image) => {
    const url = blobUrls[image.id] || await fetchImageBlob(image.id);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `painting-${image.id}.${image.mime_type.split('/')[1] || 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [blobUrls, fetchImageBlob]);

  return (
    <div style={{ padding: '20px 24px 24px', maxWidth: 1400, margin: '0 auto', minHeight: 'calc(100vh - 120px)' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <IconImage size='large' style={{ color: 'var(--semi-color-primary)' }} />
        <Title heading={3} style={{ margin: 0 }}>{t('AI 绘画')}</Title>
      </div>

      {/* Tab Switch */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button
          theme={activeTab === 'generate' ? 'solid' : 'light'}
          onClick={() => setActiveTab('generate')}
        >
          {t('图片生成')}
        </Button>
        <Button
          theme={activeTab === 'edit' ? 'solid' : 'light'}
          onClick={() => setActiveTab('edit')}
        >
          {t('图片编辑')}
        </Button>
        <Button
          theme={activeTab === 'gallery' ? 'solid' : 'light'}
          onClick={() => setActiveTab('gallery')}
        >
          {t('画廊')} ({galleryImages.length})
        </Button>
        <Button
          theme={activeTab === 'retouch' ? 'solid' : 'light'}
          type={activeTab === 'retouch' ? 'primary' : 'tertiary'}
          onClick={() => setActiveTab('retouch')}
        >
          {t('产品精修')}
        </Button>
        <Button
          theme={activeTab === 'watermark' ? 'solid' : 'light'}
          type={activeTab === 'watermark' ? 'primary' : 'tertiary'}
          onClick={() => setActiveTab('watermark')}
        >
          {t('图片去水印')}
        </Button>
        <Button
          theme={activeTab === 'cutout' ? 'solid' : 'light'}
          type={activeTab === 'cutout' ? 'primary' : 'tertiary'}
          onClick={() => setActiveTab('cutout')}
        >
          {t('智能抠图')}
        </Button>
        <Button
          theme={activeTab === 'replace' ? 'solid' : 'light'}
          type={activeTab === 'replace' ? 'primary' : 'tertiary'}
          onClick={() => setActiveTab('replace')}
        >
          {t('商品替换')}
        </Button>
        <Button
          theme={activeTab === 'clothing' ? 'solid' : 'light'}
          type={activeTab === 'clothing' ? 'primary' : 'tertiary'}
          onClick={() => setActiveTab('clothing')}
        >
          {t('服装替换')}
        </Button>
        <Button
          theme={activeTab === 'model' ? 'solid' : 'light'}
          type={activeTab === 'model' ? 'primary' : 'tertiary'}
          onClick={() => setActiveTab('model')}
        >
          {t('模特生成')}
        </Button>
      </div>

      {activeTab === 'generate' && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Left Panel: Settings & Input */}
          <div style={{ flex: '1 1 400px', minWidth: 340 }}>
            {/* Settings Card */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {/* Model */}
                <div style={{ flex: '1 1 200px' }}>
                  <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('模型')}</Text>
                  <Select
                    value={model}
                    onChange={setModel}
                    style={{ width: '100%' }}
                    optionList={paintingModels}
                    emptyContent={t('暂无可用模型，请在模型管理中配置')}
                  />
                </div>
                {/* Token */}
                <div style={{ flex: '1 1 200px' }}>
                  <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('密钥')}</Text>
                  <Select
                    value={tokenKey}
                    onChange={setTokenKey}
                    style={{ width: '100%' }}
                    loading={tokensLoading}
                    placeholder={t('选择密钥')}
                    emptyContent={t('暂无可用密钥')}
                    optionList={tokens.map((tk) => ({
                      value: tk.key,
                      label: tk.name ? `${tk.name} (${tk.key.slice(0, 8)}...)` : `${tk.key.slice(0, 16)}...`,
                    }))}
                  />
                </div>
                {/* Aspect Ratio (Gemini only) */}
                {selectedProvider !== 'openai_image' && (
                  <div style={{ flex: '1 1 140px' }}>
                    <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('宽高比')}</Text>
                    <Select
                      value={aspectRatio}
                      onChange={setAspectRatio}
                      style={{ width: '100%' }}
                      optionList={ASPECT_RATIOS}
                    />
                  </div>
                )}
                {/* Image Size */}
                {selectedProvider !== 'openai_image' ? (
                  <div style={{ flex: '1 1 100px' }}>
                    <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('图片尺寸')}</Text>
                    <Select
                      value={imageSize}
                      onChange={setImageSize}
                      style={{ width: '100%' }}
                      optionList={IMAGE_SIZES}
                    />
                  </div>
                ) : (
                  <div style={{ flex: '1 1 160px' }}>
                    <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('图片尺寸')}</Text>
                    <Select
                      value={gptImageSize}
                      onChange={setGptImageSize}
                      style={{ width: '100%' }}
                      optionList={GPT_IMAGE_SIZES}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Prompt Input */}
            <Card style={{ marginBottom: 16 }}>
              <Text strong size='small' style={{ display: 'block', marginBottom: 8 }}>{t('提示词')}</Text>
              <TextArea
                value={prompt}
                onChange={setPrompt}
                placeholder={t('描述你想生成的图片...')}
                autosize={{ minRows: 3, maxRows: 8 }}
                style={{ marginBottom: 12 }}
              />

              {/* Reference Images */}
              <Text strong size='small' style={{ display: 'block', marginBottom: 8 }}>
                {t('参考图')} <Text type='tertiary' size='small'>({t('可选，支持多张')})</Text>
              </Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {referenceImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 80, height: 80 }}>
                    <img
                      src={img.preview}
                      alt={img.name}
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                      onClick={() => { setPreviewSrc(img.preview); setPreviewVisible(true); }}
                    />
                    <Button
                      icon={<IconDelete />}
                      type='danger'
                      theme='solid'
                      size='small'
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 20, height: 20, borderRadius: '50%', padding: 0, minWidth: 0,
                      }}
                      onClick={() => removeRefImage(idx)}
                    />
                  </div>
                ))}
                <Upload
                  action=''
                  accept='image/png,image/jpeg,image/webp'
                  showUploadList={false}
                  customRequest={handleUpload}
                >
                  <div style={{
                    width: 80, height: 80, border: '1px dashed var(--semi-color-border)',
                    borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--semi-color-text-2)',
                  }}>
                    <IconPlus size='large' />
                  </div>
                </Upload>
              </div>

              {/* Generate Button */}
              <Button
                theme='solid'
                type='primary'
                size='large'
                loading={generating}
                onClick={handleGenerate}
                block
                icon={<IconImage />}
              >
                {generating ? t('正在生成...') : t('生成图片')}
              </Button>
            </Card>
          </div>

          {/* Right Panel: Results */}
          <div style={{ flex: '1 1 400px', minWidth: 340 }}>
            <Card
              title={t('生成结果')}
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
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                  <Spin size='large' tip={t('正在生成...')} />
                </div>
              )}

              {genError && !generating && (
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <Text type='danger'>{genError}</Text>
                </div>
              )}

              {!generating && !result && !genError && (
                <Empty
                  image={<IconImage size='extra-large' style={{ color: 'var(--semi-color-text-3)' }} />}
                  description={t('输入提示词并点击生成')}
                  style={{ padding: '40px 0' }}
                />
              )}

              {result && !generating && (
                <div>
                  {/* Text responses */}
                  {result.texts.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      {result.texts.map((text, idx) => (
                        <Paragraph key={idx} style={{ marginBottom: 8 }}>{text}</Paragraph>
                      ))}
                    </div>
                  )}

                  {/* Generated images */}
                  {result.images.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {result.images.map((img, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <img
                            src={`data:${img.mimeType};base64,${img.base64}`}
                            alt={`Generated ${idx + 1}`}
                            style={{
                              maxWidth: '100%', maxHeight: 500, borderRadius: 8,
                              cursor: 'pointer', display: 'block',
                            }}
                            onClick={() => {
                              setPreviewSrc(`data:${img.mimeType};base64,${img.base64}`);
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
                              onClick={() => handleDownload(img, `painting-${Date.now()}.${img.mimeType.split('/')[1] || 'png'}`)}
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
      )}

      {/* Gallery Tab */}
      {activeTab === 'gallery' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text type='tertiary'>
              {t('图片保存48小时后自动删除')}
            </Text>
            <Button icon={<IconRefresh />} onClick={fetchImages} loading={galleryLoading} size='small'>
              {t('刷新')}
            </Button>
          </div>

          {galleryLoading && galleryImages.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <Spin size='large' />
            </div>
          ) : galleryImages.length === 0 ? (
            <Empty
              image={<IconImage size='extra-large' style={{ color: 'var(--semi-color-text-3)' }} />}
              description={t('画廊暂无图片')}
              style={{ padding: '60px 0' }}
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}>
              {galleryImages.map((image) => (
                <Card
                  key={image.id}
                  cover={
                    blobUrls[image.id] ? (
                      <img
                        src={blobUrls[image.id]}
                        alt={image.prompt || 'Painting'}
                        style={{ width: '100%', height: 220, objectFit: 'cover', cursor: 'pointer' }}
                        onClick={() => {
                          setPreviewSrc(blobUrls[image.id]);
                          setPreviewVisible(true);
                        }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--semi-color-fill-0)' }}>
                        <Spin />
                      </div>
                    )
                  }
                  bodyStyle={{ padding: '12px 16px' }}
                >
                  {image.prompt && (
                    <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8, fontSize: 13 }}>
                      {image.prompt}
                    </Paragraph>
                  )}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    <Tag size='small' color='blue'>{image.model}</Tag>
                    {image.aspect_ratio && <Tag size='small'>{image.aspect_ratio}</Tag>}
                    {image.image_size && <Tag size='small'>{image.image_size}</Tag>}
                    {image.reference_count > 0 && (
                      <Tag size='small' color='green'>{t('参考图')}: {image.reference_count}</Tag>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tooltip content={new Date(image.created_at * 1000).toLocaleString()}>
                      <Text type='tertiary' size='small'>
                        {t('剩余')}: {formatTimeLeft(image.expires_at)}
                      </Text>
                    </Tooltip>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button
                        icon={<IconDownload />}
                        size='small'
                        type='tertiary'
                        onClick={() => handleDownloadGallery(image)}
                      />
                      <Popconfirm
                        title={t('确认删除此图片？')}
                        onConfirm={() => handleDelete(image.id)}
                      >
                        <Button
                          icon={<IconDelete />}
                          size='small'
                          type='danger'
                          theme='borderless'
                        />
                      </Popconfirm>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tool Tabs */}
      {activeTab === 'edit' && (
        <ImageEditTool
          model={model}
          setModel={setModel}
          tokenKey={tokenKey}
          setTokenKey={setTokenKey}
          tokens={tokens}
          tokensLoading={tokensLoading}
          paintingModels={paintingModels}
          saveImage={saveImage}
        />
      )}
      {activeTab === 'retouch' && (
        <ProductRetouchTool
          model={model}
          setModel={setModel}
          tokenKey={tokenKey}
          setTokenKey={setTokenKey}
          tokens={tokens}
          tokensLoading={tokensLoading}
          paintingModels={paintingModels}
          saveImage={saveImage}
        />
      )}
      {activeTab === 'watermark' && (
        <WatermarkRemoveTool
          model={model}
          setModel={setModel}
          tokenKey={tokenKey}
          setTokenKey={setTokenKey}
          tokens={tokens}
          tokensLoading={tokensLoading}
          paintingModels={paintingModels}
          saveImage={saveImage}
        />
      )}
      {activeTab === 'cutout' && (
        <SmartCutoutTool
          model={model}
          setModel={setModel}
          tokenKey={tokenKey}
          setTokenKey={setTokenKey}
          tokens={tokens}
          tokensLoading={tokensLoading}
          paintingModels={paintingModels}
          saveImage={saveImage}
        />
      )}
      {activeTab === 'replace' && (
        <ProductReplaceTool
          model={model}
          setModel={setModel}
          tokenKey={tokenKey}
          setTokenKey={setTokenKey}
          tokens={tokens}
          tokensLoading={tokensLoading}
          paintingModels={paintingModels}
          saveImage={saveImage}
        />
      )}
      {activeTab === 'clothing' && (
        <ClothingReplaceTool
          model={model}
          setModel={setModel}
          tokenKey={tokenKey}
          setTokenKey={setTokenKey}
          tokens={tokens}
          tokensLoading={tokensLoading}
          paintingModels={paintingModels}
          saveImage={saveImage}
        />
      )}

      {activeTab === 'model' && (
        <ModelGenerateTool
          model={model}
          setModel={setModel}
          tokenKey={tokenKey}
          setTokenKey={setTokenKey}
          tokens={tokens}
          tokensLoading={tokensLoading}
          paintingModels={paintingModels}
          saveImage={saveImage}
        />
      )}

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
