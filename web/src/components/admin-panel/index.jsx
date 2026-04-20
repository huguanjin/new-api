import React, { useEffect, useState } from 'react';
import { DatePicker, Button, Typography } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useAdminOverview } from '../../hooks/admin-panel/useAdminOverview';
import OverviewCards from './OverviewCards';
import RankingTable from './RankingTable';

const { Title } = Typography;

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AdminPanel() {
  const { t } = useTranslation();
  const { data, loading, fetchData } = useAdminOverview();
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchData(formatDate(new Date()));
  }, []);

  const handleQuery = () => {
    fetchData(formatDate(selectedDate));
  };

  const handleDateChange = (date) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  return (
    <div className='p-4'>
      <Title heading={3} className='mb-4'>{t('管理面板')}</Title>

      <div className='bg-white rounded-lg p-4 mb-6 flex flex-wrap items-center gap-4'>
        <span className='text-sm text-gray-600'>{t('选择日期')}:</span>
        <DatePicker
          value={selectedDate}
          onChange={handleDateChange}
          type='date'
          placeholder={t('默认今天')}
          style={{ width: 200 }}
        />
        <Button
          theme='solid'
          type='primary'
          onClick={handleQuery}
          loading={loading}
          icon={<IconRefresh />}
        >
          {t('查询')}
        </Button>
        <span className='text-xs text-gray-400'>
          {t('默认查询今天及昨天的数据')}
        </span>
      </div>

      <OverviewCards data={data} loading={loading} />

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
        <RankingTable
          title={t('模型排行')}
          data={data?.model_rank}
          loading={loading}
          nameLabel={t('模型')}
          valueLabel={t('使用量')}
          isQuota={true}
        />
        <RankingTable
          title={t('渠道排行')}
          data={data?.channel_rank}
          loading={loading}
          nameLabel={t('渠道')}
          valueLabel={t('使用量')}
          isQuota={true}
        />
        <RankingTable
          title={t('用户排行')}
          data={data?.user_rank}
          loading={loading}
          nameLabel={t('用户')}
          valueLabel={t('使用量')}
          isQuota={true}
        />
        <RankingTable
          title={t('错误模型排行')}
          data={data?.error_model_rank}
          loading={loading}
          valueKey='count'
          nameLabel={t('模型')}
          valueLabel={t('错误次数')}
          isQuota={false}
        />
      </div>
    </div>
  );
}
