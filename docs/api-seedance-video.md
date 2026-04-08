# Seedance 2.0 视频生成 API 对接文档

> **认证方式**: `Authorization: Bearer {your_api_key}`（new-api 令牌）  
> **基础地址**: `https://your-domain.com`（你的 new-api 网关地址）  
> **Content-Type**: `application/json`  
> **最后更新**: 2026-04-08

本文档描述通过 new-api 网关调用 Seedance 2.0 视频生成服务的接口。客户端统一使用网关端点，无需关心上游供应商的具体 URL。

---

## 目录

- [1. 模型列表](#1-模型列表)
- [2. 接口总览](#2-接口总览)
- [3. 创建视频生成任务](#3-创建视频生成任务)
- [4. 查询视频生成任务](#4-查询视频生成任务)
- [5. 下载视频](#5-下载视频)
- [6. 素材管理](#6-素材管理)
  - [6.1 上传素材](#61-上传素材)
  - [6.2 查询素材](#62-查询素材)
- [7. 任务状态说明](#7-任务状态说明)
- [8. 计费说明](#8-计费说明)
- [9. 对接流程](#9-对接流程)
- [10. 代码示例](#10-代码示例)
- [11. 常见错误](#11-常见错误)

---

## 1. 模型列表

| 模型名称 | 说明 |
|----------|------|
| `doubao-seedance-2-0-260128` | Seedance 2.0 标准版 |
| `doubao-seedance-2-0-fast-260128` | Seedance 2.0 快速版 |

---

## 2. 接口总览

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/v1/videos` | 创建视频生成任务 |
| GET | `/v1/videos/{task_id}` | 查询任务状态与结果 |
| GET | `/v1/videos/{task_id}/content` | 代理下载视频文件 |
| POST | `/api/asset/createMedia` | 上传素材（图生视频场景） |
| GET | `/api/asset/get?id={asset_id}` | 查询素材信息 |

---

## 3. 创建视频生成任务

### Endpoint

```
POST /v1/videos
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | ✅ | 模型名称，见 [模型列表](#1-模型列表) |
| `prompt` | string | ✅ | 视频生成提示词 |
| `image` | string | ❌ | 参考图片 URL 或 Base64（图生视频时使用） |
| `duration` | number | ❌ | 视频时长（秒），如 `5`、`10` |
| `width` | int | ❌ | 视频宽度（像素） |
| `height` | int | ❌ | 视频高度（像素） |
| `fps` | int | ❌ | 帧率 |
| `seed` | int | ❌ | 随机种子，用于复现结果 |
| `n` | int | ❌ | 生成数量，默认 1 |
| `metadata` | object | ❌ | 扩展参数，透传至上游 |

> **提示：** 请求体中的所有参数会透传到上游服务，上游支持的额外参数均可直接放入请求体。

### 请求示例

**文生视频：**

```bash
curl -X POST https://your-domain.com/v1/videos \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "一只金色的猫咪在阳光下慵懒地伸懒腰",
    "duration": 5
  }'
```

**图生视频：**

```bash
curl -X POST https://your-domain.com/v1/videos \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "让画面中的女孩转头微笑",
    "image": "https://example.com/photo.jpg",
    "duration": 5
  }'
```

### 响应示例

```json
{
  "id": "video_xxxxxxxxxxxxxx",
  "task_id": "video_xxxxxxxxxxxxxx",
  "object": "video",
  "status": "queued",
  "model": "doubao-seedance-2-0-260128",
  "created_at": 1712567890
}
```

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务 ID（网关分配） |
| `task_id` | string | 同 `id` |
| `status` | string | 初始状态，通常为 `queued` |
| `model` | string | 使用的模型 |
| `created_at` | int | 创建时间（Unix 时间戳） |

---

## 4. 查询视频生成任务

### Endpoint

```
GET /v1/videos/{task_id}
```

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `task_id` | string | 创建任务时返回的任务 ID |

### 请求示例

```bash
curl -X GET https://your-domain.com/v1/videos/video_xxxxxxxxxxxxxx \
  -H "Authorization: Bearer sk-your-api-key"
```

### 响应示例（进行中）

```json
{
  "id": "video_xxxxxxxxxxxxxx",
  "task_id": "video_xxxxxxxxxxxxxx",
  "object": "video",
  "status": "in_progress",
  "progress": "45%",
  "model": "doubao-seedance-2-0-260128",
  "created_at": 1712567890
}
```

### 响应示例（成功）

```json
{
  "id": "video_xxxxxxxxxxxxxx",
  "task_id": "video_xxxxxxxxxxxxxx",
  "object": "video",
  "status": "succeeded",
  "progress": "100%",
  "model": "doubao-seedance-2-0-260128",
  "created_at": 1712567890,
  "completed_at": 1712568200,
  "seconds": "5",
  "size": "1920x1080",
  "metadata": {
    "url": "https://upstream-cdn.example.com/videos/xxxxx.mp4",
    "video_url": "https://upstream-cdn.example.com/videos/xxxxx.mp4"
  }
}
```

### 响应示例（失败）

```json
{
  "id": "video_xxxxxxxxxxxxxx",
  "task_id": "video_xxxxxxxxxxxxxx",
  "object": "video",
  "status": "failed",
  "model": "doubao-seedance-2-0-260128",
  "created_at": 1712567890,
  "error": {
    "message": "content policy violation",
    "code": "failed"
  }
}
```

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务 ID |
| `status` | string | 任务状态，见 [状态说明](#7-任务状态说明) |
| `progress` | string | 进度百分比，如 `"45%"` |
| `seconds` | string | 视频时长（成功时） |
| `size` | string | 视频分辨率（成功时），如 `"1920x1080"` |
| `metadata.url` | string | 视频直链 URL（成功时） |
| `metadata.video_url` | string | 同 `metadata.url` |
| `completed_at` | int | 完成时间（成功时） |
| `error` | object | 错误信息（失败时） |

---

## 5. 下载视频

### Endpoint

```
GET /v1/videos/{task_id}/content
```

网关会代理下载上游视频文件，直接返回视频二进制流。适用于不方便直接访问上游 CDN 的场景。

### 请求示例

```bash
curl -X GET https://your-domain.com/v1/videos/video_xxxxxxxxxxxxxx/content \
  -H "Authorization: Bearer sk-your-api-key" \
  -o output.mp4
```

### 说明

- 仅在任务状态为 `succeeded` 时可用
- 响应为视频文件二进制流，Content-Type 由上游决定
- 也可以直接使用查询接口返回的 `metadata.url` 下载

---

## 6. 素材管理

图生视频场景需要先上传参考图片作为素材，获取素材 URL 后再提交视频生成任务。

### 6.1 上传素材

#### Endpoint

```
POST /api/asset/createMedia
```

#### 请求参数

请求体透传至上游，具体参数取决于上游 API。典型请求结构：

```json
{
  "type": "image",
  "url": "https://example.com/source-image.jpg"
}
```

或上传 Base64 编码的图片：

```json
{
  "type": "image",
  "content": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

#### 请求示例

```bash
curl -X POST https://your-domain.com/api/asset/createMedia \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "url": "https://example.com/cat.jpg"
  }'
```

#### 响应示例

```json
{
  "id": "asset_xxxxxxxxxxxxxx",
  "url": "https://upstream-cdn.example.com/assets/xxxxx.jpg",
  "status": "ready"
}
```

> 响应格式由上游服务决定，网关直接透传。

### 6.2 查询素材

#### Endpoint

```
GET /api/asset/get?id={asset_id}
```

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 素材 ID |

#### 请求示例

```bash
curl -X GET "https://your-domain.com/api/asset/get?id=asset_xxxxxxxxxxxxxx" \
  -H "Authorization: Bearer sk-your-api-key"
```

#### 响应示例

```json
{
  "id": "asset_xxxxxxxxxxxxxx",
  "url": "https://upstream-cdn.example.com/assets/xxxxx.jpg",
  "status": "ready",
  "type": "image"
}
```

> 响应格式由上游服务决定，网关直接透传。

---

## 7. 任务状态说明

| 状态值 | 说明 |
|--------|------|
| `queued` | 任务已提交，排队等待处理 |
| `in_progress` | 任务正在生成中 |
| `succeeded` | 生成成功，可下载视频 |
| `failed` | 生成失败，查看 `error` 字段获取原因 |

> 状态流转：`queued` → `in_progress` → `succeeded` / `failed`

---

## 8. 计费说明

- **计费方式**：按 Token 计费（精确计费）
- **扣费时机**：
  1. 提交任务时预扣费（根据模型单价和预估用量）
  2. 任务完成后根据实际消耗的 Token 进行多退少补
  3. 任务失败时，预扣费用全额退还
- **Token 来源**：上游返回的 `usage.total_tokens` 字段

---

## 9. 对接流程

### 文生视频

```
1. POST /v1/videos          — 提交文生视频任务，获取 task_id
2. GET  /v1/videos/{id}     — 轮询任务状态（建议间隔 5-10 秒）
3. 状态为 succeeded 后：
   - 方式 A：使用 metadata.url 直接下载
   - 方式 B：GET /v1/videos/{id}/content 代理下载
```

### 图生视频

```
1. POST /api/asset/createMedia  — 上传参考图片，获取素材 URL
2. (可选) GET /api/asset/get    — 查询素材状态
3. POST /v1/videos              — 提交图生视频任务，image 填素材 URL
4. GET  /v1/videos/{id}         — 轮询任务状态
5. 下载视频
```

---

## 10. 代码示例

### Python

```python
import requests
import time

BASE_URL = "https://your-domain.com"
API_KEY = "sk-your-api-key"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


def create_video(prompt: str, model: str = "doubao-seedance-2-0-260128", **kwargs):
    """提交视频生成任务"""
    payload = {"model": model, "prompt": prompt, **kwargs}
    resp = requests.post(f"{BASE_URL}/v1/videos", json=payload, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def get_video(task_id: str):
    """查询任务状态"""
    resp = requests.get(f"{BASE_URL}/v1/videos/{task_id}", headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def wait_for_video(task_id: str, interval: int = 10, timeout: int = 600):
    """轮询等待任务完成"""
    elapsed = 0
    while elapsed < timeout:
        result = get_video(task_id)
        status = result.get("status")
        print(f"[{elapsed}s] 状态: {status}, 进度: {result.get('progress', 'N/A')}")

        if status == "succeeded":
            return result
        elif status == "failed":
            raise Exception(f"任务失败: {result.get('error', {}).get('message', '未知错误')}")

        time.sleep(interval)
        elapsed += interval

    raise TimeoutError(f"任务超时（{timeout}s）")


def download_video(task_id: str, output_path: str = "output.mp4"):
    """通过网关代理下载视频"""
    resp = requests.get(
        f"{BASE_URL}/v1/videos/{task_id}/content",
        headers={"Authorization": f"Bearer {API_KEY}"},
        stream=True,
    )
    resp.raise_for_status()
    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"视频已保存: {output_path}")


# === 使用示例 ===

# 1. 提交任务
task = create_video("一只金色的猫咪在阳光下慵懒地伸懒腰", duration=5)
task_id = task["task_id"]
print(f"任务已提交: {task_id}")

# 2. 等待完成
result = wait_for_video(task_id)

# 3. 下载视频（二选一）
# 方式 A：直接下载
video_url = result.get("metadata", {}).get("url")
if video_url:
    print(f"视频直链: {video_url}")

# 方式 B：代理下载
download_video(task_id)
```

### Python（图生视频）

```python
def upload_asset(image_url: str):
    """上传素材"""
    payload = {"type": "image", "url": image_url}
    resp = requests.post(f"{BASE_URL}/api/asset/createMedia", json=payload, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


# 1. 上传参考图片
asset = upload_asset("https://example.com/photo.jpg")
asset_url = asset.get("url", "")
print(f"素材已上传: {asset_url}")

# 2. 提交图生视频任务
task = create_video(
    prompt="让画面中的女孩转头微笑",
    image=asset_url,
    duration=5,
)
task_id = task["task_id"]

# 3. 等待完成并下载
result = wait_for_video(task_id)
download_video(task_id)
```

---

## 11. 常见错误

| HTTP 状态码 | 错误类型 | 说明 | 解决方案 |
|-------------|----------|------|----------|
| 401 | `unauthorized` | API Key 无效或已过期 | 检查令牌是否正确 |
| 400 | `invalid_request_error` | 请求参数不合法 | 检查 model、prompt 等必填字段 |
| 404 | `invalid_request_error` | 任务不存在 | 检查 task_id 是否正确 |
| 429 | `rate_limit_error` | 请求频率超限 | 降低请求频率或联系管理员 |
| 503 | `server_error` | 无可用的 Seedance 渠道 | 联系管理员检查渠道配置 |
| 502 | `server_error` | 上游服务异常 | 稍后重试或联系管理员 |

---

## 附：与 OpenAI Video API 的兼容性

本接口遵循 OpenAI Video API 格式规范：

- 创建任务：`POST /v1/videos`
- 查询任务：`GET /v1/videos/{id}`
- 下载视频：`GET /v1/videos/{id}/content`

如果你已有对接 OpenAI Sora 的代码，只需将 `model` 参数改为 Seedance 模型名即可无缝切换。
