# GPT Image 图片生成 API 对接文档

> **认证方式**: `Authorization: Bearer {your_api_key}`（网关令牌）  
> **基础地址**: `https://your-domain.com`（你的 new-api 网关地址）  
> **Content-Type**: `application/json` 或 `multipart/form-data`（图片编辑接口）  
> **最后更新**: 2026-04-30

本文档描述通过 new-api 网关调用 GPT Image 图片生成与编辑服务的接口，接口格式与 OpenAI 图片接口兼容。

---

## 目录

- [1. 模型列表](#1-模型列表)
- [2. 接口总览](#2-接口总览)
- [3. 图片生成](#3-图片生成)
- [4. 图片编辑（参考图生图）](#4-图片编辑参考图生图)
- [5. 尺寸说明](#5-尺寸说明)
- [6. quality 参数说明](#6-quality-参数说明)
- [7. 响应格式](#7-响应格式)
- [8. 错误处理](#8-错误处理)
- [9. 计费说明](#9-计费说明)
- [10. 代码示例](#10-代码示例)

---

## 1. 模型列表

| 模型名称 | 说明 |
|---|---|
| `gpt-image-2` | 标准版，支持 1K 分辨率以内的图片生成与编辑 |
| `gpt-image-2-vip` | VIP 版，在标准版基础上额外支持 2K、4K 等高分辨率输出，以及 `quality` 质量控制参数 |

---

## 2. 接口总览

| 接口 | 方法 | 说明 |
|---|---|---|
| `/v1/images/generations` | POST | 文字生成图片 |
| `/v1/images/edits` | POST | 参考图生图（图片编辑） |

---

## 3. 图片生成

### 接口

```
POST /v1/images/generations
```

### 请求头

```http
Authorization: Bearer {your_api_key}
Content-Type: application/json
```

### 请求体

```json
{
  "model": "gpt-image-2",
  "prompt": "一只可爱的橘猫坐在窗台上看夕阳",
  "n": 1,
  "size": "1024x1024",
  "quality": "auto",
  "response_format": "b64_json"
}
```

### 请求参数说明

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称，见[模型列表](#1-模型列表) |
| `prompt` | string | 是 | 图片描述提示词 |
| `n` | integer | 否 | 生成图片数量，默认 `1` |
| `size` | string | 否 | 图片尺寸/比例，见[尺寸说明](#5-尺寸说明)，默认 `1024x1024`；网关内部映射为上游 `aspectRatio` 字段 |
| `quality` | string | 否 | 图片质量（仅 `gpt-image-2-vip` 有效），见[quality 参数说明](#6-quality-参数说明) |
| `response_format` | string | 否 | 响应格式，固定使用 `b64_json` |

---

## 4. 图片编辑（参考图生图）

提供一张或多张参考图，由 AI 根据提示词进行编辑或风格迁移。

### 接口

```
POST /v1/images/edits
```

### 方式一：multipart/form-data（推荐，支持直接上传文件）

```http
POST /v1/images/edits
Authorization: Bearer {your_api_key}
Content-Type: multipart/form-data
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称 |
| `prompt` | string | 是 | 编辑描述提示词 |
| `image` | file | 是 | 参考图片文件（支持 PNG / JPEG / WebP，可传多个，字段名支持 `image`、`image[]`、`image[0]` 等） |
| `size` | string | 否 | 输出图片尺寸/比例，见[尺寸说明](#5-尺寸说明)；映射为上游 `aspectRatio` 字段 |
| `quality` | string | 否 | 图片质量，见[quality 参数说明](#6-quality-参数说明) |

**示例（curl）：**

```bash
curl https://your-domain.com/v1/images/edits \
  -H "Authorization: Bearer sk-xxxx" \
  -F model="gpt-image-2" \
  -F prompt="将图片风格改为水彩画风格" \
  -F image="@/path/to/reference.jpg" \
  -F size="1024x1024"
```

### 方式二：application/json（传图片 URL）

```json
{
  "model": "gpt-image-2",
  "prompt": "将图片风格改为水彩画风格",
  "size": "1024x1024",
  "urls": [
    "https://example.com/reference1.jpg",
    "https://example.com/reference2.jpg"
  ]
}
```

> **注意**：`urls` 字段为本网关扩展字段，置于 JSON body 顶层，包含参考图的公网可访问 URL 列表。

---

## 5. 尺寸说明

`size` 参数支持 OpenAI 标准像素格式（`宽x高`）以及比例格式（`宽:高`）。网关会将其转换后以 `aspectRatio` 字段发送至上游 GRSAI 服务。

`size` 直接填写比例字符串（如 `"1:1"`、`"16:9"`、`"3:4"` 等）时，原样透传；填写像素格式时按下表映射。

### 标准尺寸（gpt-image-2 / gpt-image-2-vip 均支持）

| size 值 | 实际比例 | 说明 |
|---|---|---|
| `1024x1024` | 1:1 | 正方形，1K（默认） |
| `512x512` | 1:1 | 正方形，小尺寸 |
| `256x256` | 1:1 | 正方形，最小 |
| `1536x1024` | 3:2 | 横版 |
| `1792x1024` | 3:2 | 横版宽幅 |
| `1024x1536` | 2:3 | 竖版 |
| `1024x1792` | 2:3 | 竖版高幅 |
| `1280x720` | 16:9 | 横版宽屏 |
| `720x1280` | 9:16 | 竖版全屏 |
| `auto` | — | 由模型自动决定 |

也可直接填写比例字符串，例如 `"1:1"`、`"16:9"`、`"3:4"` 等。

### 高分辨率尺寸（仅 gpt-image-2-vip 支持）

| size 值 | 说明 |
|---|---|
| `2048x2048` | 2K 正方形 |
| `4096x4096` | 4K 正方形 |
| 其他 `宽x高` 格式 | 可参考 OpenAI 官方文档支持的像素值直接填写 |

> 超出标准尺寸列表的像素值（如 `2048x2048`）会直接透传给上游，请确保使用 `gpt-image-2-vip` 模型。

---

## 6. quality 参数说明

`quality` 参数用于控制图片的生成质量，**仅对 `gpt-image-2-vip` 有效**。

| 值 | 说明 |
|---|---|
| `auto` | 自动（默认） |
| `low` | 低质量，速度最快 |
| `medium` | 中等质量 |
| `high` | 高质量，速度最慢 |

---

## 7. 响应格式

### 成功响应

```json
{
  "created": 1714444800,
  "data": [
    {
      "b64_json": "iVBORw0KGgo..."
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `created` | integer | 生成时间戳（Unix 秒） |
| `data` | array | 图片数组 |
| `data[].b64_json` | string | Base64 编码的图片数据（PNG 格式） |

> 响应图片统一以 `b64_json` 形式返回，解码后即为 PNG 二进制数据。

---

## 8. 错误处理

### 通用错误格式

```json
{
  "error": {
    "message": "错误描述",
    "type": "invalid_request_error",
    "code": "invalid_request"
  }
}
```

### 常见错误

| HTTP 状态码 | 错误场景 | 说明 |
|---|---|---|
| `400` | 内容违规 | 提示词或参考图触发内容政策，请求被拦截，**不扣费** |
| `400` | 参数错误 | 必填参数缺失或格式不正确 |
| `400` | 无参考图 | 调用图片编辑接口时未提供参考图 |
| `401` | 认证失败 | API Key 无效或已过期 |
| `429` | 超出限流 | 请求速率超出限制，稍后重试 |
| `500` | 上游错误 | 上游服务异常，可重试 |

### 内容违规说明

当图片生成因内容政策被拦截时：
- 返回 HTTP `400`
- 错误信息为：`请求违反内容政策，图片生成被拦截`
- **不扣除额度**

---

## 9. 计费说明

- 按实际生成成功的图片数量计费
- 内容违规被拦截（返回 400）的请求**不扣费**
- 计费单位基于 token，输入 token 按提示词字符数估算（约 4 字符/token），输出 token 按图片尺寸计算

---

## 10. 代码示例

### Python

```python
import base64
import requests

API_KEY = "sk-your-api-key"
BASE_URL = "https://your-domain.com"

def generate_image(prompt: str, model: str = "gpt-image-2", size: str = "1024x1024", quality: str = None):
    payload = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": size,
        "response_format": "b64_json",
    }
    if quality:
        payload["quality"] = quality

    resp = requests.post(
        f"{BASE_URL}/v1/images/generations",
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()
    b64 = resp.json()["data"][0]["b64_json"]
    with open("output.png", "wb") as f:
        f.write(base64.b64decode(b64))
    print("图片已保存至 output.png")

# 标准生图
generate_image("一只橘猫坐在窗台上看夕阳")

# 2K 高清生图（需使用 vip 模型）
generate_image("一只橘猫坐在窗台上看夕阳", model="gpt-image-2-vip", size="2048x2048", quality="high")
```

### JavaScript / Node.js

```javascript
import fs from 'fs';
import fetch from 'node-fetch';

const API_KEY = 'sk-your-api-key';
const BASE_URL = 'https://your-domain.com';

async function generateImage(prompt, { model = 'gpt-image-2', size = '1024x1024', quality } = {}) {
  const body = { model, prompt, n: 1, size, response_format: 'b64_json' };
  if (quality) body.quality = quality;

  const res = await fetch(`${BASE_URL}/v1/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const b64 = data.data[0].b64_json;
  fs.writeFileSync('output.png', Buffer.from(b64, 'base64'));
  console.log('图片已保存至 output.png');
}

// 标准生图
await generateImage('一只橘猫坐在窗台上看夕阳');

// 4K 高清生图（需使用 vip 模型）
await generateImage('一只橘猫坐在窗台上看夕阳', { model: 'gpt-image-2-vip', size: '4096x4096', quality: 'high' });
```

### curl — 图片编辑（上传参考图）

```bash
curl https://your-domain.com/v1/images/edits \
  -H "Authorization: Bearer sk-your-api-key" \
  -F model="gpt-image-2" \
  -F prompt="将背景替换为海边日落场景" \
  -F image="@/path/to/photo.jpg" \
  -F size="1024x1024" \
  | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
with open('edited.png', 'wb') as f:
    f.write(base64.b64decode(data['data'][0]['b64_json']))
print('图片已保存至 edited.png')
"
```
