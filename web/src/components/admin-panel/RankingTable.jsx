import React from 'react';
import { Card, Skeleton } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { renderQuota } from '../../helpers';

const medalColors = ['#f59e0b', '#9ca3af', '#cd7f32'];

function RankBadge({ index }) {
  if (index < 3) {
    return (
      <span
        className='inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold'
        style={{ backgroundColor: medalColors[index] }}
      >
        {index + 1}
      </span>
    );
  }
  return (
    <span className='inline-flex items-center justify-center w-6 h-6 text-gray-400 text-sm'>
      {index + 1}
    </span>
  );
}

export default function RankingTable({
  title,
  data,
  loading,
  valueKey = 'quota',
  nameKey = 'name',
  isQuota = true,
  nameLabel,
  valueLabel,
}) {
  const { t } = useTranslation();

  const displayNameLabel = nameLabel || title.replace(t('排行'), '');
  const displayValueLabel = valueLabel || (isQuota ? t('使用量') : t('错误次数'));

  return (
    <Card
      title={<span className='font-bold'>{title}</span>}
      bodyStyle={{ padding: 0 }}
    >
      {loading || !data ? (
        <div className='p-4'>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton.Paragraph key={i} rows={1} style={{ marginBottom: 8 }} />
          ))}
        </div>
      ) : (
        <div>
          <div className='flex items-center px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium border-b'>
            <div className='w-10 text-center'>#</div>
            <div className='flex-1'>{displayNameLabel}</div>
            <div className='w-24 text-right'>{displayValueLabel}</div>
          </div>
          {data.length === 0 ? (
            <div className='text-center text-gray-400 py-8 text-sm'>
              {t('暂无数据')}
            </div>
          ) : (
            data.map((item, index) => (
              <div
                key={item[nameKey] || index}
                className='flex items-center px-4 py-2.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors'
              >
                <div className='w-10 flex justify-center'>
                  <RankBadge index={index} />
                </div>
                <div className='flex-1 text-sm truncate' title={item[nameKey]}>
                  {item[nameKey]}
                </div>
                <div className='w-24 text-right text-sm font-medium'>
                  {isQuota ? renderQuota(item[valueKey], 2) : item[valueKey].toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
