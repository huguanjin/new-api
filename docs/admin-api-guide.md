# 普通管理员 API 对接文档

> **适用角色**: 普通管理员 (role = 10)  
> **基础地址**: `https://your-domain.com`  
> **最后更新**: 2026-04-02

---

## 目录

- [1. 认证方式](#1-认证方式)
  - [1.1 方式 A：系统访问令牌（推荐）](#11-方式-a系统访问令牌推荐)
  - [1.2 方式 B：Session Cookie 登录](#12-方式-bsession-cookie-登录)
- [2. 用户注册](#2-用户注册)
  - [2.1 公开注册接口](#21-公开注册接口)
  - [2.2 管理员创建用户](#22-管理员创建用户)
  - [2.3 批量创建用户](#23-批量创建用户)
- [3. 用户令牌管理](#3-用户令牌管理)
  - [3.1 创建令牌（当前用户）](#31-创建令牌当前用户)
  - [3.2 查看指定用户的令牌](#32-查看指定用户的令牌)
  - [3.3 获取令牌列表](#33-获取令牌列表)
  - [3.4 更新令牌](#34-更新令牌)
  - [3.5 删除令牌](#35-删除令牌)
- [4. 订阅套餐购买](#4-订阅套餐购买)
  - [4.1 获取套餐列表](#41-获取套餐列表)
  - [4.2 易支付下单](#42-易支付下单)
  - [4.3 Stripe 下单](#43-stripe-下单)
  - [4.4 Creem 下单](#44-creem-下单)
  - [4.5 获取当前用户订阅信息](#45-获取当前用户订阅信息)
  - [4.6 管理员为用户绑定订阅](#46-管理员为用户绑定订阅)
  - [4.7 管理员为用户创建订阅](#47-管理员为用户创建订阅)
  - [4.8 管理员查看所有用户订阅](#48-管理员查看所有用户订阅)
  - [4.9 管理员查看指定用户订阅](#49-管理员查看指定用户订阅)
  - [4.10 管理员作废订阅](#410-管理员作废订阅)
  - [4.11 管理员删除订阅](#411-管理员删除订阅)
- [5. 用户信息查询](#5-用户信息查询)
  - [5.1 获取当前用户信息](#51-获取当前用户信息)
  - [5.2 获取用户列表](#52-获取用户列表)
  - [5.3 获取指定用户信息](#53-获取指定用户信息)
  - [5.4 搜索用户](#54-搜索用户)
- [6. 通用响应格式](#6-通用响应格式)
- [7. 错误码与常见问题](#7-错误码与常见问题)

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

## 2. 用户注册

### 2.1 公开注册接口

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

### 2.2 管理员创建用户

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

### 2.3 批量创建用户

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

## 3. 用户令牌管理

> **说明：** 这里的「令牌」是指用户的 AI API 令牌（`sk-` 前缀），用于调用 AI 模型接口，与第 1 节的「系统访问令牌」不同。

### 3.1 创建令牌（当前用户）

为当前登录用户创建 API 令牌。

```
POST /api/token/
Content-Type: application/json
```

**权限：** UserAuth

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 令牌名称，最长 50 字符 |
| `remain_quota` | int | 条件 | 剩余额度（`unlimited_quota=false` 时必填），≥ 0 |
| `unlimited_quota` | bool | ❌ | 无限额度，默认 false |
| `expired_time` | int64 | ❌ | 过期 Unix 时间戳，-1 表示永不过期 |
| `model_limits_enabled` | bool | ❌ | 启用模型限制 |
| `model_limits` | string | ❌ | 允许的模型 ID，逗号分隔，最长 1024 字符 |
| `allow_ips` | string | ❌ | 允许的 IP 地址，换行或逗号分隔 |
| `group` | string | ❌ | 分组：`"auto"` 或指定分组名 |
| `cross_group_retry` | bool | ❌ | 跨组重试（仅 group=auto 时有效） |

**请求示例：**

```json
{
  "name": "Production Token",
  "unlimited_quota": true,
  "expired_time": -1,
  "group": "auto"
}
```

**成功响应：**

```json
{
  "success": true,
  "message": ""
}
```

> **注意：** 此接口只能为当前登录用户创建令牌，无法为其他用户创建。若需为其他用户创建请使用 [批量创建用户](#23-批量创建用户) 接口。

### 3.2 查看指定用户的令牌

管理员查看某个用户的所有令牌。

```
GET /api/user/{user_id}/tokens
```

**权限：** AdminAuth

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `user_id` | int | 目标用户 ID |

**成功响应：**

```json
{
  "success": true,
  "message": "",
  "data": [
    {
      "id": 1,
      "user_id": 5,
      "key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "status": 1,
      "name": "default-token",
      "created_time": 1711900800,
      "accessed_time": 1711900800,
      "expired_time": -1,
      "remain_quota": 0,
      "unlimited_quota": true,
      "used_quota": 15000,
      "group": "default"
    }
  ]
}
```

**令牌状态值：**

| 值 | 状态 |
|----|------|
| 1 | 已启用 |
| 2 | 已禁用 |
| 3 | 已过期 |
| 4 | 额度已耗尽 |

### 3.3 获取令牌列表

获取当前用户的令牌列表。

```
GET /api/token/?p={page}
```

**权限：** UserAuth

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `p` | int | 1 | 页码 |

### 3.4 更新令牌

```
PUT /api/token/
Content-Type: application/json
```

**权限：** UserAuth

请求体与创建令牌相同，额外需要 `id` 字段标识要更新的令牌。

### 3.5 删除令牌

```
DELETE /api/token/{token_id}
```

**权限：** UserAuth

---

## 4. 订阅套餐购买

### 4.1 获取套餐列表

获取所有已启用的订阅套餐。

```
GET /api/subscription/plans
```

**权限：** UserAuth

**成功响应：**

```json
{
  "success": true,
  "data": [
    {
      "plan": {
        "id": 1,
        "title": "专业版月度套餐",
        "subtitle": "适合个人开发者",
        "price_amount": 99.00,
        "currency": "CNY",
        "duration_unit": "month",
        "duration_value": 1,
        "total_amount": 1000000,
        "quota_reset_period": "monthly",
        "rpm_limit": 60,
        "sort_order": 10,
        "max_purchase_per_user": 1,
        "upgrade_group": "pro",
        "enabled": true
      }
    }
  ]
}
```

**套餐字段说明：**

| 字段 | 说明 |
|------|------|
| `price_amount` | 价格金额 |
| `currency` | 货币类型，默认 USD |
| `duration_unit` | 时长单位：`year` / `month` / `day` / `hour` / `custom` |
| `duration_value` | 时长倍数 |
| `total_amount` | 总额度（0 = 无限） |
| `quota_reset_period` | 额度重置周期：`never` / `daily` / `weekly` / `monthly` / `custom` |
| `rpm_limit` | 每分钟请求数限制（0 = 不限） |
| `max_purchase_per_user` | 每用户最大购买次数（0 = 不限） |
| `upgrade_group` | 购买后用户分组升级（空 = 不变） |

### 4.2 易支付下单

通过易支付（Epay）发起购买。

```
POST /api/subscription/epay/pay
Content-Type: application/json
```

**权限：** UserAuth

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `plan_id` | int | ✅ | 套餐 ID |
| `payment_method` | string | ✅ | 支付方式：`alipay`（支付宝）/ `wechat`（微信）等 |

**请求示例：**

```json
{
  "plan_id": 1,
  "payment_method": "alipay"
}
```

**成功响应：**

```json
{
  "message": "success",
  "data": { "...支付参数..." },
  "url": "https://pay.example.com/submit?..."
}
```

> 用户需重定向到返回的 `url` 完成支付。支付完成后，系统通过回调自动完成订阅开通。

### 4.3 Stripe 下单

通过 Stripe 发起购买。

```
POST /api/subscription/stripe/pay
Content-Type: application/json
```

**权限：** UserAuth

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `plan_id` | int | ✅ | 套餐 ID（需配置 `stripe_price_id`） |

**成功响应：**

```json
{
  "message": "success",
  "data": {
    "pay_link": "https://checkout.stripe.com/c/pay/cs_xxx..."
  }
}
```

### 4.4 Creem 下单

通过 Creem 发起购买。

```
POST /api/subscription/creem/pay
Content-Type: application/json
```

**权限：** UserAuth

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `plan_id` | int | ✅ | 套餐 ID（需配置 `creem_product_id`） |

**成功响应：**

```json
{
  "message": "success",
  "data": {
    "pay_link": "https://creem.io/checkout/..."
  }
}
```

### 4.5 获取当前用户订阅信息

```
GET /api/subscription/self
```

**权限：** UserAuth

**成功响应：**

```json
{
  "success": true,
  "data": {
    "preference": "subscription",
    "subscriptions": [
      {
        "id": 1,
        "plan_id": 1,
        "plan_title": "专业版月度套餐",
        "amount_total": 1000000,
        "amount_used": 250000,
        "start_time": 1711900800,
        "end_time": 1714492800,
        "status": "active",
        "rpm_limit": 60
      }
    ],
    "all_subscriptions": [...]
  }
}
```

### 4.6 管理员为用户绑定订阅

管理员直接为指定用户绑定套餐（无需支付）。

```
POST /api/subscription/admin/bind
Content-Type: application/json
```

**权限：** AdminAuth

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_id` | int | ✅ | 目标用户 ID |
| `plan_id` | int | ✅ | 套餐 ID |

**请求示例：**

```json
{
  "user_id": 5,
  "plan_id": 1
}
```

**成功响应：**

```json
{
  "success": true,
  "data": null
}
```

### 4.7 管理员为用户创建订阅

为指定用户创建订阅（无需支付），与绑定类似。

```
POST /api/subscription/admin/users/{user_id}/subscriptions
Content-Type: application/json
```

**权限：** AdminAuth

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `user_id` | int | 目标用户 ID |

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `plan_id` | int | ✅ | 套餐 ID |

### 4.8 管理员查看所有用户订阅

```
GET /api/subscription/admin/subscriptions?p={page}&page_size={size}&status={status}&keyword={keyword}
```

**权限：** AdminAuth

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `p` | int | 1 | 页码 |
| `page_size` | int | 20 | 每页数量 |
| `status` | string | `all` | 筛选状态：`all` / `active` / `expired` / `cancelled` |
| `keyword` | string | 空 | 搜索关键字 |

**成功响应：**

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

### 4.9 管理员查看指定用户订阅

```
GET /api/subscription/admin/users/{user_id}/subscriptions
```

**权限：** AdminAuth

### 4.10 管理员作废订阅

立即作废指定订阅。

```
POST /api/subscription/admin/user_subscriptions/{subscription_id}/invalidate
```

**权限：** AdminAuth

### 4.11 管理员删除订阅

永久删除指定订阅记录。

```
DELETE /api/subscription/admin/user_subscriptions/{subscription_id}
```

**权限：** AdminAuth

---

## 5. 用户信息查询

### 5.1 获取当前用户信息

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

### 5.2 获取用户列表

分页获取所有用户列表（包含已软删除的用户）。

```
GET /api/user/?p={page}&page_size={page_size}
```

**权限：** AdminAuth

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `p` | int | 1 | 页码 |
| `page_size` | int | 10 | 每页条数（最大 100） |

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
      }
    ]
  }
}
```

> **注意：** 返回结果中密码字段始终被过滤，不会返回。

### 5.3 获取指定用户信息

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

### 5.4 搜索用户

根据关键词搜索用户，支持按用户名、邮箱、显示名称或 ID 搜索。

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
- 当关键词为纯数字时，会同时匹配用户 ID、用户名、邮箱、显示名称
- 当关键词为非数字时，匹配用户名、邮箱、显示名称（模糊搜索）
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

## 7. 错误码与常见问题

### 常见错误信息

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `用户注册已禁用` | 系统关闭了注册功能 | 联系超级管理员开启 RegisterEnabled |
| `密码注册已禁用` | 系统关闭了密码注册 | 联系超级管理员开启 PasswordRegisterEnabled |
| `用户已存在` | 用户名或邮箱重复 | 更换用户名重试 |
| `无法创建权限大于等于自己的用户` | 管理员试图创建同级或更高角色 | 只能创建 role < 10 的用户 |
| `已达到最大令牌数量限制` | 用户令牌数超过上限 | 删除不需要的令牌后重试 |
| `无权修改此选项` | 非超级管理员修改受保护选项 | 此选项仅超级管理员可修改 |
| `参数错误` | 请求体格式不正确或缺少必填字段 | 检查请求体 JSON 格式 |

### 购买流程说明

```
用户发起支付请求
    ↓
系统创建待支付订单（pending）
    ↓
系统返回支付链接/参数
    ↓
用户跳转到支付平台完成支付
    ↓
支付平台回调通知系统
    ↓
系统验证支付 → 创建用户订阅 → 升级用户分组 → 订单标记完成
    ↓
用户获得订阅权益（额度、分组、RPM 限制等）
```

### 两种令牌说明

| | 系统访问令牌 | AI API 令牌 (sk-) |
|---|---|---|
| **用途** | 访问后台管理 API | 调用 AI 模型接口 |
| **认证头** | `Authorization: Bearer <token>` + `New-Api-User: <id>` | `Authorization: Bearer sk-xxx` |
| **获取方式** | Web 后台 → 个人中心 → 安全设置 | 控制台 → 令牌管理 / 批量创建 |
| **可访问接口** | 本文档中的所有管理 API | `/v1/chat/completions` 等 AI 接口 |

### 对接建议

1. **认证方式**：优先使用系统访问令牌（方式 A），无需维护 Session 状态
2. **用户 + 令牌一步到位**：用 `POST /api/user/batch` 批量创建用户并自动分配令牌
3. **免支付绑定套餐**：用 `POST /api/subscription/admin/bind` 直接为用户分配套餐
4. **令牌使用**：创建的 AI API 令牌以 `sk-` 开头，用户在 `Authorization: Bearer sk-xxx` 头中携带即可调用 AI 接口
