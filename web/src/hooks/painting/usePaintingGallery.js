import { useState, useEffect, useCallback, useRef } from 'react';
import { API } from '../../helpers/api';

export function usePaintingGallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [blobUrls, setBlobUrls] = useState({});
  const blobUrlsRef = useRef({});

  // Revoke all blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(blobUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const fetchImageBlob = useCallback(async (id) => {
    if (blobUrlsRef.current[id]) return blobUrlsRef.current[id];
    try {
      const res = await API.get(`/api/painting/images/${id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      blobUrlsRef.current[id] = url;
      setBlobUrls((prev) => ({ ...prev, [id]: url }));
      return url;
    } catch (err) {
      console.error('Failed to fetch image blob:', err);
      return '';
    }
  }, []);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/painting/images');
      if (res.data.success) {
        const list = res.data.data || [];
        setImages(list);
        // Preload blob URLs for all images
        list.forEach((img) => fetchImageBlob(img.id));
      }
    } catch (err) {
      console.error('Failed to fetch painting gallery:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchImageBlob]);

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
          // Revoke blob URL for deleted image
          if (blobUrlsRef.current[id]) {
            URL.revokeObjectURL(blobUrlsRef.current[id]);
            delete blobUrlsRef.current[id];
            setBlobUrls((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }
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

  return { images, loading, blobUrls, fetchImages, saveImage, deleteImage, fetchImageBlob };
}
