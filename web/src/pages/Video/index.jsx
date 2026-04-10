import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Layout,
  Select,
  Button,
  TextArea,
  Card,
  Typography,
  Spin,
  Toast,
  Tag,
  Progress,
  Banner,
  InputNumber,
  Empty,
  Modal,
  Tooltip,
  Pagination,
} from '@douyinfe/semi-ui';
import {
  IconVideo,
  IconPlay,
  IconStop,
  IconRefresh,
  IconDownload,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useVideoGenerate } from '../../hooks/video/useVideoGenerate';
import { useVideoHistory } from '../../hooks/video/useVideoHistory';
import { API } from '../../helpers/api';
import { getServerAddress } from '../../helpers/token';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

// Provider definitions (models are empty by default, configured via model management)
const DEFAULT_PROVIDERS = [
  {
    key: 'sora',
    label: 'OpenAI Sora',
    models: [],
    sizes: ['1280x720', '720x1280', '1024x1792', '1792x1024'],
    secondsRange: [1, 20],
    defaultSeconds: 5,
    supportAspectRatio: false,
  },
  {
    key: 'veo',
    label: 'Google Veo',
    models: [],
    sizes: ['1280x720', '720x1280'],
    secondsRange: [5, 8],
    defaultSeconds: 8,
    supportAspectRatio: false,
  },
  {
    key: 'grok',
    label: 'XAI Grok',
    models: [],
    sizes: ['1280x720', '720x1280', '1024x1024'],
    secondsRange: [5, 10],
    defaultSeconds: 5,
    supportAspectRatio: true,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportExtend: true,
  },
  {
    key: 'doubao',
    label: '字节跳动 豆包',
    models: [],
    sizes: ['1280x720', '720x1280', '960x960'],
    secondsRange: [5, 10],
    defaultSeconds: 5,
    supportAspectRatio: false,
  },
  {
    key: 'hailuo',
    label: '海螺AI',
    models: [],
    sizes: ['768P', '1080P'],
    secondsRange: [6, 10],
    defaultSeconds: 6,
    supportAspectRatio: false,
    apiFormat: 'json',
    endpoint: '/v1/videos',
    supportImages: true,
    useOutputConfig: true,
  },
  {
    key: 'kling',
    label: '可灵 Kling',
    models: [],
    sizes: ['720P', '1080P'],
    secondsRange: [5, 10],
    defaultSeconds: 5,
    supportAspectRatio: true,
    aspectRatios: ['16:9', '9:16', '1:1'],
    apiFormat: 'json',
    endpoint: '/v1/videos',
    supportImages: true,
    useOutputConfig: true,
  },
  {
    key: 'gv',
    label: 'GV',
    models: [],
    secondsRange: [8, 8],
    defaultSeconds: 8,
    supportAspectRatio: true,
    aspectRatios: ['16:9', '9:16', '1:1'],
    apiFormat: 'json',
    endpoint: '/v1/videos',
    supportImages: true,
    useOutputConfig: true,
  },
  {
    key: 'os',
    label: 'OS',
    models: [],
    secondsRange: [4, 12],
    defaultSeconds: 8,
    supportAspectRatio: false,
    apiFormat: 'json',
    endpoint: '/v1/videos',
    supportImages: true,
    useOutputConfig: true,
  },
  {
    key: 'hunyuan',
    label: '混元 Hunyuan',
    models: [],
    sizes: ['720P', '1080P'],
    supportAspectRatio: false,
    apiFormat: 'json',
    endpoint: '/v1/videos',
    supportImages: true,
    useOutputConfig: true,
  },
  {
    key: 'mingmou',
    label: '明眸 Mingmou',
    models: [],
    sizes: ['720P', '1080P'],
    supportAspectRatio: false,
    apiFormat: 'json',
    endpoint: '/v1/videos',
    supportImages: true,
    useOutputConfig: true,
  },
  {
    key: 'vidu',
    label: 'Vidu',
    models: [],
    sizes: ['720p', '1080p'],
    secondsRange: [1, 10],
    defaultSeconds: 5,
    supportAspectRatio: true,
    aspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    apiFormat: 'json',
    endpoint: '/v1/video/generations',
    supportImages: true,
  },
];

function transformProviders(apiProviders) {
  return apiProviders.map((p) => ({
    key: p.key,
    label: p.label,
    models: (p.models || []).map((m) => ({ value: m, label: m })),
    sizes: p.sizes,
    secondsRange: p.seconds_range,
    defaultSeconds: p.default_seconds,
    supportAspectRatio: !!(p.aspect_ratios && p.aspect_ratios.length > 0),
    aspectRatios: p.aspect_ratios,
    apiFormat: p.api_format,
    endpoint: p.endpoint,
    supportImages: p.support_images,
    supportExtend: p.support_extend,
    useOutputConfig: p.use_output_config,
  }));
}

function getVideoProxyUrl(taskId, tokenKey) {
  const serverAddress = getServerAddress();
  return `${serverAddress}/v1/videos/${taskId}/content?token=${encodeURIComponent(tokenKey)}`;
}

function formatTimeAgo(timestamp, t) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return t('刚刚');
  if (diff < 3600) return t('{{n}} 分钟前', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('{{n}} 小时前', { n: Math.floor(diff / 3600) });
  return t('{{n}} 天前', { n: Math.floor(diff / 86400) });
}

function handleDownloadVideo(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'video.mp4';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function Video() {
  const { t } = useTranslation();
  const { submit, submitExtend, submitJson, loading, taskStatus, error: genError, reset } = useVideoGenerate();
  const { tasks: historyTasks, total: historyTotal, page: historyPage, setPage: setHistoryPage, loading: historyLoading, refresh: refreshHistory, pageSize: historyPageSize } = useVideoHistory(12);

  // Tab state
  const [activeTab, setActiveTab] = useState('generate');

  // Preview modal
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // State
  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [providerKey, setProviderKey] = useState('sora');
  const [model, setModel] = useState('');
  const [tokenKey, setTokenKey] = useState('');
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1280x720');
  const [seconds, setSeconds] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [videoPostId, setVideoPostId] = useState('');
  const [mode, setMode] = useState('generate'); // 'generate' | 'extend'
  const [imageUrls, setImageUrls] = useState('');

  // Load dynamic providers and merge model assignments from API
  useEffect(() => {
    const loadProviders = async () => {
      let baseProviders = DEFAULT_PROVIDERS;

      // Try loading from API first for freshest data, fallback to localStorage
      let videoModels = null;
      let providerModelsMap = null;
      try {
        const res = await API.get('/api/status');
        if (res.data.success && res.data.data) {
          const statusData = res.data.data;
          if (Array.isArray(statusData.video_models) && statusData.video_models.length > 0) {
            videoModels = statusData.video_models;
          }
          if (statusData.video_provider_models && typeof statusData.video_provider_models === 'object') {
            providerModelsMap = statusData.video_provider_models;
          }
        }
      } catch (e) {
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem('video_models');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              videoModels = parsed;
            }
          }
        } catch (_) {}
        try {
          const vpModels = localStorage.getItem('video_provider_models');
          if (vpModels) {
            providerModelsMap = JSON.parse(vpModels);
          }
        } catch (_) {}
      }

      // Apply provider config
      if (videoModels) {
        baseProviders = transformProviders(videoModels);
      }

      // Merge model assignments from model management
      if (providerModelsMap && typeof providerModelsMap === 'object' && Object.keys(providerModelsMap).length > 0) {
        baseProviders = baseProviders.map((p) => {
          const assignedModels = providerModelsMap[p.key];
          if (assignedModels && assignedModels.length > 0) {
            return {
              ...p,
              models: assignedModels.map((m) => ({ value: m, label: m })),
            };
          }
          return p;
        });
      }

      setProviders(baseProviders);
    };

    loadProviders();
  }, []);

  const provider = useMemo(
    () => providers.find((p) => p.key === providerKey) || providers[0],
    [providerKey, providers],
  );

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

  // When provider changes, reset model, size, seconds
  useEffect(() => {
    const p = providers.find((pr) => pr.key === providerKey);
    if (p && p.models.length > 0) {
      setModel(p.models[0].value);
      if (p.sizes && p.sizes.length > 0) {
        setSize(p.sizes[0]);
      }
      if (p.defaultSeconds) {
        setSeconds(p.defaultSeconds);
      }
      if (p.aspectRatios && p.aspectRatios.length > 0) {
        setAspectRatio(p.aspectRatios[0]);
      }
      setMode('generate');
    } else {
      setModel('');
    }
  }, [providerKey]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      Toast.warning(t('请输入提示词'));
      return;
    }
    if (!tokenKey) {
      Toast.warning(t('请选择密钥'));
      return;
    }
    if (provider.comingSoon) {
      Toast.info(t('该供应商即将支持'));
      return;
    }

    if (mode === 'extend') {
      await submitExtend({
        prompt: prompt.trim(),
        model,
        tokenKey,
        videoPostId: videoPostId.trim() || undefined,
      });
    } else if (provider.apiFormat === 'json') {
      const imgList = imageUrls.trim()
        ? imageUrls.trim().split('\n').map((u) => u.trim()).filter(Boolean)
        : undefined;
      const metadata = {};
      if (provider.useOutputConfig) {
        // magic666 style: metadata.output_config
        const outputConfig = {};
        if (size) outputConfig.resolution = size;
        if (provider.supportAspectRatio && aspectRatio) outputConfig.aspect_ratio = aspectRatio;
        if (Object.keys(outputConfig).length > 0) metadata.output_config = outputConfig;
      } else {
        // Vidu style: flat metadata
        if (provider.supportAspectRatio && aspectRatio) metadata.aspect_ratio = aspectRatio;
      }
      await submitJson({
        prompt: prompt.trim(),
        model,
        tokenKey,
        seconds: provider.useOutputConfig ? seconds : undefined,
        duration: !provider.useOutputConfig ? seconds : undefined,
        size: !provider.useOutputConfig ? size : undefined,
        image: imgList && imgList.length === 1 ? imgList[0] : undefined,
        images: imgList && imgList.length > 1 ? imgList : (!provider.useOutputConfig && imgList ? imgList : undefined),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        endpoint: provider.endpoint,
      });
    } else {
      await submit({
        prompt: prompt.trim(),
        model,
        tokenKey,
        size,
        seconds,
        aspectRatio: provider.supportAspectRatio ? aspectRatio : undefined,
      });
    }
  }, [prompt, tokenKey, provider, mode, model, size, seconds, aspectRatio, videoPostId, imageUrls, submit, submitExtend, submitJson, t]);

  const taskId = taskStatus?.id || taskStatus?.task_id;
  const isCompleted = taskStatus?.status === 'completed' || taskStatus?.status === 'success';
  const isFailed = taskStatus?.status === 'failed' || taskStatus?.status === 'cancelled';
  const progressValue = taskStatus?.progress || 0;

  return (
    <div style={{ padding: '20px 24px 24px', maxWidth: 1200, margin: '0 auto', minHeight: 'calc(100vh - 120px)' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <IconVideo size='large' style={{ color: 'var(--semi-color-primary)' }} />
        <Title heading={3} style={{ margin: 0 }}>{t('AI 视频')}</Title>
      </div>

      {/* Tab Switch */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button
          theme={activeTab === 'generate' ? 'solid' : 'light'}
          onClick={() => setActiveTab('generate')}
        >
          {t('视频生成')}
        </Button>
        <Button
          theme={activeTab === 'history' ? 'solid' : 'light'}
          onClick={() => { setActiveTab('history'); refreshHistory(); }}
        >
          {t('历史记录')}
        </Button>
      </div>

      {activeTab === 'generate' && (
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Left Panel: Settings */}
        <div style={{ flex: '1 1 400px', minWidth: 340 }}>
          {/* Provider & Model */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {/* Provider */}
              <div style={{ flex: '1 1 180px' }}>
                <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('供应商')}</Text>
                <Select
                  value={providerKey}
                  onChange={setProviderKey}
                  style={{ width: '100%' }}
                  optionList={providers.map((p) => ({
                    value: p.key,
                    label: p.comingSoon ? `${p.label} (${t('即将支持')})` : p.label,
                  }))}
                />
              </div>
              {/* Model */}
              <div style={{ flex: '1 1 220px' }}>
                <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('模型')}</Text>
                <Select
                  value={model}
                  onChange={setModel}
                  style={{ width: '100%' }}
                  disabled={provider.comingSoon}
                  emptyContent={t('暂无可用模型，请在模型管理中配置')}
                  optionList={provider.models.map((m) => ({
                    value: m.value,
                    label: m.label,
                  }))}
                />
              </div>
              {/* Token */}
              <div style={{ flex: '1 1 220px' }}>
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
            </div>
          </Card>

          {/* Parameters */}
          {!provider.comingSoon && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {/* Mode toggle for providers that support extend */}
                {provider.supportExtend && (
                  <div style={{ flex: '1 1 100%' }}>
                    <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('模式')}</Text>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        theme={mode === 'generate' ? 'solid' : 'light'}
                        size='small'
                        onClick={() => setMode('generate')}
                      >
                        {t('生成')}
                      </Button>
                      <Button
                        theme={mode === 'extend' ? 'solid' : 'light'}
                        size='small'
                        onClick={() => setMode('extend')}
                      >
                        {t('延伸')}
                      </Button>
                    </div>
                  </div>
                )}

                {mode === 'generate' && (
                  <>
                    {/* Size */}
                    {provider.sizes && (
                      <div style={{ flex: '1 1 150px' }}>
                        <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('尺寸')}</Text>
                        <Select
                          value={size}
                          onChange={setSize}
                          style={{ width: '100%' }}
                          optionList={provider.sizes.map((s) => ({ value: s, label: s }))}
                        />
                      </div>
                    )}
                    {/* Seconds */}
                    {provider.secondsRange && (
                      <div style={{ flex: '1 1 120px' }}>
                        <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('时长(秒)')}</Text>
                        <InputNumber
                          value={seconds}
                          onChange={setSeconds}
                          min={provider.secondsRange[0]}
                          max={provider.secondsRange[1]}
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                    {/* Aspect Ratio */}
                    {provider.supportAspectRatio && provider.aspectRatios && (
                      <div style={{ flex: '1 1 120px' }}>
                        <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>{t('宽高比')}</Text>
                        <Select
                          value={aspectRatio}
                          onChange={setAspectRatio}
                          style={{ width: '100%' }}
                          optionList={provider.aspectRatios.map((ar) => ({ value: ar, label: ar }))}
                        />
                      </div>
                    )}
                    {/* Image URLs for providers that support images */}
                    {provider.supportImages && (
                      <div style={{ flex: '1 1 100%' }}>
                        <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>
                          {t('图片URL')} <Text type='tertiary' size='small'>({t('可选')})</Text>
                        </Text>
                        <TextArea
                          value={imageUrls}
                          onChange={setImageUrls}
                          placeholder={t('输入图片URL，每行一个\n1张图：图生视频\n2张图：首尾帧生视频')}
                          autosize={{ minRows: 2, maxRows: 4 }}
                        />
                      </div>
                    )}
                  </>
                )}

                {mode === 'extend' && (
                  <div style={{ flex: '1 1 100%' }}>
                    <Text strong size='small' style={{ display: 'block', marginBottom: 4 }}>
                      Video Post ID <Text type='tertiary' size='small'>({t('可选')})</Text>
                    </Text>
                    <TextArea
                      value={videoPostId}
                      onChange={setVideoPostId}
                      placeholder={t('输入要延伸的视频 Post ID')}
                      autosize={{ minRows: 1, maxRows: 2 }}
                    />
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Prompt */}
          <Card style={{ marginBottom: 16 }}>
            <Text strong size='small' style={{ display: 'block', marginBottom: 8 }}>{t('提示词')}</Text>
            <TextArea
              value={prompt}
              onChange={setPrompt}
              placeholder={t('描述你想生成的视频...')}
              autosize={{ minRows: 3, maxRows: 8 }}
              disabled={provider.comingSoon}
              style={{ marginBottom: 12 }}
            />

            {/* Coming Soon Banner */}
            {provider.comingSoon && (
              <Banner
                type='info'
                description={t('该供应商即将支持，敬请期待')}
                style={{ marginBottom: 12 }}
              />
            )}

            {/* Generate Button */}
            <Button
              theme='solid'
              type='primary'
              size='large'
              icon={loading ? <IconStop /> : <IconPlay />}
              loading={loading}
              disabled={provider.comingSoon || (!prompt.trim())}
              onClick={loading ? reset : handleGenerate}
              block
            >
              {loading ? t('停止') : mode === 'extend' ? t('延伸视频') : t('生成视频')}
            </Button>
          </Card>
        </div>

        {/* Right Panel: Result */}
        <div style={{ flex: '1 1 480px', minWidth: 340 }}>
          <Card
            title={t('视频结果')}
            style={{ minHeight: 400 }}
          >
            {/* Error */}
            {genError && (
              <Banner
                type='danger'
                description={genError}
                closeIcon={null}
                style={{ marginBottom: 12 }}
              />
            )}

            {/* Task Progress */}
            {loading && taskStatus && !isCompleted && !isFailed && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size='large' />
                <div style={{ marginTop: 16 }}>
                  <Text>{t('视频生成中...')}</Text>
                  {taskStatus.status && (
                    <Tag color='blue' style={{ marginLeft: 8 }}>{taskStatus.status}</Tag>
                  )}
                </div>
                {progressValue > 0 && (
                  <Progress
                    percent={progressValue}
                    style={{ marginTop: 12, maxWidth: 300, margin: '12px auto 0' }}
                    showInfo
                  />
                )}
              </div>
            )}

            {/* Completed Video */}
            {isCompleted && taskId && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <Tag color='green'>{t('生成完成')}</Tag>
                </div>
                <video
                  controls
                  style={{
                    width: '100%',
                    maxHeight: 500,
                    borderRadius: 8,
                    backgroundColor: '#000',
                  }}
                  src={getVideoProxyUrl(taskId, tokenKey)}
                >
                  {t('您的浏览器不支持视频播放')}
                </video>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <Button
                    icon={<IconRefresh />}
                    onClick={reset}
                  >
                    {t('重新生成')}
                  </Button>
                </div>
              </div>
            )}

            {/* Failed */}
            {isFailed && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Banner
                  type='danger'
                  description={taskStatus?.error?.message || t('视频生成失败')}
                  closeIcon={null}
                />
                <Button
                  icon={<IconRefresh />}
                  onClick={reset}
                  style={{ marginTop: 16 }}
                >
                  {t('重试')}
                </Button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !taskStatus && !genError && (
              <div style={{
                textAlign: 'center',
                padding: '60px 0',
                color: 'var(--semi-color-text-2)',
              }}>
                <IconVideo size='extra-large' style={{ color: 'var(--semi-color-text-3)', marginBottom: 12 }} />
                <Paragraph type='tertiary'>
                  {t('选择供应商和模型，输入提示词，开始生成视频')}
                </Paragraph>
              </div>
            )}
          </Card>
        </div>
      </div>
      )}

      {activeTab === 'history' && (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text type='tertiary'>
            {t('共 {{total}} 条记录', { total: historyTotal })}
          </Text>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!tokenKey && (
              <Text type='warning' size='small'>
                {t('请先在生成页选择密钥以预览视频')}
              </Text>
            )}
            <Button icon={<IconRefresh />} onClick={refreshHistory} loading={historyLoading} size='small'>
              {t('刷新')}
            </Button>
          </div>
        </div>

        {historyLoading && historyTasks.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spin size='large' />
          </div>
        ) : historyTasks.length === 0 ? (
          <Empty
            image={<IconVideo size='extra-large' style={{ color: 'var(--semi-color-text-3)' }} />}
            description={t('暂无视频任务记录')}
            style={{ padding: '60px 0' }}
          />
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
            }}>
              {historyTasks.map((task) => {
                const isSuccess = task.status === 'SUCCESS';
                const isFail = task.status === 'FAILURE';
                const isProcessing = !isSuccess && !isFail;
                const modelName = task.properties?.origin_model_name || task.properties?.upstream_model_name || '-';
                const videoUrl = isSuccess && task.task_id && tokenKey
                  ? getVideoProxyUrl(task.task_id, tokenKey)
                  : null;

                return (
                  <Card
                    key={task.id}
                    bodyStyle={{ padding: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    {/* Video preview / status placeholder */}
                    <div style={{
                      width: '100%',
                      height: 200,
                      backgroundColor: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}>
                      {isSuccess && videoUrl ? (
                        <video
                          src={videoUrl}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
                          muted
                          preload='metadata'
                          onClick={() => { setPreviewUrl(videoUrl); setPreviewVisible(true); }}
                          onMouseEnter={(e) => e.target.play?.()}
                          onMouseLeave={(e) => { e.target.pause?.(); e.target.currentTime = 0; }}
                        />
                      ) : isSuccess && !tokenKey ? (
                        <Text type='tertiary' style={{ color: '#999' }}>{t('选择密钥后可预览')}</Text>
                      ) : isProcessing ? (
                        <div style={{ textAlign: 'center' }}>
                          <Spin />
                          <div style={{ marginTop: 8 }}>
                            <Text style={{ color: '#ccc' }}>{task.progress || '0%'}</Text>
                          </div>
                        </div>
                      ) : (
                        <Text type='danger' style={{ color: '#ff7875' }}>{t('生成失败')}</Text>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '12px 16px' }}>
                      {/* Model & Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text strong ellipsis={{ showTooltip: true }} style={{ maxWidth: '60%' }}>
                          {modelName}
                        </Text>
                        <Tag
                          size='small'
                          color={isSuccess ? 'green' : isFail ? 'red' : 'blue'}
                        >
                          {isSuccess ? t('成功') : isFail ? t('失败') : t('进行中')}
                        </Tag>
                      </div>

                      {/* Tags */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                        {task.action && <Tag size='small' color='light-blue'>{task.action}</Tag>}
                      </div>

                      {/* Fail reason */}
                      {isFail && task.fail_reason && (
                        <Tooltip content={task.fail_reason}>
                          <Paragraph ellipsis={{ rows: 1 }} type='danger' style={{ fontSize: 12, marginBottom: 8 }}>
                            {task.fail_reason}
                          </Paragraph>
                        </Tooltip>
                      )}

                      {/* Time & Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tooltip content={new Date(task.submit_time * 1000).toLocaleString()}>
                          <Text type='tertiary' size='small'>
                            {formatTimeAgo(task.submit_time, t)}
                          </Text>
                        </Tooltip>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {isSuccess && videoUrl && (
                            <>
                              <Button
                                icon={<IconPlay />}
                                size='small'
                                type='tertiary'
                                onClick={() => { setPreviewUrl(videoUrl); setPreviewVisible(true); }}
                              />
                              <Button
                                icon={<IconDownload />}
                                size='small'
                                type='tertiary'
                                onClick={() => handleDownloadVideo(videoUrl, `${task.task_id}.mp4`)}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {historyTotal > historyPageSize && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                <Pagination
                  total={historyTotal}
                  currentPage={historyPage}
                  pageSize={historyPageSize}
                  onChange={(p) => setHistoryPage(p)}
                />
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Video Preview Modal */}
      <Modal
        visible={previewVisible}
        onCancel={() => { setPreviewVisible(false); setPreviewUrl(''); }}
        footer={null}
        width={800}
        bodyStyle={{ padding: 0 }}
        closable
      >
        {previewUrl && (
          <video
            controls
            autoPlay
            style={{ width: '100%', maxHeight: '80vh', backgroundColor: '#000' }}
            src={previewUrl}
          >
            {t('您的浏览器不支持视频播放')}
          </video>
        )}
      </Modal>
    </div>
  );
}
