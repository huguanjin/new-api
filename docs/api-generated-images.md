# 生成图片缓存与下载 API 文档

> **认证方式**: `Authorization: Bearer {your_api_key}`（网关令牌）  
> **基础地址**: `https://your-domain.com`（你的 new-api 网关地址）  
> **Content-Type**: `application/json`  
> **最后更新**: 2026-06-16

当用户通过 Gemini 或 GPT 等模型调用图片生成接口时，网关会自动将返回的 base64 图片存储一份到服务器，**有效期 24 小时**。用户可在有效期内通过本文档所述接口查询和下载已生成的图片。

---

## 目录

- [1. 功能说明](#1-功能说明)
- [2. 接口总览](#2-接口总览)
- [3. 查询生成图片列表](#3-查询生成图片列表)
- [4. 下载生成图片文件](#4-下载生成图片文件)
- [5. 数据结构](#5-数据结构)
- [6. 错误处理](#6-错误处理)
- [7. 使用场景与示例](#7-使用场景与示例)

---

## 1. 功能说明

| 特性 | 说明 |
|---|---|
| **自动存储** | 调用图片生成接口（`/v1/images/generations`、`/v1/images/edits`）时，返回的 base64 图片会异步存储到服务器 |
| **支持的上游** | Gemini Imagen 系列、OpenAI GPT Image 系列（所有以 `b64_json` 格式返回的图片） |
| **有效期** | 24 小时，过期后自动删除文件和数据库记录 |
| **关联方式** | 通过 `request_id` 关联到日志记录，可从日志页面跳转查看 |
| **权限隔离** | 用户只能查看和下载自己生成的图片 |
| **对原有接口无影响** | 图片生成的 API 响应格式不变，仍然返回 base64 数据 |

> **注意**：仅当上游返回 `b64_json` 格式的图片时才会存储。如果响应中使用 `url` 格式返回，则不会缓存。

---

## 2. 接口总览

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/generated-images/` | GET | 查询生成图片列表（支持分页和按 request_id 筛选） |
| `/api/generated-images/:id/file` | GET | 下载指定图片文件 |

所有接口均需要用户认证（`Authorization: Bearer {token}`）。

---

## 3. 查询生成图片列表

### 接口

```
GET /api/generated-images/
```

### 请求头

```http
Authorization: Bearer {your_api_key}
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `request_id` | string | 否 | 按请求 ID 筛选，返回该次请求生成的所有图片。与日志记录中的 `request_id` 对应 |
| `page` | integer | 否 | 页码，默认 `1`（仅在不指定 `request_id` 时生效） |
| `page_size` | integer | 否 | 每页数量，默认 `20`，最大 `100`（仅在不指定 `request_id` 时生效） |

### 响应示例

#### 按 request_id 查询

```
GET /api/generated-images/?request_id=req-abc123def456
```

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "user_id": 1,
      "request_id": "req-abc123def456",
      "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
      "mime_type": "image/png",
      "model": "gpt-image-2",
      "prompt": "一只可爱的橘猫坐在窗台上看夕阳",
      "image_index": 0,
      "file_size": 1048576,
      "created_at": 1750089600,
      "expires_at": 1750176000
    }
  ]
}
```

#### 分页查询

```
GET /api/generated-images/?page=1&page_size=10
```

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "user_id": 1,
      "request_id": "req-abc123def456",
      "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
      "mime_type": "image/png",
      "model": "gpt-image-2",
      "prompt": "一只可爱的橘猫坐在窗台上看夕阳",
      "image_index": 0,
      "file_size": 1048576,
      "created_at": 1750089600,
      "expires_at": 1750176000
    }
  ],
  "total": 56,
  "page": 1,
  "page_size": 10
}
```

---

## 4. 下载生成图片文件

### 接口

```
GET /api/generated-images/:id/file
```

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | integer | 是 | 图片记录 ID（从列表接口获取） |

### 请求头

```http
Authorization: Bearer {your_api_key}
```

### 成功响应

- **状态码**: `200 OK`
- **Content-Type**: 图片对应的 MIME 类型（如 `image/png`）
- **Cache-Control**: `private, max-age=3600`
- **Body**: 图片二进制数据

可直接在浏览器中访问或使用下载工具保存。

### 错误响应

| HTTP 状态码 | 场景 | 响应体 |
|---|---|---|
| `400` | 图片 ID 格式无效 | `{"success": false, "message": "invalid image id"}` |
| `404` | 图片不存在或非当前用户所有 | `{"success": false, "message": "image not found"}` |
| `410` | 图片已过期（超过 24 小时） | `{"success": false, "message": "image has expired"}` |

---

## 5. 数据结构

### GeneratedImage 对象

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | integer | 图片记录唯一 ID |
| `user_id` | integer | 所属用户 ID |
| `request_id` | string | 关联的 API 请求 ID，与日志中的 `request_id` 一致 |
| `filename` | string | 服务器存储的文件名（UUID 格式） |
| `mime_type` | string | 图片 MIME 类型，如 `image/png`、`image/jpeg`、`image/webp` |
| `model` | string | 生成图片使用的模型名称 |
| `prompt` | string | 生成时的提示词（如可获取） |
| `image_index` | integer | 同一请求中的图片序号（从 0 开始，当 `n > 1` 时用于区分多张图片） |
| `file_size` | integer | 文件大小（字节） |
| `created_at` | integer | 创建时间（Unix 时间戳，秒） |
| `expires_at` | integer | 过期时间（Unix 时间戳，秒），过期后自动删除 |

---

## 6. 错误处理

### 通用错误格式

```json
{
  "success": false,
  "message": "错误描述"
}
```

### 错误码汇总

| HTTP 状态码 | 错误场景 | 说明 |
|---|---|---|
| `400` | 参数错误 | 图片 ID 格式不正确 |
| `401` | 认证失败 | API Key 无效或已过期 |
| `403` | 权限拒绝 | 路径校验未通过 |
| `404` | 图片不存在 | 图片记录不存在或不属于当前用户 |
| `410` | 图片已过期 | 图片已超过 24 小时有效期，已被自动清理 |
| `500` | 服务器错误 | 内部错误，请稍后重试 |

---

## 7. 使用场景与示例

### 场景一：从日志页面查看生成的图片

前端在展示日志详情时，可通过日志记录中的 `request_id` 调用接口获取关联图片：

```javascript
const response = await fetch('/api/generated-images/?request_id=' + log.request_id, {
  headers: { 'Authorization': 'Bearer ' + apiKey }
});
const result = await response.json();
// result.data 即为该次请求生成的所有图片记录
// 通过 /api/generated-images/{id}/file 下载每张图片
```

### 场景二：Python 批量下载图片

```python
import requests

API_KEY = "sk-your-api-key"
BASE_URL = "https://your-domain.com"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

# 1. 查询某次请求的所有生成图片
resp = requests.get(
    f"{BASE_URL}/api/generated-images/",
    params={"request_id": "req-abc123def456"},
    headers=HEADERS,
)
images = resp.json()["data"]

# 2. 逐张下载
for img in images:
    file_resp = requests.get(
        f"{BASE_URL}/api/generated-images/{img['id']}/file",
        headers=HEADERS,
    )
    filename = f"image_{img['image_index']}.png"
    with open(filename, "wb") as f:
        f.write(file_resp.content)
    print(f"已下载: {filename} ({img['file_size']} bytes)")
```

### 场景三：curl 下载单张图片

```bash
# 查询图片列表
curl -s "https://your-domain.com/api/generated-images/?page=1&page_size=5" \
  -H "Authorization: Bearer sk-your-api-key" | python3 -m json.tool

# 下载指定 ID 的图片
curl -o downloaded.png \
  "https://your-domain.com/api/generated-images/42/file" \
  -H "Authorization: Bearer sk-your-api-key"
```

### 场景四：分页浏览所有历史生成图片

```javascript
async function loadGeneratedImages(page = 1) {
  const resp = await fetch(
    `/api/generated-images/?page=${page}&page_size=20`,
    { headers: { 'Authorization': 'Bearer ' + apiKey } }
  );
  const result = await resp.json();
  console.log(`第 ${result.page} 页，共 ${result.total} 条记录`);
  for (const img of result.data) {
    console.log(`[${img.model}] ${img.prompt || '(无提示词)'} - ${img.mime_type} - ${img.file_size} bytes`);
    // 图片下载地址: /api/generated-images/${img.id}/file
  }
}
```
