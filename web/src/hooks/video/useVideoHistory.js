import { useState, useCallback, useEffect } from 'react';
import { API } from '../../helpers/api';

// All channel types that have video task adaptors
// Mirrors relay/relay_adaptor.go GetTaskAdaptor switch cases
const VIDEO_PLATFORMS = [
  17, // Ali
  24, // Gemini
  35, // MiniMax (Hailuo)
  41, // VertexAI
  45, // VolcEngine
  48, // xAI (Grok)
  50, // Kling
  51, // Jimeng
  52, // Vidu
  54, // DoubaoVideo
  55, // Sora
  58, // HUBAGI
  59, // Seedance
];

export function useVideoHistory(pageSize = 12) {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(
    async (p = page) => {
      setLoading(true);
      try {
        const platformsStr = VIDEO_PLATFORMS.join(',');
        const res = await API.get(
          `/api/task/self?p=${p}&size=${pageSize}&platforms=${platformsStr}`,
        );
        if (res.data.success) {
          const data = res.data.data;
          setTasks(data.items || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch video history:', err);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize],
  );

  useEffect(() => {
    fetchTasks(page);
  }, [page, fetchTasks]);

  const refresh = useCallback(() => {
    fetchTasks(page);
  }, [fetchTasks, page]);

  return { tasks, total, page, setPage, loading, refresh, pageSize };
}
