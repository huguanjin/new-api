import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Form,
  Button,
  Space,
  Spin,
  Typography,
  Banner,
  Tag,
  Collapsible,
} from '@douyinfe/semi-ui';
import { IconLink, IconAlertTriangle, IconChevronDown, IconChevronRight } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text } = Typography;

const BatchConfigureModelsModal = ({
  visible,
  onClose,
  selectedModels,
  onSuccess,
  t,
}) => {
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [tagGroups, setTagGroups] = useState([]);
  const [videoProviderOptions, setVideoProviderOptions] = useState([]);
  const [showModelList, setShowModelList] = useState(false);
  const formApiRef = useRef(null);
  const isMobile = useIsMobile();

  const fetchVendors = async () => {
    try {
      const res = await API.get('/api/vendors/?page_size=1000');
      if (res.data.success) {
        const items = res.data.data.items || res.data.data || [];
        setVendors(Array.isArray(items) ? items : []);
      }
    } catch (_) {}
  };

  const fetchTagGroups = async () => {
    try {
      const res = await API.get('/api/prefill_group?type=tag');
      if (res?.data?.success) {
        setTagGroups(res.data.data || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (visible) {
      fetchVendors();
      fetchTagGroups();
      setShowModelList(false);
      // 加载视频供应商选项
      try {
        const stored = localStorage.getItem('video_models');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setVideoProviderOptions(
              parsed.map((p) => ({ label: p.label, value: p.key })),
            );
          }
        }
      } catch (_) {}
      formApiRef.current?.setValues({
        icon: '',
        description: '',
        tags: [],
        vendor_id: undefined,
        video_provider: undefined,
        image_provider: undefined,
        red_book_provider: undefined,
      });
    }
  }, [visible]);

  const handleSubmit = async () => {
    const values = formApiRef.current?.getValues() || {};

    // 构建请求体，只发送非空字段
    const data = {
      model_names: selectedModels || [],
    };
    if (values.icon) data.icon = values.icon;
    if (values.description) data.description = values.description;
    if (values.tags && values.tags.length > 0) {
      data.tags = Array.isArray(values.tags) ? values.tags.join(',') : values.tags;
    }
    if (values.vendor_id !== undefined && values.vendor_id !== null) {
      data.vendor_id = values.vendor_id;
    }
    if (values.video_provider !== undefined && values.video_provider !== null) {
      data.video_provider = values.video_provider;
    }
    if (values.image_provider !== undefined && values.image_provider !== null) {
      data.image_provider = values.image_provider;
    }
    if (values.red_book_provider !== undefined && values.red_book_provider !== null) {
      data.red_book_provider = values.red_book_provider;
    }

    // 检查是否至少填写了一个字段
    if (!data.icon && !data.description && !data.tags && data.vendor_id === undefined && data.video_provider === undefined && data.image_provider === undefined && data.red_book_provider === undefined) {
      showError(t('至少需要填写一个配置字段'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/models/batch_configure', data);
      const { success, message, data: result } = res.data;
      if (success) {
        const msg = t('批量配置完成：创建 {{created}} 个，更新 {{updated}} 个', {
          created: result.created_count,
          updated: result.updated_count,
        });
        showSuccess(msg);
        onSuccess?.();
        onClose();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.response?.data?.message || t('操作失败'));
    }
    setLoading(false);
  };

  return (
    <Modal
      title={
        <div className='flex items-center gap-2'>
          <Text strong className='!text-base'>
            {t('批量配置模型')}
          </Text>
          <Tag color='blue' size='small'>
            {selectedModels?.length || 0} {t('个模型')}
          </Tag>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      size={isMobile ? 'full-width' : 'medium'}
      className='!rounded-lg'
      footer={
        <Space>
          <Button
            theme='solid'
            type='primary'
            onClick={handleSubmit}
            loading={loading}
          >
            {t('确认配置')}
          </Button>
          <Button type='tertiary' onClick={onClose}>
            {t('取消')}
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {/* 选中模型列表（可折叠） */}
        <div className='mb-4'>
          <div
            className='flex items-center gap-1 cursor-pointer select-none mb-2'
            onClick={() => setShowModelList(!showModelList)}
          >
            {showModelList ? <IconChevronDown size='small' /> : <IconChevronRight size='small' />}
            <Text type='secondary' size='small'>
              {t('已选择 {{count}} 个模型', { count: selectedModels?.length || 0 })}
              {!showModelList && ' — ' + t('点击展开查看')}
            </Text>
          </div>
          <Collapsible isOpen={showModelList}>
            <div className='flex flex-wrap gap-1 p-2 rounded bg-[var(--semi-color-fill-0)] max-h-[120px] overflow-y-auto'>
              {selectedModels?.map((name) => (
                <Tag key={name} size='small' color='light-blue'>
                  {name}
                </Tag>
              ))}
            </div>
          </Collapsible>
        </div>

        <Banner
          type='info'
          closeIcon={null}
          description={t('只有填写了的字段才会被应用到所选模型，留空的字段将不会修改')}
          style={{ marginBottom: 16 }}
        />

        <Form
          getFormApi={(api) => (formApiRef.current = api)}
          initValues={{
            icon: '',
            description: '',
            tags: [],
            vendor_id: undefined,
            video_provider: undefined,
            image_provider: undefined,
            red_book_provider: undefined,
          }}
        >
          <Form.Input
            field='icon'
            label={t('模型图标')}
            placeholder={t('请输入图标名称')}
            extraText={
              <span>
                {t(
                  "图标使用@lobehub/icons库，如：OpenAI、Claude.Color，支持链式参数：OpenAI.Avatar.type={'platform'}、OpenRouter.Avatar.shape={'square'}，查询所有可用图标请 ",
                )}
                <Typography.Text
                  link={{
                    href: 'https://icons.lobehub.com/components/lobe-hub',
                    target: '_blank',
                  }}
                  icon={<IconLink />}
                  underline
                >
                  {t('请点击我')}
                </Typography.Text>
              </span>
            }
            showClear
          />

          <Form.TextArea
            field='description'
            label={t('描述')}
            placeholder={t('请输入模型描述')}
            rows={3}
            showClear
          />

          <Form.TagInput
            field='tags'
            label={t('标签')}
            placeholder={t('输入标签或使用","分隔多个标签')}
            addOnBlur
            showClear
            onChange={(newTags) => {
              if (!formApiRef.current) return;
              const normalize = (tags) => {
                if (!Array.isArray(tags)) return [];
                return [
                  ...new Set(
                    tags.flatMap((tag) =>
                      tag
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    ),
                  ),
                ];
              };
              const normalized = normalize(newTags);
              formApiRef.current.setValue('tags', normalized);
            }}
            style={{ width: '100%' }}
            {...(tagGroups.length > 0 && {
              extraText: (
                <Space wrap>
                  {tagGroups.map((group) => (
                    <Button
                      key={group.id}
                      size='small'
                      type='primary'
                      onClick={() => {
                        if (formApiRef.current) {
                          const currentTags =
                            formApiRef.current.getValue('tags') || [];
                          const newTags = [
                            ...currentTags,
                            ...(group.items || []),
                          ];
                          const uniqueTags = [...new Set(newTags)];
                          formApiRef.current.setValue('tags', uniqueTags);
                        }
                      }}
                    >
                      {group.name}
                    </Button>
                  ))}
                </Space>
              ),
            })}
          />

          <Form.Select
            field='vendor_id'
            label={t('供应商')}
            placeholder={t('选择模型供应商')}
            optionList={vendors.map((v) => ({
              label: v.name,
              value: v.id,
            }))}
            filter
            showClear
            style={{ width: '100%' }}
          />

          {videoProviderOptions.length > 0 && (
            <Form.Select
              field='video_provider'
              label={t('视频供应商')}
              placeholder={t('选择视频供应商（可选）')}
              optionList={videoProviderOptions}
              filter
              showClear
              extraText={t('指定后，该模型将出现在视频页面对应供应商的模型下拉列表中')}
              style={{ width: '100%' }}
            />
          )}

          <Form.Select
            field='image_provider'
            label={t('绘画接口')}
            placeholder={t('不修改')}
            optionList={[
              { label: t('不启用'), value: '' },
              { label: 'Gemini (Imagen)', value: 'gemini' },
              { label: 'GPT Image', value: 'openai_image' },
            ]}
            showClear
            extraText={t('设置后，所选模型将出现在绘画页面的模型下拉列表中')}
            style={{ width: '100%' }}
          />

          <Form.Select
            field='red_book_provider'
            label={t('小红书模型角色')}
            placeholder={t('选择小红书模型角色（可选）')}
            optionList={[
              { label: t('无'), value: '' },
              { label: t('文本生成模型'), value: 'text' },
              { label: t('图片生成模型'), value: 'image' },
            ]}
            showClear
            extraText={t('指定后，所选模型将出现在小红书页面对应的模型选择列表中')}
            style={{ width: '100%' }}
          />
        </Form>
      </Spin>
    </Modal>
  );
};

export default BatchConfigureModelsModal;
