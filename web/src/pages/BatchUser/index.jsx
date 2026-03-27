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

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Button,
  Table,
  Modal,
  InputNumber,
  Select,
  Switch,
  Banner,
  Typography,
  Space,
  Tag,
  Pagination,
  Input,
  Spin,
} from '@douyinfe/semi-ui';
import { IconSearch, IconCopy, IconDownload } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, copy, renderQuota } from '../../helpers';

const { Text } = Typography;

const BatchUser = () => {
  const { t } = useTranslation();

  // Form state
  const [formApi, setFormApi] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [usernameMode, setUsernameMode] = useState('sequential');

  // Results modal
  const [resultsVisible, setResultsVisible] = useState(false);
  const [results, setResults] = useState([]);

  // Created users list
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');

  // Token viewer modal
  const [tokensVisible, setTokensVisible] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokenUserName, setTokenUserName] = useState('');

  // Group options
  const [groupOptions, setGroupOptions] = useState([]);

  // Admin balance
  const [adminQuota, setAdminQuota] = useState(0);
  const [isRootUser, setIsRootUser] = useState(false);

  const fetchAdminInfo = useCallback(async () => {
    try {
      const res = await API.get('/api/user/self');
      if (res?.data?.success) {
        setAdminQuota(res.data.data.quota || 0);
        setIsRootUser(res.data.data.role === 100);
      }
    } catch (error) {
      // ignore
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await API.get('/api/group/');
      if (res?.data?.data) {
        setGroupOptions(
          res.data.data.map((group) => ({
            label: group,
            value: group,
          })),
        );
      }
    } catch (error) {
      showError(error.message);
    }
  }, []);

  const loadUsers = useCallback(
    async (page, size) => {
      setLoading(true);
      try {
        const url = searchKeyword
          ? `/api/user/created/search?keyword=${encodeURIComponent(searchKeyword)}&p=${page}&page_size=${size}`
          : `/api/user/created?p=${page}&page_size=${size}`;
        const res = await API.get(url);
        const { success, message, data } = res.data;
        if (success) {
          setUsers(data.items || []);
          setTotal(data.total || 0);
          setActivePage(data.page || page);
        } else {
          showError(message);
        }
      } catch (error) {
        showError(error.message);
      }
      setLoading(false);
    },
    [searchKeyword],
  );

  useEffect(() => {
    fetchGroups();
    fetchAdminInfo();
    loadUsers(1, pageSize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        username_prefix: values.username_prefix,
        username_mode: values.username_mode,
        start_number: values.username_mode === 'sequential' ? (values.start_number || 1) : 0,
        count: values.count,
        password: values.password,
        token_name: values.token_name || '',
        token_group: values.token_group || '',
        token_unlimited_quota: values.token_unlimited_quota || false,
        token_quota: values.token_unlimited_quota ? 0 : (values.token_quota || 0),
        user_quota: values.user_quota || 0,
        user_group: values.user_group || '',
      };
      const res = await API.post('/api/user/batch', payload);
      const { success, message, data } = res.data;
      if (success) {
        setResults(data);
        setResultsVisible(true);
        showSuccess(t('批量创建成功'));
        loadUsers(1, pageSize);
        fetchAdminInfo();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setSubmitting(false);
  };

  const handleSearch = () => {
    loadUsers(1, pageSize);
  };

  const handleReset = () => {
    setSearchKeyword('');
    loadUsers(1, pageSize);
  };

  const handlePageChange = (page) => {
    loadUsers(page, pageSize);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    loadUsers(1, size);
  };

  const viewTokens = async (userId, username) => {
    setTokenUserName(username);
    setTokensLoading(true);
    setTokensVisible(true);
    try {
      const res = await API.get(`/api/user/${userId}/tokens`);
      const { success, message, data } = res.data;
      if (success) {
        setTokens(data || []);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    }
    setTokensLoading(false);
  };

  const copyAllResults = async () => {
    const text = results
      .map(
        (r, i) =>
          `${i + 1}. ${t('用户名')}: ${r.username}  ${t('密码')}: ${r.password}  ${t('令牌')}: sk-${r.token_key}`,
      )
      .join('\n');
    await copy(text);
    showSuccess(t('已复制到剪贴板'));
  };

  const exportCSV = () => {
    const header = `${t('序号')},${t('用户名')},${t('密码')},${t('令牌Key')}`;
    const rows = results.map(
      (r, i) => `${i + 1},${r.username},${r.password},sk-${r.token_key}`,
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_users_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copySingleRow = async (row) => {
    const text = `${t('用户名')}: ${row.username}  ${t('密码')}: ${row.password}  ${t('令牌')}: sk-${row.token_key}`;
    await copy(text);
    showSuccess(t('已复制到剪贴板'));
  };

  // Result table columns
  const resultColumns = [
    {
      title: t('序号'),
      dataIndex: 'index',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
    },
    {
      title: t('密码'),
      dataIndex: 'password',
    },
    {
      title: t('令牌Key'),
      dataIndex: 'token_key',
      render: (text) => <Text copyable>{`sk-${text}`}</Text>,
    },
    {
      title: t('操作'),
      dataIndex: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          icon={<IconCopy />}
          size='small'
          theme='borderless'
          onClick={() => copySingleRow(record)}
        />
      ),
    },
  ];

  // Created users table columns
  const userColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
    },
    {
      title: t('显示名称'),
      dataIndex: 'display_name',
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      render: (text) => text ? <Tag size='small'>{text}</Tag> : '-',
    },
    {
      title: t('额度'),
      dataIndex: 'quota',
      render: (text) => text?.toLocaleString() || '0',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 1 ? 'green' : 'red'} size='small'>
          {status === 1 ? t('已启用') : t('已禁用')}
        </Tag>
      ),
    },
    {
      title: t('操作'),
      dataIndex: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          size='small'
          theme='borderless'
          onClick={() => viewTokens(record.id, record.username)}
        >
          {t('查看令牌')}
        </Button>
      ),
    },
  ];

  // Token modal columns
  const tokenColumns = [
    {
      title: t('令牌名称'),
      dataIndex: 'name',
    },
    {
      title: t('令牌Key'),
      dataIndex: 'key',
      render: (text) => <Text copyable>{`sk-${text}`}</Text>,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 1 ? 'green' : 'red'} size='small'>
          {status === 1 ? t('已启用') : t('已禁用')}
        </Tag>
      ),
    },
    {
      title: t('已用额度'),
      dataIndex: 'used_quota',
      render: (text) => text?.toLocaleString() || '0',
    },
    {
      title: t('剩余额度'),
      dataIndex: 'remain_quota',
      render: (text, record) =>
        record.unlimited_quota ? t('无限') : (text?.toLocaleString() || '0'),
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      {/* Batch Create Form */}
      <Card
        title={t('批量创建用户')}
        style={{ marginBottom: 16 }}
      >
        {!isRootUser && (
          <Banner
            type='info'
            description={t('您的当前余额') + ': ' + renderQuota(adminQuota) + '。' + t('创建子账号的初始额度将从您的余额中扣除。')}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form
          onSubmit={handleSubmit}
          getFormApi={(api) => setFormApi(api)}
          labelPosition='left'
          labelWidth='120px'
          initValues={{
            username_mode: 'sequential',
            start_number: 1,
            count: 10,
            token_unlimited_quota: true,
          }}
        >
          <div className='grid grid-cols-1 md:grid-cols-2 gap-x-8'>
            <Form.Input
              field='username_prefix'
              label={t('用户名前缀')}
              placeholder={t('请输入用户名前缀')}
              rules={[{ required: true, message: t('请输入用户名前缀') }]}
              maxLength={12}
            />
            <Form.Select
              field='username_mode'
              label={t('用户名生成规则')}
              onChange={(val) => setUsernameMode(val)}
            >
              <Select.Option value='sequential'>
                {t('前缀+序号')}
              </Select.Option>
              <Select.Option value='random'>
                {t('前缀+随机后缀')}
              </Select.Option>
            </Form.Select>
            {usernameMode === 'sequential' && (
              <Form.InputNumber
                field='start_number'
                label={t('起始序号')}
                min={0}
                style={{ width: '100%' }}
              />
            )}
            <Form.InputNumber
              field='count'
              label={t('创建数量')}
              min={1}
              max={100}
              rules={[{ required: true, message: t('请输入创建数量') }]}
              style={{ width: '100%' }}
            />
            <Form.Input
              field='password'
              label={t('默认密码')}
              mode='password'
              placeholder={t('至少8位')}
              rules={[
                { required: true, message: t('请输入密码') },
                { min: 8, message: t('密码至少8位') },
              ]}
            />
            <Form.Input
              field='token_name'
              label={t('令牌名称')}
              placeholder={t('默认为 default')}
            />
            <Form.Select
              field='token_group'
              label={t('令牌分组')}
              optionList={groupOptions}
              showClear
              placeholder={t('选择分组')}
            />
            <Form.Select
              field='user_group'
              label={t('用户分组')}
              optionList={groupOptions}
              showClear
              placeholder={t('选择分组')}
            />
            <Form.InputNumber
              field='user_quota'
              label={t('用户额度')}
              min={0}
              style={{ width: '100%' }}
              placeholder='0'
            />
            <div className='flex items-end gap-4'>
              <Form.Switch
                field='token_unlimited_quota'
                label={t('无限额度')}
              />
              <Form.InputNumber
                field='token_quota'
                label={t('令牌额度')}
                min={0}
                style={{ width: '100%' }}
                placeholder='0'
                noLabel
              />
            </div>
          </div>
          <div className='mt-4'>
            <Button
              type='primary'
              htmlType='submit'
              loading={submitting}
            >
              {t('开始创建')}
            </Button>
          </div>
        </Form>
      </Card>

      {/* Created Users List */}
      <Card title={t('已创建用户')}>
        <div className='flex flex-col md:flex-row justify-between items-center gap-2 mb-4'>
          <div className='flex gap-2 w-full md:w-auto'>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索用户名')}
              value={searchKeyword}
              onChange={(val) => setSearchKeyword(val)}
              onEnterPress={handleSearch}
              showClear
              size='small'
              style={{ width: 240 }}
            />
            <Button
              type='tertiary'
              size='small'
              onClick={handleSearch}
            >
              {t('查询')}
            </Button>
            <Button
              type='tertiary'
              size='small'
              onClick={handleReset}
            >
              {t('重置')}
            </Button>
          </div>
        </div>
        <Table
          columns={userColumns}
          dataSource={users}
          rowKey='id'
          loading={loading}
          pagination={false}
          size='middle'
          empty={t('暂无数据')}
        />
        {total > 0 && (
          <div className='flex justify-end mt-4'>
            <Pagination
              currentPage={activePage}
              pageSize={pageSize}
              total={total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              showSizeChanger
              pageSizeOpts={[10, 20, 50, 100]}
              showTotal
            />
          </div>
        )}
      </Card>

      {/* Results Modal */}
      <Modal
        title={t('创建结果')}
        visible={resultsVisible}
        onCancel={() => setResultsVisible(false)}
        footer={null}
        width={800}
        closeOnEsc
      >
        <Banner
          type='success'
          description={t('成功创建 {{count}} 个用户', {
            count: results.length,
          })}
          style={{ marginBottom: 16 }}
        />
        <div className='flex gap-2 mb-4'>
          <Button
            icon={<IconCopy />}
            onClick={copyAllResults}
          >
            {t('一键复制全部')}
          </Button>
          <Button
            icon={<IconDownload />}
            onClick={exportCSV}
          >
            {t('导出CSV')}
          </Button>
        </div>
        <Table
          columns={resultColumns}
          dataSource={results}
          rowKey='username'
          pagination={false}
          size='small'
        />
      </Modal>

      {/* Token Viewer Modal */}
      <Modal
        title={`${t('查看令牌')} - ${tokenUserName}`}
        visible={tokensVisible}
        onCancel={() => setTokensVisible(false)}
        footer={null}
        width={700}
        closeOnEsc
      >
        <Spin spinning={tokensLoading}>
          <Table
            columns={tokenColumns}
            dataSource={tokens}
            rowKey='id'
            pagination={false}
            size='small'
            empty={t('暂无数据')}
          />
        </Spin>
      </Modal>
    </div>
  );
};

export default BatchUser;
