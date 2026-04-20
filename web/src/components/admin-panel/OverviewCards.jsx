import React from 'react';
import { Card, Skeleton, Tag } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { renderQuota } from '../../helpers';

function calcChangePercent(today, yesterday) {
  if (yesterday === 0) {
    return today > 0 ? null : 0;
  }
  return ((today - yesterday) / yesterday) * 100;
}

function getCurrencySymbol() {
  const quotaDisplayType = localStorage.getItem('quota_display_type') || 'USD';
  if (quotaDisplayType === 'TOKENS') return '';
  if (quotaDisplayType === 'CNY') return '¥';
  if (quotaDisplayType === 'CUSTOM') {
    try {
      const statusStr = localStorage.getItem('status');
      if (statusStr) {
        const s = JSON.parse(statusStr);
        return s?.custom_currency_symbol || '¤';
      }
    } catch (e) {}
    return '¤';
  }
  return '$';
}

function formatMoney(value) {
  const symbol = getCurrencySymbol();
  return symbol + value.toFixed(2);
}

function PercentTag({ today, yesterday, yesterdayLabel, t }) {
  const percent = calcChangePercent(today, yesterday);

  if (yesterday === 0 && today > 0) {
    return <Tag color='blue' size='small'>{t('新增')}</Tag>;
  }
  if (percent === null || percent === 0) {
    return (
      <span className='text-xs text-gray-400'>
        {t('昨日')}: {yesterdayLabel}
      </span>
    );
  }
  const isUp = percent > 0;
  return (
    <span className='text-xs'>
      <span className='text-gray-400'>{t('昨日')}: {yesterdayLabel} </span>
      <Tag color={isUp ? 'green' : 'red'} size='small' type='light'>
        {isUp ? '+' : ''}{percent.toFixed(2)}%
      </Tag>
    </span>
  );
}

export default function OverviewCards({ data, loading }) {
  const { t } = useTranslation();

  if (loading || !data) {
    return (
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <Skeleton.Title style={{ width: 80, marginBottom: 12 }} />
            <Skeleton.Title style={{ width: 120, height: 32 }} />
            <Skeleton.Paragraph rows={1} style={{ marginTop: 8 }} />
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: t('今日充值'),
      value: formatMoney(data.today_topup_money),
      yesterdayLabel: formatMoney(data.yesterday_topup_money),
      today: data.today_topup_money,
      yesterday: data.yesterday_topup_money,
      color: '#f59e0b',
    },
    {
      title: t('今日消费'),
      value: renderQuota(data.today_consume_quota, 2),
      yesterdayLabel: renderQuota(data.yesterday_consume_quota, 2),
      today: data.today_consume_quota,
      yesterday: data.yesterday_consume_quota,
      color: '#3b82f6',
    },
    {
      title: t('今日注册'),
      value: data.today_register_count,
      yesterdayLabel: String(data.yesterday_register_count),
      today: data.today_register_count,
      yesterday: data.yesterday_register_count,
      color: '#10b981',
    },
  ];

  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
      {cards.map((card) => (
        <Card
          key={card.title}
          style={{ borderTop: `3px solid ${card.color}` }}
          bodyStyle={{ padding: '20px 24px' }}
        >
          <div className='text-sm text-gray-500 mb-2'>{card.title}</div>
          <div className='text-2xl font-bold mb-2' style={{ color: card.color }}>
            {card.value}
          </div>
          <div>
            <PercentTag
              today={card.today}
              yesterday={card.yesterday}
              yesterdayLabel={card.yesterdayLabel}
              t={t}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
