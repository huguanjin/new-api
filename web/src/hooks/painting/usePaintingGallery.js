import { useState, useEffect, useCallback } from 'react';
import { API } from '../../helpers/api';

export function usePaintingGallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/painting/images');
      if (res.data.success) {
        setImages(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch painting gallery:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const saveImage = useCallback(
    async ({ base64Data, mimeType, prompt, model, aspectRatio, imageSize, referenceCount }) => {
      try {
        const res = await API.post('/api/painting/images', {
          base64_data: base64Data,
          mime_type: mimeType,
          prompt,
          model,
          aspect_ratio: aspectRatio,
          image_size: imageSize,
          reference_count: referenceCount || 0,
        });
        if (res.data.success) {
          // Refresh gallery
          await fetchImages();
          return res.data.data;
        }
        throw new Error(res.data.message || 'Failed to save image');
      } catch (err) {
        throw err;
      }
    },
    [fetchImages],
  );

  const deleteImage = useCallback(
    async (id) => {
      try {
        const res = await API.delete(`/api/painting/images/${id}`);
        if (res.data.success) {
          setImages((prev) => prev.filter((img) => img.id !== id));
          return true;
        }
        return false;
      } catch (err) {
        console.error('Failed to delete image:', err);
        return false;
      }
    },
    [],
  );

  const getImageUrl = useCallback((id) => {
    return `/api/painting/images/${id}/file`;
  }, []);

  return { images, loading, fetchImages, saveImage, deleteImage, getImageUrl };
}
