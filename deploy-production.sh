# 生产环境部署脚本
# 请按步骤执行

## 步骤 1: 创建生产环境配置

# 复制示例配置文件
cp .env.example .env

# 编辑 .env 文件，设置以下关键配置：
# LLM_API_KEY=your_real_api_key_here  <- 替换为真实 API Key
# JWT_SECRET=your-strong-random-string  <- 使用强随机字符串
# HOST=0.0.0.0  <- 允许外部访问
# AUTH_ENABLED=true  <- 启用认证

## 步骤 2: 安装 PM2 进程管理器

npm install -g pm2

## 步骤 3: 启动服务

# 基础启动
pm2 start app.js --name smart-agent

# 或者使用高级配置启动（推荐）
pm2 start app.js \
  --name smart-agent \
  --instances 1 \
  --max-memory-restart 500M \
  --env production \
  --log ./data/logs/app.log \
  --error ./data/logs/error.log

## 步骤 4: 查看服务状态

pm2 status
pm2 logs smart-agent
pm2 monit

## 步骤 5: 设置开机自启

pm2 startup
pm2 save

## 步骤 6: 测试服务

curl http://localhost:3000/api/health
curl http://localhost:3000/api/info

## 步骤 7: 配置 Nginx 反向代理（可选，用于域名和 HTTPS）

# 创建 Nginx 配置文件
# sudo nano /etc/nginx/sites-available/smart-agent

# 添加以下内容：
# server {
#     listen 80;
#     server_name your-domain.com;
#     
#     location / {
#         proxy_pass http://localhost:3000;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_cache_bypass $http_upgrade;
#         proxy_buffering off;
#     }
# }

# 启用配置
# sudo ln -s /etc/nginx/sites-available/smart-agent /etc/nginx/sites-enabled/
# sudo nginx -t
# sudo systemctl restart nginx

## 步骤 8: 配置 HTTPS（推荐）

# 使用 Let's Encrypt 获取免费 SSL 证书
# sudo apt install certbot python3-certbot-nginx
# sudo certbot --nginx -d your-domain.com

## 步骤 9: 监控和日志

# 查看实时日志
pm2 logs smart-agent

# 查看历史日志
cat data/logs/app.log
cat data/logs/error.log

# 监控资源使用
pm2 monit

## 步骤 10: 常用管理命令

# 重启服务
pm2 restart smart-agent

# 停止服务
pm2 stop smart-agent

# 删除服务
pm2 delete smart-agent

# 查看详细信息
pm2 show smart-agent

# 清空日志
pm2 flush