import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import CardPro from '../../common/ui/CardPro';
import ExportTaskTable from './ExportTaskTable';
import CreateExportTaskModal from './CreateExportTaskModal';
import { useExportTasksData } from '../../../hooks/export-tasks/useExportTasksData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const ExportTasksPage = () => {
  const data = useExportTasksData();
  const isMobile = useIsMobile();

  return (
    <>
      <CreateExportTaskModal {...data} />
      <CardPro
        type='type1'
        actionsArea={
          <div className='flex items-center gap-2'>
            <Button
              icon={<IconPlus />}
              theme='solid'
              type='primary'
              onClick={() => data.setCreateModalVisible(true)}
            >
              {data.t('创建导出任务')}
            </Button>
            <Button onClick={data.refresh}>{data.t('刷新')}</Button>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: data.activePage,
          pageSize: data.pageSize,
          total: data.taskCount,
          onPageChange: data.handlePageChange,
          onPageSizeChange: data.handlePageSizeChange,
          isMobile: isMobile,
          t: data.t,
        })}
        t={data.t}
      >
        <ExportTaskTable {...data} />
      </CardPro>
    </>
  );
};

export default ExportTasksPage;
