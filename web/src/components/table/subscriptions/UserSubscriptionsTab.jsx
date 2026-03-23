/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Tag,
  Badge,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Tooltip,
  Pagination,
  Empty,
  Popconfirm,
} from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh } from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';
import { renderQuota } from '../../../helpers/render';

const { Text } = Typography;

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '生效中' },
  { value: 'expired', label: '已过期' },
  { value: 'cancelled', label: '已作废' },
];

const UserSubscriptionsTab = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadData = useCallback(
    async (p, ps, st, kw) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          p: String(p || page),
          page_size: String(ps || pageSize),
          status: st ?? status,
          keyword: kw ?? keyword,
        });
        const res = await API.get(
          `/api/subscription/admin/subscriptions?${params.toString()}`
        );
        if (res.data?.success) {
          const d = res.data.data;
          setData(d?.items || []);
          setTotal(d?.total || 0);
        } else {
          showError(res.data?.message || t('加载失败'));
        }
      } catch {
        showError(t('请求失败'));
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, status, keyword, t]
  );

  useEffect(() => {
    loadData(page, pageSize, status, keyword);
  }, [page, pageSize, status]);

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
    loadData(1, pageSize, status, searchInput);
  };

  const handleStatusChange = (val) => {
    setStatus(val);
    setPage(1);
  };

  const handlePageChange = (p) => {
    setPage(p);
  };

  const handlePageSizeChange = (ps) => {
    setPageSize(ps);
    setPage(1);
  };

  const handleInvalidate = async (subId) => {
    try {
      const res = await API.post(
        `/api/subscription/admin/user_subscriptions/${subId}/invalidate`
      );
      if (res.data?.success) {
        showSuccess(t('操作成功'));
        loadData(page, pageSize, status, keyword);
      } else {
        showError(res.data?.message || t('操作失败'));
      }
    } catch {
      showError(t('请求失败'));
    }
  };

  const handleDelete = async (subId) => {
    try {
      const res = await API.delete(
        `/api/subscription/admin/user_subscriptions/${subId}`
      );
      if (res.data?.success) {
        showSuccess(t('删除成功'));
        loadData(page, pageSize, status, keyword);
      } else {
        showError(res.data?.message || t('操作失败'));
      }
    } catch {
      showError(t('请求失败'));
    }
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

  const formatTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
  };

  const columns = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 70,
      },
      {
        title: t('用户'),
        dataIndex: 'user_id',
        width: 150,
        render: (userId, record) => (
          <div>
            <Text strong>
              {record.display_name || record.username || '-'}
            </Text>
            <div>
              <Text type='tertiary' size='small'>
                ID: {userId}
                {record.username ? ` · ${record.username}` : ''}
              </Text>
            </div>
          </div>
        ),
      },
      {
        title: t('套餐'),
        dataIndex: 'plan_id',
        width: 150,
        render: (planId, record) => (
          <div>
            <Text>{record.plan_title || `#${planId}`}</Text>
          </div>
        ),
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 100,
        render: (_, record) => renderStatus(record),
      },
      {
        title: t('额度使用'),
        dataIndex: 'amount_used',
        width: 180,
        render: (_, record) => {
          const total = Number(record.amount_total || 0);
          const used = Number(record.amount_used || 0);
          if (total <= 0) return <Text type='tertiary'>{t('不限')}</Text>;
          const percent = Math.round((used / total) * 100);
          return (
            <Tooltip
              content={`${t('原生额度')}：${used}/${total}`}
            >
              <Text>
                {renderQuota(used)} / {renderQuota(total)} ({percent}%)
              </Text>
            </Tooltip>
          );
        },
      },
      {
        title: t('来源'),
        dataIndex: 'source',
        width: 80,
        render: (source) => (
          <Tag size='small' shape='circle'>
            {source === 'admin' ? t('管理员') : t('购买')}
          </Tag>
        ),
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
        title: t('操作'),
        dataIndex: 'operate',
        width: 150,
        fixed: 'right',
        render: (_, record) => {
          const now = Date.now() / 1000;
          const isActive =
            record.status === 'active' && (record.end_time || 0) > now;
          return (
            <Space>
              {isActive && (
                <Popconfirm
                  title={t('确认作废该订阅？')}
                  content={t('作废后用户将立即失去该订阅权益')}
                  onConfirm={() => handleInvalidate(record.id)}
                >
                  <Button size='small' type='warning' theme='light'>
                    {t('作废')}
                  </Button>
                </Popconfirm>
              )}
              <Popconfirm
                title={t('确认删除该订阅记录？')}
                content={t('删除后不可恢复')}
                onConfirm={() => handleDelete(record.id)}
              >
                <Button size='small' type='danger' theme='light'>
                  {t('删除')}
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [t, page, pageSize, status, keyword]
  );

  const translatedStatusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((opt) => ({
        ...opt,
        label: t(opt.label),
      })),
    [t]
  );

  return (
    <div className='space-y-3'>
      {/* Filters */}
      <div className='flex flex-col md:flex-row gap-2 items-start md:items-center'>
        <Select
          value={status}
          onChange={handleStatusChange}
          optionList={translatedStatusOptions}
          style={{ width: 140 }}
          size='small'
        />
        <Input
          prefix={<IconSearch />}
          placeholder={t('搜索用户ID或用户名')}
          value={searchInput}
          onChange={setSearchInput}
          onEnterPress={handleSearch}
          size='small'
          style={{ width: 240 }}
          showClear
        />
        <Button
          icon={<IconSearch />}
          size='small'
          onClick={handleSearch}
        >
          {t('搜索')}
        </Button>
        <Button
          icon={<IconRefresh />}
          size='small'
          theme='light'
          onClick={() => loadData(page, pageSize, status, keyword)}
        >
          {t('刷新')}
        </Button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        rowKey='id'
        scroll={{ x: 'max-content' }}
        size='middle'
        empty={
          <Empty
            image={
              <IllustrationNoResult style={{ width: 150, height: 150 }} />
            }
            darkModeImage={
              <IllustrationNoResultDark
                style={{ width: 150, height: 150 }}
              />
            }
            description={t('暂无用户订阅记录')}
            style={{ padding: 30 }}
          />
        }
      />

      {/* Pagination */}
      {total > 0 && (
        <div className='flex justify-end'>
          <Pagination
            total={total}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            showSizeChanger
            pageSizeOpts={[10, 20, 50, 100]}
            showTotal
            size='small'
          />
        </div>
      )}
    </div>
  );
};

export default UserSubscriptionsTab;
