# 用户信息查询 API 对接文档

> **适用角色**: 普通管理员 (role = 10) / 普通用户 (role = 1)  
> **基础地址**: `https://your-domain.com`  
> **最后更新**: 2026-04-03

---

## 目录

- [1. 认证方式](#1-认证方式)
  - [1.1 方式 A：系统访问令牌（推荐）](#11-方式-a系统访问令牌推荐)
  - [1.2 方式 B：Session Cookie 登录](#12-方式-bsession-cookie-登录)
- [2. 获取当前用户信息](#2-获取当前用户信息)
- [3. 获取用户列表](#3-获取用户列表)
- [4. 获取指定用户信息](#4-获取指定用户信息)
- [5. 搜索用户](#5-搜索用户)
- [6. 通用响应格式](#6-通用响应格式)
- [7. 常见错误](#7-常见错误)

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
> - 不能使用此令牌访问 Playground 功能

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

#### 后续请求

```bash
# 登录并保存 Cookie
curl -X POST https://your-domain.com/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_user","password":"your_password"}' \
  -c cookies.txt

# 后续请求携带 Cookie
curl https://your-domain.com/api/user/self -b cookies.txt
```

> Session Cookie 有超时机制，长期运行的程序需处理过期后重新登录的逻辑。

---

## 2. 获取当前用户信息

获取当前已认证用户的详细信息。

```
GET /api/user/self
```

**权限：** UserAuth

**cURL 示例（系统访问令牌）：**

```bash
curl -X GET https://your-domain.com/api/user/self \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"
```

**cURL 示例（Session Cookie）：**

```bash
curl -X GET https://your-domain.com/api/user/self \
  -b cookies.txt
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
    "email": "admin@example.com",
    "group": "default",
    "quota": 5000000,
    "used_quota": 1500000,
    "request_count": 320,
    "aff_code": "ABC123",
    "aff_count": 5,
    "aff_quota": 2000,
    "aff_history_quota": 5000,
    "inviter_id": 0,
    "commission_balance": 100.50,
    "commission_total": 500.00
  }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int | 用户 ID |
| `username` | string | 用户名 |
| `display_name` | string | 显示名称 |
| `role` | int | 角色：1=普通用户，10=管理员，100=超级管理员 |
| `status` | int | 状态：1=已启用，2=已禁用 |
| `email` | string | 绑定邮箱 |
| `group` | string | 用户分组 |
| `quota` | int | 剩余额度 |
| `used_quota` | int | 已使用额度 |
| `request_count` | int | 累计请求次数 |
| `aff_code` | string | 邀请码 |
| `aff_count` | int | 邀请人数 |
| `aff_quota` | int | 邀请剩余奖励额度 |
| `aff_history_quota` | int | 邀请历史累计奖励额度 |
| `inviter_id` | int | 邀请人 ID（0 表示无邀请人） |
| `commission_balance` | float | 佣金余额 |
| `commission_total` | float | 佣金累计总额 |

> **注意：** 普通用户调用此接口不会返回 `remark`（备注）字段。

---

## 3. 获取用户列表

分页获取所有用户列表（包含已软删除的用户）。

```
GET /api/user/?p={page}&page_size={page_size}
```

**权限：** AdminAuth

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `p` | int | ❌ | 1 | 页码 |
| `page_size` | int | ❌ | 10 | 每页条数（最大 100） |

**cURL 示例：**

```bash
curl -X GET "https://your-domain.com/api/user/?p=1&page_size=10" \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"
```

**成功响应：**

```json
{
  "success": true,
  "message": "",
  "data": {
    "page": 1,
    "page_size": 10,
    "total": 42,
    "items": [
      {
        "id": 1,
        "username": "user1",
        "display_name": "用户一",
        "role": 1,
        "status": 1,
        "email": "user1@example.com",
        "group": "default",
        "quota": 1000000,
        "used_quota": 250000,
        "request_count": 100,
        "aff_code": "XYZ789",
        "inviter_id": 10
      },
      {
        "id": 2,
        "username": "user2",
        "display_name": "用户二",
        "role": 1,
        "status": 1,
        "email": "user2@example.com",
        "group": "pro",
        "quota": 2000000,
        "used_quota": 500000,
        "request_count": 200,
        "aff_code": "ABC456",
        "inviter_id": 0
      }
    ]
  }
}
```

> **注意：** 返回结果中密码字段始终被过滤，不会返回。

---

## 4. 获取指定用户信息

根据用户 ID 获取单个用户的详细信息。

```
GET /api/user/{id}
```

**权限：** AdminAuth

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | int | 用户 ID |

**cURL 示例：**

```bash
curl -X GET https://your-domain.com/api/user/5 \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"
```

**成功响应：**

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 5,
    "username": "developer1",
    "display_name": "开发者一号",
    "role": 1,
    "status": 1,
    "email": "dev1@example.com",
    "group": "pro",
    "quota": 2000000,
    "used_quota": 800000,
    "request_count": 450,
    "aff_code": "DEV001",
    "aff_count": 3,
    "aff_quota": 1000,
    "aff_history_quota": 3000,
    "inviter_id": 10,
    "commission_balance": 50.00,
    "commission_total": 200.00,
    "remark": "测试用户"
  }
}
```

> **注意：** 管理员接口会返回 `remark`（备注）字段，`GetSelf` 接口不返回此字段。

---

## 5. 搜索用户

根据关键词搜索用户，支持按用户名、邮箱、显示名称或用户 ID 搜索。

```
GET /api/user/search?keyword={keyword}&group={group}&p={page}&page_size={page_size}
```

**权限：** AdminAuth

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `keyword` | string | ✅ | - | 搜索关键词（用户名/邮箱/显示名称/用户ID） |
| `group` | string | ❌ | - | 按用户分组过滤 |
| `p` | int | ❌ | 1 | 页码 |
| `page_size` | int | ❌ | 10 | 每页条数（最大 100） |

**cURL 示例：**

```bash
# 按关键词搜索
curl -X GET "https://your-domain.com/api/user/search?keyword=developer&p=1&page_size=10" \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"

# 按关键词 + 分组过滤
curl -X GET "https://your-domain.com/api/user/search?keyword=test&group=pro&p=1" \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"

# 按用户 ID 搜索（关键词为纯数字）
curl -X GET "https://your-domain.com/api/user/search?keyword=5" \
  -H "Authorization: Bearer your_access_token_here" \
  -H "New-Api-User: 10"
```

**成功响应：**

```json
{
  "success": true,
  "message": "",
  "data": {
    "page": 1,
    "page_size": 10,
    "total": 3,
    "items": [
      {
        "id": 5,
        "username": "developer1",
        "display_name": "开发者一号",
        "role": 1,
        "status": 1,
        "email": "dev1@example.com",
        "group": "pro",
        "quota": 2000000,
        "used_quota": 800000,
        "request_count": 450
      }
    ]
  }
}
```

**搜索逻辑说明：**
- 当关键词为**纯数字**时，会同时匹配用户 ID、用户名、邮箱、显示名称
- 当关键词为**非数字**时，匹配用户名、邮箱、显示名称（模糊搜索）
- `group` 参数为可选的精确匹配过滤条件

---

## 6. 通用响应格式

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

HTTP 状态码统一为 `200`，通过 `success` 字段判断是否成功。仅参数绑定错误等少数情况返回 `400` / `403`。

---

## 7. 常见错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `参数错误` | 请求参数格式不正确 | 检查请求 URL 和参数格式 |
| `无权进行此操作` | 当前用户权限不足 | 使用管理员账号（role >= 10）调用 |
| `用户不存在` | 指定的用户 ID 不存在 | 确认用户 ID 是否正确 |

### 接口权限总览

| 接口 | 路径 | 权限要求 |
|------|------|----------|
| 获取当前用户信息 | `GET /api/user/self` | UserAuth（任意已登录用户） |
| 获取用户列表 | `GET /api/user/` | AdminAuth（管理员） |
| 获取指定用户信息 | `GET /api/user/{id}` | AdminAuth（管理员） |
| 搜索用户 | `GET /api/user/search` | AdminAuth（管理员） |

### 两种令牌说明

| | 系统访问令牌 | AI API 令牌 (sk-) |
|---|---|---|
| **用途** | 访问后台管理 API | 调用 AI 模型接口 |
| **认证头** | `Authorization: Bearer <token>` + `New-Api-User: <id>` | `Authorization: Bearer sk-xxx` |
| **获取方式** | Web 后台 → 个人中心 → 安全设置 | 控制台 → 令牌管理 / 批量创建 |
| **可访问接口** | 本文档中的所有管理 API | `/v1/chat/completions` 等 AI 接口 |
