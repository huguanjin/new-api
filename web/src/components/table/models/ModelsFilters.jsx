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

import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Form, Button, Popover, Tag, Space } from '@douyinfe/semi-ui';
import { IconSearch, IconFilter } from '@douyinfe/semi-icons';

const ModelsFilters = ({
  formInitValues,
  setFormApi,
  searchModels,
  loading,
  searching,
  t,
}) => {
  const formApiRef = useRef(null);
  const [popoverVisible, setPopoverVisible] = useState(false);

  // Count how many filter fields are actively set
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const updateFilterCount = useCallback(() => {
    if (!formApiRef.current) return;
    const values = formApiRef.current.getValues();
    let count = 0;
    if (values.hasIcon && values.hasIcon !== '') count++;
    if (values.hasDescription && values.hasDescription !== '') count++;
    if (values.hasVendor && values.hasVendor !== '') count++;
    if (values.hasTags && values.hasTags !== '') count++;
    setActiveFilterCount(count);
  }, []);

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    setActiveFilterCount(0);
    setTimeout(() => {
      searchModels();
    }, 100);
  };

  const handleFilterApply = () => {
    updateFilterCount();
    setPopoverVisible(false);
    searchModels();
  };

  const handleFilterReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.setValue('hasIcon', '');
    formApiRef.current.setValue('hasDescription', '');
    formApiRef.current.setValue('hasVendor', '');
    formApiRef.current.setValue('hasTags', '');
    setActiveFilterCount(0);
    setPopoverVisible(false);
    setTimeout(() => {
      searchModels();
    }, 100);
  };

  const filterOptions = useMemo(() => [
    { value: '', label: t('不限') },
    { value: '1', label: t('已设置') },
    { value: '0', label: t('未设置') },
  ], [t]);

  const filterPopoverContent = (
    <div style={{ padding: 12, width: 280 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: 'var(--semi-color-text-1)' }}>{t('图标')}</div>
          <Form.Select
            field='hasIcon'
            optionList={filterOptions}
            size='small'
            pure
            showClear
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: 'var(--semi-color-text-1)' }}>{t('描述')}</div>
          <Form.Select
            field='hasDescription'
            optionList={filterOptions}
            size='small'
            pure
            showClear
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: 'var(--semi-color-text-1)' }}>{t('供应商')}</div>
          <Form.Select
            field='hasVendor'
            optionList={filterOptions}
            size='small'
            pure
            showClear
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: 'var(--semi-color-text-1)' }}>{t('标签')}</div>
          <Form.Select
            field='hasTags'
            optionList={filterOptions}
            size='small'
            pure
            showClear
            style={{ width: '100%' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button size='small' type='tertiary' onClick={handleFilterReset}>
          {t('重置')}
        </Button>
        <Button size='small' theme='solid' onClick={handleFilterApply}>
          {t('应用')}
        </Button>
      </div>
    </div>
  );

  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => {
        setFormApi(api);
        formApiRef.current = api;
      }}
      onSubmit={searchModels}
      allowEmpty={true}
      autoComplete='off'
      layout='horizontal'
      trigger='change'
      stopValidateWithError={false}
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row flex-wrap items-center gap-2 w-full md:w-auto'>
        <div className='relative w-full md:w-56'>
          <Form.Input
            field='searchKeyword'
            prefix={<IconSearch />}
            placeholder={t('搜索模型名称')}
            showClear
            pure
            size='small'
          />
        </div>

        <div className='relative w-full md:w-56'>
          <Form.Input
            field='searchVendor'
            prefix={<IconSearch />}
            placeholder={t('搜索供应商')}
            showClear
            pure
            size='small'
          />
        </div>

        <Popover
          visible={popoverVisible}
          onVisibleChange={setPopoverVisible}
          content={filterPopoverContent}
          trigger='click'
          position='bottomLeft'
          showArrow
        >
          <Button
            icon={<IconFilter />}
            type='tertiary'
            size='small'
            theme={activeFilterCount > 0 ? 'solid' : 'light'}
          >
            {t('筛选')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
        </Popover>

        <div className='flex gap-2 w-full md:w-auto'>
          <Button
            type='tertiary'
            htmlType='submit'
            loading={loading || searching}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('查询')}
          </Button>

          <Button
            type='tertiary'
            onClick={handleReset}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default ModelsFilters;
