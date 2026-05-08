import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import { API, showError, timestamp2string } from '../../helpers';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Agent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // overview
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // invitees
  const [invitees, setInvitees] = useState([]);
  const [inviteesTotal, setInviteesTotal] = useState(0);
  const [inviteesPage, setInviteesPage] = useState(1);
  const [inviteesLoading, setInviteesLoading] = useState(false);

  // settlements
  const [settlements, setSettlements] = useState([]);
  const [settlementsTotal, setSettlementsTotal] = useState(0);
  const [settlementsPage, setSettlementsPage] = useState(1);
  const [settlementsLoading, setSettlementsLoading] = useState(false);

  // invitee topups
  const [topups, setTopups] = useState([]);
  const [topupsTotal, setTopupsTotal] = useState(0);
  const [topupsPage, setTopupsPage] = useState(1);
  const [topupsLoading, setTopupsLoading] = useState(false);

  const PAGE_SIZE = 20;

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await API.get('/api/agent/overview');
      const { success, data, message } = res.data;
      if (success) setOverview(data);
      else showError(message);
    } catch {
      showError(t('请求失败'));
    } finally {
      setOverviewLoading(false);
    }
  }, [t]);

  const loadInvitees = useCallback(
    async (page = 1) => {
      setInviteesLoading(true);
      try {
        const res = await API.get(
          `/api/agent/users?p=${page}&page_size=${PAGE_SIZE}`,
        );
        const { success, data, message } = res.data;
        if (success) {
          setInvitees(data.items || []);
          setInviteesTotal(data.total || 0);
        } else showError(message);
      } catch {
        showError(t('请求失败'));
      } finally {
        setInviteesLoading(false);
      }
    },
    [t],
  );

  const loadSettlements = useCallback(
    async (page = 1) => {
      setSettlementsLoading(true);
      try {
        const res = await API.get(
          `/api/agent/settlements?p=${page}&page_size=${PAGE_SIZE}`,
        );
        const { success, data, message } = res.data;
        if (success) {
          setSettlements(data.items || []);
          setSettlementsTotal(data.total || 0);
        } else showError(message);
      } catch {
        showError(t('请求失败'));
      } finally {
        setSettlementsLoading(false);
      }
    },
    [t],
  );

  const loadTopups = useCallback(
    async (page = 1) => {
      setTopupsLoading(true);
      try {
        const res = await API.get(
          `/api/agent/topups?p=${page}&page_size=${PAGE_SIZE}`,
        );
        const { success, data, message } = res.data;
        if (success) {
          setTopups(data.items || []);
          setTopupsTotal(data.total || 0);
        } else showError(message);
      } catch {
        showError(t('请求失败'));
      } finally {
        setTopupsLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    loadOverview();
    loadInvitees(1);
    loadSettlements(1);
    loadTopups(1);
  }, []);

  const inviteeColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
    },
    {
      title: t('显示名'),
      dataIndex: 'display_name',
    },
    {
      title: t('注册时间'),
      dataIndex: 'created_at',
      render: (v) => timestamp2string(v),
    },
    {
      title: t('累计消耗额度'),
      dataIndex: 'used_quota',
      render: (v) => v.toLocaleString(),
    },
  ];

  const settlementColumns = [
    { title: t('月份'), dataIndex: 'month' },
    { title: t('下级用户 ID'), dataIndex: 'invitee_id' },
    {
      title: t('用量变化'),
      dataIndex: 'used_quota_delta',
      render: (v) => v.toLocaleString(),
    },
    {
      title: t('结算费率'),
      dataIndex: 'commission_rate',
      render: (v) => `${(v * 100).toFixed(2)}%`,
    },
    {
      title: t('分红金额'),
      dataIndex: 'commission',
      render: (v) => `¥${v.toFixed(2)}`,
    },
    {
      title: t('结算时间'),
      dataIndex: 'created_at',
      render: (v) => timestamp2string(v),
    },
  ];

  const topupColumns = [
    { title: t('订单号'), dataIndex: 'trade_no' },
    { title: t('用户 ID'), dataIndex: 'user_id' },
    {
      title: t('金额'),
      dataIndex: 'amount',
      render: (v) => `¥${(v / 100).toFixed(2)}`,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (v) => (
        <Tag color={v === 'success' ? 'green' : 'orange'}>
          {v === 'success' ? t('成功') : t('处理中')}
        </Tag>
      ),
    },
    {
      title: t('时间'),
      dataIndex: 'created_at',
      render: (v) => timestamp2string(v),
    },
  ];

  return (
    <div className='mt-[60px] px-4 pb-8'>
      <Title heading={3} className='mb-4'>
        {t('代理中心')}
      </Title>

      {/* 概览卡片 */}
      <Card className='mb-4'>
        {overviewLoading ? (
          <Spin />
        ) : overview ? (
          <>
            <Descriptions
              data={[
                {
                  key: t('邀请码'),
                  value: (
                    <Text strong copyable>
                      {overview.aff_code}
                    </Text>
                  ),
                },
                {
                  key: t('下级用户数'),
                  value: overview.invitee_count,
                },
                {
                  key: t('本月已结算分红'),
                  value: `¥${(overview.this_month_commission ?? 0).toFixed(2)}`,
                },
                {
                  key: t('可提现余额'),
                  value: `¥${(overview.commission_balance ?? 0).toFixed(2)}`,
                },
                {
                  key: t('历史分红总额'),
                  value: `¥${(overview.commission_total ?? 0).toFixed(2)}`,
                },
              ]}
            />
            <div className='mt-3'>
              <Button onClick={() => navigate('/console/topup')}>
                {t('提现 / 转换额度')}
              </Button>
            </div>
          </>
        ) : null}
      </Card>

      {/* 下级用户 */}
      <Card className='mb-4' title={t('下级用户列表')}>
        <Table
          columns={inviteeColumns}
          dataSource={invitees}
          loading={inviteesLoading}
          rowKey='id'
          pagination={{
            total: inviteesTotal,
            currentPage: inviteesPage,
            pageSize: PAGE_SIZE,
            onPageChange: (page) => {
              setInviteesPage(page);
              loadInvitees(page);
            },
          }}
          empty={
            <Empty
              image={<IllustrationNoResult />}
              darkModeImage={<IllustrationNoResultDark />}
              description={t('暂无下级用户')}
            />
          }
        />
      </Card>

      {/* 月度结算明细 */}
      <Card className='mb-4' title={t('月度结算明细')}>
        <Table
          columns={settlementColumns}
          dataSource={settlements}
          loading={settlementsLoading}
          rowKey='id'
          pagination={{
            total: settlementsTotal,
            currentPage: settlementsPage,
            pageSize: PAGE_SIZE,
            onPageChange: (page) => {
              setSettlementsPage(page);
              loadSettlements(page);
            },
          }}
          empty={
            <Empty
              image={<IllustrationNoResult />}
              darkModeImage={<IllustrationNoResultDark />}
              description={t('暂无结算记录')}
            />
          }
        />
      </Card>

      {/* 下级充值记录 */}
      <Card title={t('下级充值记录')}>
        <Table
          columns={topupColumns}
          dataSource={topups}
          loading={topupsLoading}
          rowKey='trade_no'
          pagination={{
            total: topupsTotal,
            currentPage: topupsPage,
            pageSize: PAGE_SIZE,
            onPageChange: (page) => {
              setTopupsPage(page);
              loadTopups(page);
            },
          }}
          empty={
            <Empty
              image={<IllustrationNoResult />}
              darkModeImage={<IllustrationNoResultDark />}
              description={t('暂无充值记录')}
            />
          }
        />
      </Card>
    </div>
  );
};

export default Agent;
