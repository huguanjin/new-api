import React, { useState, useCallback, useEffect } from 'react';
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
  Switch,
  Banner,
} from '@douyinfe/semi-ui';
import {
  IconImage,
  IconDelete,
  IconDownload,
  IconSave,
  IconRefresh,
  IconEdit,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { usePaintingGenerate } from '../../hooks/painting/usePaintingGenerate';

const { Title, Text, Paragraph } = Typography;

const DEFAULT_CUTOUT_PROMPT =
  '移除背景并输出透明底图，主体边缘干净完整，不要出现白边、灰边或锯齿';

// ─── Canvas post-processing utilities ────────────────────────────────────────

function detectBgColor(data, w, h) {
  const samples = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
    [Math.floor(w / 2), 0], [Math.floor(w / 2), h - 1],
    [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)],
  ];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of samples) {
    const i = (y * w + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const n = samples.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function colorDiff(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function floodFillRemoveBackground(imageData, w, h, tolerance) {
  const data = imageData.data;
  const visited = new Uint8Array(w * h);
  const [bgR, bgG, bgB] = detectBgColor(data, w, h);

  const queue = [];
  const tryAdd = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (colorDiff(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB) > tolerance) return;
    visited[idx] = 1;
    queue.push([x, y]);
  };

  // seed from all 4 borders
  for (let x = 0; x < w; x++) { tryAdd(x, 0); tryAdd(x, h - 1); }
  for (let y = 0; y < h; y++) { tryAdd(0, y); tryAdd(w - 1, y); }

  while (queue.length) {
    const [x, y] = queue.shift();
    const i = (y * w + x) * 4;
    data[i + 3] = 0;
    tryAdd(x + 1, y); tryAdd(x - 1, y);
    tryAdd(x, y + 1); tryAdd(x, y - 1);
  }
  return imageData;
}

function smoothAlphaEdges(imageData, w, h) {
  const data = imageData.data;
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = alpha[i];
      if (a > 0 && a < 255) {
        const avg =
          (alpha[i] + alpha[i - 1] + alpha[i + 1] + alpha[i - w] + alpha[i + w]) / 5;
        data[i * 4 + 3] = Math.round(avg);
      }
    }
  }
  return imageData;
}

function cropToContent(canvas) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX || minY > maxY) return canvas;
  const pad = 2;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - cx;
  const ch = Math.min(h, maxY + pad + 1) - cy;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return out;
}

function cropLargestRegion(canvas) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const label = new Int32Array(w * h).fill(-1);
  let nextLabel = 0;
  const regions = [];

  for (let start = 0; start < w * h; start++) {
    if (data[start * 4 + 3] <= 10 || label[start] >= 0) continue;
    const lbl = nextLabel++;
    regions.push([]);
    const queue = [start];
    label[start] = lbl;
    while (queue.length) {
      const idx = queue.shift();
      regions[lbl].push(idx);
      const x = idx % w;
      const y = Math.floor(idx / w);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (label[ni] >= 0 || data[ni * 4 + 3] <= 10) continue;
        label[ni] = lbl;
        queue.push(ni);
      }
    }
  }

  if (!regions.length) return canvas;
  const largest = regions.reduce((a, b) => (a.length >= b.length ? a : b));

  // make everything except largest region transparent
  const keep = new Uint8Array(w * h);
  for (const idx of largest) keep[idx] = 1;
  for (let i = 0; i < w * h; i++) {
    if (!keep[i]) data[i * 4 + 3] = 0;
  }
  ctx.putImageData(imgData, 0, 0);

  // crop to bounding box of largest region
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (const idx of largest) {
    const x = idx % w;
    const y = Math.floor(idx / w);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const pad = 4;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - cx;
  const ch = Math.min(h, maxY + pad + 1) - cy;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return out;
}

function processImage(imgData, { format, edgeEnhancement, autoCrop, patternCrop }) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const tolerance = edgeEnhancement === 'standard' ? 30 : 20;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      floodFillRemoveBackground(imageData, canvas.width, canvas.height, tolerance);

      if (edgeEnhancement === 'standard') {
        smoothAlphaEdges(imageData, canvas.width, canvas.height);
      }

      ctx.putImageData(imageData, 0, 0);

      let finalCanvas = canvas;
      if (patternCrop) {
        finalCanvas = cropLargestRegion(finalCanvas);
      } else if (autoCrop) {
        finalCanvas = cropToContent(finalCanvas);
      }

      const mimeType = format === 'webp' ? 'image/webp' : 'image/png';
      const dataUrl = finalCanvas.toDataURL(mimeType);
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType });
    };
    img.src = `data:${imgData.mimeType};base64,${imgData.base64}`;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

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

function UploadPlaceholder({ label }) {
  return (
    <div
      style={{
        width: 120,
        height: 120,
        border: '2px dashed var(--semi-color-primary)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--semi-color-primary)',
        gap: 6,
      }}
    >
      <IconImage size='large' />
      <Text size='small' style={{ color: 'var(--semi-color-primary)' }}>
        {label}
      </Text>
    </div>
  );
}

const CHECKERBOARD = {
  backgroundImage:
    'linear-gradient(45deg,#ccc 25%,transparent 25%),' +
    'linear-gradient(-45deg,#ccc 25%,transparent 25%),' +
    'linear-gradient(45deg,transparent 75%,#ccc 75%),' +
    'linear-gradient(-45deg,transparent 75%,#ccc 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
};

export default function SmartCutoutTool({
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
  const [prompt, setPrompt] = useState(DEFAULT_CUTOUT_PROMPT);
  const [format, setFormat] = useState('png');
  const [edgeEnhancement, setEdgeEnhancement] = useState('none');
  const [autoCrop, setAutoCrop] = useState(true);
  const [patternCrop, setPatternCrop] = useState(false);
  const [processedImages, setProcessedImages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [savingIndex, setSavingIndex] = useState(-1);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');

  // Re-process whenever AI result or output options change
  useEffect(() => {
    if (!result || !result.images || result.images.length === 0) {
      setProcessedImages([]);
      return;
    }
    let cancelled = false;
    setProcessing(true);
    Promise.all(
      result.images.map((img) =>
        processImage(img, { format, edgeEnhancement, autoCrop, patternCrop })
      )
    ).then((processed) => {
      if (!cancelled) {
        setProcessedImages(processed);
        setProcessing(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [result, format, edgeEnhancement, autoCrop, patternCrop]);

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

  const removeSource = useCallback(() => setSourceImage(null), []);

  const resetPrompt = useCallback(() => setPrompt(DEFAULT_CUTOUT_PROMPT), []);

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
      aspectRatio: '1:1',
      imageSize: '1K',
      referenceImages: [sourceImage],
    });
  }, [sourceImage, tokenKey, prompt, model, generate, t]);

  const handlePatternCropChange = useCallback((val) => {
    setPatternCrop(val);
    if (val) setAutoCrop(true);
  }, []);

  const handleSave = useCallback(
    async (imgData, index) => {
      setSavingIndex(index);
      try {
        await saveImage({
          base64Data: imgData.base64,
          mimeType: imgData.mimeType,
          prompt: prompt.trim(),
          model,
          aspectRatio: '1:1',
          imageSize: '1K',
          referenceCount: 1,
        });
        Toast.success(t('保存成功'));
      } catch (_) {
        Toast.error(t('保存失败'));
      } finally {
        setSavingIndex(-1);
      }
    },
    [saveImage, prompt, model, t]
  );

  const handleDownload = useCallback(
    (imgData, filename) => {
      const link = document.createElement('a');
      link.href = `data:${imgData.mimeType};base64,${imgData.base64}`;
      link.download = filename || 'cutout.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    []
  );

  const openPreview = useCallback((src) => {
    setPreviewSrc(src);
    setPreviewVisible(true);
  }, []);

  const handleClear = useCallback(() => {
    reset();
    setProcessedImages([]);
  }, [reset]);

  const ext = format === 'webp' ? 'webp' : 'png';

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Title heading={5} style={{ margin: 0 }}>
          {t('智能抠图')}
        </Title>
        <Text type='tertiary' size='small'>
          {t('上传图片，AI 自动移除背景，输出透明底图')}
        </Text>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Left Panel */}
        <div style={{ flex: '1 1 400px', minWidth: 340 }}>
          {/* Model & Key Card */}
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
            </div>
          </Card>

          {/* Upload Card */}
          <Card style={{ marginBottom: 16 }}>
            <Text
              strong
              size='small'
              style={{ display: 'block', marginBottom: 8 }}
            >
              {t('源图片')}
              <Text type='danger' size='small'>
                {' '}
                *
              </Text>
            </Text>
            {sourceImage ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={sourceImage.preview}
                  alt={sourceImage.name}
                  style={{
                    maxWidth: 200,
                    maxHeight: 200,
                    objectFit: 'contain',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'block',
                  }}
                  onClick={() => openPreview(sourceImage.preview)}
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
                  onClick={removeSource}
                />
              </div>
            ) : (
              <Upload
                action=''
                accept='image/png,image/jpeg,image/webp'
                showUploadList={false}
                customRequest={handleUpload}
              >
                <UploadPlaceholder label={t('上传图片')} />
              </Upload>
            )}
          </Card>

          {/* Settings Card */}
          <Card style={{ marginBottom: 16 }}>
            <Text
              strong
              size='small'
              style={{ display: 'block', marginBottom: 12 }}
            >
              {t('输出设置')}
            </Text>

            {/* Format */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div>
                <Text size='small'>{t('输出格式')}</Text>
                <Text
                  type='tertiary'
                  size='small'
                  style={{ display: 'block' }}
                >
                  {t('PNG 支持透明，WebP 体积更小')}
                </Text>
              </div>
              <Select
                value={format}
                onChange={setFormat}
                style={{ width: 90 }}
                optionList={[
                  { value: 'png', label: 'PNG' },
                  { value: 'webp', label: 'WebP' },
                ]}
              />
            </div>

            {/* Edge Enhancement */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div>
                <Text size='small'>{t('边缘增强')}</Text>
                <Text
                  type='tertiary'
                  size='small'
                  style={{ display: 'block' }}
                >
                  {t('标准模式对边缘进行柔化处理')}
                </Text>
              </div>
              <Select
                value={edgeEnhancement}
                onChange={setEdgeEnhancement}
                style={{ width: 110 }}
                optionList={[
                  { value: 'none', label: t('无') },
                  { value: 'standard', label: t('标准') },
                ]}
              />
            </div>

            {/* Auto Crop */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div>
                <Text size='small'>{t('自动裁切透明边')}</Text>
                <Text
                  type='tertiary'
                  size='small'
                  style={{ display: 'block' }}
                >
                  {t('裁掉图像四周多余的透明区域')}
                </Text>
              </div>
              <Switch
                checked={autoCrop}
                onChange={setAutoCrop}
                disabled={patternCrop}
              />
            </div>

            {/* Pattern Crop */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <Text size='small'>{t('印花裁切')}</Text>
                <Text
                  type='tertiary'
                  size='small'
                  style={{ display: 'block' }}
                >
                  {t('仅保留最大连通主体，适合印花/图案')}
                </Text>
              </div>
              <Switch
                checked={patternCrop}
                onChange={handlePatternCropChange}
              />
            </div>
          </Card>

          {/* Prompt Card */}
          <Card>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text strong size='small'>
                {t('提示词')}
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
              icon={<IconEdit />}
            >
              {generating ? t('抠图中...') : t('开始抠图')}
            </Button>
          </Card>
        </div>

        {/* Right Panel: Results */}
        <div style={{ flex: '1 1 400px', minWidth: 340 }}>
          {/* AI Limitation Banner */}
          <Banner
            type='warning'
            description={
              <span>
                {t(
                  'AI 抠图效果受模型限制，结果仅供参考。如需专业级透明底图，建议搭配 '
                )}
                <a href='https://www.remove.bg' target='_blank' rel='noreferrer'>
                  remove.bg
                </a>
                {t('、Adobe Photoshop 或 Canva 等工具进行二次处理。')}
              </span>
            }
            style={{ marginBottom: 16, borderRadius: 8 }}
          />

          <Card
            title={t('抠图结果')}
            style={{ minHeight: 400 }}
            headerExtraContent={
              (result || processedImages.length > 0) && (
                <Button size='small' icon={<IconRefresh />} onClick={handleClear}>
                  {t('清除')}
                </Button>
              )
            }
          >
            {(generating || processing) && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: 200,
                }}
              >
                <Spin
                  size='large'
                  tip={generating ? t('AI 生成中...') : t('后处理中...')}
                />
              </div>
            )}

            {genError && !generating && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Text type='danger'>{genError}</Text>
              </div>
            )}

            {!generating && !processing && !result && !genError && (
              <Empty
                image={
                  <IconImage
                    size='extra-large'
                    style={{ color: 'var(--semi-color-text-3)' }}
                  />
                }
                description={t('上传图片并点击开始抠图')}
                style={{ padding: '40px 0' }}
              />
            )}

            {!generating && !processing && processedImages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {processedImages.map((img, idx) => (
                  <div key={idx}>
                    <div
                      style={{
                        ...CHECKERBOARD,
                        borderRadius: 8,
                        overflow: 'hidden',
                        display: 'inline-block',
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        openPreview(`data:${img.mimeType};base64,${img.base64}`)
                      }
                    >
                      <img
                        src={`data:${img.mimeType};base64,${img.base64}`}
                        alt={`Cutout ${idx + 1}`}
                        style={{
                          maxWidth: '100%',
                          maxHeight: 500,
                          display: 'block',
                        }}
                      />
                    </div>
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
                          handleDownload(img, `cutout-${Date.now()}.${ext}`)
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

            {!generating &&
              !processing &&
              result &&
              processedImages.length === 0 &&
              !genError && <Empty description={t('未生成内容')} />}
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
