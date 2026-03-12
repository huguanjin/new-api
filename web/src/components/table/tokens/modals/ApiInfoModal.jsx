import React from 'react';
import { Modal, Avatar, Tag, Divider, Empty, Typography } from '@douyinfe/semi-ui';
import { Copy, ExternalLink } from 'lucide-react';
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';

const { Text } = Typography;

const ApiInfoModal = ({ visible, onCancel, apiInfoData, copyText, t }) => {
  const handleCopyUrl = async (url) => {
    await copyText(url);
  };

  return (
    <Modal
      title={t('查看API地址')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={520}
    >
      {apiInfoData && apiInfoData.length > 0 ? (
        apiInfoData.map((api, index) => (
          <React.Fragment key={api.id || index}>
            <div className='flex p-3 hover:bg-gray-50 rounded-lg transition-colors'>
              <div className='flex-shrink-0 mr-3'>
                <Avatar size='small' color={api.color}>
                  {api.route?.substring(0, 2)}
                </Avatar>
              </div>
              <div className='flex-1'>
                <div className='flex flex-wrap items-center justify-between mb-1 w-full gap-2'>
                  <span className='text-sm font-medium text-gray-900 font-bold'>
                    {api.route}
                  </span>
                  <div className='flex items-center gap-1'>
                    <Tag
                      prefixIcon={<Copy size={12} />}
                      size='small'
                      color='blue'
                      shape='circle'
                      onClick={() => handleCopyUrl(api.url)}
                      className='cursor-pointer hover:opacity-80 text-xs'
                    >
                      {t('复制')}
                    </Tag>
                    <Tag
                      prefixIcon={<ExternalLink size={12} />}
                      size='small'
                      color='white'
                      shape='circle'
                      onClick={() =>
                        window.open(api.url, '_blank', 'noopener,noreferrer')
                      }
                      className='cursor-pointer hover:opacity-80 text-xs'
                    >
                      {t('跳转')}
                    </Tag>
                  </div>
                </div>
                <div
                  className='text-blue-500 break-all cursor-pointer hover:underline mb-1'
                  onClick={() => handleCopyUrl(api.url)}
                >
                  {api.url}
                </div>
                {api.description && (
                  <Text type='tertiary' size='small'>
                    {api.description}
                  </Text>
                )}
              </div>
            </div>
            {index < apiInfoData.length - 1 && <Divider margin='4px' />}
          </React.Fragment>
        ))
      ) : (
        <Empty
          image={<IllustrationConstruction style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationConstructionDark style={{ width: 150, height: 150 }} />
          }
          title={t('暂无API信息')}
          description={t('请联系管理员在系统设置中配置API信息')}
        />
      )}
    </Modal>
  );
};

export default ApiInfoModal;
