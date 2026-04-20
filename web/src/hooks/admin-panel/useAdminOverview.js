import { useState, useCallback } from 'react';
import { API, showError } from '../../helpers';

export const useAdminOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (date) => {
    setLoading(true);
    try {
      const params = {};
      if (date) {
        params.date = date;
      }
      const res = await API.get('/api/data/admin/overview', { params });
      const { success, message, data: respData } = res.data;
      if (success) {
        setData(respData);
      } else {
        showError(message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    loading,
    fetchData,
  };
};
