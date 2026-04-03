# 用户注册 API 对接文档

> **适用角色**: 普通管理员 (role = 10)  
> **基础地址**: `https://your-domain.com`  
> **最后更新**: 2026-04-02

---

## 目录

- [1. 认证方式](#1-认证方式)
  - [1.1 方式 A：系统访问令牌（推荐）](#11-方式-a系统访问令牌推荐)
  - [1.2 方式 B：Session Cookie 登录](#12-方式-bsession-cookie-登录)
- [2. 公开注册接口](#2-公开注册接口)
- [3. 管理员创建用户](#3-管理员创建用户)
- [4. 批量创建用户](#4-批量创建用户)
- [5. 通用响应格式](#5-通用响应格式)
- [6. 常见错误](#6-常见错误)

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

**若启用了 2FA：**

```json
{
  "success": true,
  "message": "User Require 2FA",
  "data": { "require_2fa": true }
}
```

#### 后续请求

```bash
# 登录并保存 Cookie
curl -X POST https://your-domain.com/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_user","password":"your_password"}' \
  -c cookies.txt

# 后续请求携带 Cookie
curl https://your-domain.com/api/user/ -b cookies.txt
```

> Session Cookie 有超时机制，长期运行的程序需处理过期后重新登录的逻辑。

---

## 2. 公开注册接口

前端用户自助注册，不需要登录。需系统开启注册功能。

```
POST /api/user/register
Content-Type: application/json
```

**中间件：** 频率限制 + Turnstile 验证码（若已启用）

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | ✅ | 用户名，最长 20 字符，唯一 |
| `password` | string | ✅ | 密码，8-20 字符 |
| `email` | string | 条件 | 开启邮箱验证时必填 |
| `verification_code` | string | 条件 | 开启邮箱验证时必填 |
| `aff_code` | string | ❌ | 邀请码（关联邀请人） |
| `display_name` | string | ❌ | 显示名称，最长 20 字符 |

**请求示例：**

```json
{
  "username": "new_user",
  "password": "securePass123",
  "display_name": "新用户",
  "aff_code": "abc123"
}
```

**成功响应：**

```json
{
  "success": true,
  "message": ""
}
```

**注意事项：**
- 注册的用户角色固定为普通用户 (role = 1)，无法通过此接口创建管理员
- 若系统启用了 Turnstile 验证码，需在 URL 参数中附带 `?turnstile=<token>`
- 注册的用户默认没有 API 令牌，除非系统配置了自动生成默认令牌

---

## 3. 管理员创建用户

管理员直接创建用户，无需邮箱验证和注册限制。

```
POST /api/user/
Content-Type: application/json
```

**权限：** AdminAuth

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | ✅ | 用户名，最长 20 字符 |
| `password` | string | ✅ | 密码，至少 8 字符 |
| `display_name` | string | ❌ | 显示名称，默认为用户名 |
| `role` | int | ❌ | 用户角色，必须小于当前用户角色 |

**角色值说明：**

| 值 | 角色 |
|----|------|
| 1 | 普通用户 |
| 10 | 普通管理员 |
| 100 | 超级管理员 |

> **约束：** 普通管理员 (role=10) 只能创建角色值 < 10 的用户，即只能创建普通用户。

**请求示例：**

```json
{
  "username": "customer_01",
  "password": "securePass123",
  "display_name": "客户一号",
  "role": 1
}
```

**成功响应：**

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 15
  }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `data.id` | int | 新创建用户的 ID |

---

## 4. 批量创建用户

一次性创建多个用户并自动生成 API 令牌。**推荐用于批量对接场景。**

```
POST /api/user/batch
Content-Type: application/json
```

**权限：** AdminAuth

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username_prefix` | string | ✅ | 用户名前缀，最长 12 字符 |
| `username_mode` | string | ✅ | `sequential`（顺序编号）/ `random`（随机后缀） |
| `start_number` | int | 条件 | sequential 模式下的起始编号 |
| `count` | int | ✅ | 创建数量，1-100 |
| `password` | string | ✅ | 统一密码，至少 8 字符 |
| `token_name` | string | ❌ | 令牌名称 |
| `token_group` | string | ❌ | 令牌分组 |
| `token_unlimited_quota` | bool | ❌ | 令牌无限额度 |
| `token_quota` | int | ❌ | 令牌额度 |
| `user_quota` | int | ❌ | 用户初始额度 |
| `user_group` | string | ❌ | 用户分组 |

**请求示例：**

```json
{
  "username_prefix": "cust",
  "username_mode": "sequential",
  "start_number": 1,
  "count": 5,
  "password": "defaultPass123",
  "token_name": "default-token",
  "token_unlimited_quota": true,
  "token_group": "default"
}
```

**成功响应：**

```json
{
  "success": true,
  "data": [
    {
      "username": "cust1",
      "password": "defaultPass123",
      "token_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    },
    {
      "username": "cust2",
      "password": "defaultPass123",
      "token_key": "sk-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
    }
  ]
}
```

> **提示：** 批量创建是唯一能同时创建用户和 API 令牌的接口，建议用于批量对接场景。

---

## 5. 通用响应格式

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

## 6. 常见错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `用户注册已禁用` | 系统关闭了注册功能 | 联系超级管理员开启 RegisterEnabled |
| `密码注册已禁用` | 系统关闭了密码注册 | 联系超级管理员开启 PasswordRegisterEnabled |
| `用户已存在` | 用户名或邮箱重复 | 更换用户名重试 |
| `无法创建权限大于等于自己的用户` | 管理员试图创建同级或更高角色 | 只能创建 role < 10 的用户 |
| `参数错误` | 请求体格式不正确或缺少必填字段 | 检查请求体 JSON 格式 |
