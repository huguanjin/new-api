import { useState, useCallback } from 'react';
import { getServerAddress } from '../../helpers/token';

export function usePaintingGenerate() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const generate = useCallback(
    async ({ prompt, model, tokenKey, aspectRatio, imageSize, referenceImages }) => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const parts = [];

        // Add text prompt
        if (prompt) {
          parts.push({ text: prompt });
        }

        // Add reference images as inline_data
        if (referenceImages && referenceImages.length > 0) {
          for (const img of referenceImages) {
            parts.push({
              inline_data: {
                mime_type: img.mimeType,
                data: img.base64,
              },
            });
          }
        }

        const body = {
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {},
          },
        };

        if (aspectRatio) {
          body.generationConfig.imageConfig.aspectRatio = aspectRatio;
        }
        if (imageSize) {
          body.generationConfig.imageConfig.imageSize = imageSize;
        }

        const serverAddress = getServerAddress();
        const url = `${serverAddress}/v1beta/models/${model}:generateContent`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          const errMsg =
            errData?.error?.message || `Request failed: ${response.status}`;
          throw new Error(errMsg);
        }

        const data = await response.json();

        // Parse response to extract text and images
        const texts = [];
        const images = [];

        if (data.candidates && data.candidates.length > 0) {
          const candidate = data.candidates[0];
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.text) {
                texts.push(part.text);
              }
              if (part.inlineData || part.inline_data) {
                const inlineData = part.inlineData || part.inline_data;
                images.push({
                  mimeType: inlineData.mimeType || inlineData.mime_type,
                  base64: inlineData.data,
                });
              }
            }
          }
        }

        const parsedResult = { texts, images };
        setResult(parsedResult);
        return parsedResult;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { generate, loading, result, error, reset };
}
