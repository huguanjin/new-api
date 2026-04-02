# 订阅购买 API 对接文档

> **适用角色**: 普通管理员 (role = 10) / 普通用户 (role = 1)  
> **基础地址**: `https://your-domain.com`  
> **最后更新**: 2026-04-02

---

## 目录

- [1. 认证方式](#1-认证方式)
  - [1.1 方式 A：系统访问令牌（推荐）](#11-方式-a系统访问令牌推荐)
  - [1.2 方式 B：Session Cookie 登录](#12-方式-bsession-cookie-登录)
- [2. 获取套餐列表](#2-获取套餐列表)
- [3. 支付下单](#3-支付下单)
  - [3.1 易支付下单](#31-易支付下单)
  - [3.2 Stripe 下单](#32-stripe-下单)
  - [3.3 Creem 下单](#33-creem-下单)
- [4. 获取当前用户订阅信息](#4-获取当前用户订阅信息)
- [5. 管理员订阅管理](#5-管理员订阅管理)
  - [5.1 管理员为用户绑定订阅](#51-管理员为用户绑定订阅)
  - [5.2 管理员为用户创建订阅](#52-管理员为用户创建订阅)
  - [5.3 管理员查看所有用户订阅](#53-管理员查看所有用户订阅)
  - [5.4 管理员查看指定用户订阅](#54-管理员查看指定用户订阅)
  - [5.5 管理员作废订阅](#55-管理员作废订阅)
  - [5.6 管理员删除订阅](#56-管理员删除订阅)
- [6. 购买流程说明](#6-购买流程说明)
- [7. 通用响应格式](#7-通用响应格式)
- [8. 常见错误](#8-常见错误)

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

## 2. 获取套餐列表

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

---

## 3. 支付下单

### 3.1 易支付下单

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

### 3.2 Stripe 下单

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

### 3.3 Creem 下单

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

---

## 4. 获取当前用户订阅信息

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

---

## 5. 管理员订阅管理

以下接口仅限管理员角色使用。

### 5.1 管理员为用户绑定订阅

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

### 5.2 管理员为用户创建订阅

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

### 5.3 管理员查看所有用户订阅

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

### 5.4 管理员查看指定用户订阅

```
GET /api/subscription/admin/users/{user_id}/subscriptions
```

**权限：** AdminAuth

### 5.5 管理员作废订阅

立即作废指定订阅。

```
POST /api/subscription/admin/user_subscriptions/{subscription_id}/invalidate
```

**权限：** AdminAuth

### 5.6 管理员删除订阅

永久删除指定订阅记录。

```
DELETE /api/subscription/admin/user_subscriptions/{subscription_id}
```

**权限：** AdminAuth

---

## 6. 购买流程说明

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

**管理员直接绑定流程：**

```
管理员调用绑定/创建 API
    ↓
系统直接创建订阅（跳过支付环节）
    ↓
用户立即获得订阅权益
```

---

## 7. 通用响应格式

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

## 8. 常见错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `套餐不存在或已下架` | 套餐 ID 无效或已禁用 | 先调用套餐列表确认可用 |
| `已达到最大购买次数` | 超过套餐的 `max_purchase_per_user` 限制 | 联系管理员调整限制或使用管理员绑定 |
| `支付配置未完成` | 系统未配置支付渠道（Epay/Stripe/Creem） | 联系超级管理员完成支付配置 |
| `参数错误` | 请求体格式不正确或缺少必填字段 | 检查请求体 JSON 格式 |

### 对接建议

1. **免支付绑定套餐**：管理员使用 `POST /api/subscription/admin/bind` 直接为用户分配套餐，无需走支付流程
2. **批量开通推荐流程**：先用批量创建用户 API 创建用户和令牌 → 再用管理员绑定 API 为每个用户绑定套餐
3. **支付回调**：支付下单后用户需跳转到支付平台完成支付，系统通过回调自动处理，无需轮询
