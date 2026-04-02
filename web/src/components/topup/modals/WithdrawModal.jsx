import React, { useState } from 'react';
import { Modal, Typography, Input, InputNumber, Button } from '@douyinfe/semi-ui';
import { Banknote } from 'lucide-react';

const { Text } = Typography;

const WithdrawModal = ({
  t,
  visible,
  onOk,
  onCancel,
  commissionBalance,
  confirmLoading,
}) => {
  const [amount, setAmount] = useState('');
  const [alipayAccount, setAlipayAccount] = useState('');
  const [alipayName, setAlipayName] = useState('');

  const handleOk = () => {
    onOk({
      amount: parseFloat(amount) || 0,
      alipay_account: alipayAccount,
      alipay_name: alipayName,
    });
  };

  const handleCancel = () => {
    setAmount('');
    setAlipayAccount('');
    setAlipayName('');
    onCancel();
  };

  const fillAll = () => {
    setAmount(commissionBalance);
  };

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <Banknote className='mr-2' size={18} />
          {t('请输入要提现的金额')}
        </div>
      }
      visible={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      maskClosable={false}
      centered
      okText={t('确定')}
      cancelText={t('取消')}
      confirmLoading={confirmLoading}
    >
      <div className='space-y-4'>
        <div>
          <Text strong className='block mb-2'>
            {t('可提现金额')}
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
            {t('提现金额（元）')}
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
                {t('全部提现')}
              </Button>
            }
          />
        </div>
        <div>
          <Text strong className='block mb-2'>
            {t('支付宝账号')}
          </Text>
          <Input
            value={alipayAccount}
            onChange={(value) => setAlipayAccount(value)}
            placeholder={t('请输入支付宝账号')}
            className='!rounded-lg'
          />
        </div>
        <div>
          <Text strong className='block mb-2'>
            {t('支付宝实名')}
          </Text>
          <Input
            value={alipayName}
            onChange={(value) => setAlipayName(value)}
            placeholder={t('请输入支付宝实名')}
            className='!rounded-lg'
          />
        </div>
      </div>
    </Modal>
  );
};

export default WithdrawModal;
