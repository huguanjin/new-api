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

import React, { useEffect, useState, useContext, useMemo } from 'react';
import { Layout, TabPane, Tabs } from '@douyinfe/semi-ui';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Calculator,
  Gauge,
  Shapes,
  Cog,
  MoreHorizontal,
  LayoutDashboard,
  MessageSquare,
  Palette,
  CreditCard,
  Server,
  Activity,
} from 'lucide-react';

import SystemSetting from '../../components/settings/SystemSetting';
import { isRoot, isAdmin } from '../../helpers';
import OtherSetting from '../../components/settings/OtherSetting';
import OperationSetting from '../../components/settings/OperationSetting';
import RateLimitSetting from '../../components/settings/RateLimitSetting';
import ModelSetting from '../../components/settings/ModelSetting';
import DashboardSetting from '../../components/settings/DashboardSetting';
import RatioSetting from '../../components/settings/RatioSetting';
import ChatsSetting from '../../components/settings/ChatsSetting';
import DrawingSetting from '../../components/settings/DrawingSetting';
import PaymentSetting from '../../components/settings/PaymentSetting';
import ModelDeploymentSetting from '../../components/settings/ModelDeploymentSetting';
import PerformanceSetting from '../../components/settings/PerformanceSetting';
import { StatusContext } from '../../context/Status';

const Setting = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [tabActiveKey, setTabActiveKey] = useState('');
  const [statusState] = useContext(StatusContext);

  const settingPermissions = useMemo(() => {
    if (isRoot()) return null; // root sees everything
    try {
      const raw = statusState?.status?.AdminRolePermissions;
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed.setting === 'object' && parsed.setting !== null
        ? parsed.setting
        : {};
    } catch {
      return {};
    }
  }, [statusState?.status?.AdminRolePermissions]);

  const canSeeTab = (tabKey) => {
    if (isRoot()) return true;
    if (!isAdmin()) return false;
    if (!settingPermissions) return true;
    return settingPermissions[tabKey] === true;
  };

  let panes = [];

  if (isAdmin()) {
    if (canSeeTab('operation')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Settings size={18} />
            {t('运营设置')}
          </span>
        ),
        content: <OperationSetting />,
        itemKey: 'operation',
      });
    }
    if (canSeeTab('dashboard')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <LayoutDashboard size={18} />
            {t('仪表盘设置')}
          </span>
        ),
        content: <DashboardSetting />,
        itemKey: 'dashboard',
      });
    }
    if (canSeeTab('chats')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MessageSquare size={18} />
            {t('聊天设置')}
          </span>
        ),
        content: <ChatsSetting />,
        itemKey: 'chats',
      });
    }
    if (canSeeTab('drawing')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Palette size={18} />
            {t('绘图设置')}
          </span>
        ),
        content: <DrawingSetting />,
        itemKey: 'drawing',
      });
    }
    if (canSeeTab('payment')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CreditCard size={18} />
            {t('支付设置')}
          </span>
        ),
        content: <PaymentSetting />,
        itemKey: 'payment',
      });
    }
    if (canSeeTab('ratio')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calculator size={18} />
            {t('分组与模型定价设置')}
          </span>
        ),
        content: <RatioSetting />,
        itemKey: 'ratio',
      });
    }
    if (canSeeTab('ratelimit')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Gauge size={18} />
            {t('速率限制设置')}
          </span>
        ),
        content: <RateLimitSetting />,
        itemKey: 'ratelimit',
      });
    }
    if (canSeeTab('models')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Shapes size={18} />
            {t('模型相关设置')}
          </span>
        ),
        content: <ModelSetting />,
        itemKey: 'models',
      });
    }
    if (canSeeTab('model_deployment')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Server size={18} />
            {t('模型部署设置')}
          </span>
        ),
        content: <ModelDeploymentSetting />,
        itemKey: 'model-deployment',
      });
    }
    if (canSeeTab('performance')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={18} />
            {t('性能设置')}
          </span>
        ),
        content: <PerformanceSetting />,
        itemKey: 'performance',
      });
    }
    if (canSeeTab('system')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Cog size={18} />
            {t('系统设置')}
          </span>
        ),
        content: <SystemSetting />,
        itemKey: 'system',
      });
    }
    if (canSeeTab('other')) {
      panes.push({
        tab: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MoreHorizontal size={18} />
            {t('其他设置')}
          </span>
        ),
        content: <OtherSetting />,
        itemKey: 'other',
      });
    }
  }
  const onChangeTab = (key) => {
    setTabActiveKey(key);
    navigate(`?tab=${key}`);
  };
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    if (tab && panes.some((p) => p.itemKey === tab)) {
      setTabActiveKey(tab);
    } else if (panes.length > 0) {
      onChangeTab(panes[0].itemKey);
    }
  }, [location.search, panes.length]);
  return (
    <div className='mt-[60px] px-2'>
      <Layout>
        <Layout.Content>
          <Tabs
            type='card'
            collapsible
            activeKey={tabActiveKey}
            onChange={(key) => onChangeTab(key)}
          >
            {panes.map((pane) => (
              <TabPane itemKey={pane.itemKey} tab={pane.tab} key={pane.itemKey}>
                {tabActiveKey === pane.itemKey && pane.content}
              </TabPane>
            ))}
          </Tabs>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default Setting;
