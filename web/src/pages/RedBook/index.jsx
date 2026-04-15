import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Layout,
  Select,
  Button,
  TextArea,
  Card,
  Typography,
  Spin,
  Empty,
  Toast,
  Tag,
  Popconfirm,
  Image,
  InputNumber,
  Divider,
  Tooltip,
} from '@douyinfe/semi-ui';
import {
  IconImage,
  IconDelete,
  IconDownload,
  IconEdit,
  IconRefresh,
  IconSave,
  IconPlay,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useRedBookGenerate } from '../../hooks/redbook/useRedBookGenerate';
import { useRedBookGallery } from '../../hooks/redbook/useRedBookGallery';
import { API } from '../../helpers/api';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

export default function RedBook() {
  const { t } = useTranslation();

  // Hooks
  const {
    generateOutline,
    generateImage,
    loading: generateLoading,
    error: generateError,
    reset: resetGenerate,
  } = useRedBookGenerate();
  const {
    projects,
    loading: galleryLoading,
    blobUrls,
    fetchProjects,
    fetchProjectImages,
    fetchImageBlob,
    saveProject,
    saveImage,
    deleteProject,
    deleteImage,
  } = useRedBookGallery();

  // Tab
  const [activeTab, setActiveTab] = useState('generate');

  // Models
  const [textModels, setTextModels] = useState([]);
  const [imageModels, setImageModels] = useState([]);
  const [textModel, setTextModel] = useState('');
  const [imageModel, setImageModel] = useState('');

  // Tokens
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [textTokenKey, setTextTokenKey] = useState('');
  const [imageTokenKey, setImageTokenKey] = useState('');

  // Generate state
  const [topic, setTopic] = useState('');
  const [pageCount, setPageCount] = useState(5);
  const [outline, setOutline] = useState(null);
  const [editingOutline, setEditingOutline] = useState(false);
  const [outlineText, setOutlineText] = useState('');
  const [generatedImages, setGeneratedImages] = useState({}); // pageIndex -> { mimeType, base64 }
  const [generatingPage, setGeneratingPage] = useState(-1); // which page is currently generating
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState(null);

  // Gallery state
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectImages, setProjectImages] = useState([]);

  // Load models from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('redbook_text_models');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const models = parsed.map((name) => ({ value: name, label: name }));
          setTextModels(models);
          setTextModel(models[0].value);
        }
      }
    } catch (_) {}

    try {
      const stored = localStorage.getItem('redbook_image_models');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const models = parsed.map((name) => ({ value: name, label: name }));
          setImageModels(models);
          setImageModel(models[0].value);
        }
      }
    } catch (_) {}
  }, []);

  // Load tokens
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
            setTextTokenKey(activeTokens[0].key);
            setImageTokenKey(activeTokens[0].key);
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

  const tokenOptions = useMemo(
    () =>
      tokens.map((tk) => ({
        value: tk.key,
        label: tk.name || tk.key.slice(0, 16) + '...',
      })),
    [tokens],
  );

  // Step 1: Generate outline
  const handleGenerateOutline = useCallback(async () => {
    if (!topic.trim()) {
      Toast.warning(t('请输入主题'));
      return;
    }
    if (!textModel) {
      Toast.warning(t('请选择文本模型'));
      return;
    }
    if (!textTokenKey) {
      Toast.warning(t('请选择文本密钥'));
      return;
    }

    const result = await generateOutline({
      topic: topic.trim(),
      pageCount,
      textModel,
      textTokenKey,
    });

    if (result) {
      setOutline(result);
      setOutlineText(JSON.stringify(result, null, 2));
      setGeneratedImages({});
      setSavedProjectId(null);
      Toast.success(t('大纲生成成功'));
    }
  }, [topic, pageCount, textModel, textTokenKey, generateOutline, t]);

  // Edit outline
  const handleSaveOutlineEdit = useCallback(() => {
    try {
      const parsed = JSON.parse(outlineText);
      setOutline(parsed);
      setEditingOutline(false);
      Toast.success(t('大纲已更新'));
    } catch (err) {
      Toast.error(t('JSON格式错误'));
    }
  }, [outlineText, t]);

  // Step 2: Generate image for a single page
  const handleGeneratePageImage = useCallback(
    async (page) => {
      if (!imageModel) {
        Toast.warning(t('请选择图片模型'));
        return;
      }
      if (!imageTokenKey) {
        Toast.warning(t('请选择图片密钥'));
        return;
      }

      setGeneratingPage(page.pageIndex);
      const result = await generateImage({
        prompt: page.imagePrompt,
        imageModel,
        imageTokenKey,
      });

      if (result) {
        setGeneratedImages((prev) => ({
          ...prev,
          [page.pageIndex]: result,
        }));
      }
      setGeneratingPage(-1);
    },
    [imageModel, imageTokenKey, generateImage, t],
  );

  // Step 3: Batch generate all page images
  const handleBatchGenerate = useCallback(async () => {
    if (!outline || !outline.pages) return;
    if (!imageModel) {
      Toast.warning(t('请选择图片模型'));
      return;
    }
    if (!imageTokenKey) {
      Toast.warning(t('请选择图片密钥'));
      return;
    }

    setBatchGenerating(true);
    for (const page of outline.pages) {
      if (generatedImages[page.pageIndex]) continue; // Skip already generated

      setGeneratingPage(page.pageIndex);
      const result = await generateImage({
        prompt: page.imagePrompt,
        imageModel,
        imageTokenKey,
      });

      if (result) {
        setGeneratedImages((prev) => ({
          ...prev,
          [page.pageIndex]: result,
        }));
      }
    }
    setGeneratingPage(-1);
    setBatchGenerating(false);
    Toast.success(t('图片生成完成'));
  }, [outline, imageModel, imageTokenKey, generatedImages, generateImage, t]);

  // Save project + images
  const handleSaveProject = useCallback(async () => {
    if (!outline) return;

    try {
      const project = await saveProject({
        topic,
        outline: JSON.stringify(outline),
        page_count: outline.pages?.length || 0,
        text_model: textModel,
        image_model: imageModel,
        status: 'completed',
      });

      const projectId = project.id;

      // Save each generated image
      for (const [pageIndex, imgData] of Object.entries(generatedImages)) {
        const page = outline.pages?.find(
          (p) => p.pageIndex === parseInt(pageIndex),
        );
        await saveImage({
          base64Data: imgData.base64,
          mimeType: imgData.mimeType,
          prompt: page?.imagePrompt || '',
          model: imageModel,
          projectId,
          pageIndex: parseInt(pageIndex),
          pageType: page?.pageType || 'content',
        });
      }

      setSavedProjectId(projectId);
      Toast.success(t('项目保存成功'));
    } catch (err) {
      Toast.error(err.message || t('保存失败'));
    }
  }, [outline, topic, textModel, imageModel, generatedImages, saveProject, saveImage, t]);

  // Download single image
  const downloadImage = useCallback((base64, mimeType, filename) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Download all images
  const handleDownloadAll = useCallback(() => {
    if (!outline?.pages) return;
    for (const page of outline.pages) {
      const imgData = generatedImages[page.pageIndex];
      if (imgData) {
        const ext = imgData.mimeType?.includes('png') ? 'png' : 'jpg';
        downloadImage(
          imgData.base64,
          imgData.mimeType,
          `redbook_${page.pageType}_${page.pageIndex}.${ext}`,
        );
      }
    }
  }, [outline, generatedImages, downloadImage]);

  // Gallery: view project detail
  const handleViewProject = useCallback(
    async (project) => {
      setSelectedProject(project);
      const images = await fetchProjectImages(project.id);
      setProjectImages(images);
    },
    [fetchProjectImages],
  );

  const handleDeleteProject = useCallback(
    async (id) => {
      const ok = await deleteProject(id);
      if (ok) {
        Toast.success(t('删除成功'));
        if (selectedProject?.id === id) {
          setSelectedProject(null);
          setProjectImages([]);
        }
      }
    },
    [deleteProject, selectedProject, t],
  );

  // Reset
  const handleReset = useCallback(() => {
    setOutline(null);
    setOutlineText('');
    setGeneratedImages({});
    setSavedProjectId(null);
    setTopic('');
    resetGenerate();
  }, [resetGenerate]);

  const hasAllImages = useMemo(() => {
    if (!outline?.pages) return false;
    return outline.pages.every((p) => generatedImages[p.pageIndex]);
  }, [outline, generatedImages]);

  // ---- Render ----

  const renderConfigPanel = () => (
    <Card
      style={{ marginBottom: 16 }}
      title={t('配置')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Text strong size='small'>{t('文本模型')}</Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            value={textModel}
            onChange={setTextModel}
            optionList={textModels}
            placeholder={t('选择文本模型')}
            filter
          />
        </div>
        <div>
          <Text strong size='small'>{t('文本密钥')}</Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            value={textTokenKey}
            onChange={setTextTokenKey}
            optionList={tokenOptions}
            placeholder={t('选择密钥')}
            loading={tokensLoading}
            filter
          />
        </div>
        <Divider margin={4} />
        <div>
          <Text strong size='small'>{t('图片模型')}</Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            value={imageModel}
            onChange={setImageModel}
            optionList={imageModels}
            placeholder={t('选择图片模型')}
            filter
          />
        </div>
        <div>
          <Text strong size='small'>{t('图片密钥')}</Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            value={imageTokenKey}
            onChange={setImageTokenKey}
            optionList={tokenOptions}
            placeholder={t('选择密钥')}
            loading={tokensLoading}
            filter
          />
        </div>
        <Divider margin={4} />
        <div>
          <Text strong size='small'>{t('页数')}</Text>
          <InputNumber
            style={{ width: '100%', marginTop: 4 }}
            value={pageCount}
            onChange={setPageCount}
            min={2}
            max={20}
          />
        </div>
      </div>
    </Card>
  );

  const renderGenerateTab = () => (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* Left Panel */}
      <div style={{ width: 320, flexShrink: 0 }}>
        {renderConfigPanel()}
        <Card title={t('主题')}>
          <TextArea
            value={topic}
            onChange={setTopic}
            placeholder={t('输入小红书内容主题，例如：秋季穿搭指南')}
            rows={3}
            maxCount={500}
          />
          <Button
            theme='solid'
            type='primary'
            style={{ width: '100%', marginTop: 12 }}
            onClick={handleGenerateOutline}
            loading={generateLoading && !batchGenerating}
            disabled={!topic.trim() || !textModel || !textTokenKey}
            icon={<IconPlay />}
          >
            {t('生成大纲')}
          </Button>
          {outline && (
            <>
              <Button
                style={{ width: '100%', marginTop: 8 }}
                onClick={handleBatchGenerate}
                loading={batchGenerating}
                disabled={!imageModel || !imageTokenKey}
                icon={<IconImage />}
              >
                {t('一键生成图片')}
              </Button>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button
                  style={{ flex: 1 }}
                  onClick={handleSaveProject}
                  disabled={!hasAllImages || !!savedProjectId}
                  icon={<IconSave />}
                >
                  {savedProjectId ? t('已保存') : t('保存项目')}
                </Button>
                <Button
                  style={{ flex: 1 }}
                  onClick={handleDownloadAll}
                  disabled={Object.keys(generatedImages).length === 0}
                  icon={<IconDownload />}
                >
                  {t('一键下载')}
                </Button>
              </div>
              <Button
                type='tertiary'
                style={{ width: '100%', marginTop: 8 }}
                onClick={handleReset}
                icon={<IconRefresh />}
              >
                {t('重新开始')}
              </Button>
            </>
          )}
        </Card>
      </div>

      {/* Right Panel: Outline + Images */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {generateError && (
          <Card style={{ marginBottom: 16 }}>
            <Text type='danger'>{generateError}</Text>
          </Card>
        )}

        {!outline && !generateLoading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              minHeight: 300,
            }}
          >
            <Empty
              title={t('输入主题开始创作')}
              description={t('输入一个小红书内容主题，AI将自动生成图文大纲和配图')}
            />
          </div>
        )}

        {generateLoading && !outline && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: 300,
            }}
          >
            <Spin size='large' tip={t('正在生成大纲...')} />
          </div>
        )}

        {outline && (
          <div>
            {/* Outline Header */}
            <Card
              style={{ marginBottom: 16 }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong>{outline.title || t('大纲')}</Text>
                  <Tag color='blue' size='small'>
                    {outline.pages?.length || 0} {t('页')}
                  </Tag>
                </div>
              }
              headerExtraContent={
                <Button
                  size='small'
                  icon={<IconEdit />}
                  onClick={() => setEditingOutline(!editingOutline)}
                >
                  {editingOutline ? t('取消') : t('编辑大纲')}
                </Button>
              }
            >
              {editingOutline ? (
                <div>
                  <TextArea
                    value={outlineText}
                    onChange={setOutlineText}
                    rows={12}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                  <Button
                    theme='solid'
                    size='small'
                    style={{ marginTop: 8 }}
                    onClick={handleSaveOutlineEdit}
                  >
                    {t('保存修改')}
                  </Button>
                </div>
              ) : null}
            </Card>

            {/* Page Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280, 1fr))',
                gap: 16,
              }}
            >
              {outline.pages?.map((page) => (
                <Card
                  key={page.pageIndex}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag
                        color={page.pageType === 'cover' ? 'red' : 'blue'}
                        size='small'
                      >
                        {page.pageType === 'cover' ? t('封面') : t('内容页')}
                      </Tag>
                      <Text strong ellipsis style={{ maxWidth: 160 }}>
                        {page.title}
                      </Text>
                    </div>
                  }
                  style={{ overflow: 'hidden' }}
                >
                  <Paragraph
                    ellipsis={{ rows: 3, expandable: true }}
                    style={{ marginBottom: 8, fontSize: 13 }}
                  >
                    {page.content}
                  </Paragraph>

                  <Tooltip content={page.imagePrompt}>
                    <Text
                      type='tertiary'
                      size='small'
                      ellipsis
                      style={{ display: 'block', marginBottom: 8 }}
                    >
                      Prompt: {page.imagePrompt}
                    </Text>
                  </Tooltip>

                  {/* Image display or generate button */}
                  {generatedImages[page.pageIndex] ? (
                    <div style={{ position: 'relative' }}>
                      <Image
                        src={`data:${generatedImages[page.pageIndex].mimeType};base64,${generatedImages[page.pageIndex].base64}`}
                        alt={page.title}
                        style={{
                          width: '100%',
                          borderRadius: 8,
                          maxHeight: 300,
                          objectFit: 'cover',
                        }}
                        preview
                      />
                      <div
                        style={{
                          display: 'flex',
                          gap: 4,
                          marginTop: 8,
                        }}
                      >
                        <Button
                          size='small'
                          icon={<IconRefresh />}
                          onClick={() => handleGeneratePageImage(page)}
                          loading={generatingPage === page.pageIndex}
                        >
                          {t('重新生成')}
                        </Button>
                        <Button
                          size='small'
                          icon={<IconDownload />}
                          onClick={() => {
                            const img = generatedImages[page.pageIndex];
                            const ext = img.mimeType?.includes('png')
                              ? 'png'
                              : 'jpg';
                            downloadImage(
                              img.base64,
                              img.mimeType,
                              `redbook_${page.pageType}_${page.pageIndex}.${ext}`,
                            );
                          }}
                        >
                          {t('下载')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      icon={<IconImage />}
                      onClick={() => handleGeneratePageImage(page)}
                      loading={generatingPage === page.pageIndex}
                      disabled={!imageModel || !imageTokenKey}
                      style={{ width: '100%' }}
                    >
                      {t('生成图片')}
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderGalleryTab = () => (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* Project List */}
      <div style={{ width: 320, flexShrink: 0, overflow: 'auto' }}>
        <Card
          title={t('历史项目')}
          headerExtraContent={
            <Button
              size='small'
              icon={<IconRefresh />}
              onClick={fetchProjects}
              loading={galleryLoading}
            />
          }
        >
          {galleryLoading && projects.length === 0 ? (
            <Spin />
          ) : projects.length === 0 ? (
            <Empty description={t('暂无项目')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.map((project) => (
                <Card
                  key={project.id}
                  shadows='hover'
                  style={{
                    cursor: 'pointer',
                    border:
                      selectedProject?.id === project.id
                        ? '2px solid var(--semi-color-primary)'
                        : undefined,
                  }}
                  bodyStyle={{ padding: 12 }}
                  onClick={() => handleViewProject(project)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <Text strong ellipsis style={{ maxWidth: 200, display: 'block' }}>
                        {project.topic}
                      </Text>
                      <Text type='tertiary' size='small'>
                        {project.page_count} {t('页')} ·{' '}
                        {new Date(project.created_at).toLocaleDateString()}
                      </Text>
                    </div>
                    <Popconfirm
                      title={t('确认删除该项目？')}
                      onConfirm={(e) => {
                        e?.stopPropagation?.();
                        handleDeleteProject(project.id);
                      }}
                    >
                      <Button
                        size='small'
                        type='danger'
                        theme='borderless'
                        icon={<IconDelete />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Project Detail */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!selectedProject ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              minHeight: 300,
            }}
          >
            <Empty description={t('选择一个项目查看详情')} />
          </div>
        ) : (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <Title heading={5}>{selectedProject.topic}</Title>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Tag color='blue'>{selectedProject.text_model}</Tag>
                <Tag color='green'>{selectedProject.image_model}</Tag>
                <Tag>{selectedProject.page_count} {t('页')}</Tag>
              </div>
            </Card>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 16,
              }}
            >
              {projectImages.map((img) => (
                <Card key={img.id} bodyStyle={{ padding: 8 }}>
                  <Tag
                    color={img.page_type === 'cover' ? 'red' : 'blue'}
                    size='small'
                    style={{ marginBottom: 8 }}
                  >
                    {img.page_type === 'cover' ? t('封面') : `${t('内容页')} ${img.page_index}`}
                  </Tag>
                  {blobUrls[img.id] ? (
                    <Image
                      src={blobUrls[img.id]}
                      alt={img.prompt}
                      style={{
                        width: '100%',
                        borderRadius: 8,
                        maxHeight: 240,
                        objectFit: 'cover',
                      }}
                      preview
                    />
                  ) : (
                    <div
                      style={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--semi-color-fill-0)',
                        borderRadius: 8,
                      }}
                    >
                      <Spin />
                    </div>
                  )}
                  <Tooltip content={img.prompt}>
                    <Text
                      type='tertiary'
                      size='small'
                      ellipsis
                      style={{ display: 'block', marginTop: 4 }}
                    >
                      {img.prompt}
                    </Text>
                  </Tooltip>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout style={{ padding: '24px', minHeight: 'calc(100vh - 60px)' }}>
      <Content>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Title heading={3}>{t('小红书图文生成')}</Title>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              theme={activeTab === 'generate' ? 'solid' : 'light'}
              onClick={() => setActiveTab('generate')}
            >
              {t('创作')}
            </Button>
            <Button
              theme={activeTab === 'gallery' ? 'solid' : 'light'}
              onClick={() => setActiveTab('gallery')}
            >
              {t('历史')}
            </Button>
          </div>
        </div>

        {activeTab === 'generate'
          ? renderGenerateTab()
          : renderGalleryTab()}
      </Content>
    </Layout>
  );
}
