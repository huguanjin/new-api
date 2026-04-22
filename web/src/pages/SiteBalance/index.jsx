import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconDownload,
  IconEdit,
  IconRefresh,
  IconUpload,
  IconPlus,
} from '@douyinfe/semi-icons';
import { API } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

const QUOTA_USD_RATE = 500000;

function quotaToUSD(quota) {
  return (quota / QUOTA_USD_RATE).toFixed(4);
}

const defaultForm = {
  name: '',
  url: '',
  token: '',
  user_id_ext: '',
  remark: '',
};

export default function SiteBalance() {
  const { t } = useTranslation();

  const [sites, setSites] = useState([]);
  const [queryResults, setQueryResults] = useState({});
  const [loadingSites, setLoadingSites] = useState(false);
  const [queryingAll, setQueryingAll] = useState(false);
  const [queryingId, setQueryingId] = useState(null);

  // modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // import modal
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef(null);

  const fetchSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const res = await API.get('/api/external-site/');
      if (res.data.success) {
        setSites(res.data.data || []);
      } else {
        Toast.error(res.data.message || t('获取失败'));
      }
    } catch (e) {
      Toast.error(e.message);
    } finally {
      setLoadingSites(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // ---- Query ----

  const querySingle = useCallback(
    async (id) => {
      setQueryingId(id);
      try {
        const res = await API.post(`/api/external-site/${id}/query`);
        if (res.data.success) {
          setQueryResults((prev) => ({ ...prev, [id]: res.data.data }));
        } else {
          Toast.error(res.data.message || t('查询失败'));
        }
      } catch (e) {
        Toast.error(e.message);
      } finally {
        setQueryingId(null);
      }
    },
    [t],
  );

  const queryAll = useCallback(async () => {
    setQueryingAll(true);
    try {
      const res = await API.post('/api/external-site/query_all');
      if (res.data.success) {
        const map = {};
        (res.data.data || []).forEach((r) => {
          map[r.id] = r;
        });
        setQueryResults(map);
      } else {
        Toast.error(res.data.message || t('批量查询失败'));
      }
    } catch (e) {
      Toast.error(e.message);
    } finally {
      setQueryingAll(false);
    }
  }, [t]);

  // ---- CRUD ----

  const openCreateModal = () => {
    setEditingId(null);
    setFormValues(defaultForm);
    setShowToken(false);
    setModalVisible(true);
  };

  const openEditModal = (site) => {
    setEditingId(site.id);
    setFormValues({
      name: site.name,
      url: site.url,
      token: '',
      user_id_ext: site.user_id_ext || '',
      remark: site.remark || '',
    });
    setShowToken(false);
    setModalVisible(true);
  };

  const submitForm = async () => {
    if (!formValues.name || !formValues.url) {
      Toast.warning(t('名称和 URL 不能为空'));
      return;
    }
    if (!editingId && !formValues.token) {
      Toast.warning(t('新建时 Token 不能为空'));
      return;
    }
    setSubmitting(true);
    try {
      let res;
      if (editingId) {
        res = await API.put(`/api/external-site/${editingId}`, formValues);
      } else {
        res = await API.post('/api/external-site/', formValues);
      }
      if (res.data.success) {
        Toast.success(editingId ? t('更新成功') : t('创建成功'));
        setModalVisible(false);
        await fetchSites();
      } else {
        Toast.error(res.data.message || t('操作失败'));
      }
    } catch (e) {
      Toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSite = async (id) => {
    try {
      const res = await API.delete(`/api/external-site/${id}`);
      if (res.data.success) {
        Toast.success(t('删除成功'));
        setSites((prev) => prev.filter((s) => s.id !== id));
        setQueryResults((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        Toast.error(res.data.message || t('删除失败'));
      }
    } catch (e) {
      Toast.error(e.message);
    }
  };

  // ---- Import / Export ----

  const handleExport = async () => {
    try {
      const res = await API.get('/api/external-site/export');
      if (!res.data.success) {
        Toast.error(res.data.message || t('导出失败'));
        return;
      }
      const json = JSON.stringify(res.data.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sites-config.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      Toast.error(e.message);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText(ev.target.result);
      setImportModalVisible(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const doImport = async () => {
    let parsed;
    try {
      parsed = JSON.parse(importText);
    } catch {
      Toast.error(t('JSON 格式错误'));
      return;
    }
    if (!Array.isArray(parsed)) {
      Toast.error(t('数据必须是数组格式'));
      return;
    }
    setImporting(true);
    try {
      const res = await API.post('/api/external-site/import', parsed);
      if (res.data.success) {
        Toast.success(t('导入成功，共 {{count}} 条', { count: res.data.count }));
        setImportModalVisible(false);
        setImportText('');
        await fetchSites();
      } else {
        Toast.error(res.data.message || t('导入失败'));
      }
    } catch (e) {
      Toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  // ---- Stats ----

  const totalSites = sites.length;
  const queriedResults = Object.values(queryResults);
  const onlineCount = queriedResults.filter((r) => !r.error).length;
  const totalBalanceUSD = queriedResults
    .filter((r) => !r.error)
    .reduce((sum, r) => sum + (r.balance_usd || 0), 0);

  // ---- Table columns ----

  const columns = [
    {
      title: t('名称'),
      dataIndex: 'name',
      width: 140,
      render: (v, record) => (
        <Text strong ellipsis={{ showTooltip: true }} style={{ maxWidth: 130 }}>
          {v}
        </Text>
      ),
    },
    {
      title: t('站点 URL'),
      dataIndex: 'url',
      width: 200,
      render: (v) => (
        <Text link={{ href: v, target: '_blank' }} ellipsis={{ showTooltip: true }} style={{ maxWidth: 190 }}>
          {v}
        </Text>
      ),
    },
    {
      title: t('备注'),
      dataIndex: 'remark',
      width: 120,
      render: (v) => <Text type="tertiary">{v || '-'}</Text>,
    },
    {
      title: t('用户名'),
      key: 'username',
      width: 110,
      render: (_, record) => {
        const r = queryResults[record.id];
        if (!r) return <Text type="tertiary">-</Text>;
        if (r.error) return <Tag color="red" size="small">{t('错误')}</Tag>;
        return <Text>{r.username || '-'}</Text>;
      },
    },
    {
      title: t('分组'),
      key: 'group',
      width: 90,
      render: (_, record) => {
        const r = queryResults[record.id];
        if (!r || r.error) return <Text type="tertiary">-</Text>;
        return <Tag color="blue" size="small">{r.group || '-'}</Tag>;
      },
    },
    {
      title: t('可用额度'),
      key: 'quota',
      width: 120,
      render: (_, record) => {
        const r = queryResults[record.id];
        if (!r || r.error) return <Text type="tertiary">-</Text>;
        return (
          <Tooltip content={`${r.quota?.toLocaleString()} quota`}>
            <Text>${quotaToUSD(r.quota)}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: t('已用额度'),
      key: 'used_quota',
      width: 120,
      render: (_, record) => {
        const r = queryResults[record.id];
        if (!r || r.error) return <Text type="tertiary">-</Text>;
        return (
          <Tooltip content={`${r.used_quota?.toLocaleString()} quota`}>
            <Text type="secondary">${quotaToUSD(r.used_quota)}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: t('请求次数'),
      key: 'request_count',
      width: 90,
      render: (_, record) => {
        const r = queryResults[record.id];
        if (!r || r.error) return <Text type="tertiary">-</Text>;
        return <Text>{r.request_count?.toLocaleString()}</Text>;
      },
    },
    {
      title: t('状态'),
      key: 'status',
      width: 90,
      render: (_, record) => {
        const r = queryResults[record.id];
        if (!r) return <Tag color="grey" size="small">{t('未查询')}</Tag>;
        if (r.error) return (
          <Tooltip content={r.error}>
            <Tag color="red" size="small">{t('失败')}</Tag>
          </Tooltip>
        );
        return <Tag color="green" size="small">{t('正常')}</Tag>;
      },
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<IconRefresh />}
            loading={queryingId === record.id}
            onClick={() => querySingle(record.id)}
          />
          <Button
            size="small"
            icon={<IconEdit />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title={t('确认删除该站点？')}
            okText={t('删除')}
            cancelText={t('取消')}
            onConfirm={() => deleteSite(record.id)}
          >
            <Button size="small" type="danger" icon={<IconDelete />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title heading={4} style={{ margin: 0 }}>{t('站点余额查询')}</Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<IconRefresh />} loading={queryingAll} onClick={queryAll}>
              {t('刷新全部')}
            </Button>
            <Button icon={<IconPlus />} type="primary" onClick={openCreateModal}>
              {t('添加站点')}
            </Button>
            <Button icon={<IconUpload />} onClick={() => fileInputRef.current?.click()}>
              {t('导入')}
            </Button>
            <Button icon={<IconDownload />} onClick={handleExport}>
              {t('导出')}
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Stats cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Text type="tertiary">{t('站点总数')}</Text>
            <Title heading={3} style={{ margin: '4px 0 0' }}>{totalSites}</Title>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Text type="tertiary">{t('正常站点')}</Text>
            <Title heading={3} style={{ margin: '4px 0 0', color: '#00b42a' }}>{onlineCount}</Title>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Text type="tertiary">{t('总余额 (USD)')}</Text>
            <Title heading={3} style={{ margin: '4px 0 0' }}>${totalBalanceUSD.toFixed(4)}</Title>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Spin spinning={loadingSites}>
        <Table
          columns={columns}
          dataSource={sites}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          empty={<Empty description={t('暂无站点，点击「添加站点」开始')} />}
          scroll={{ x: 'max-content' }}
        />
      </Spin>

      {/* Create/Edit Modal */}
      <Modal
        title={editingId ? t('编辑站点') : t('添加站点')}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={submitForm}
        okButtonProps={{ loading: submitting }}
        okText={editingId ? t('保存') : t('创建')}
        cancelText={t('取消')}
      >
        <Form labelPosition="left" labelWidth={80}>
          <Form.Input
            field="name"
            label={t('名称')}
            placeholder={t('显示名称')}
            value={formValues.name}
            onChange={(v) => setFormValues((p) => ({ ...p, name: v }))}
            rules={[{ required: true }]}
          />
          <Form.Input
            field="url"
            label="URL"
            placeholder="https://example.com"
            value={formValues.url}
            onChange={(v) => setFormValues((p) => ({ ...p, url: v }))}
            rules={[{ required: true }]}
          />
          <Form.Input
            field="token"
            label="Token"
            type={showToken ? 'text' : 'password'}
            placeholder={editingId ? t('留空则不修改') : 'sk-...'}
            value={formValues.token}
            onChange={(v) => setFormValues((p) => ({ ...p, token: v }))}
            suffix={
              <Button
                size="small"
                type="tertiary"
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? t('隐藏') : t('显示')}
              </Button>
            }
          />
          <Form.Input
            field="user_id_ext"
            label={t('用户 ID')}
            placeholder={t('可选，对应 New-Api-User 请求头')}
            value={formValues.user_id_ext}
            onChange={(v) => setFormValues((p) => ({ ...p, user_id_ext: v }))}
          />
          <Form.Input
            field="remark"
            label={t('备注')}
            placeholder={t('可选备注')}
            value={formValues.remark}
            onChange={(v) => setFormValues((p) => ({ ...p, remark: v }))}
          />
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title={t('导入站点配置')}
        visible={importModalVisible}
        onCancel={() => { setImportModalVisible(false); setImportText(''); }}
        onOk={doImport}
        okButtonProps={{ loading: importing }}
        okText={t('确认导入')}
        cancelText={t('取消')}
      >
        <Banner
          type="warning"
          description={t('导入将覆盖现有所有站点配置，请谨慎操作')}
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          rows={10}
          placeholder={t('粘贴 JSON 数组内容，格式：[{"name":"...","url":"...","token":"...","userId":"..."}]')}
          value={importText}
          onChange={(v) => setImportText(v)}
        />
      </Modal>

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  );
}
