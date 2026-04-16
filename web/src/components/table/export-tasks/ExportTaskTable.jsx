import React from 'react';
import { Table, Tag, Button, Popconfirm, Typography, Space } from '@douyinfe/semi-ui';
import { IconDownload, IconDelete } from '@douyinfe/semi-icons';

const { Text } = Typography;

const LOG_TYPE_MAP = {
  0: { text: '全部', color: 'grey' },
  1: { text: '充值', color: 'blue' },
  2: { text: '消费', color: 'green' },
  3: { text: '管理', color: 'purple' },
  4: { text: '系统', color: 'cyan' },
  5: { text: '错误', color: 'red' },
  6: { text: '退款', color: 'orange' },
};

const STATUS_MAP = {
  0: { text: '排队中', color: 'blue' },
  1: { text: '处理中', color: 'orange' },
  2: { text: '已完成', color: 'green' },
  3: { text: '失败', color: 'red' },
};

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTimestamp(ts) {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  return d.toLocaleString('zh-CN');
}

const ExportTaskTable = ({ t, tasks, loading, downloadTask, deleteTask }) => {
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: t('导出类型'),
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (type) => {
        const info = LOG_TYPE_MAP[type] || LOG_TYPE_MAP[0];
        return <Tag color={info.color}>{t(info.text)}</Tag>;
      },
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => {
        const info = STATUS_MAP[status] || STATUS_MAP[0];
        return (
          <div>
            <Tag color={info.color}>{t(info.text)}</Tag>
            {status === 1 && record.progress > 0 && (
              <Text size='small' type='tertiary' className='ml-1'>
                {record.progress}%
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: t('创建用户'),
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: t('记录数'),
      dataIndex: 'record_count',
      key: 'record_count',
      width: 90,
      render: (val) => (val > 0 ? val.toLocaleString() : '-'),
    },
    {
      title: t('文件大小'),
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (val) => formatFileSize(val),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val) => formatTimestamp(val),
    },
    {
      title: t('完成时间'),
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 160,
      render: (val) => formatTimestamp(val),
    },
    {
      title: t('错误信息'),
      dataIndex: 'error_message',
      key: 'error_message',
      width: 200,
      render: (val) =>
        val ? (
          <Text type='danger' ellipsis={{ showTooltip: true }} style={{ maxWidth: 180 }}>
            {val}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 2 && (
            <Button
              icon={<IconDownload />}
              size='small'
              theme='light'
              type='primary'
              onClick={() => downloadTask(record.id)}
            >
              {t('下载')}
            </Button>
          )}
          <Popconfirm
            title={t('确定删除此导出任务？')}
            onConfirm={() => deleteTask(record.id)}
          >
            <Button icon={<IconDelete />} size='small' theme='light' type='danger'>
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={tasks}
      loading={loading}
      rowKey='id'
      pagination={false}
      scroll={{ x: 'max-content' }}
      empty={t('暂无导出任务')}
    />
  );
};

export default ExportTaskTable;
