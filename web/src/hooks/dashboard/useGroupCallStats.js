import { useState, useCallback } from 'react';
import { API, showError } from '../../helpers';

export const useGroupCallStats = (isAdminUser) => {
  const [groupCallStats, setGroupCallStats] = useState(null);
  const [groupCallLoading, setGroupCallLoading] = useState(false);

  const loadGroupCallStats = useCallback(async () => {
    setGroupCallLoading(true);
    try {
      const url = isAdminUser
        ? '/api/log/stat/group'
        : '/api/log/self/stat/group';
      const res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        setGroupCallStats(data);
      } else {
        showError(message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGroupCallLoading(false);
    }
  }, [isAdminUser]);

  return {
    groupCallStats,
    groupCallLoading,
    loadGroupCallStats,
  };
};
