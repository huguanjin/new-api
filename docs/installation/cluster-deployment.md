# new-api 集群部署指南（自建方案）

> **部署模式**：可执行文件 + HAProxy 负载均衡 + 自建 MySQL + 自建 Redis  
> **适用场景**：3 台云服务器，追求最低成本和最优性能的自建集群

---

## 目录

- [1. 架构说明](#1-架构说明)
- [2. 服务器分工规划](#2-服务器分工规划)
- [3. 服务器3：部署 MySQL](#3-服务器3部署-mysql)
- [4. 服务器3：部署 Redis](#4-服务器3部署-redis)
- [5. 服务器1 & 2：部署 new-api](#5-服务器1--2部署-new-api)
- [6. 服务器1：部署 HAProxy](#6-服务器1部署-haproxy)
- [7. 域名与 SSL 配置](#7-域名与-ssl-配置)
- [8. 防火墙与安全组配置](#8-防火墙与安全组配置)
- [9. 验证部署](#9-验证部署)
- [10. 日常运维](#10-日常运维)

---

## 1. 架构说明

```
用户请求
    ↓
域名 → 服务器1 公网IP（HAProxy 监听 80/443）
    ↓               ↓
服务器1:3000     服务器2:3000
(new-api)        (new-api)
    ↓               ↓
        服务器3（内网）
    MySQL:3306   Redis:6379
```

**流量链路**：用户 → HAProxy → new-api 实例 → MySQL/Redis

**HAProxy 与 new-api 共存于服务器1**，HAProxy 几乎不消耗资源，两者互不影响。

---

## 2. 服务器分工规划

| 服务器 | 角色 | 运行服务 | 对外端口 |
|---|---|---|---|
| 服务器1 | 入口 + 应用节点 | HAProxy + new-api | 80、443（公网） |
| 服务器2 | 应用节点 | new-api | 3000（仅内网） |
| 服务器3 | 数据层 | MySQL + Redis | 3306、6379（仅内网） |

> **约定**：以下文档中使用以下内网 IP 示例，请替换为实际内网 IP：
> - 服务器1 内网 IP：`10.0.0.1`
> - 服务器2 内网 IP：`10.0.0.2`
> - 服务器3 内网 IP：`10.0.0.3`

---

## 3. 服务器3：部署 MySQL

### 3.1 安装 MySQL

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y mysql-server

# CentOS / Rocky Linux
sudo yum install -y mysql-server
sudo systemctl start mysqld
```

### 3.2 安全初始化

```bash
sudo mysql_secure_installation
```

### 3.3 创建数据库和用户

```bash
sudo mysql -u root -p
```

```sql
-- 创建数据库
CREATE DATABASE `new-api` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用用户，仅允许内网访问
CREATE USER 'newapi'@'10.0.0.%' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON `new-api`.* TO 'newapi'@'10.0.0.%';
FLUSH PRIVILEGES;
```

### 3.4 允许内网连接

编辑 MySQL 配置文件（`/etc/mysql/mysql.conf.d/mysqld.cnf` 或 `/etc/my.cnf`）：

```ini
[mysqld]
# 监听所有网卡（依赖安全组/防火墙限制访问来源）
bind-address = 0.0.0.0
```

```bash
sudo systemctl restart mysql
```

### 3.5 验证

```bash
# 在服务器1或服务器2上测试连通性
mysql -h 10.0.0.3 -u newapi -p new-api -e "SELECT 1;"
```

---

## 4. 服务器3：部署 Redis

### 4.1 安装 Redis

```bash
# Ubuntu / Debian
sudo apt install -y redis-server

# CentOS / Rocky Linux
sudo yum install -y redis
sudo systemctl start redis
```

### 4.2 配置 Redis

编辑 `/etc/redis/redis.conf`（或 `/etc/redis.conf`）：

```conf
# 监听所有网卡
bind 0.0.0.0

# 关闭保护模式（已有密码即可）
protected-mode no

# 设置访问密码
requirepass your_redis_password

# 后台运行
daemonize yes

# 日志文件
logfile /var/log/redis/redis-server.log
```

```bash
sudo systemctl restart redis
sudo systemctl enable redis
```

### 4.3 验证

```bash
# 在服务器1或服务器2上测试
redis-cli -h 10.0.0.3 -a your_redis_password ping
# 预期输出：PONG
```

---

## 5. 服务器1 & 2：部署 new-api

> **两台服务器操作完全相同**，逐一执行以下步骤。

### 5.1 下载可执行文件

前往 [Releases 页面](https://github.com/QuantumNous/new-api/releases) 下载最新版本：

```bash
# 创建部署目录
sudo mkdir -p /opt/new-api/logs
cd /opt/new-api

# 下载（以 linux-amd64 为例，根据实际架构选择）
wget https://github.com/QuantumNous/new-api/releases/latest/download/new-api-linux-amd64 -O new-api
sudo chmod +x new-api
```

### 5.2 创建环境变量配置文件

```bash
sudo nano /opt/new-api/.env
```

写入以下内容（**注意修改所有密码和密钥**）：

```env
# 数据库连接（指向服务器3）
SQL_DSN=newapi:your_strong_password@tcp(10.0.0.3:3306)/new-api

# Redis 连接（指向服务器3）
REDIS_CONN_STRING=redis://:your_redis_password@10.0.0.3:6379

# 多机部署必须设置，三台机器此值必须完全相同！
SESSION_SECRET=请替换为随机长字符串例如openssl_rand_hex_32的输出

# 时区
TZ=Asia/Shanghai

# 启用批量更新（减少数据库写压力）
BATCH_UPDATE_ENABLED=true

# 启用错误日志
ERROR_LOG_ENABLED=true
```

> 生成随机 `SESSION_SECRET`：
> ```bash
> openssl rand -hex 32
> ```

### 5.3 创建 systemd 服务

```bash
sudo nano /etc/systemd/system/new-api.service
```

```ini
[Unit]
Description=new-api Service
After=network.target

[Service]
User=root
WorkingDirectory=/opt/new-api
EnvironmentFile=/opt/new-api/.env
ExecStart=/opt/new-api/new-api --port 3000 --log-dir /opt/new-api/logs
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### 5.4 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl start new-api
sudo systemctl enable new-api

# 查看运行状态
sudo systemctl status new-api

# 查看实时日志
sudo journalctl -u new-api -f
```

### 5.5 验证单节点

```bash
curl http://localhost:3000/api/status
# 预期输出包含 "success":true
```

---

## 6. 服务器1：部署 HAProxy

### 6.1 安装 HAProxy

```bash
# Ubuntu / Debian
sudo apt install -y haproxy

# CentOS / Rocky Linux
sudo yum install -y haproxy
```

### 6.2 配置 HAProxy

备份默认配置：

```bash
sudo cp /etc/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg.bak
```

编辑 `/etc/haproxy/haproxy.cfg`：

```haproxy
global
    log /dev/log local0
    log /dev/log local1 notice
    maxconn 50000
    user haproxy
    group haproxy
    daemon

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    timeout connect 5s
    timeout client  60s
    timeout server  120s
    option  forwardfor
    option  http-server-close

# 统计监控页面（可选，建议仅内网访问）
listen stats
    bind *:8888
    stats enable
    stats uri /haproxy-stats
    stats auth admin:your_stats_password
    stats refresh 10s

# HTTP 前端（如使用 SSL 则改为跳转 HTTPS）
frontend http_front
    bind *:80
    # 若配置了 SSL，取消下行注释以强制跳转 HTTPS
    # redirect scheme https code 301 if !{ ssl_fc }
    default_backend new_api_backend

# HTTPS 前端（配置 SSL 证书后启用）
# frontend https_front
#     bind *:443 ssl crt /etc/haproxy/certs/your-domain.pem
#     default_backend new_api_backend

# new-api 后端集群
backend new_api_backend
    balance roundrobin
    option httpchk GET /api/status
    http-check expect string "success":true

    # 服务器1 本机的 new-api
    server node1 10.0.0.1:3000 check inter 10s fall 3 rise 2
    # 服务器2 的 new-api
    server node2 10.0.0.2:3000 check inter 10s fall 3 rise 2
```

### 6.3 启动 HAProxy

```bash
# 检查配置语法
sudo haproxy -c -f /etc/haproxy/haproxy.cfg

sudo systemctl restart haproxy
sudo systemctl enable haproxy
sudo systemctl status haproxy
```

### 6.4 验证负载均衡

```bash
# 连续请求，观察是否轮流返回
for i in {1..6}; do curl -s http://localhost/api/status | grep -o '"success":true'; done
```

---

## 7. 域名与 SSL 配置

### 7.1 域名解析

在域名服务商控制台，添加 **A 记录**：

```
your-domain.com  →  服务器1 公网IP
```

### 7.2 申请 SSL 证书（使用 acme.sh）

```bash
# 安装 acme.sh
curl https://get.acme.sh | sh
source ~/.bashrc

# 申请证书（HTTP 验证，需 80 端口可访问）
~/.acme.sh/acme.sh --issue -d your-domain.com --webroot /var/www/html

# 合并证书为 HAProxy 所需格式（cert + key 合并为一个 pem）
cat /root/.acme.sh/your-domain.com/fullchain.cer \
    /root/.acme.sh/your-domain.com/your-domain.com.key \
    > /etc/haproxy/certs/your-domain.pem

sudo chmod 600 /etc/haproxy/certs/your-domain.pem
```

### 7.3 启用 HTTPS

修改 `/etc/haproxy/haproxy.cfg`，启用 HTTPS 前端并开启 HTTP 强制跳转：

```haproxy
frontend http_front
    bind *:80
    redirect scheme https code 301 if !{ ssl_fc }
    default_backend new_api_backend

frontend https_front
    bind *:443 ssl crt /etc/haproxy/certs/your-domain.pem
    default_backend new_api_backend
```

```bash
sudo systemctl reload haproxy
```

### 7.4 自动续期证书

```bash
# acme.sh 会自动安装 cron 任务，续期后执行以下命令重载 HAProxy
~/.acme.sh/acme.sh --install-cert -d your-domain.com \
    --fullchain-file /etc/haproxy/certs/your-domain.pem \
    --reloadcmd "cat /root/.acme.sh/your-domain.com/fullchain.cer /root/.acme.sh/your-domain.com/your-domain.com.key > /etc/haproxy/certs/your-domain.pem && systemctl reload haproxy"
```

---

## 8. 防火墙与安全组配置

### 云服务器安全组规则

| 服务器 | 方向 | 端口 | 来源 | 说明 |
|---|---|---|---|---|
| 服务器1 | 入站 | 80、443 | `0.0.0.0/0` | 公网 HTTP/HTTPS |
| 服务器1 | 入站 | 22 | 你的 IP | SSH 管理 |
| 服务器1 | 入站 | 8888 | 你的 IP | HAProxy 监控页（可选） |
| 服务器2 | 入站 | 3000 | 服务器1 内网IP | 仅允许 HAProxy 访问 |
| 服务器2 | 入站 | 22 | 你的 IP | SSH 管理 |
| 服务器3 | 入站 | 3306 | 内网网段 | MySQL，仅内网 |
| 服务器3 | 入站 | 6379 | 内网网段 | Redis，仅内网 |
| 服务器3 | 入站 | 22 | 你的 IP | SSH 管理 |

> **注意**：服务器2 的 3000 端口、服务器3 的 3306/6379 端口**绝对不能**对公网开放。

---

## 9. 验证部署

### 9.1 端到端测试

```bash
# 测试 HTTP 接口
curl https://your-domain.com/api/status

# 预期响应
{"success":true,...}
```

### 9.2 故障转移测试

```bash
# 停止服务器2的 new-api
ssh user@10.0.0.2 "sudo systemctl stop new-api"

# 服务器1 应仍然正常响应
curl https://your-domain.com/api/status

# 恢复
ssh user@10.0.0.2 "sudo systemctl start new-api"
```

### 9.3 查看 HAProxy 监控

浏览器访问 `http://服务器1公网IP:8888/haproxy-stats`（需安全组开放 8888 给你的 IP），可查看两个后端节点的实时状态、请求数、健康检查结果。

---

## 10. 日常运维

### 升级 new-api

> 两台应用服务器（服务器1、服务器2）**逐一升级**，保证升级过程中服务不中断。

```bash
# 1. 先升级服务器2（HAProxy 健康检查失败后自动切流到服务器1）
ssh user@10.0.0.2

cd /opt/new-api
sudo systemctl stop new-api
wget https://github.com/QuantumNous/new-api/releases/latest/download/new-api-linux-amd64 -O new-api
sudo chmod +x new-api
sudo systemctl start new-api

# 验证服务器2恢复正常
curl http://10.0.0.2:3000/api/status

# 2. 再升级服务器1
# 重复以上步骤
```

### 常用命令

```bash
# 查看 new-api 运行状态
sudo systemctl status new-api

# 查看 new-api 实时日志
sudo journalctl -u new-api -f

# 查看 new-api 应用日志
tail -f /opt/new-api/logs/*.log

# 重启 new-api
sudo systemctl restart new-api

# 查看 HAProxy 状态
sudo systemctl status haproxy

# 平滑重载 HAProxy 配置（不中断连接）
sudo systemctl reload haproxy

# 查看 MySQL 状态
sudo systemctl status mysql

# 查看 Redis 状态
sudo systemctl status redis
```

### 数据备份（服务器3）

```bash
# MySQL 每日备份脚本
cat > /opt/backup-mysql.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
mysqldump -u newapi -pyour_strong_password new-api > /opt/backups/new-api-${DATE}.sql
# 只保留最近 7 天
find /opt/backups -name "*.sql" -mtime +7 -delete
EOF

chmod +x /opt/backup-mysql.sh
mkdir -p /opt/backups

# 添加 cron 任务（每天凌晨 3 点执行）
echo "0 3 * * * root /opt/backup-mysql.sh" >> /etc/crontab
```
