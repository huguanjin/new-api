import { useState, useEffect, useCallback, useRef } from 'react';
import { API } from '../../helpers/api';

export function useRedBookGallery() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [blobUrls, setBlobUrls] = useState({});
  const blobUrlsRef = useRef({});

  // Revoke all blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(blobUrlsRef.current).forEach((url) =>
        URL.revokeObjectURL(url),
      );
    };
  }, []);

  const fetchImageBlob = useCallback(async (id) => {
    if (blobUrlsRef.current[id]) return blobUrlsRef.current[id];
    try {
      const res = await API.get(`/api/redbook/images/${id}/file`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      blobUrlsRef.current[id] = url;
      setBlobUrls((prev) => ({ ...prev, [id]: url }));
      return url;
    } catch (err) {
      console.error('Failed to fetch image blob:', err);
      return '';
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/redbook/projects');
      if (res.data.success) {
        const list = res.data.data || [];
        setProjects(list);
      }
    } catch (err) {
      console.error('Failed to fetch redbook projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjectImages = useCallback(
    async (projectId) => {
      try {
        const res = await API.get(`/api/redbook/images?project_id=${projectId}`);
        if (res.data.success) {
          const images = res.data.data || [];
          // Preload blob URLs
          images.forEach((img) => fetchImageBlob(img.id));
          return images;
        }
        return [];
      } catch (err) {
        console.error('Failed to fetch project images:', err);
        return [];
      }
    },
    [fetchImageBlob],
  );

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const saveProject = useCallback(
    async (projectData) => {
      try {
        const res = await API.post('/api/redbook/projects', projectData);
        if (res.data.success) {
          await fetchProjects();
          return res.data.data;
        }
        throw new Error(res.data.message || 'Failed to save project');
      } catch (err) {
        throw err;
      }
    },
    [fetchProjects],
  );

  const saveImage = useCallback(
    async ({ base64Data, mimeType, prompt, model, projectId, pageIndex, pageType }) => {
      try {
        const res = await API.post('/api/redbook/images', {
          base64_data: base64Data,
          mime_type: mimeType,
          prompt,
          model,
          project_id: projectId,
          page_index: pageIndex,
          page_type: pageType,
        });
        if (res.data.success) {
          return res.data.data;
        }
        throw new Error(res.data.message || 'Failed to save image');
      } catch (err) {
        throw err;
      }
    },
    [],
  );

  const deleteProject = useCallback(
    async (id) => {
      try {
        const res = await API.delete(`/api/redbook/projects/${id}`);
        if (res.data.success) {
          setProjects((prev) => prev.filter((p) => p.id !== id));
          return true;
        }
        return false;
      } catch (err) {
        console.error('Failed to delete project:', err);
        return false;
      }
    },
    [],
  );

  const deleteImage = useCallback(
    async (id) => {
      try {
        const res = await API.delete(`/api/redbook/images/${id}`);
        if (res.data.success) {
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

  return {
    projects,
    loading,
    blobUrls,
    fetchProjects,
    fetchProjectImages,
    fetchImageBlob,
    saveProject,
    saveImage,
    deleteProject,
    deleteImage,
  };
}
