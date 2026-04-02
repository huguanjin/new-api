import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Badge,
  Tabs,
  TabPane,
  Card,
  Empty,
  Typography,
  Tooltip,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../helpers';
import { renderQuota } from '../../helpers/render';

const { Text } = Typography;

const InvitedSubscriptions = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = useCallback(
    async (page, size, status) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          p: String(page ?? activePage),
          page_size: String(size ?? pageSize),
          status: status ?? statusFilter,
        });
        const res = await API.get(
          `/api/user/invited-subscriptions?${params.toString()}`
        );
        const { success, message, data: d } = res.data;
        if (success) {
          setData(d?.items || []);
          setTotal(d?.total || 0);
        } else {
          showError(message);
        }
      } catch {
        showError(t('请求失败'));
      } finally {
        setLoading(false);
      }
    },
    [activePage, pageSize, statusFilter, t],
  );

  useEffect(() => {
    loadData(1, pageSize, 'all');
  }, []);

  const handleTabChange = (key) => {
    setStatusFilter(key);
    setActivePage(1);
    loadData(1, pageSize, key);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    loadData(page, pageSize, statusFilter);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    loadData(1, size, statusFilter);
  };

  const formatTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
  };

  const renderStatus = (record) => {
    const now = Date.now() / 1000;
    const isExpired =
      record.status === 'active' && (record.end_time || 0) < now;
    const isCancelled = record.status === 'cancelled';
    const isActive = record.status === 'active' && !isExpired;

    if (isActive) {
      return (
        <Tag
          color='white'
          shape='circle'
          type='light'
          prefixIcon={<Badge dot type='success' />}
        >
          {t('生效中')}
        </Tag>
      );
    }
    if (isCancelled) {
      return (
        <Tag
          color='white'
          shape='circle'
          type='light'
          prefixIcon={<Badge dot type='warning' />}
        >
          {t('已作废')}
        </Tag>
      );
    }
    return (
      <Tag
        color='white'
        shape='circle'
        type='light'
        prefixIcon={<Badge dot type='danger' />}
      >
        {t('已过期')}
      </Tag>
    );
  };

  const columns = [
    {
      title: t('用户'),
      dataIndex: 'user_id',
      width: 140,
      render: (userId, record) => (
        <div>
          <Text strong>
            {record.display_name || record.username || '-'}
          </Text>
          {record.username && (
            <div>
              <Text type='tertiary' size='small'>
                {record.username}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('套餐'),
      dataIndex: 'plan_id',
      width: 140,
      render: (planId, record) => (
        <Text>{record.plan_title || `#${planId}`}</Text>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (_, record) => renderStatus(record),
    },
    {
      title: t('开始时间'),
      dataIndex: 'start_time',
      width: 160,
      render: (ts) => (
        <Text type='tertiary' size='small'>
          {formatTime(ts)}
        </Text>
      ),
    },
    {
      title: t('到期时间'),
      dataIndex: 'end_time',
      width: 160,
      render: (ts) => (
        <Text type='tertiary' size='small'>
          {formatTime(ts)}
        </Text>
      ),
    },
    {
      title: t('订阅金额'),
      dataIndex: 'order_money',
      width: 110,
      render: (val) => (
        <Text>
          {val > 0 ? `¥${Number(val).toFixed(2)}` : '-'}
        </Text>
      ),
    },
    {
      title: t('返利金额'),
      dataIndex: 'commission',
      width: 110,
      render: (val) => (
        <Text style={{ color: val > 0 ? 'var(--semi-color-success)' : undefined }}>
          {val > 0 ? `¥${Number(val).toFixed(2)}` : '-'}
        </Text>
      ),
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <Card className='!rounded-2xl shadow-sm'>
        <Tabs
          type='card'
          activeKey={statusFilter}
          onChange={handleTabChange}
          className='mb-4'
        >
          <TabPane itemKey='all' tab={t('全部')} />
          <TabPane itemKey='active' tab={t('生效中')} />
          <TabPane itemKey='expired' tab={t('已过期')} />
        </Tabs>

        <Table
          columns={columns}
          dataSource={data}
          rowKey='id'
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            currentPage: activePage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            pageSizeOpts: [10, 20, 50, 100],
            onPageSizeChange: handlePageSizeChange,
            onPageChange: handlePageChange,
          }}
          empty={
            <Empty
              image={
                <IllustrationNoResult
                  style={{ width: 150, height: 150 }}
                />
              }
              darkModeImage={
                <IllustrationNoResultDark
                  style={{ width: 150, height: 150 }}
                />
              }
              description={t('暂无邀请用户订阅记录')}
              style={{ padding: 30 }}
            />
          }
          className='rounded-xl overflow-hidden'
          size='middle'
        />
      </Card>
    </div>
  );
};

export default InvitedSubscriptions;
