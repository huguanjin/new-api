import React from 'react';
import { Card, Skeleton, Tag, Empty } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { IconLayers } from '@douyinfe/semi-icons';

const GroupCallStats = ({ groupCallStats, groupCallLoading, CARD_PROPS }) => {
  const { t } = useTranslation();

  if (!groupCallLoading && !groupCallStats) {
    return null;
  }

  const todayList = groupCallStats?.today || [];
  const yesterdayList = groupCallStats?.yesterday || [];

  const yesterdayMap = {};
  yesterdayList.forEach((item) => {
    yesterdayMap[item.group] = item.count;
  });

  // Merge all groups from both today and yesterday
  const allGroups = new Set([
    ...todayList.map((i) => i.group),
    ...yesterdayList.map((i) => i.group),
  ]);

  const groupData = Array.from(allGroups)
    .map((group) => {
      const todayCount =
        todayList.find((i) => i.group === group)?.count || 0;
      const yesterdayCount = yesterdayMap[group] || 0;

      let changePercent = null;
      let changeType = 'grey'; // grey = flat

      if (yesterdayCount === 0 && todayCount > 0) {
        changePercent = null; // new
        changeType = 'green';
      } else if (yesterdayCount > 0) {
        changePercent =
          (((todayCount - yesterdayCount) / yesterdayCount) * 100).toFixed(1);
        if (changePercent > 0) changeType = 'green';
        else if (changePercent < 0) changeType = 'red';
        else changeType = 'grey';
      }

      return { group, todayCount, yesterdayCount, changePercent, changeType };
    })
    .sort((a, b) => b.todayCount - a.todayCount);

  if (!groupCallLoading && groupData.length === 0) {
    return null;
  }

  const renderChangeTag = (item) => {
    if (item.yesterdayCount === 0 && item.todayCount > 0) {
      return (
        <Tag color='green' size='small' shape='circle'>
          {t('新增')}
        </Tag>
      );
    }
    if (item.changePercent === null) {
      return null;
    }
    const prefix = item.changePercent > 0 ? '+' : '';
    const color =
      item.changeType === 'green'
        ? 'green'
        : item.changeType === 'red'
          ? 'red'
          : 'grey';
    return (
      <Tag color={color} size='small' shape='circle'>
        {prefix}
        {item.changePercent}%
      </Tag>
    );
  };

  return (
    <div className='mb-4'>
      <Card
        {...CARD_PROPS}
        className='border-0 !rounded-2xl'
        title={
          <div className='flex items-center gap-2'>
            <IconLayers size='small' />
            <span>{t('分组调用统计')}</span>
          </div>
        }
      >
        <Skeleton loading={groupCallLoading} active placeholder={<Skeleton.Paragraph rows={2} />}>
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3'>
            {groupData.map((item) => (
              <div
                key={item.group}
                className='bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100'
              >
                <div className='text-xs text-gray-500 mb-1 truncate' title={item.group || 'default'}>
                  {item.group || 'default'}
                </div>
                <div className='text-xl font-bold text-gray-800 mb-2'>
                  {item.todayCount.toLocaleString()}
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-xs text-gray-400'>
                    {t('昨日')}: {item.yesterdayCount.toLocaleString()}
                  </span>
                  {renderChangeTag(item)}
                </div>
              </div>
            ))}
          </div>
        </Skeleton>
      </Card>
    </div>
  );
};

export default GroupCallStats;
