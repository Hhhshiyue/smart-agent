# Smart Agent - 部署与运维指南

## 目录
- [环境要求](#环境要求)
- [部署方式](#部署方式)
- [配置说明](#配置说明)
- [监控与日志](#监控与日志)
- [性能优化](#性能优化)
- [故障排查](#故障排查)
- [备份恢复](#备份恢复)

## 环境要求

### 系统要求
- **操作系统**: Windows 10+, macOS 10.14+, Ubuntu 18.04+
- **Node.js**: v18.0.0 或更高版本
- **内存**: 至少 1GB RAM（推荐 2GB+）
- **磁盘**: 至少 500MB 可用空间

### 外部依赖
- LLM API 访问权限（DeepSeek/OpenAI/Claude）
- 网络访问（如需抓取外部网站）

## 部署方式

### 1. 本地开发部署

```bash
# 克隆项目
git clone <repository-url>
cd smart-agent

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置必要的配置

# 启动服务
npm start
```

### 2. 生产环境部署

#### 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start app.js --name smart-agent

# 查看状态
pm2 status

# 查看日志
pm2 logs smart-agent

# 设置开机自启
pm2 startup
pm2 save
```

#### 使用 Docker 部署

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# 构建镜像
docker build -t smart-agent:latest .

# 运行容器
docker run -d \
  --name smart-agent \
  -p 3000:3000 \
  -e LLM_API_KEY=your_key_here \
  -v $(pwd)/data:/app/data \
  smart-agent:latest
```

#### 使用 Docker Compose

```yaml
version: '3.8'

services:
  smart-agent:
    build: .
    ports:
      - "3000:3000"
    environment:
      - LLM_API_KEY=${LLM_API_KEY}
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

```bash
docker-compose up -d
```

### 3. 云平台部署

#### 阿里云/腾讯云

1. 购买 ECS/CVM 服务器
2. 安装 Node.js 和 PM2
3. 遵循生产环境部署步骤
4. 配置安全组开放 3000 端口
5. 建议配置 Nginx 反向代理和 SSL

#### Vercel/Railway

1. 连接 Git 仓库
2. 设置环境变量
3. 自动部署

## 配置说明

### 环境变量配置

创建 `.env` 文件：

```env
# LLM 配置
LLM_PROVIDER=deepseek
LLM_API_KEY=your_api_key_here
LLM_MODEL=deepseek-chat
LLM_MAX_TOKENS=2000
LLM_TEMPERATURE=0.7

# Agent 配置
AGENT_MAX_ITERATIONS=15
AGENT_VERBOSE=false

# 认证配置
AUTH_ENABLED=true
JWT_SECRET=your-secret-key-change-this

# 服务器配置
PORT=3000
HOST=0.0.0.0

# 日志配置
LOG_LEVEL=info
LOG_FILE=./data/app.log

# CORS 配置
CORS_ORIGIN=*
```

### 安全配置

1. **修改默认密码**
   - 编辑 `server/middleware/auth.js`
   - 修改默认用户密码
   - 生产环境建议使用数据库存储用户信息

2. **JWT 密钥**
   - 使用强随机字符串作为 JWT_SECRET
   - 不要在代码仓库中提交真实密钥

3. **API 限流**
   - 已内置请求限流
   - 可根据需要调整限制参数

### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
    }
}
```

## 监控与日志

### 日志管理

日志文件位于 `data/app.log`，包含：
- HTTP 请求日志
- 错误日志
- Agent 执行日志

### 日志轮转

日志文件超过 10MB 自动轮转，备份文件格式：
```
app.log.1234567890.bak
```

### 健康检查

```bash
# 健康检查端点
curl http://localhost:3000/api/health

# 服务信息
curl http://localhost:3000/api/info
```

### 监控指标

建议监控：
- HTTP 响应时间
- 错误率
- 内存使用
- API 调用次数
- LLM Token 消耗

## 性能优化

### 1. 内存优化

```javascript
// 定期清理过期会话
setInterval(() => {
  // 清理逻辑
}, 3600000); // 每小时
```

### 2. 缓存策略

- LLM 响应缓存（避免重复请求）
- 工具结果缓存
- 静态资源缓存

### 3. 并发控制

```env
RATE_LIMIT_WINDOW=60000  # 1分钟
RATE_LIMIT_MAX=100        # 最大100次请求
```

### 4. 数据库优化

- 定期压缩向量数据库
- 清理旧的会话历史
- 优化查询索引

## 故障排查

### 常见问题

#### 1. 服务无法启动

**症状**: `npm start` 失败

**排查步骤**:
```bash
# 检查 Node.js 版本
node --version

# 检查依赖
npm install

# 查看错误日志
cat data/app.log
```

#### 2. LLM API 调用失败

**症状**: Agent 无法生成响应

**排查步骤**:
```bash
# 检查 API Key
echo $LLM_API_KEY

# 测试 API 连接
curl -X POST http://localhost:3000/api/llm/test \
  -H "Content-Type: application/json"
```

#### 3. 内存占用过高

**症状**: 服务内存持续增长

**解决方案**:
- 启用会话自动摘要
- 限制向量数据库大小
- 重启服务

#### 4. 认证失败

**症状**: 401 错误

**排查步骤**:
```bash
# 检查认证是否启用
echo $AUTH_ENABLED

# 重新登录
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 日志分析

```bash
# 查看最近的错误
grep "ERROR" data/app.log | tail -20

# 查看 HTTP 错误
grep "status.*[45][0-9][0-9]" data/app.log

# 查看特定时间段的日志
grep "2026-08-04" data/app.log
```

## 备份恢复

### 数据备份

```bash
# 备份数据目录
tar -czf backup_$(date +%Y%m%d).tar.gz data/

# 备份配置文件
cp .env .env.backup
```

### 恢复数据

```bash
# 解压备份
tar -xzf backup_20260804.tar.gz

# 恢复配置
cp .env.backup .env

# 重启服务
pm2 restart smart-agent
```

### 定期备份脚本

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据
tar -czf $BACKUP_DIR/data_$DATE.tar.gz data/

# 删除 7 天前的备份
find $BACKUP_DIR -name "data_*.tar.gz" -mtime +7 -delete

echo "备份完成: $DATE"
```

```bash
# 添加到 crontab（每天凌晨 2 点执行）
0 2 * * * /path/to/backup.sh
```

## 运维检查清单

### 每日检查
- [ ] 服务运行状态
- [ ] 错误日志检查
- [ ] API 调用统计

### 每周检查
- [ ] 性能指标分析
- [ ] 存储空间检查
- [ ] 备份验证

### 每月检查
- [ ] 依赖更新
- [ ] 安全补丁
- [ ] 性能优化

## 安全建议

1. **定期更新依赖**
   ```bash
   npm audit
   npm update
   ```

2. **启用 HTTPS**
   - 使用 Let's Encrypt 免费证书
   - 配置 Nginx SSL

3. **限制文件访问**
   - 工具执行沙箱隔离
   - 禁止访问系统目录

4. **监控异常请求**
   - 设置告警阈值
   - 记录可疑行为

## 联系支持

如有问题，请：
1. 查看日志文件
2. 检查配置项
3. 提交 Issue（附带日志和配置）