import { useState, useCallback, useRef, useEffect } from 'react';
import { getServerAddress } from '../../helpers/token';

const POLL_INTERVAL = 5000;
const MAX_POLL_COUNT = 360; // 30 minutes max

export function useVideoGenerate() {
  const [loading, setLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState(null); // null | { id, status, progress, video_url, error }
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollTask = useCallback((taskId, tokenKey) => {
    stopPolling();
    pollCountRef.current = 0;

    const serverAddress = getServerAddress();

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > MAX_POLL_COUNT) {
        stopPolling();
        setError('Polling timed out');
        setLoading(false);
        return;
      }

      try {
        const resp = await fetch(`${serverAddress}/v1/videos/${taskId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenKey}`,
          },
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => null);
          const errMsg = errData?.error?.message || `Poll failed: ${resp.status}`;
          stopPolling();
          setError(errMsg);
          setLoading(false);
          return;
        }

        const data = await resp.json();
        setTaskStatus(data);

        if (data.status === 'completed' || data.status === 'success') {
          stopPolling();
          setLoading(false);
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          stopPolling();
          setError(data.error?.message || 'Task failed');
          setLoading(false);
        }
      } catch (err) {
        // Don't stop on transient network errors, just log
        console.error('Poll error:', err);
      }
    }, POLL_INTERVAL);
  }, [stopPolling]);

  const submit = useCallback(
    async ({ prompt, model, tokenKey, size, seconds, aspectRatio, inputReference }) => {
      setLoading(true);
      setError(null);
      setTaskStatus(null);

      try {
        const serverAddress = getServerAddress();
        const formData = new FormData();
        formData.append('model', model);
        if (prompt) formData.append('prompt', prompt);
        if (size) formData.append('size', size);
        if (seconds) formData.append('seconds', String(seconds));
        if (aspectRatio) formData.append('aspect_ratio', aspectRatio);
        if (inputReference) {
          formData.append('input_reference', inputReference);
        }

        const resp = await fetch(`${serverAddress}/v1/videos`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenKey}`,
          },
          body: formData,
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => null);
          const errMsg = errData?.error?.message || `Request failed: ${resp.status}`;
          throw new Error(errMsg);
        }

        const data = await resp.json();
        setTaskStatus(data);

        const taskId = data.id || data.task_id;
        if (!taskId) {
          throw new Error('No task ID in response');
        }

        // Start polling if not already completed
        if (data.status !== 'completed' && data.status !== 'success') {
          pollTask(taskId, tokenKey);
        } else {
          setLoading(false);
        }

        return data;
      } catch (err) {
        setError(err.message);
        setLoading(false);
        return null;
      }
    },
    [pollTask],
  );

  const submitExtend = useCallback(
    async ({ prompt, model, tokenKey, videoPostId }) => {
      setLoading(true);
      setError(null);
      setTaskStatus(null);

      try {
        const serverAddress = getServerAddress();
        const body = { model, prompt };
        if (videoPostId) body.video_post_id = videoPostId;

        const resp = await fetch(`${serverAddress}/v1/videos/extend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => null);
          const errMsg = errData?.error?.message || `Request failed: ${resp.status}`;
          throw new Error(errMsg);
        }

        const data = await resp.json();
        setTaskStatus(data);

        const taskId = data.id || data.task_id;
        if (!taskId) {
          throw new Error('No task ID in response');
        }

        if (data.status !== 'completed' && data.status !== 'success') {
          pollTask(taskId, tokenKey);
        } else {
          setLoading(false);
        }

        return data;
      } catch (err) {
        setError(err.message);
        setLoading(false);
        return null;
      }
    },
    [pollTask],
  );

  const submitJson = useCallback(
    async ({ prompt, model, tokenKey, duration, seconds, size, image, images, metadata, endpoint }) => {
      setLoading(true);
      setError(null);
      setTaskStatus(null);

      try {
        const serverAddress = getServerAddress();
        const body = { model, prompt };
        if (duration != null) body.duration = duration;
        if (seconds != null) body.seconds = String(seconds);
        if (size) body.size = size;
        if (image) body.image = image;
        if (images && images.length > 0) body.images = images;
        if (metadata && Object.keys(metadata).length > 0) body.metadata = metadata;

        const resp = await fetch(`${serverAddress}${endpoint || '/v1/video/generations'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => null);
          const errMsg = errData?.error?.message || `Request failed: ${resp.status}`;
          throw new Error(errMsg);
        }

        const data = await resp.json();
        setTaskStatus(data);

        const taskId = data.id || data.task_id;
        if (!taskId) {
          throw new Error('No task ID in response');
        }

        if (data.status !== 'completed' && data.status !== 'success') {
          pollTask(taskId, tokenKey);
        } else {
          setLoading(false);
        }

        return data;
      } catch (err) {
        setError(err.message);
        setLoading(false);
        return null;
      }
    },
    [pollTask],
  );

  const reset = useCallback(() => {
    stopPolling();
    setLoading(false);
    setTaskStatus(null);
    setError(null);
  }, [stopPolling]);

  return { submit, submitExtend, submitJson, loading, taskStatus, error, reset };
}
