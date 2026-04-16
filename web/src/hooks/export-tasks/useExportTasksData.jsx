import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { API, isAdmin, showError, showSuccess } from '../../helpers';

export function useExportTasksData() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(
    parseInt(localStorage.getItem('page-size') || '10', 10),
  );
  const [taskCount, setTaskCount] = useState(0);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const pollingRef = useRef(null);

  const loadTasks = useCallback(
    async (page, size) => {
      setLoading(true);
      try {
        const p = page || activePage;
        const s = size || pageSize;
        const url = isAdmin()
          ? `/api/export-task/all?p=${p}&page_size=${s}`
          : `/api/export-task?p=${p}&page_size=${s}`;
        const res = await API.get(url);
        const { success, message, data } = res.data;
        if (success) {
          setTasks(data.items || []);
          setTaskCount(data.total || 0);
        } else {
          showError(message);
        }
      } catch (error) {
        showError(t('加载失败'));
      } finally {
        setLoading(false);
      }
    },
    [activePage, pageSize, t],
  );

  const refresh = useCallback(() => {
    setActivePage(1);
    loadTasks(1, pageSize);
  }, [pageSize, loadTasks]);

  const handlePageChange = useCallback(
    (page) => {
      setActivePage(page);
      loadTasks(page, pageSize);
    },
    [pageSize, loadTasks],
  );

  const handlePageSizeChange = useCallback(
    (size) => {
      setPageSize(size);
      setActivePage(1);
      localStorage.setItem('page-size', String(size));
      loadTasks(1, size);
    },
    [loadTasks],
  );

  const createTask = useCallback(
    async (values) => {
      try {
        const res = await API.post('/api/export-task', values);
        const { success, message } = res.data;
        if (success) {
          showSuccess(t('导出任务已创建'));
          setCreateModalVisible(false);
          refresh();
        } else {
          showError(message);
        }
        return success;
      } catch (error) {
        showError(t('创建失败'));
        return false;
      }
    },
    [t, refresh],
  );

  const downloadTask = useCallback(
    (taskId) => {
      const url = `/api/export-task/${taskId}/download`;
      const baseURL = import.meta.env.VITE_REACT_APP_SERVER_URL || '';
      const link = document.createElement('a');
      link.href = baseURL + url;
      link.setAttribute('download', '');
      // Add auth header via cookie (session-based) - for token auth, we open in new tab
      window.open(baseURL + url, '_blank');
    },
    [],
  );

  const deleteTask = useCallback(
    async (taskId) => {
      try {
        const res = await API.delete(`/api/export-task/${taskId}`);
        const { success, message } = res.data;
        if (success) {
          showSuccess(t('删除成功'));
          refresh();
        } else {
          showError(message);
        }
      } catch (error) {
        showError(t('删除失败'));
      }
    },
    [t, refresh],
  );

  // Initial load
  useEffect(() => {
    loadTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto polling when there are pending tasks
  useEffect(() => {
    const hasPending = tasks.some(
      (task) => task.status === 0 || task.status === 1,
    );
    if (hasPending) {
      pollingRef.current = setInterval(() => {
        loadTasks();
      }, 10000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [tasks, loadTasks]);

  return {
    t,
    tasks,
    loading,
    activePage,
    pageSize,
    taskCount,
    createModalVisible,
    setCreateModalVisible,
    handlePageChange,
    handlePageSizeChange,
    refresh,
    createTask,
    downloadTask,
    deleteTask,
  };
}
