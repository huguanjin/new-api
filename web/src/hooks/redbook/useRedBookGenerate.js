import { useState, useCallback } from 'react';
import { getServerAddress } from '../../helpers/token';

export function useRedBookGenerate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generate outline for Xiaohongshu pages via chat completions
   */
  const generateOutline = useCallback(
    async ({ topic, pageCount, textModel, textTokenKey }) => {
      setLoading(true);
      setError(null);

      try {
        const systemPrompt = `你是一个专业的小红书内容创作助手。请根据用户提供的主题，生成${pageCount}页小红书图文内容的大纲。
第1页是封面，其余为内容页。

请严格按以下JSON格式输出(不要输出其他内容):
{
  "title": "封面标题",
  "pages": [
    {
      "pageIndex": 0,
      "pageType": "cover",
      "title": "封面标题",
      "content": "封面副标题或简短描述",
      "imagePrompt": "用于生成封面图片的英文提示词，描述画面内容、风格、色调"
    },
    {
      "pageIndex": 1,
      "pageType": "content",
      "title": "第1页标题",
      "content": "该页的详细文字内容(50-150字)",
      "imagePrompt": "用于生成该页配图的英文提示词"
    }
  ]
}`;

        const serverAddress = getServerAddress();
        const response = await fetch(
          `${serverAddress}/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${textTokenKey}`,
            },
            body: JSON.stringify({
              model: textModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `主题：${topic}` },
              ],
              temperature: 0.8,
            }),
          },
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          const errMsg =
            errData?.error?.message || `Request failed: ${response.status}`;
          throw new Error(errMsg);
        }

        const data = await response.json();
        const content =
          data.choices?.[0]?.message?.content || '';

        // Extract JSON from response (handle markdown code block wrapping)
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }

        const outline = JSON.parse(jsonStr);
        return outline;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Generate a single image via Gemini-style generateContent API
   */
  const generateImage = useCallback(
    async ({ prompt, imageModel, imageTokenKey }) => {
      setLoading(true);
      setError(null);

      try {
        const body = {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE'],
          },
        };

        const serverAddress = getServerAddress();
        const url = `${serverAddress}/v1beta/models/${imageModel}:generateContent`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${imageTokenKey}`,
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

        // Extract first image from response
        if (data.candidates && data.candidates.length > 0) {
          const candidate = data.candidates[0];
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              const inlineData = part.inlineData || part.inline_data;
              if (inlineData) {
                return {
                  mimeType: inlineData.mimeType || inlineData.mime_type,
                  base64: inlineData.data,
                };
              }
            }
          }
        }

        throw new Error('No image in response');
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
    setError(null);
  }, []);

  return { generateOutline, generateImage, loading, error, reset };
}
