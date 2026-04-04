import React, { useState, useCallback, useRef } from 'react';
import {
  Table,
  Form,
  Button,
  Tag,
  Space,
  Input,
  Tooltip,
  Typography,
  Popover,
  Progress,
  Empty,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import {
  IconSearch,
  IconRefresh,
  IconCopy,
  IconEyeOpened,
  IconEyeClosed,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  API,
  copy,
  showError,
  showSuccess,
  timestamp2string,
  renderQuota,
  renderGroup,
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';

const { Paragraph } = Typography;

const getProgressColor = (pct) => {
  if (pct === 100) return 'var(--semi-color-success)';
  if (pct <= 10) return 'var(--semi-color-danger)';
  if (pct <= 30) return 'var(--semi-color-warning)';
  return undefined;
};

const AdminTokens = () => {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [total, setTotal] = useState(0);
  const [showKeys, setShowKeys] = useState({});
  const formApiRef = useRef(null);
  const [searched, setSearched] = useState(false);

  const fetchTokens = useCallback(
    async (page = 1, size = pageSize) => {
      setLoading(true);
      try {
        const values = formApiRef.current
          ? formApiRef.current.getValues()
          : {};
        const params = new URLSearchParams();
        params.append('p', page);
        params.append('page_size', size);
        if (values.keyword) params.append('keyword', values.keyword);
        if (values.token) params.append('token', values.token);
        if (values.user_id) params.append('user_id', values.user_id);
        if (values.status !== undefined && values.status !== '')
          params.append('status', values.status);
        if (values.group) params.append('group', values.group);

        const res = await API.get(
          `/api/token/admin/search?${params.toString()}`,
        );
        const { success, message, data } = res.data;
        if (success) {
          setTokens(data.items || []);
          setTotal(data.total || 0);
          setActivePage(page);
          setSearched(true);
        } else {
          showError(message);
        }
      } catch (err) {
        showError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  const handleSearch = () => {
    fetchTokens(1, pageSize);
  };

  const handleReset = () => {
    if (formApiRef.current) {
      formApiRef.current.setValues({
        keyword: '',
        token: '',
        user_id: '',
        status: '',
        group: '',
      });
    }
    setTokens([]);
    setTotal(0);
    setSearched(false);
  };

  const handlePageChange = (page) => {
    fetchTokens(page, pageSize);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    fetchTokens(1, newPageSize);
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('复制成功'));
    } else {
      showError(t('复制失败'));
    }
  };

  const renderStatus = (status) => {
    const map = {
      1: { color: 'green', text: t('已启用') },
      2: { color: 'red', text: t('已禁用') },
      3: { color: 'yellow', text: t('已过期') },
      4: { color: 'grey', text: t('已耗尽') },
    };
    const info = map[status] || { color: 'black', text: t('未知状态') };
    return (
      <Tag color={info.color} shape='circle' size='small'>
        {info.text}
      </Tag>
    );
  };

  const renderTokenKey = (record) => {
    const fullKey = 'sk-' + record.key;
    const maskedKey =
      'sk-' + record.key.slice(0, 4) + '**********' + record.key.slice(-4);
    const revealed = !!showKeys[record.id];

    return (
      <div className='w-[200px]'>
        <Input
          readOnly
          value={revealed ? fullKey : maskedKey}
          size='small'
          suffix={
            <div className='flex items-center'>
              <Button
                theme='borderless'
                size='small'
                type='tertiary'
                icon={revealed ? <IconEyeClosed /> : <IconEyeOpened />}
                aria-label='toggle token visibility'
                onClick={(e) => {
                  e.stopPropagation();
                  setShowKeys((prev) => ({
                    ...prev,
                    [record.id]: !revealed,
                  }));
                }}
              />
              <Button
                theme='borderless'
                size='small'
                type='tertiary'
                icon={<IconCopy />}
                aria-label='copy token key'
                onClick={async (e) => {
                  e.stopPropagation();
                  await copyText(fullKey);
                }}
              />
            </div>
          }
        />
      </div>
    );
  };

  const renderQuotaUsage = (record) => {
    const used = parseInt(record.used_quota) || 0;
    const remain = parseInt(record.remain_quota) || 0;
    const total = used + remain;
    if (record.unlimited_quota) {
      const popoverContent = (
        <div className='text-xs p-2'>
          <Paragraph copyable={{ content: renderQuota(used) }}>
            {t('已用额度')}: {renderQuota(used)}
          </Paragraph>
        </div>
      );
      return (
        <Popover content={popoverContent} position='top'>
          <Tag color='white' shape='circle'>
            {t('无限额度')}
          </Tag>
        </Popover>
      );
    }
    const percent = total > 0 ? (remain / total) * 100 : 0;
    const popoverContent = (
      <div className='text-xs p-2'>
        <Paragraph copyable={{ content: renderQuota(used) }}>
          {t('已用额度')}: {renderQuota(used)}
        </Paragraph>
        <Paragraph copyable={{ content: renderQuota(remain) }}>
          {t('剩余额度')}: {renderQuota(remain)} ({percent.toFixed(0)}%)
        </Paragraph>
        <Paragraph copyable={{ content: renderQuota(total) }}>
          {t('总额度')}: {renderQuota(total)}
        </Paragraph>
      </div>
    );
    return (
      <Popover content={popoverContent} position='top'>
        <Tag color='white' shape='circle'>
          <div className='flex flex-col items-end'>
            <span className='text-xs leading-none'>{`${renderQuota(remain)} / ${renderQuota(total)}`}</span>
            <Progress
              percent={percent}
              stroke={getProgressColor(percent)}
              aria-label='quota usage'
              format={() => `${percent.toFixed(0)}%`}
              style={{ width: '100%', marginTop: '1px', marginBottom: 0 }}
            />
          </div>
        </Tag>
      </Popover>
    );
  };

  const renderGroupColumn = (text, record) => {
    if (text === 'auto') {
      return (
        <Tooltip
          content={t(
            '当前分组为 auto，会自动选择最优分组，当一个组不可用时自动降级到下一个组（熔断机制）',
          )}
          position='top'
        >
          <Tag color='white' shape='circle'>
            {t('智能熔断')}
            {record && record.cross_group_retry ? `(${t('跨分组')})` : ''}
          </Tag>
        </Tooltip>
      );
    }
    return renderGroup(text);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      width: 100,
    },
    {
      title: t('用户ID'),
      dataIndex: 'user_id',
      width: 80,
    },
    {
      title: t('名称'),
      dataIndex: 'name',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 80,
      render: (text) => renderStatus(text),
    },
    {
      title: t('剩余额度/总额度'),
      key: 'quota_usage',
      render: (text, record) => renderQuotaUsage(record),
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      width: 100,
      render: (text, record) => renderGroupColumn(text, record),
    },
    {
      title: t('密钥'),
      key: 'token_key',
      render: (text, record) => renderTokenKey(record),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      width: 160,
      render: (text) => <>{timestamp2string(text)}</>,
    },
    {
      title: t('最近访问'),
      dataIndex: 'accessed_time',
      width: 160,
      render: (text) => (
        <>{text ? timestamp2string(text) : t('从未使用')}</>
      ),
    },
    {
      title: t('过期时间'),
      dataIndex: 'expired_time',
      width: 160,
      render: (text) => (
        <>{text === -1 ? t('永不过期') : timestamp2string(text)}</>
      ),
    },
  ];

  const statusOptions = [
    { value: '', label: t('全部状态') },
    { value: 1, label: t('已启用') },
    { value: 2, label: t('已禁用') },
    { value: 3, label: t('已过期') },
    { value: 4, label: t('已耗尽') },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <div className='p-4'>
        <Form
          layout='horizontal'
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={handleSearch}
        >
          <Space wrap align='end'>
            <Form.Input
              field='keyword'
              label={t('令牌名称')}
              placeholder={t('搜索令牌名称')}
              prefix={<IconSearch />}
              showClear
            />
            <Form.Input
              field='token'
              label={t('密钥')}
              placeholder={t('搜索密钥')}
              prefix={<IconSearch />}
              showClear
            />
            <Form.Input
              field='user_id'
              label={t('用户ID')}
              placeholder={t('输入用户ID')}
              showClear
            />
            <Form.Select
              field='status'
              label={t('状态')}
              placeholder={t('全部状态')}
              optionList={statusOptions}
              style={{ width: 130 }}
            />
            <Form.Input
              field='group'
              label={t('分组')}
              placeholder={t('输入分组名称')}
              showClear
            />
            <Button
              type='primary'
              htmlType='submit'
              icon={<IconSearch />}
              loading={loading}
            >
              {t('搜索')}
            </Button>
            <Button icon={<IconRefresh />} onClick={handleReset}>
              {t('重置')}
            </Button>
          </Space>
        </Form>

        <Table
          className='mt-4'
          columns={columns}
          dataSource={tokens}
          rowKey='id'
          loading={loading}
          pagination={
            total > pageSize
              ? {
                  currentPage: activePage,
                  pageSize: pageSize,
                  total: total,
                  onPageChange: handlePageChange,
                  onPageSizeChange: handlePageSizeChange,
                  pageSizeOpts: [10, 20, 50, 100],
                  showSizeChanger: true,
                }
              : false
          }
          scroll={{ x: 1400 }}
          empty={
            <Empty
              image={<IllustrationNoResult />}
              darkModeImage={<IllustrationNoResultDark />}
              description={
                searched
                  ? t('搜索无结果')
                  : t('请输入搜索条件查询令牌')
              }
            />
          }
        />
      </div>
    </div>
  );
};

export default AdminTokens;
