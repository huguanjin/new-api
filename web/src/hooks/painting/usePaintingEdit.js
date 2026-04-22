import { useState, useCallback } from 'react';
import { getServerAddress } from '../../helpers/token';

export function usePaintingEdit() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const edit = useCallback(async ({ prompt, model, tokenKey, imageFile, size }) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('prompt', prompt);
      formData.append('model', model);
      formData.append('n', '1');
      if (size) formData.append('size', size);

      const serverAddress = getServerAddress();
      // Do NOT set Content-Type — browser sets multipart/form-data with boundary automatically
      const response = await fetch(`${serverAddress}/v1/images/edits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const errMsg = errData?.error?.message || `Request failed: ${response.status}`;
        throw new Error(errMsg);
      }

      const data = await response.json();
      const images = (data.data || []).map((item) => ({
        mimeType: 'image/png',
        base64: item.b64_json,
      }));
      const parsedResult = { texts: [], images };
      setResult(parsedResult);
      return parsedResult;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { edit, loading, result, error, reset };
}
