# 令牌管理 API 对接文档

> **适用角色**: 普通管理员 (role = 10)  
> **基础地址**: `https://your-domain.com`  
> **最后更新**: 2026-04-02

---

## 目录

- [1. 认证方式](#1-认证方式)
  - [1.1 方式 A：系统访问令牌（推荐）](#11-方式-a系统访问令牌推荐)
  - [1.2 方式 B：Session Cookie 登录](#12-方式-bsession-cookie-登录)
- [2. 创建令牌](#2-创建令牌)
- [3. 查看指定用户的令牌](#3-查看指定用户的令牌)
- [4. 筛选令牌列表](#4-筛选令牌列表)
- [5. 更新令牌](#5-更新令牌)
- [6. 删除令牌](#6-删除令牌)
- [7. 令牌类型说明](#7-令牌类型说明)
- [8. 通用响应格式](#8-通用响应格式)
- [9. 常见错误](#9-常见错误)

---

## 1. 认证方式

系统支持两种认证方式，程序化对接推荐使用系统访问令牌。

### 1.1 方式 A：系统访问令牌（推荐）

系统访问令牌是 Session 登录的替代品，适合脚本和自动化程序使用，无需维护 Cookie 状态。

#### 获取令牌

管理员登录 Web 后台 → 个人中心 → 安全设置 → 点击「生成令牌」，复制生成的令牌。

> 此令牌只能通过 Web 界面登录后生成，无法通过 API 生成。

#### 使用方式

所有后续 API 请求需同时携带两个 Header：

```
Authorization: Bearer <access_token>
New-Api-User: <user_id>
```

- `access_token`：在个人中心安全设置中生成的系统访问令牌
- `user_id`：当前管理员的用户 ID（登录后可在个人中心查看）

**cURL 示例：**

```bash
curl -X GET https://your-domain.com/api/user/self \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"
```

> **注意事项：**
> - 系统访问令牌**不同于** AI API 令牌（`sk-` 前缀），两者用途不同
> - 系统访问令牌只能访问后台管理 API，不能调用 AI 模型接口
> - 重新生成令牌后，旧令牌立即失效

### 1.2 方式 B：Session Cookie 登录

适合浏览器或需要临时调用的场景。

#### 登录

```
POST /api/user/login
Content-Type: application/json
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | ✅ | 用户名 |
| `password` | string | ✅ | 密码 |

**请求示例：**

```json
{
  "username": "admin_user",
  "password": "your_password"
}
```

**成功响应：**

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 10,
    "username": "admin_user",
    "display_name": "管理员",
    "role": 10,
    "status": 1,
    "group": "default"
  }
}
```

> 登录成功后，响应头中会包含 `Set-Cookie`，请保存并在后续请求中携带该 Cookie。

---

## 2. 创建令牌

为指定用户创建 AI API 令牌。

```
POST /api/token/
Content-Type: application/json
```

**权限：** UserAuth（管理员可为任意用户创建）

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 令牌名称 |
| `remain_quota` | int | ❌ | 可用额度 |
| `unlimited_quota` | bool | ❌ | 是否无限额度 |
| `expired_time` | int | ❌ | 过期时间（Unix 时间戳秒），-1 = 永不过期 |
| `model_limits_enabled` | bool | ❌ | 是否启用模型限制 |
| `model_limits` | string | ❌ | 允许使用的模型列表（逗号分隔） |
| `allow_ips` | string | ❌ | IP 白名单 |
| `group` | string | ❌ | 令牌分组 |

> 若需要以管理员身份为其他用户创建令牌，可通过批量创建用户接口同时生成，或使用在令牌列表中管理。

**请求示例：**

```json
{
  "name": "customer-api-token",
  "unlimited_quota": true,
  "expired_time": -1,
  "model_limits_enabled": false,
  "group": "default"
}
```

**成功响应：**

```json
{
  "success": true,
  "message": "",
  "data": {
    "key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

> **重要：** 令牌密钥 `key` 仅在创建时返回一次，请妥善保存。

---

## 3. 查看指定用户的令牌

管理员查看某个用户的令牌信息。

```
GET /api/token/{user_id}/{token_id}
```

**权限：** AdminAuth

**路径参数：**

| 参数 | 说明 |
|------|------|
| `user_id` | 目标用户 ID |
| `token_id` | 令牌 ID |

**cURL 示例：**

```bash
curl "https://your-domain.com/api/token/5/100" \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"
```

**成功响应：**

```json
{
  "success": true,
  "data": {
    "id": 100,
    "user_id": 5,
    "key": "sk-xxxx...xxxx",
    "status": 1,
    "name": "customer-api-token",
    "created_time": 1700000000,
    "expired_time": -1,
    "remain_quota": 0,
    "unlimited_quota": true,
    "used_quota": 500000
  }
}
```

---

## 4. 筛选令牌列表

管理员搜索和筛选所有令牌。

```
GET /api/token/search
```

**权限：** AdminAuth

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | ❌ | 搜索关键词（按令牌名称或密钥匹配） |
| `token_id` | int | ❌ | 按令牌 ID 筛选 |
| `user_id` | int | ❌ | 按用户 ID 筛选 |
| `status` | int | ❌ | 令牌状态（1=启用, 2=禁用, 3=已过期, 4=已耗尽） |
| `group` | string | ❌ | 按分组筛选 |
| `model` | string | ❌ | 按模型筛选 |
| `order` | string | ❌ | 排序方式 |
| `p` | int | ❌ | 页码（从 0 开始） |
| `page_size` | int | ❌ | 每页数量 |

**cURL 示例：**

```bash
curl "https://your-domain.com/api/token/search?user_id=5&status=1&p=0&page_size=20" \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"
```

**成功响应：**

```json
{
  "success": true,
  "data": {
    "tokens": [ ... ],
    "total": 50
  }
}
```

---

## 5. 更新令牌

修改已有令牌的配置。

```
PUT /api/token/
Content-Type: application/json
```

**权限：** UserAuth

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | int | ✅ | 令牌 ID |
| `name` | string | ❌ | 新名称 |
| `remain_quota` | int | ❌ | 更新额度 |
| `unlimited_quota` | bool | ❌ | 是否无限额度 |
| `expired_time` | int | ❌ | 过期时间 |
| `model_limits_enabled` | bool | ❌ | 模型限制开关 |
| `model_limits` | string | ❌ | 允许模型列表 |
| `allow_ips` | string | ❌ | IP 白名单 |
| `group` | string | ❌ | 分组 |
| `status` | int | ❌ | 状态（1=启用, 2=手动禁用） |

**请求示例：**

```json
{
  "id": 100,
  "name": "renamed-token",
  "status": 1,
  "unlimited_quota": false,
  "remain_quota": 1000000
}
```

---

## 6. 删除令牌

```
DELETE /api/token/{token_id}
```

**权限：** UserAuth

**路径参数：**

| 参数 | 说明 |
|------|------|
| `token_id` | 令牌 ID |

**cURL 示例：**

```bash
curl -X DELETE "https://your-domain.com/api/token/100" \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"
```

---

## 7. 令牌类型说明

系统中有两种不同的令牌概念，请勿混淆：

| 对比项 | AI API 令牌 (Token) | 系统访问令牌 (Access Token) |
|--------|---------------------|-----------------------------|
| 前缀 | `sk-` | 无固定前缀（十六进制串） |
| 用途 | 调用 AI 模型 API（`/v1/chat/completions` 等） | 访问后台管理 API（`/api/*`） |
| 创建方式 | API 接口或 Web 页面 | 仅限 Web 个人中心生成 |
| 传递方式 | `Authorization: Bearer sk-xxx` | `Authorization: Bearer xxx` + `New-Api-User: id` |
| 可否调用模型 | ✅ | ❌ |
| 可否管理后台 | ❌ | ✅ |

---

## 8. 通用响应格式

所有接口均返回 JSON，统一结构：

**成功：**

```json
{
  "success": true,
  "message": "",
  "data": { ... }
}
```

**失败：**

```json
{
  "success": false,
  "message": "错误描述"
}
```

HTTP 状态码统一为 `200`，通过 `success` 字段判断是否成功。

---

## 9. 常见错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `无权限操作该令牌` | 尝试操作其他管理员的令牌 | 使用管理员 API 或联系目标用户 |
| `令牌不存在` | 令牌 ID 无效或已删除 | 确认令牌 ID |
| `令牌已过期` | 过期时间已到 | 更新过期时间或创建新令牌 |
| `参数错误` | 请求体格式不正确或缺少必填字段 | 检查请求体 JSON 格式 |
