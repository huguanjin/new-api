# Seedance 2.0 视频生成 API 对接文档

> **认证方式**: `Authorization: Bearer {your_api_key}`（new-api 令牌）  
> **基础地址**: `https://your-domain.com`（你的 new-api 网关地址）  
> **Content-Type**: `application/json`（也支持 `multipart/form-data`，但仅接受 URL 字段，不支持真实文件上传）  
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
  - [6.1 创建虚拟资源库（上传素材）](#61-创建虚拟资源库上传素材)
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

#### 基础参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | ✅ | 模型名称，见 [模型列表](#1-模型列表) |
| `prompt` | string | ✅ | 视频生成提示词 |
| `duration` | integer | ❌ | 视频时长（秒），优先于 `seconds`。≥ 1 |
| `seconds` | integer | ❌ | 视频时长（秒），当未传 `duration` 时使用。≥ 1 |
| `ratio` | string | ❌ | 画幅比例，枚举：`21:9`、`16:9`、`4:3`、`1:1`、`3:4`、`9:16`、`adaptive` |
| `resolution` | string | ❌ | 输出分辨率，枚举：`480p`、`720p` |
| `size` | string | ❌ | OpenAI 兼容尺寸字段，仅支持固定映射（如 `1280x720`、`720x1280`、`1024x1024`、`854x480`），不支持任意像素值 |
| `watermark` | boolean | ❌ | 是否带水印 |
| `generate_audio` | boolean | ❌ | 是否生成音频 |

#### 参考素材参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image` | string(uri) | ❌ | 单参考图片 URL，默认映射为 `first_frame`。兼容字段 |
| `image_url` | string(uri) | ❌ | 同 `image`，兼容字段 |
| `input_reference` | string(uri) | ❌ | 同 `image`，兼容字段 |
| `input_reference_role` | string | ❌ | 当使用 `image` / `image_url` / `input_reference` 时指定角色，枚举：`first_frame`（默认）、`reference_image` |
| `first_frame_url` | string(uri) | ❌ | 首帧图 URL |
| `last_frame_url` | string(uri) | ❌ | 尾帧图 URL |
| `reference_image_urls` | array[string] | ❌ | 多张参考图 URL |
| `reference_video_url` | string(uri) | ❌ | 单个参考视频 URL |
| `reference_video_urls` | array[string] | ❌ | 多个参考视频 URL |
| `audio_url` | string(uri) | ❌ | 参考音频 URL。**不能单独出现**，至少要配合参考图或参考视频 |

#### 工具参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tools` | array[object] | ❌ | 显式工具列表，当前仅支持 `[{"type":"web_search"}]` |
| `web_search` | boolean | ❌ | 为 `true` 时等效 `tools=[{"type":"web_search"}]`。若同时传 `tools`，优先使用 `tools` |

### 参数组合规则

1. `prompt` **必填**
2. `duration` 优先于 `seconds`——同时传时以 `duration` 为准
3. `audio_url` 不能单独出现，至少要配合参考图或参考视频
4. `input_reference` / `image` / `image_url` 默认映射为 `first_frame`，可通过 `input_reference_role` 改为 `reference_image`
5. `tools` 与 `web_search` 同时传时，优先使用 `tools`
6. `size` 仅支持固定映射表，不支持任意像素值

### 请求示例

**文生视频（最小示例）：**

```bash
curl -X POST https://your-domain.com/v1/videos \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "一个电影感产品广告视频，镜头缓慢推进",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p",
    "watermark": false,
    "generate_audio": true
  }'
```

**图生视频（首帧参考）：**

```bash
curl -X POST https://your-domain.com/v1/videos \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "让画面中的女孩转头微笑",
    "image": "https://example.com/photo.jpg",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p"
  }'
```

**多模态参考（参考图 + 参考视频 + 音频）：**

```bash
curl -X POST https://your-domain.com/v1/videos \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-fast-260128",
    "prompt": "使用参考图中的主体风格，参考视频的镜头语言，并使用参考音频作为背景音乐，生成一个6秒的广告感短视频，保持画面连贯自然。",
    "reference_image_urls": [
      "https://example.com/ref-image-1.jpg",
      "https://example.com/ref-image-2.jpg"
    ],
    "reference_video_urls": [
      "https://example.com/ref-video-1.mp4",
      "https://example.com/ref-video-2.mp4"
    ],
    "audio_url": "https://example.com/bgm.mp3",
    "duration": 6,
    "ratio": "adaptive",
    "resolution": "480p",
    "generate_audio": true,
    "watermark": false
  }'
```

### 响应示例

```json
{
  "id": "task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
  "task_id": "task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
  "object": "video",
  "status": "queued",
  "progress": 0,
  "model": "doubao-seedance-2-0-260128",
  "created_at": 1712567890,
  "seconds": "5",
  "size": "1280x720"
}
```

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务 ID（网关分配，格式为 `task_` + 32位随机字符） |
| `task_id` | string | 同 `id` |
| `object` | string | 固定为 `"video"` |
| `status` | string | 初始状态，通常为 `queued`。见 [状态说明](#7-任务状态说明) |
| `progress` | integer | 进度百分比（0-100） |
| `model` | string | 使用的模型 |
| `created_at` | integer(int64) | 创建时间（Unix 时间戳） |
| `seconds` | string | 视频时长 |
| `size` | string | 视频分辨率，如 `"1280x720"` |

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
curl -X GET https://your-domain.com/v1/videos/task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345 \
  -H "Authorization: Bearer sk-your-api-key"
```

### 响应示例（进行中）

```json
{
  "id": "task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
  "task_id": "task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
  "object": "video",
  "status": "in_progress",
  "progress": 50,
  "model": "doubao-seedance-2-0-260128",
  "created_at": 1712567890,
  "seconds": "5",
  "size": "1280x720"
}
```

### 响应示例（成功）

```json
{
  "id": "task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
  "task_id": "task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
  "object": "video",
  "status": "completed",
  "progress": 100,
  "model": "doubao-seedance-2-0-260128",
  "created_at": 1712567890,
  "completed_at": 1712568200,
  "seconds": "5",
  "size": "1920x1080",
  "metadata": {
    "url": "https://upstream-cdn.example.com/videos/xxxxx.mp4"
  }
}
```

### 响应示例（失败）

```json
{
  "id": "task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
  "task_id": "task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
  "object": "video",
  "status": "failed",
  "progress": 100,
  "model": "doubao-seedance-2-0-260128",
  "created_at": 1712567890,
  "completed_at": 1712568010,
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
| `task_id` | string | 同 `id` |
| `object` | string | 固定为 `"video"` |
| `status` | string | 任务状态，见 [状态说明](#7-任务状态说明) |
| `progress` | integer | 进度百分比（0-100） |
| `model` | string | 使用的模型 |
| `created_at` | integer(int64) | 创建时间（Unix 时间戳） |
| `completed_at` | integer(int64) | 完成时间（成功或失败时返回） |
| `seconds` | string | 视频时长 |
| `size` | string | 视频分辨率，如 `"1920x1080"` |
| `metadata` | object | 扩展信息 |
| `metadata.url` | string | 视频直链 URL（成功时返回） |
| `error` | object | 错误信息（失败时返回） |
| `error.message` | string | 错误描述 |
| `error.code` | string | 错误码 |

---

## 5. 下载视频

### Endpoint

```
GET /v1/videos/{task_id}/content
```

网关会代理下载上游视频文件，直接返回视频二进制流。适用于不方便直接访问上游 CDN 的场景。

### 请求示例

```bash
curl -X GET https://your-domain.com/v1/videos/task_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345/content \
  -H "Authorization: Bearer sk-your-api-key" \
  -o output.mp4
```

### 说明

- 仅在任务状态为 `completed` 时可用
- 响应为视频文件二进制流，Content-Type 由上游决定
- 也可以直接使用查询接口返回的 `metadata.url` 下载

---

## 6. 素材管理

图生视频场景需要先上传参考图片/视频作为素材，获取素材信息后再提交视频生成任务。

> **注意：** 素材管理接口为上游透传，网关不做响应格式转换，返回的是上游原始格式。

### 6.1 创建虚拟资源库（上传素材）

#### Endpoint

```
POST /api/asset/createMedia
```

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | ✅ | 素材资源 URL |
| `name` | string | ✅ | 素材名称（如 `"ref-image.jpg"`） |
| `assetType` | string | ✅ | 素材类型，如 `"Image"` |

#### 请求示例

```bash
curl -X POST https://your-domain.com/api/asset/createMedia \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/cat.jpg",
    "name": "cat-ref-image.jpg",
    "assetType": "Image"
  }'
```

#### 响应示例

```json
{}
```

> 上游创建成功后返回空对象。素材创建后需通过 [查询素材](#62-查询素材) 接口获取素材详情（ID、URL、状态等）。

### 6.2 查询素材

#### Endpoint

```
GET /api/asset/get?id={asset_id}
```

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 素材 ID（如 `asset-20260327164915-cj6zh`） |

#### 请求示例

```bash
curl -X GET "https://your-domain.com/api/asset/get?id=asset-20260327164915-cj6zh" \
  -H "Authorization: Bearer sk-your-api-key"
```

#### 响应示例

```json
{
  "ResponseMetadata": {
    "RequestId": "20260327164951427454FA0B9337531531",
    "Action": "GetAsset",
    "Version": "2024-01-01",
    "Service": "ark",
    "Region": "cn-beijing"
  },
  "Result": {
    "Id": "asset-20260327164915-cj6zh",
    "Name": "大卫",
    "URL": "https://ark-media-asset.tos-cn-beijing.volces.com/2120268317/xxxxx.jpg?...(签名参数)",
    "AssetType": "Image",
    "GroupId": "group-20260323170848-fwlzh",
    "Status": "Active",
    "CreateTime": "2026-03-27T08:49:15Z",
    "UpdateTime": "2026-03-27T08:49:25Z",
    "ProjectName": "default"
  }
}
```

#### 响应字段

> 响应为上游火山引擎 ark 原始格式，网关直接透传。

| 字段 | 类型 | 说明 |
|------|------|------|
| `ResponseMetadata.RequestId` | string | 请求 ID |
| `ResponseMetadata.Action` | string | 操作名称（`GetAsset`） |
| `ResponseMetadata.Version` | string | API 版本 |
| `ResponseMetadata.Service` | string | 服务名称 |
| `ResponseMetadata.Region` | string | 区域 |
| `Result.Id` | string | 素材 ID |
| `Result.Name` | string | 素材名称 |
| `Result.URL` | string | 素材访问 URL（带签名，有有效期） |
| `Result.AssetType` | string | 素材类型（如 `Image`） |
| `Result.GroupId` | string | 资源组 ID |
| `Result.Status` | string | 素材状态（如 `Active`） |
| `Result.CreateTime` | string | 创建时间（ISO 8601） |
| `Result.UpdateTime` | string | 更新时间（ISO 8601） |
| `Result.ProjectName` | string | 项目名称 |

---

## 7. 任务状态说明

| 状态值 | 说明 |
|--------|------|
| `queued` | 任务已提交，排队等待处理 |
| `in_progress` | 任务正在生成中 |
| `completed` | 生成成功，可下载视频 |
| `failed` | 生成失败，查看 `error` 字段获取原因 |

> 状态流转：`queued` → `in_progress` → `completed` / `failed`
>
> 上游状态映射规则：`pending/queued → queued`、`processing/running/in_progress → in_progress`、`succeeded/completed → completed`、`failed/cancelled → failed`

---

## 8. 计费说明

- **计费方式**：按 Token 计费（精确计费）
- **扣费时机**：
  1. 提交任务时预扣费（根据模型单价和预估用量）
  2. 任务完成后根据实际消耗的 Token 进行多退少补
  3. 任务失败时，预扣费用全额退还
- **Token 来源**：上游返回的 `usage.total_tokens` 字段（包含 `completion_tokens` 和 `total_tokens`）

---

## 9. 对接流程

### 文生视频

```
1. POST /v1/videos          — 提交文生视频任务，获取 task_id
2. GET  /v1/videos/{id}     — 轮询任务状态（建议间隔 5-10 秒）
3. 状态为 completed 后：
   - 方式 A：使用 metadata.url 直接下载
   - 方式 B：GET /v1/videos/{id}/content 代理下载
```

### 图生视频

```
1. POST /api/asset/createMedia  — 创建虚拟资源库，上传参考图片
2. GET  /api/asset/get          — 查询素材状态，获取素材 ID 和 URL
3. POST /v1/videos              — 提交图生视频任务，image 填素材 URL
4. GET  /v1/videos/{id}         — 轮询任务状态
5. 下载视频
```

### 多模态参考视频

```
1. (可选) POST /api/asset/createMedia  — 上传参考素材
2. POST /v1/videos                     — 提交任务，填写 reference_image_urls / reference_video_urls / audio_url
3. GET  /v1/videos/{id}                — 轮询任务状态
4. 下载视频
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
        progress = result.get("progress", 0)
        print(f"[{elapsed}s] 状态: {status}, 进度: {progress}%")

        if status == "completed":
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
task = create_video(
    "一个电影感产品广告视频，镜头缓慢推进",
    duration=5,
    ratio="16:9",
    resolution="720p",
    watermark=False,
    generate_audio=True,
)
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
def create_asset(image_url: str, name: str, asset_type: str = "Image"):
    """创建虚拟资源库（上传素材）"""
    payload = {"url": image_url, "name": name, "assetType": asset_type}
    resp = requests.post(f"{BASE_URL}/api/asset/createMedia", json=payload, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def get_asset(asset_id: str):
    """查询素材信息"""
    resp = requests.get(f"{BASE_URL}/api/asset/get", params={"id": asset_id}, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


# 1. 上传参考图片
create_asset("https://example.com/photo.jpg", name="ref-photo.jpg")

# 2. 查询素材（需知道素材 ID）
asset = get_asset("asset-20260327164915-cj6zh")
asset_url = asset.get("Result", {}).get("URL", "")
print(f"素材 URL: {asset_url}")

# 3. 提交图生视频任务
task = create_video(
    prompt="让画面中的女孩转头微笑",
    image=asset_url,
    duration=5,
    ratio="16:9",
    resolution="720p",
)
task_id = task["task_id"]

# 4. 等待完成并下载
result = wait_for_video(task_id)
download_video(task_id)
```

### Python（多模态参考）

```python
# 使用多张参考图 + 参考视频 + 音频
task = create_video(
    prompt="使用参考图中的主体风格，参考视频的镜头语言，并使用参考音频作为背景音乐",
    reference_image_urls=[
        "https://example.com/ref-image-1.jpg",
        "https://example.com/ref-image-2.jpg",
    ],
    reference_video_urls=[
        "https://example.com/ref-video-1.mp4",
    ],
    audio_url="https://example.com/bgm.mp3",
    duration=6,
    ratio="adaptive",
    resolution="480p",
    generate_audio=True,
    watermark=False,
)
result = wait_for_video(task["task_id"])
download_video(task["task_id"])
```

---

## 11. 常见错误

### HTTP 错误响应格式

```json
{
  "error": {
    "message": "prompt is required",
    "type": "invalid_request_error",
    "code": "missing_prompt"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `error.message` | string | 错误描述 |
| `error.type` | string | OpenAI 风格错误类型 |
| `error.code` | string | 业务错误码 |

### 错误码列表

| HTTP 状态码 | 错误类型 | code | 说明 | 解决方案 |
|-------------|----------|------|------|----------|
| 400 | `invalid_request_error` | `missing_prompt` | 缺少 prompt 参数 | 补充 prompt 字段 |
| 400 | `invalid_request_error` | `invalid_size` | 不支持的 size 值 | 使用支持的固定映射表值 |
| 400 | `invalid_request_error` | `audio_requires_reference` | audio_url 缺少参考素材 | audio_url 需配合参考图或参考视频使用 |
| 401 | `authentication_error` | `missing_api_key` | API Key 无效或缺失 | 检查 Authorization 头是否正确 |
| 404 | `invalid_request_error` | `invalid_task_id` | 任务不存在 | 检查 task_id 是否正确 |
| 429 | `rate_limit_error` | `rate_limit_exceeded` | 请求频率超限 | 降低请求频率或联系管理员 |
| 500 | `server_error` | - | 网关内部错误 | 稍后重试或联系管理员 |
| 502 | `server_error` | - | 上游服务异常 | 稍后重试或联系管理员 |

---

## 附：与 OpenAI Video API 的兼容性

本接口遵循 OpenAI Video API 格式规范：

- 创建任务：`POST /v1/videos`
- 查询任务：`GET /v1/videos/{id}`
- 下载视频：`GET /v1/videos/{id}/content`

如果你已有对接 OpenAI Sora 的代码，只需将 `model` 参数改为 Seedance 模型名即可无缝切换。

> **注意：** 成功状态在本接口中为 `completed`（与上游保持一致），请确保状态判断使用 `completed` 而非 `succeeded`。
