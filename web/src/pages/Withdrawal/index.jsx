import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Input,
  Tabs,
  TabPane,
  Card,
  Empty,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';

const { Text } = Typography;

const STATUS_MAP = {
  pending: { color: 'orange', text: '待审核' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已拒绝' },
};

const Withdrawal = () => {
  const { t } = useTranslation();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [processLoading, setProcessLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState({ visible: false, id: null });
  const [rejectRemark, setRejectRemark] = useState('');

  const loadWithdrawals = useCallback(
    async (page, size, status) => {
      setLoading(true);
      try {
        let url = `/api/user/withdrawals?p=${page ?? activePage}&page_size=${size ?? pageSize}`;
        const s = status !== undefined ? status : statusFilter;
        if (s) {
          url += `&status=${s}`;
        }
        const res = await API.get(url);
        const { success, message, data } = res.data;
        if (success) {
          setWithdrawals(data.items || []);
          setTotal(data.total || 0);
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
    loadWithdrawals(1, pageSize, statusFilter);
  }, []);

  const handleTabChange = (key) => {
    setStatusFilter(key);
    setActivePage(1);
    loadWithdrawals(1, pageSize, key);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    loadWithdrawals(page, pageSize, statusFilter);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
    loadWithdrawals(1, size, statusFilter);
  };

  const handleApprove = async (id) => {
    Modal.confirm({
      title: t('确认通过'),
      content: t('确认通过该提现申请？请确保已完成线下打款。'),
      onOk: async () => {
        setProcessLoading(true);
        try {
          const res = await API.post(`/api/user/withdrawal/${id}/process`, {
            action: 'approve',
          });
          const { success, message } = res.data;
          if (success) {
            showSuccess(t('已通过'));
            loadWithdrawals(activePage, pageSize, statusFilter);
          } else {
            showError(message);
          }
        } catch {
          showError(t('请求失败'));
        } finally {
          setProcessLoading(false);
        }
      },
    });
  };

  const handleReject = (id) => {
    setRejectModal({ visible: true, id });
    setRejectRemark('');
  };

  const handleRejectConfirm = async () => {
    setProcessLoading(true);
    try {
      const res = await API.post(
        `/api/user/withdrawal/${rejectModal.id}/process`,
        {
          action: 'reject',
          remark: rejectRemark,
        },
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('已拒绝'));
        setRejectModal({ visible: false, id: null });
        loadWithdrawals(activePage, pageSize, statusFilter);
      } else {
        showError(message);
      }
    } catch {
      showError(t('请求失败'));
    } finally {
      setProcessLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: t('用户'),
      dataIndex: 'username',
      width: 120,
      render: (text, record) => (
        <span>
          {text} (ID: {record.user_id})
        </span>
      ),
    },
    {
      title: t('提现金额'),
      dataIndex: 'amount',
      width: 120,
      render: (text) => (
        <Text strong style={{ color: 'var(--semi-color-warning)' }}>
          ¥{Number(text).toFixed(2)}
        </Text>
      ),
    },
    {
      title: t('支付宝账号'),
      dataIndex: 'alipay_account',
      width: 180,
    },
    {
      title: t('支付宝实名'),
      dataIndex: 'alipay_name',
      width: 100,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (text) => {
        const cfg = STATUS_MAP[text] || { color: 'grey', text: '未知' };
        return (
          <Tag color={cfg.color} shape='circle'>
            {t(cfg.text)}
          </Tag>
        );
      },
    },
    {
      title: t('备注'),
      dataIndex: 'remark',
      width: 150,
      render: (text) => text || '-',
    },
    {
      title: t('申请时间'),
      dataIndex: 'created_at',
      width: 180,
      render: (text) =>
        text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      width: 160,
      fixed: 'right',
      render: (_, record) => {
        if (record.status !== 'pending') {
          return <Text type='tertiary'>-</Text>;
        }
        return (
          <Space>
            <Button
              size='small'
              type='primary'
              theme='solid'
              onClick={() => handleApprove(record.id)}
              loading={processLoading}
            >
              {t('通过')}
            </Button>
            <Button
              size='small'
              type='danger'
              theme='solid'
              onClick={() => handleReject(record.id)}
              loading={processLoading}
            >
              {t('拒绝')}
            </Button>
          </Space>
        );
      },
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
          <TabPane itemKey='' tab={t('全部')} />
          <TabPane itemKey='pending' tab={t('待审核')} />
          <TabPane itemKey='approved' tab={t('已通过')} />
          <TabPane itemKey='rejected' tab={t('已拒绝')} />
        </Tabs>

        <Table
          columns={columns}
          dataSource={withdrawals}
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
              description={t('暂无提现记录')}
              style={{ padding: 30 }}
            />
          }
          className='rounded-xl overflow-hidden'
          size='middle'
        />
      </Card>

      <Modal
        title={t('拒绝提现')}
        visible={rejectModal.visible}
        onOk={handleRejectConfirm}
        onCancel={() => setRejectModal({ visible: false, id: null })}
        confirmLoading={processLoading}
        maskClosable={false}
      >
        <Input
          placeholder={t('请输入拒绝原因（可选）')}
          value={rejectRemark}
          onChange={setRejectRemark}
        />
      </Modal>
    </div>
  );
};

export default Withdrawal;
