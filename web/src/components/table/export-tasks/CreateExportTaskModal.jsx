import React, { useState } from 'react';
import {
  Modal,
  Form,
  Button,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { isAdmin } from '../../../helpers';
import { DATE_RANGE_PRESETS } from '../../../constants/console.constants';

const { Text } = Typography;

const LOG_TYPE_OPTIONS = [
  { value: 0, label: '全部' },
  { value: 2, label: '消费' },
  { value: 1, label: '充值' },
  { value: 3, label: '管理' },
  { value: 4, label: '系统' },
  { value: 5, label: '错误' },
  { value: 6, label: '退款' },
];

const USER_LOG_TYPE_OPTIONS = [
  { value: 0, label: '全部' },
  { value: 2, label: '消费' },
  { value: 1, label: '充值' },
];

const CreateExportTaskModal = ({
  createModalVisible,
  setCreateModalVisible,
  createTask,
}) => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const admin = isAdmin();

  const typeOptions = admin ? LOG_TYPE_OPTIONS : USER_LOG_TYPE_OPTIONS;

  const handleSubmit = async (values) => {
    const { dateRange, type, target_username, model_name, token_name, group } =
      values;

    if (!dateRange || dateRange.length !== 2) {
      return;
    }

    const startTimestamp = Math.floor(new Date(dateRange[0]).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(dateRange[1]).getTime() / 1000);

    setSubmitting(true);
    const payload = {
      type: type ?? 2,
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
      target_username: admin ? target_username || '' : '',
      model_name: model_name || '',
      token_name: token_name || '',
      group: group || '',
    };

    await createTask(payload);
    setSubmitting(false);
  };

  return (
    <Modal
      title={t('创建导出任务')}
      visible={createModalVisible}
      onCancel={() => setCreateModalVisible(false)}
      footer={null}
      closeOnEsc
      width={520}
    >
      <Form onSubmit={handleSubmit} labelPosition='top'>
        <Form.Select
          field='type'
          label={t('导出类型')}
          initValue={2}
          style={{ width: '100%' }}
        >
          {typeOptions.map((opt) => (
            <Form.Select.Option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </Form.Select.Option>
          ))}
        </Form.Select>

        <Form.DatePicker
          field='dateRange'
          label={t('时间范围')}
          type='dateTimeRange'
          rules={[{ required: true, message: t('请选择时间范围') }]}
          style={{ width: '100%' }}
          presets={DATE_RANGE_PRESETS.map((preset) => ({
            text: t(preset.text),
            start: preset.start(),
            end: preset.end(),
          }))}
        />

        {admin && (
          <Form.Input
            field='target_username'
            label={t('用户名（留空导出全部）')}
            placeholder={t('输入用户名过滤，留空代表导出所有用户')}
          />
        )}

        <Form.Input
          field='model_name'
          label={t('模型名称（可选）')}
          placeholder={t('输入模型名称过滤')}
        />

        <Form.Input
          field='token_name'
          label={t('令牌名称（可选）')}
          placeholder={t('输入令牌名称过滤')}
        />

        <Form.Input
          field='group'
          label={t('分组（可选）')}
          placeholder={t('输入分组过滤')}
        />

        <Text type='tertiary' size='small'>
          {t('导出文件为CSV格式，支持Excel打开。最大导出100万条记录，文件保留7天。')}
        </Text>

        <div className='flex justify-end gap-2 mt-4'>
          <Button onClick={() => setCreateModalVisible(false)}>
            {t('取消')}
          </Button>
          <Button
            htmlType='submit'
            theme='solid'
            type='primary'
            loading={submitting}
          >
            {t('创建')}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default CreateExportTaskModal;
