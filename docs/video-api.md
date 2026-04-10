# AI 视频生成 API 文档

## 概述

统一的视频生成 API，支持多个 AI 视频模型，包括可灵（Kling）、Vidu、海螺（Hailuo）、GV、OS、混元（Hunyuan）、明眸（Mingmou）等系列。

## 鉴权

所有请求需在 Header 中携带 API 密钥：

```
Authorization: Bearer YOUR_API_KEY
```

## 接口列表

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 视频生成 | POST | `/v1/videos` | 提交视频生成任务 |
| 任务查询 | GET | `/v1/videos/{task_id}` | 查询任务进度和结果 |
| 视频内容 | GET | `/v1/videos/{task_id}/content` | 获取/下载生成的视频 |

---

## 视频生成

### 请求

```
POST /v1/videos
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

### 请求体

```json
{
  "model": "模型名称（必填）",
  "prompt": "视频描述提示词（必填）",
  "seconds": "时长秒数",
  "size": "分辨率或尺寸",
  "image": "参考图片URL（单张）",
  "images": ["图片URL1", "图片URL2"],
  "metadata": {
    "output_config": {
      "resolution": "720P",
      "aspect_ratio": "16:9",
      "duration": 5,
      "audio_generation": "Enabled"
    }
  }
}
```

### 参数说明

#### 顶层参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | ✅ | 模型名称，见下方模型列表 |
| `prompt` | string | ✅ | 视频描述提示词 |
| `seconds` | string | ❌ | 视频时长（秒），如 `"5"`、`"10"` |
| `size` | string | ❌ | 尺寸，支持 `720P`/`1080P` 或 `WxH` 格式（如 `720x1280`） |
| `image` | string | ❌ | 单张参考图片 URL（图生视频） |
| `images` | string[] | ❌ | 多张参考图片 URL 数组（最多 3 张） |
| `metadata` | object | ❌ | 扩展参数，见下方详细说明 |

#### 生成模式自动判定

| 条件 | 模式 |
|------|------|
| 无 `image`/`images` | 文生视频（Text to Video） |
| 有 `image` 或 `images` | 图生视频（Image to Video） |
| 有 `image` + `metadata.last_frame_url` | 首尾帧生视频 |

#### 时长优先级

`seconds`（顶层） > `duration`（顶层） > `metadata.output_config.duration` > 模型默认值

#### 分辨率优先级

`metadata.output_config.resolution` > `size`（顶层） > 模型默认值

#### `metadata` 扩展参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `output_config` | object | 输出配置，见下方详细字段 |
| `scene_type` | string | 场景类型：`motion_control`（动作控制）/ `avatar_i2v`（数字人）/ `lip_sync`（对口型）/ `template_effect`（模板特效） |
| `motion_level` | string | 动作控制档位：`std` / `pro` |
| `offpeak` | boolean | 是否错峰计费 |
| `last_frame_url` | string | 尾帧图片 URL（首尾帧场景） |
| `video_url` | string | 参考视频 URL |
| `file_infos` | array | 高级文件引用，见下方说明 |
| `ext_info` | string | 上游透传扩展信息（JSON 字符串） |

#### `output_config` 字段

| 参数 | 类型 | 说明 |
|------|------|------|
| `resolution` | string | 分辨率：`720P` / `1080P` |
| `aspect_ratio` | string | 宽高比：`16:9` / `9:16` / `1:1` 等 |
| `duration` | float | 时长（秒） |
| `audio_generation` | string | 音频生成：`Enabled` / `Disabled` |
| `person_generation` | string | 人物生成：`AllowAdult` / `Disallowed` |
| `enhance_switch` | string | 增强：`Enabled` / `Disabled` |
| `frame_interpolate` | string | 帧插值（Vidu）：`Enabled` / `Disabled` |
| `logo_add` | string | 添加水印（Vidu）：`Enabled` / `Disabled` |

#### `file_infos` 字段说明

`metadata.file_infos` 数组，每项支持以下字段：

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | string | `File` / `Url` |
| `category` | string | `Image` / `Video` |
| `file_id` | string | 当 `type=File` 时使用 |
| `url` | string | 当 `type=Url` 时使用 |
| `usage` | string | 如 `FirstFrame` / `Reference` |
| `reference_type` | string | 参考类型区分：`feature`（特征参考）/ `base`（待编辑） |

最多支持 3 个 `file_infos`。

---

## 可用模型

### Vidu 系列

| 模型名 | 说明 | 时长 | 分辨率 |
|--------|------|------|--------|
| `Vidu-q2` | Vidu Q2 | 1-10秒 | 720P/1080P |
| `Vidu-q2-pro` | Vidu Q2 Pro | 1-10秒 | 720P/1080P |
| `Vidu-q2-turbo` | Vidu Q2 Turbo | 1-10秒 | 720P/1080P |
| `Vidu-q3-pro` | Vidu Q3 Pro | 1-10秒 | 540P/720P/1080P |
| `Vidu-q3-turbo` | Vidu Q3 Turbo | 1-10秒 | 540P/720P/1080P |
| `Vidu-template` | Vidu 模板特效 | - | - |

### 可灵（Kling）系列

| 模型名 | 说明 | 时长 | 分辨率 |
|--------|------|------|--------|
| `Kling-3.0` | 可灵 3.0 | 5/10秒 | 720P/1080P |
| `Kling-3.0-Omni` | 可灵 3.0 Omni | 5/10秒 | 720P/1080P |
| `Kling-O1` | 可灵 O1 | 5/10秒 | 720P/1080P |
| `Kling-2.6` | 可灵 2.6 | 5/10秒 | - |
| `Kling-2.5` | 可灵 2.5 | 5/10秒 | 720P/1080P |
| `Kling-2.1` | 可灵 2.1 | 5/10秒 | 720P/1080P |
| `Kling-2.0` | 可灵 2.0 | 5/10秒 | 720P/1080P |
| `Kling-1.6` | 可灵 1.6 | 5/10秒 | 720P/1080P |

### 海螺（Hailuo）系列

| 模型名 | 说明 | 时长 | 分辨率 |
|--------|------|------|--------|
| `Hailuo-02` | 海螺 02 | 6/10秒 | 768P/1080P |
| `Hailuo-2.3` | 海螺 2.3 | 6/10秒 | 768P/1080P |
| `Hailuo-2.3-fast` | 海螺 2.3 Fast | 6/10秒 | 768P/1080P |

### GV / OS / Hunyuan / Mingmou 系列

| 模型名 | 说明 | 时长 | 分辨率 |
|--------|------|------|--------|
| `GV-3.1` | GV 3.1 | 8秒 | - |
| `GV-3.1-fast` | GV 3.1 Fast | 8秒 | - |
| `OS-2.0` | OS 2.0 | 4/8/12秒 | - |
| `Hunyuan-1.5` | 混元 1.5 | - | 720P/1080P |
| `Mingmou-1.0` | 明眸 1.0 | - | 720P/1080P |

---

## 请求示例

### 文生视频

```json
{
  "model": "Vidu-q3-pro",
  "prompt": "赛博朋克城市夜景，镜头慢慢推进",
  "seconds": "5",
  "metadata": {
    "output_config": {
      "resolution": "720P",
      "aspect_ratio": "16:9"
    }
  }
}
```

### 图生视频

```json
{
  "model": "Kling-3.0-Omni",
  "prompt": "让人物向前走并微笑",
  "image": "https://example.com/character.png",
  "seconds": "5",
  "metadata": {
    "output_config": {
      "resolution": "1080P",
      "aspect_ratio": "9:16",
      "audio_generation": "Enabled"
    }
  }
}
```

### 多图参考

```json
{
  "model": "Vidu-q2-pro",
  "prompt": "镜头从远到近展示产品细节",
  "images": [
    "https://example.com/ref-1.png",
    "https://example.com/ref-2.png"
  ],
  "seconds": "6",
  "metadata": {
    "output_config": {
      "resolution": "1080P"
    }
  }
}
```

### 首尾帧

```json
{
  "model": "GV-3.1-fast",
  "prompt": "第一帧到最后一帧平滑过渡",
  "image": "https://example.com/first.png",
  "seconds": "8",
  "metadata": {
    "last_frame_url": "https://example.com/last.png",
    "output_config": {
      "resolution": "1080P",
      "aspect_ratio": "16:9"
    }
  }
}
```

### 竖屏 9:16

```json
{
  "model": "Kling-3.0-Omni",
  "prompt": "女孩在花海中奔跑",
  "seconds": "10",
  "size": "720x1280",
  "metadata": {
    "output_config": {
      "duration": 10,
      "resolution": "720P",
      "aspect_ratio": "9:16",
      "audio_generation": "Enabled"
    }
  }
}
```

### 动作控制（Kling，需视频参考）

```json
{
  "model": "Kling-2.6",
  "prompt": "人物按参考视频动作运动",
  "seconds": "5",
  "metadata": {
    "video_url": "https://example.com/motion-ref.mp4",
    "scene_type": "motion_control",
    "motion_level": "pro",
    "output_config": {
      "resolution": "1080P"
    }
  }
}
```

### 模板特效（Vidu）

```json
{
  "model": "Vidu-template",
  "prompt": "使用模板特效生成炫酷转场",
  "seconds": "5",
  "metadata": {
    "scene_type": "template_effect",
    "output_config": {
      "resolution": "720P"
    }
  }
}
```

### 参考视频高级透传（file_infos）

```json
{
  "model": "Kling-3.0-Omni",
  "prompt": "基于参考视频生成同风格镜头",
  "seconds": "5",
  "metadata": {
    "file_infos": [
      {
        "type": "Url",
        "category": "Video",
        "url": "https://example.com/ref-video.mp4",
        "reference_type": "feature"
      }
    ],
    "output_config": {
      "resolution": "720P"
    }
  }
}
```

---

## 响应格式

### 提交任务响应

```json
{
  "id": "task_abc123",
  "object": "video",
  "model": "Kling-3.0-Omni",
  "status": "queued",
  "progress": 0,
  "created_at": 1712736000,
  "size": "720x1280"
}
```

### 查询任务响应

```
GET /v1/videos/{task_id}
Authorization: Bearer YOUR_API_KEY
```

```json
{
  "id": "task_abc123",
  "object": "video",
  "model": "Kling-3.0-Omni",
  "status": "completed",
  "progress": 100,
  "created_at": 1712736000,
  "completed_at": 1712736120,
  "expires_at": 1712822400,
  "seconds": "10",
  "size": "720x1280",
  "video_url": "https://...",
  "error": null
}
```

### 任务状态说明

| 状态值 | 说明 |
|--------|------|
| `queued` | 排队中 |
| `processing` | 生成中 |
| `completed` | 生成完成 |
| `failed` | 生成失败 |
| `cancelled` | 已取消 |

### 获取视频内容

```
GET /v1/videos/{task_id}/content
Authorization: Bearer YOUR_API_KEY
```

直接返回视频文件流，可用于下载或播放。

---

## 错误响应

```json
{
  "error": {
    "message": "错误描述信息",
    "code": "error_code"
  }
}
```

---

## 模型约束参考

### 时长

| 模型系列 | 支持时长 | 默认 |
|----------|---------|------|
| Kling | 5/10 秒 | 5 |
| Hailuo | 6/10 秒 | 6 |
| Vidu | 1-10 秒 | 5 |
| GV | 8 秒 | 8 |
| OS | 4/8/12 秒 | 8 |

### 分辨率

| 模型系列 | 支持分辨率 | 默认 |
|----------|-----------|------|
| Kling | 720P / 1080P | 720P |
| Hailuo | 768P / 1080P | 768P |
| Vidu | 720P / 1080P | 720P |
| GV | 不区分 | — |
| OS | 不区分 | — |
| Hunyuan | 720P / 1080P | — |
| Mingmou | 720P / 1080P | — |
