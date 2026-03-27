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

import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Button,
  Switch,
  Row,
  Col,
  Typography,
  Banner,
} from '@douyinfe/semi-ui';
import { API, showSuccess, showError } from '../../../helpers';
import { StatusContext } from '../../../context/Status';

const { Text } = Typography;

const DEFAULT_ADMIN_ROLE_PERMISSIONS = {
  channel: true,
  subscription: true,
  models: true,
  deployment: true,
  redemption: true,
  user: true,
  batch_user: true,
};

export default function SettingsAdminPermissions(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);

  const [permissions, setPermissions] = useState({ ...DEFAULT_ADMIN_ROLE_PERMISSIONS });

  function handlePermissionChange(key) {
    return (checked) => {
      setPermissions((prev) => ({
        ...prev,
        [key]: checked,
      }));
    };
  }

  function resetPermissions() {
    setPermissions({ ...DEFAULT_ADMIN_ROLE_PERMISSIONS });
    showSuccess(t('已重置为默认配置'));
  }

  async function onSubmit() {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: 'AdminRolePermissions',
        value: JSON.stringify(permissions),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));

        statusDispatch({
          type: 'set',
          payload: {
            ...statusState.status,
            AdminRolePermissions: JSON.stringify(permissions),
          },
        });

        if (props.refresh) {
          await props.refresh();
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (props.options && props.options.AdminRolePermissions) {
      try {
        const parsed = JSON.parse(props.options.AdminRolePermissions);
        setPermissions({ ...DEFAULT_ADMIN_ROLE_PERMISSIONS, ...parsed });
      } catch (error) {
        setPermissions({ ...DEFAULT_ADMIN_ROLE_PERMISSIONS });
      }
    }
  }, [props.options]);

  const permissionItems = [
    { key: 'channel', title: t('渠道管理'), description: t('管理API渠道配置') },
    { key: 'subscription', title: t('订阅管理'), description: t('管理订阅套餐') },
    { key: 'models', title: t('模型管理'), description: t('管理AI模型配置') },
    { key: 'deployment', title: t('模型部署'), description: t('管理模型部署') },
    { key: 'redemption', title: t('兑换码管理'), description: t('管理兑换码生成') },
    { key: 'user', title: t('用户管理'), description: t('管理用户账户') },
    { key: 'batch_user', title: t('批量创建用户'), description: t('批量创建和管理用户') },
  ];

  return (
    <Card>
      <Form.Section
        text={t('管理员角色授权')}
        extraText={t(
          '控制普通管理员可访问的管理功能，超级管理员不受此限制',
        )}
      >
        <Banner
          type='info'
          description={t('以下功能默认对所有管理员开放，关闭后普通管理员将无法看到对应的侧边栏入口。超级管理员始终拥有全部权限。')}
          bordered
          fullMode={false}
          closeIcon={null}
          style={{ marginBottom: '16px' }}
        />

        <Row gutter={[16, 16]}>
          {permissionItems.map((item) => (
            <Col key={item.key} xs={24} sm={12} md={8} lg={6} xl={6}>
              <Card
                bodyStyle={{ padding: '16px' }}
                hoverable
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div
                      style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        color: 'var(--semi-color-text-0)',
                        marginBottom: '4px',
                      }}
                    >
                      {item.title}
                    </div>
                    <Text
                      type='secondary'
                      size='small'
                      style={{
                        fontSize: '12px',
                        color: 'var(--semi-color-text-2)',
                        lineHeight: '1.4',
                        display: 'block',
                      }}
                    >
                      {item.description}
                    </Text>
                  </div>
                  <div style={{ marginLeft: '16px' }}>
                    <Switch
                      checked={permissions[item.key]}
                      onChange={handlePermissionChange(item.key)}
                      size='default'
                    />
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            gap: '12px',
          }}
        >
          <Button
            type='primary'
            onClick={onSubmit}
            loading={loading}
          >
            {t('保存管理员授权')}
          </Button>
          <Button onClick={resetPermissions}>
            {t('重置为默认')}
          </Button>
        </div>
      </Form.Section>
    </Card>
  );
}
