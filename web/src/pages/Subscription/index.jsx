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

import React, { useState } from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { CalendarClock, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SubscriptionsPage from '../../components/table/subscriptions';
import UserSubscriptionsTab from '../../components/table/subscriptions/UserSubscriptionsTab';

const Subscription = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('plans');

  return (
    <div className='mt-[60px] px-2'>
      <Tabs
        type='line'
        activeKey={activeTab}
        onChange={setActiveTab}
        className='mb-2'
      >
        <TabPane
          itemKey='plans'
          tab={
            <div className='flex items-center gap-2'>
              <CalendarClock size={16} />
              {t('套餐管理')}
            </div>
          }
        >
          <SubscriptionsPage />
        </TabPane>
        <TabPane
          itemKey='user_subs'
          tab={
            <div className='flex items-center gap-2'>
              <Users size={16} />
              {t('用户订阅')}
            </div>
          }
        >
          <UserSubscriptionsTab />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Subscription;
