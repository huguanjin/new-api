import React, { useState } from 'react';
import { Modal, Typography, Input, InputNumber, Button } from '@douyinfe/semi-ui';
import { ArrowRightLeft } from 'lucide-react';

const { Text } = Typography;

const CommissionTransferModal = ({
  t,
  visible,
  onOk,
  onCancel,
  commissionBalance,
  confirmLoading,
  priceRatio,
  renderQuota,
  getQuotaPerUnit,
}) => {
  const [amount, setAmount] = useState('');

  const handleOk = () => {
    onOk({ amount: parseFloat(amount) || 0 });
  };

  const handleCancel = () => {
    setAmount('');
    onCancel();
  };

  const fillAll = () => {
    setAmount(commissionBalance);
  };

  // 预估可得额度：元 → 美元 → 额度
  const estimateQuota = () => {
    const val = parseFloat(amount) || 0;
    if (val <= 0 || !priceRatio || priceRatio <= 0) return 0;
    return Math.floor((val / priceRatio) * (getQuotaPerUnit ? getQuotaPerUnit() : 1));
  };

  const estimated = estimateQuota();

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <ArrowRightLeft className='mr-2' size={18} />
          {t('划转返利至余额')}
        </div>
      }
      visible={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      maskClosable={false}
      centered
      okText={t('确认划转')}
      cancelText={t('取消')}
      confirmLoading={confirmLoading}
    >
      <div className='space-y-4'>
        <div>
          <Text strong className='block mb-2'>
            {t('可划转金额')}
          </Text>
          <Input
            value={`${(commissionBalance || 0).toFixed(2)}`}
            disabled
            suffix={t('元')}
            className='!rounded-lg'
          />
        </div>
        <div>
          <Text strong className='block mb-2'>
            {t('划转金额（元）')}
          </Text>
          <InputNumber
            min={0.01}
            max={commissionBalance || 0}
            value={amount}
            onChange={(value) => setAmount(value)}
            className='w-full !rounded-lg'
            suffix={
              <Button
                type='tertiary'
                size='small'
                onClick={fillAll}
                className='!rounded-lg'
              >
                {t('全部划转')}
              </Button>
            }
          />
        </div>
        {estimated > 0 && (
          <div className='p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
            <Text type='tertiary' className='text-sm'>
              {t('预计可得额度')}：
              <Text strong className='text-blue-600'>
                {renderQuota ? renderQuota(estimated) : estimated}
              </Text>
            </Text>
          </div>
        )}
        <div className='p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg'>
          <Text type='tertiary' className='text-xs'>
            {t('划转后返利金额将转换为账户额度，此操作不可撤销')}
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default CommissionTransferModal;
