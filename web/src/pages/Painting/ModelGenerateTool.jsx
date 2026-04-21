import React, { useState, useCallback, useRef } from 'react';
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
  Slider,
} from '@douyinfe/semi-ui';
import {
  IconImage,
  IconDelete,
  IconDownload,
  IconSave,
  IconRefresh,
  IconPlus,
  IconUser,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { usePaintingGenerate } from '../../hooks/painting/usePaintingGenerate';

const { Title, Text, Paragraph } = Typography;

//  Constants 

const GENDERS = ['女性', '男性', '儿童'];

const AGES = ['18-22岁', '23-28岁', '29-35岁', '36-45岁', '45岁以上'];

const SKIN_TONES = [
  { label: '白皙', color: '#FAE8D8' },
  { label: '粉白', color: '#F5C9B8' },
  { label: '小麦色', color: '#D4956A' },
  { label: '健康棕', color: '#B5714A' },
  { label: '深肤色', color: '#7B4A2D' },
  { label: '黝黑', color: '#4A2515' },
];

const ETHNICITIES = [
  '东亚（中日韩）',
  '东南亚',
  '南亚',
  '欧美',
  '中东 / 拉美 / 混血',
];

const BODY_TYPES = ['纤细', '标准', '健美', '丰满'];

const TEMPERAMENTS = [
  { label: '开心甜美', icon: '' },
  { label: '高冷御姐', icon: '' },
  { label: '阳光活力', icon: '' },
  { label: '知性优雅', icon: '' },
  { label: '性感妩媚', icon: '' },
  { label: '清新甜美', icon: '' },
  { label: '霸气女王', icon: '' },
  { label: '艺术个性', icon: '' },
];

const HAIRSTYLES = ['长直发', '卷发', '短发', '马尾', '丸子头'];

const HAIR_COLORS = [
  { label: '黑色', color: '#1a1a1a' },
  { label: '深棕', color: '#4a2e1a' },
  { label: '金色', color: '#c8a035' },
  { label: '红棕', color: '#8b3a1e' },
];

const PHOTO_STYLES = [
  { label: '白底棚拍', bg: '#e8e8e8', textColor: '#333' },
  { label: '时尚街拍', bg: 'linear-gradient(135deg,#2c2c2c,#555)', textColor: '#fff' },
  { label: '自然户外', bg: 'linear-gradient(135deg,#4caf50,#8bc34a)', textColor: '#fff' },
  { label: '室内生活', bg: 'linear-gradient(135deg,#ff9800,#ffc107)', textColor: '#fff' },
  { label: '海边度假', bg: 'linear-gradient(135deg,#2196f3,#00bcd4)', textColor: '#fff' },
  { label: '咖啡馆', bg: 'linear-gradient(135deg,#795548,#a1887f)', textColor: '#fff' },
];

const SHOT_TYPES = ['全身照', '半身照', '侧面照', '特写', '背影照'];

const ASPECT_RATIOS = [
  { value: '3:4', label: '3:4 竖版' },
  { value: '4:3', label: '4:3 横版' },
  { value: '1:1', label: '1:1 方形' },
  { value: '9:16', label: '9:16 竖版' },
  { value: '16:9', label: '16:9 横版' },
];

const IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

//  Helpers 

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: file.type || 'image/png', name: file.name, preview: dataUrl });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function assemblePrompt({ gender, age, skinTone, ethnicity, height, weight, bodyType,
  temperament, hairstyle, hairColorLabel, photoStyle, shotType, extraDesc }) {
  let prompt =
    `生成一位专业电商模特图片，要求如下：` +
    `性别${gender}，年龄${age}，肤色${skinTone}，人种${ethnicity}，` +
    `身高${height}cm体重${weight}kg体型${bodyType}，` +
    `神态气质${temperament}，发型${hairstyle}发色${hairColorLabel}，` +
    `拍摄风格${photoStyle}，景别${shotType}，` +
    `要求形象真实自然，适合商品展示，画面干净专业。`;
  if (extraDesc && extraDesc.trim()) {
    prompt += ' ' + extraDesc.trim();
  }
  return prompt;
}

//  Sub-components 

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <Button
          key={opt}
          theme={value === opt ? 'solid' : 'light'}
          type={value === opt ? 'primary' : 'tertiary'}
          size='small'
          onClick={() => onChange(opt)}
        >
          {opt}
        </Button>
      ))}
    </div>
  );
}

function SectionLabel({ children, sub }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <Text strong>{children}</Text>
      {sub && (
        <Text type='tertiary' size='small' style={{ display: 'block' }}>
          {sub}
        </Text>
      )}
    </div>
  );
}

//  Component 

export default function ModelGenerateTool({
  model, setModel, tokenKey, setTokenKey,
  tokens, tokensLoading, paintingModels, saveImage,
}) {
  const { t } = useTranslation();
  const { generate, reset: resetHook } = usePaintingGenerate();
  const colorInputRef = useRef(null);

  // Form state
  const [gender, setGender] = useState('女性');
  const [age, setAge] = useState('18-22岁');
  const [skinTone, setSkinTone] = useState('白皙');
  const [ethnicity, setEthnicity] = useState('东亚（中日韩）');
  const [height, setHeight] = useState(168);
  const [weight, setWeight] = useState(45);
  const [bodyType, setBodyType] = useState('纤细');
  const [temperament, setTemperament] = useState('开心甜美');
  const [hairstyle, setHairstyle] = useState('长直发');
  const [hairColorLabel, setHairColorLabel] = useState('黑色');
  const [hairColorHex, setHairColorHex] = useState('#1a1a1a');
  const [refImages, setRefImages] = useState([]);
  const [photoStyle, setPhotoStyle] = useState('白底棚拍');
  const [shotType, setShotType] = useState('全身照');
  const [aspectRatio, setAspectRatio] = useState('3:4');
  const [imageSize, setImageSize] = useState('2K');
  const [extraDesc, setExtraDesc] = useState('');
  const [count, setCount] = useState(4);

  // Result state
  const [allImages, setAllImages] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [genError, setGenError] = useState(null);
  const [savingIndex, setSavingIndex] = useState(-1);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');

  const handleRefUpload = useCallback(async ({ file }) => {
    if (refImages.length >= 6) {
      Toast.warning(t('最多上传6张参考图'));
      return false;
    }
    try {
      const imgData = await fileToBase64(file.fileInstance);
      setRefImages((prev) => [...prev, imgData]);
    } catch (_) {
      Toast.error(t('上传失败'));
    }
    return false;
  }, [refImages.length, t]);

  const removeRefImage = useCallback((idx) => {
    setRefImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleHairColorPick = useCallback((e) => {
    setHairColorHex(e.target.value);
    setHairColorLabel('自定义');
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!tokenKey) {
      Toast.warning(t('请选择密钥'));
      return;
    }
    const prompt = assemblePrompt({
      gender, age, skinTone, ethnicity, height, weight, bodyType,
      temperament, hairstyle, hairColorLabel, photoStyle, shotType, extraDesc,
    });

    setAllImages([]);
    setGenError(null);
    setGenerating(true);
    setProgress({ done: 0, total: count });

    try {
      for (let i = 0; i < count; i++) {
        const r = await generate({
          prompt,
          model,
          tokenKey,
          aspectRatio,
          imageSize,
          referenceImages: refImages,
        });
        if (r && r.images && r.images.length > 0) {
          setAllImages((prev) => [...prev, ...r.images]);
        } else if (r && r.texts && r.texts.length > 0 && i === 0) {
          setGenError(r.texts[0]);
          break;
        }
        setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
      }
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }, [
    tokenKey, gender, age, skinTone, ethnicity, height, weight, bodyType,
    temperament, hairstyle, hairColorLabel, photoStyle, shotType, extraDesc,
    count, model, aspectRatio, imageSize, refImages, generate, t,
  ]);

  const handleClear = useCallback(() => {
    setAllImages([]);
    setGenError(null);
    resetHook();
  }, [resetHook]);

  const handleSave = useCallback(async (img, idx) => {
    setSavingIndex(idx);
    const prompt = assemblePrompt({
      gender, age, skinTone, ethnicity, height, weight, bodyType,
      temperament, hairstyle, hairColorLabel, photoStyle, shotType, extraDesc,
    });
    try {
      await saveImage({
        base64Data: img.base64,
        mimeType: img.mimeType,
        prompt,
        model,
        aspectRatio,
        imageSize,
        referenceCount: refImages.length,
      });
      Toast.success(t('保存成功'));
    } catch (_) {
      Toast.error(t('保存失败'));
    } finally {
      setSavingIndex(-1);
    }
  }, [saveImage, gender, age, skinTone, ethnicity, height, weight, bodyType,
    temperament, hairstyle, hairColorLabel, photoStyle, shotType, extraDesc,
    model, aspectRatio, imageSize, refImages.length, t]);

  const handleDownload = useCallback((img, idx) => {
    const link = document.createElement('a');
    link.href = `data:${img.mimeType};base64,${img.base64}`;
    link.download = `model-${Date.now()}-${idx + 1}.${img.mimeType?.split('/')[1] || 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const openPreview = useCallback((src) => {
    setPreviewSrc(src);
    setPreviewVisible(true);
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Title heading={5} style={{ margin: 0 }}>{t('模特生成')}</Title>
        <Text type='tertiary' size='small'>
          {t('配置模特形象参数，AI 自动生成专业电商模特图')}
        </Text>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/*  Left Panel  */}
        <div style={{ flex: '1 1 420px', minWidth: 360 }}>

          {/* Model & Key */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: '1 1 200px' }}>
                <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('模型')}</Text>
                <Select value={model} onChange={setModel} style={{ width: '100%' }}
                  optionList={paintingModels}
                  emptyContent={t('暂无可用模型，请在模型管理中配置')} />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('密钥')}</Text>
                <Select value={tokenKey} onChange={setTokenKey} style={{ width: '100%' }}
                  loading={tokensLoading} placeholder={t('选择密钥')}
                  emptyContent={t('暂无可用密钥')}
                  optionList={tokens.map((tk) => ({
                    value: tk.key,
                    label: tk.name ? `${tk.name} (${tk.key.slice(0, 8)}...)` : `${tk.key.slice(0, 16)}...`,
                  }))} />
              </div>
            </div>
          </Card>

          {/* Basic Appearance */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <SectionLabel sub={t('不同性别适合不同产品类目')}>{t('性别')}</SectionLabel>
              <ToggleGroup options={GENDERS} value={gender} onChange={setGender} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <SectionLabel sub={t('选择模特年龄层次，匹配受众客群')}>{t('年龄段')}</SectionLabel>
              <ToggleGroup options={AGES} value={age} onChange={setAge} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <SectionLabel sub={t('不同肤色适合不同场景')}>{t('肤色')}</SectionLabel>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {SKIN_TONES.map((s) => (
                  <div key={s.label} style={{ textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => setSkinTone(s.label)}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: s.color, margin: '0 auto 4px',
                      border: skinTone === s.label
                        ? '3px solid var(--semi-color-primary)'
                        : '3px solid transparent',
                      outline: skinTone === s.label ? '2px solid var(--semi-color-primary-light-default)' : 'none',
                    }} />
                    <Text size='small'>{s.label}</Text>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Text strong size='small' style={{ display: 'block', marginBottom: 6 }}>{t('地区人种')}</Text>
              <Select value={ethnicity} onChange={setEthnicity} style={{ width: '100%' }}
                optionList={ETHNICITIES.map((e) => ({ value: e, label: e }))} />
            </div>
          </Card>

          {/* Body Settings */}
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel sub={t('精准调节身材参数，找到最适合展示你产品的模特')}>{t('身材设定')}</SectionLabel>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text size='small'>{t('身高')}</Text>
                <Text size='small' style={{ color: 'var(--semi-color-primary)', fontWeight: 600 }}>
                  {height}cm
                </Text>
              </div>
              <Slider value={height} onChange={setHeight} min={150} max={185} step={1}
                tipFormatter={(v) => `${v}cm`} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text size='small'>{t('体重')}</Text>
                <Text size='small' style={{ color: 'var(--semi-color-primary)', fontWeight: 600 }}>
                  {weight}kg
                </Text>
              </div>
              <Slider value={weight} onChange={setWeight} min={38} max={100} step={1}
                tipFormatter={(v) => `${v}kg`} />
            </div>
            <div>
              <Text size='small' style={{ display: 'block', marginBottom: 6 }}>{t('体型')}</Text>
              <ToggleGroup options={BODY_TYPES} value={bodyType} onChange={setBodyType} />
            </div>
          </Card>

          {/* Appearance Style */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <SectionLabel sub={t('神态决定模特气场，影响买家对产品的预估')}>{t('神态气质')}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {TEMPERAMENTS.map((tp) => (
                  <div key={tp.label} onClick={() => setTemperament(tp.label)}
                    style={{
                      padding: '8px 4px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      border: `2px solid ${temperament === tp.label ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
                      background: temperament === tp.label ? 'var(--semi-color-primary-light-default)' : 'transparent',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ fontSize: 22, lineHeight: '28px' }}>{tp.icon}</div>
                    <Text size='small'>{tp.label}</Text>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <Text size='small' style={{ display: 'block', marginBottom: 6 }}>{t('发型')}</Text>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {HAIRSTYLES.map((h) => (
                    <Button key={h} size='small'
                      theme={hairstyle === h ? 'solid' : 'light'}
                      type={hairstyle === h ? 'primary' : 'tertiary'}
                      onClick={() => setHairstyle(h)}>{h}</Button>
                  ))}
                </div>
              </div>

              <div style={{ flex: '1 1 160px' }}>
                <Text size='small' style={{ display: 'block', marginBottom: 6 }}>{t('发色')}</Text>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {HAIR_COLORS.map((hc) => (
                    <div key={hc.label} onClick={() => { setHairColorLabel(hc.label); setHairColorHex(hc.color); }}
                      title={hc.label}
                      style={{
                        width: 28, height: 28, borderRadius: 6, background: hc.color, cursor: 'pointer',
                        border: hairColorLabel === hc.label ? '3px solid var(--semi-color-primary)' : '2px solid transparent',
                        outline: hairColorLabel === hc.label ? '2px solid var(--semi-color-primary-light-default)' : 'none',
                      }} />
                  ))}
                  <div
                    onClick={() => colorInputRef.current && colorInputRef.current.click()}
                    title={t('拾色器')}
                    style={{
                      width: 28, height: 28, borderRadius: 6, background: hairColorHex, cursor: 'pointer',
                      border: hairColorLabel === '自定义' ? '3px solid var(--semi-color-primary)' : '2px solid var(--semi-color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                    }}>
                    <input ref={colorInputRef} type='color' value={hairColorHex}
                      onChange={handleHairColorPick}
                      style={{ opacity: 0, position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} />
                  </div>
                  <Text type='tertiary' size='small'>{t('拾色器')}</Text>
                </div>
                {hairColorLabel === '自定义' && (
                  <Text size='small' style={{ color: 'var(--semi-color-primary)', marginTop: 4, display: 'block' }}>
                    {hairColorHex}
                  </Text>
                )}
              </div>
            </div>
          </Card>

          {/* Reference Images */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <Text strong size='small'>{t('模特参考')}</Text>
                <Text type='tertiary' size='small' style={{ display: 'block' }}>
                  {t('上传您心仪的模特图片，AI将尽量保留其面部特征与体型风格')}
                </Text>
              </div>
              <Text type='tertiary' size='small'>{refImages.length}/6 {t('最大20M')}</Text>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {refImages.map((img, idx) => (
                <div key={idx} style={{ position: 'relative', width: 72, height: 72 }}>
                  <img src={img.preview} alt={img.name}
                    style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                    onClick={() => openPreview(img.preview)} />
                  <Button icon={<IconDelete />} type='danger' theme='solid' size='small'
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                      borderRadius: '50%', padding: 0, minWidth: 0 }}
                    onClick={() => removeRefImage(idx)} />
                </div>
              ))}
              {refImages.length < 6 && (
                <Upload action='' accept='image/png,image/jpeg,image/webp'
                  showUploadList={false} customRequest={handleRefUpload}>
                  <div style={{
                    width: 72, height: 72, border: '2px dashed var(--semi-color-primary)',
                    borderRadius: 6, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    color: 'var(--semi-color-primary)', gap: 4,
                  }}>
                    <IconPlus size='large' />
                    <Text size='small' style={{ color: 'var(--semi-color-primary)', fontSize: 11 }}>
                      {t('点击上传')}
                    </Text>
                  </div>
                </Upload>
              )}
            </div>
          </Card>

          {/* Photography Style */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <SectionLabel sub={t('选择合适的风格，模拟实拍图更具吸引力')}>{t('拍摄风格')}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {PHOTO_STYLES.map((ps) => (
                  <div key={ps.label} onClick={() => setPhotoStyle(ps.label)}
                    style={{
                      height: 60, borderRadius: 8, cursor: 'pointer',
                      background: ps.bg, color: ps.textColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 600, fontSize: 13,
                      border: photoStyle === ps.label
                        ? '3px solid var(--semi-color-primary)'
                        : '3px solid transparent',
                      transition: 'all 0.15s',
                      userSelect: 'none',
                    }}>
                    {ps.label}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel sub={t('设定模特的构图形态，如全身展示或局部细节')}>{t('镜头景别')}</SectionLabel>
              <ToggleGroup options={SHOT_TYPES} value={shotType} onChange={setShotType} />
            </div>
          </Card>

          {/* Generation Settings */}
          <Card>
            <SectionLabel>{t('生成设置')}</SectionLabel>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ flex: '1 1 140px' }}>
                <Text size='small' style={{ display: 'block', marginBottom: 4 }}>{t('尺寸比例')}</Text>
                <Select value={aspectRatio} onChange={setAspectRatio} style={{ width: '100%' }}
                  optionList={ASPECT_RATIOS} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <Text size='small' style={{ display: 'block', marginBottom: 4 }}>{t('清晰度')}</Text>
                <Select value={imageSize} onChange={setImageSize} style={{ width: '100%' }}
                  optionList={IMAGE_SIZES} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text size='small'>{t('补充描述（可选）')}</Text>
                <Text type='tertiary' size='small'>{extraDesc.length}/200</Text>
              </div>
              <TextArea value={extraDesc} onChange={setExtraDesc}
                maxLength={200} placeholder={t('例如：模特穿绿色吊带，背景有绿植...')}
                autosize={{ minRows: 2, maxRows: 4 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ background: 'var(--semi-color-fill-0)', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong size='small'>{t('生成模特数量')}</Text>
                    <Text type='tertiary' size='small' style={{ display: 'block' }}>
                      {t('一次提交会生成 {{count}} 条独立任务，方便挑选满意的模特', { count })}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Button size='small' theme='light' type='tertiary'
                      style={{ width: 28, height: 28, padding: 0, borderRadius: 6, fontSize: 18, lineHeight: 1 }}
                      onClick={() => setCount((c) => Math.max(1, c - 1))}>
                      
                    </Button>
                    <Text strong style={{ fontSize: 18, minWidth: 20, textAlign: 'center' }}>{count}</Text>
                    <Button size='small' theme='light' type='tertiary'
                      style={{ width: 28, height: 28, padding: 0, borderRadius: 6, fontSize: 18, lineHeight: 1 }}
                      onClick={() => setCount((c) => Math.min(8, c + 1))}>
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Button theme='solid' type='primary' size='large' block
              icon={<IconUser />} loading={generating} onClick={handleGenerate}>
              {generating
                ? t('生成中 {{done}}/{{total}}...', { done: progress.done, total: progress.total })
                : t('生成模特')}
            </Button>
          </Card>
        </div>

        {/*  Right Panel  */}
        <div style={{ flex: '1 1 400px', minWidth: 340 }}>
          <Card
            title={t('生成结果')}
            style={{ minHeight: 400 }}
            headerExtraContent={
              allImages.length > 0 && (
                <Button size='small' icon={<IconRefresh />} onClick={handleClear}>
                  {t('清除')}
                </Button>
              )
            }
          >
            {generating && allImages.length === 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                <Spin size='large'
                  tip={t('生成中 {{done}}/{{total}}，请稍候...', { done: progress.done, total: progress.total })} />
              </div>
            )}

            {genError && !generating && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Text type='danger'>{genError}</Text>
              </div>
            )}

            {!generating && allImages.length === 0 && !genError && (
              <Empty
                image={<IconUser size='extra-large' style={{ color: 'var(--semi-color-text-3)' }} />}
                description={t('配置参数后点击生成模特')}
                style={{ padding: '40px 0' }}
              />
            )}

            {allImages.length > 0 && (
              <div>
                {generating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Spin size='small' />
                    <Text type='tertiary' size='small'>
                      {t('{{done}}/{{total}} 已完成，继续生成中...', { done: progress.done, total: progress.total })}
                    </Text>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {allImages.map((img, idx) => (
                    <div key={idx}>
                      <img
                        src={`data:${img.mimeType};base64,${img.base64}`}
                        alt={`Model ${idx + 1}`}
                        style={{ width: '100%', borderRadius: 8, cursor: 'pointer', display: 'block' }}
                        onClick={() => openPreview(`data:${img.mimeType};base64,${img.base64}`)}
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <Button icon={<IconSave />} size='small' loading={savingIndex === idx}
                          onClick={() => handleSave(img, idx)} style={{ flex: 1 }}>
                          {t('保存')}
                        </Button>
                        <Button icon={<IconDownload />} size='small'
                          onClick={() => handleDownload(img, idx)} style={{ flex: 1 }}>
                          {t('下载')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      <Modal visible={previewVisible} onCancel={() => setPreviewVisible(false)}
        footer={null} closable width='auto' style={{ maxWidth: '90vw' }}
        bodyStyle={{ padding: 0, display: 'flex', justifyContent: 'center' }}>
        <img src={previewSrc} alt='Preview'
          style={{ maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain' }} />
      </Modal>
    </div>
  );
}