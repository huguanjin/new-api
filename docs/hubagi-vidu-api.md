# AIFAST Vidu 视频生成 API 文档（客户端版）

## 基础信息

- **Base URL**: `https://aifast.site`（你的 new-api 网关地址）
- **认证方式**: `Authorization: Bearer {your_api_key}`（new-api 令牌）
- **Content-Type**: `application/json`

> 本文档描述的是通过 new-api 网关调用 HUBAGI Vidu 视频生成服务的接口。客户端统一使用网关端点，无需关心上游供应商的具体 URL。

---

## 模型版本说明

| 任务类型     | 支持模型 (model)                                             |
|------------|--------------------------------------------------------------|
| 文生视频     | `TC-vidu-q2`、`TC-vidu-q3-pro`、`TC-vidu-q3-turbo`           |
| 图生视频     | `TC-vidu-q2-pro`、`TC-vidu-q3-pro`、`TC-vidu-q3-turbo`       |
| 首尾帧生视频 | `TC-vidu-q2-pro`、`TC-vidu-q2-turbo`、`TC-vidu-q3-turbo`     |
| 参考生视频   | `TC-vidu-q2`                                                 |

---

## 1. 创建视频生成任务

### Endpoint

```
POST /v1/video/generations
```

> 所有类型的视频生成（文生视频、图生视频、首尾帧、参考生视频）统一使用此端点。
> 系统根据请求内容自动判断任务类型，也可通过 `metadata.action` 显式指定。

### 自动判断规则

| 条件 | 判定的任务类型 |
|------|---------------|
| 无图片、无 subjects | **文生视频** (text2video) |
| `images` 含 1 张图 | **图生视频** (img2video) |
| `images` 含 2 张图 | **首尾帧生视频** (start-end2video) |
| `metadata.subjects` 存在 | **参考生视频** (reference2video) |
| `metadata.action` 显式指定 | 按指定值：`textGenerate`、`generate`、`firstTailGenerate`、`referenceGenerate` |

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型名称，枚举值见上方【模型版本说明】 |
| prompt | string | 是 | 视频生成提示词 |
| duration | int | 否 | 视频时长（秒），默认 5，范围 1-10 |
| size | string | 否 | 分辨率，默认 `720p`（对应上游 resolution） |
| images | string[] | 否 | 图片 URL 列表。图生视频传 1 张，首尾帧传 2 张 |
| metadata | object | 否 | 扩展参数，见下方说明 |

### metadata 扩展参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | string | 否 | 显式指定任务类型：`textGenerate`、`generate`、`firstTailGenerate`、`referenceGenerate` |
| aspect_ratio | string | 否 | 画面比例，默认 `16:9`。可选：`16:9`、`9:16`、`3:4`、`4:3`、`1:1`（注：`3:4`、`4:3` 仅支持 q2 模型）|
| off_peak | bool | 否 | 是否启用错峰模式 |
| callback_url | string | 否 | 回调地址（仅支持 http/https），任务状态变化时会 POST 通知 |
| subjects | array | 否 | 参考生视频的主体信息，详见下方说明 |

### subjects 参数结构（参考生视频专用）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| images | string[] | 是 | 参考图片 URL 列表 |
| id | string | 否 | 主体 ID，后续可通过 @主体ID 引用 |
| voice_id | string | 否 | 音色 ID，为空时系统自动推荐 |

---

### 请求示例

#### 文生视频

```json
{
  "model": "TC-vidu-q3-turbo",
  "prompt": "一个美女在雨中跳舞",
  "duration": 4,
  "size": "720p",
  "metadata": {
    "aspect_ratio": "16:9"
  }
}
```

#### 图生视频（1 张图）

```json
{
  "model": "TC-vidu-q2-pro",
  "prompt": "让图片中的人物开始跳舞",
  "images": ["https://example.com/photo.jpg"],
  "duration": 5
}
```

#### 首尾帧生视频（2 张图）

```json
{
  "model": "TC-vidu-q2-pro",
  "prompt": "主角在夜空下奔跑",
  "images": ["https://example.com/start.jpg", "https://example.com/end.jpg"],
  "duration": 4
}
```

#### 参考生视频

```json
{
  "model": "TC-vidu-q2",
  "prompt": "他们在一起吃火锅",
  "duration": 8,
  "metadata": {
    "subjects": [
      {
        "images": ["https://example.com/person1_a.jpg", "https://example.com/person1_b.jpg"],
        "id": "1"
      },
      {
        "images": ["https://example.com/person2.jpg"],
        "id": "2"
      }
    ]
  }
}
```

### 响应格式（OpenAI Video 格式）

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 网关生成的任务 ID（用于后续查询） |
| task_id | string | 同 id（兼容字段） |
| object | string | 固定值 `"video"` |
| model | string | 使用的模型名称 |
| status | string | 任务状态：`queued`、`in_progress`、`completed`、`failed` |
| progress | int | 进度百分比（0-100） |
| created_at | int64 | 创建时间（Unix 时间戳） |
| completed_at | int64 | 完成时间（Unix 时间戳，未完成时为 0） |
| error | object\|null | 错误信息，仅失败时返回 |
| metadata | object\|null | 元数据，完成后包含 `url`（视频下载地址）|

### 响应示例（提交成功）

```json
{
  "id": "task_abc123def456",
  "task_id": "task_abc123def456",
  "object": "video",
  "model": "TC-vidu-q3-turbo",
  "status": "queued",
  "progress": 0,
  "created_at": 1741788026,
  "metadata": null
}
```

---

## 2. 查询视频生成任务

有两个查询端点，返回**不同的响应格式**，请根据客户端需要选择：

### 端点 A：OpenAI Video 格式（推荐）

```
GET /v1/videos/{task_id}
```

返回标准 OpenAI Video 格式，与提交任务的响应格式一致。**推荐使用此端点。**

### 端点 B：通用 TaskDto 格式

```
GET /v1/video/generations/{task_id}
```

返回通用任务包装格式 `{"code":"success","data":{...}}`，字段与 OpenAI Video 格式不同。

> **⚠️ 注意**：两个端点返回的 JSON 结构不同。如果客户端按 OpenAI Video 格式（`status`、`metadata.url` 等字段）解析，必须使用 `/v1/videos/{task_id}`。

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_id | string | 是 | 提交任务时返回的 `id` |

---

### 端点 A 响应格式（`/v1/videos/{task_id}`）

与提交任务的响应格式一致（OpenAI Video 格式）。

#### 响应示例（处理中）

```json
{
  "id": "task_abc123def456",
  "object": "video",
  "model": "TC-vidu-q3-turbo",
  "status": "in_progress",
  "progress": 50,
  "created_at": 1741788026,
  "metadata": null
}
```

#### 响应示例（生成完成）

```json
{
  "id": "task_abc123def456",
  "object": "video",
  "model": "TC-vidu-q3-turbo",
  "status": "completed",
  "progress": 100,
  "created_at": 1741788026,
  "completed_at": 1741788126,
  "metadata": {
    "url": "https://cdn.example.com/videos/result.mp4"
  }
}
```

#### 响应示例（生成失败）

```json
{
  "id": "task_abc123def456",
  "object": "video",
  "model": "TC-vidu-q3-turbo",
  "status": "failed",
  "progress": 0,
  "created_at": 1741788026,
  "completed_at": 1741788126,
  "error": {
    "message": "内容审核未通过",
    "code": "内容审核未通过"
  },
  "metadata": null
}
```

---

### 端点 B 响应格式（`/v1/video/generations/{task_id}`）

返回通用 TaskDto 包装格式。

#### 响应示例

```json
{
  "code": "success",
  "data": {
    "task_id": "task_abc123def456",
    "status": "SUCCESS",
    "progress": "100%",
    "action": "textGenerate",
    "created_at": 1741788026,
    "updated_at": 1741788126,
    "data": { ... }
  }
}
```

> 注意 `data.status` 使用的是内部状态枚举（`SUBMITTED`、`IN_PROGRESS`、`SUCCESS`、`FAILURE`），与 OpenAI Video 格式的 `status` 值不同。

---

## 3. 获取视频内容（代理下载）

### Endpoint

```
GET /v1/videos/{task_id}/content
```

此端点用于通过网关代理访问生成的视频文件，适用于不方便直接访问 `metadata.url` 的场景。

---

## 状态映射

| 网关状态 (status) | 说明 |
|-------------------|------|
| `queued` | 任务已提交，排队等待处理 |
| `in_progress` | 正在生成视频 |
| `completed` | 视频生成成功，`metadata.url` 中包含下载地址 |
| `failed` | 生成失败，`error` 字段中包含错误信息 |

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数无效（prompt 缺失、模型不支持等） |
| 401 | 认证失败，API 令牌无效 |
| 402 | 余额不足 |
| 404 | 任务不存在 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |

---

## 注意事项

1. **图片格式**: 支持 JPG、PNG、JPEG、WEBP
2. **图片大小**: 单张图片不超过 10MB
3. **参考图片数量**: 参考生视频最多支持 7 张参考图片
4. **视频时长**: 支持 1-10 秒
5. **并发限制**: 每个用户最多同时处理 5 个任务
6. **异步任务**: 视频生成为异步操作，提交后需轮询查询接口获取结果
7. **建议轮询间隔**: 每 5-10 秒查询一次任务状态

---

## 完整调用流程

```
1. POST /v1/video/generations        → 提交任务，获取 task_id
2. GET  /v1/videos/{task_id}         → 轮询查询状态（推荐，返回 OpenAI Video 格式）
3. 当 status == "completed"          → 从 metadata.url 获取视频下载地址
```

### cURL 示例

**提交文生视频任务：**

```bash
curl -X POST https://<your-gateway>/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "TC-vidu-q3-turbo",
    "prompt": "一只可爱的小狗在花园里开心地玩耍",
    "duration": 5,
    "metadata": {
      "aspect_ratio": "16:9"
    }
  }'
```

**查询任务状态：**

```bash
curl https://<your-gateway>/v1/videos/task_abc123def456 \
  -H "Authorization: Bearer sk-your-api-key"
```
