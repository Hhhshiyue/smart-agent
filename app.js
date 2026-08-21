/**
 * Smart Agent 主入口文件
 * 启动 Express 服务器并提供 API 接口
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { config, validate, info } = require('./config');
const { AuthMiddleware } = require('./server/middleware');
const { errorHandler } = require('./server/utils');
const logger = require('./server/utils/logger');

// 创建 Express 应用
const app = express();

// 初始化认证中间件
const authMiddleware = new AuthMiddleware({
  enabled: process.env.AUTH_ENABLED !== 'false' // 默认启用
});

// 暴露认证实例，供设置向导等模块修改密码
app.locals.authMiddleware = authMiddleware;

// 中间件配置
app.use(cors(config.server.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // 监听响应完成事件
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.logRequest(req, res, responseTime);
  });
  
  next();
});

// 根路径（需在静态文件服务之前，以便未配置时重定向到安装向导）
const { isConfigured } = require('./config');
app.get('/', (req, res) => {
  // 未配置 AI 模型时，跳转安装配置向导
  if (!isConfigured()) {
    return res.redirect('/setup.html');
  }
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'client')));

// API 路由
const apiRoutes = require('./server/api/routes');
const streamRoutes = require('./server/api/stream');
const setupRoutes = require('./server/api/setup');

// 认证路由（不需要认证）
app.post('/api/login', authMiddleware.loginHandler);
app.post('/api/auth/login', authMiddleware.loginHandler);

// 安装配置向导（不需要认证）
app.use('/api/setup', setupRoutes);

// 应用认证中间件
app.use('/api', authMiddleware.middleware.bind(authMiddleware));

// API 路由
app.use('/api', apiRoutes);
app.use('/api/stream', streamRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    code: 'NOT_FOUND'
  });
});

// 统一错误处理
app.use(errorHandler);

// 验证配置
const validation = validate();
if (!validation.valid) {
  console.error('配置验证失败:');
  validation.errors.forEach(err => console.error(`  ❌ ${err}`));
  process.exit(1);
}
if (validation.warnings && validation.warnings.length > 0) {
  console.log('\n⚠️  配置警告:');
  validation.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  console.log('');
}

// 启动服务器（端口被占用时自动切换到下一个可用端口）
const basePort = parseInt(config.app.port, 10);
const HOST = config.app.host;
const shouldOpenBrowser = process.argv.includes('--open');

function startServer(port, attempt) {
  const server = app.listen(port, HOST, () => {
    const actualPort = server.address().port;

    console.log('\n=================================');
    console.log('  Smart Agent 服务已启动');
    console.log('=================================');
    if (attempt > 0) {
      console.log(`  ⚠️  端口 ${basePort} 被占用，已自动切换到端口 ${actualPort}`);
    }
    console.log(`  地址: http://${HOST}:${actualPort}`);
    console.log(`  API:  http://${HOST}:${actualPort}/api`);
    console.log(`  文档: http://${HOST}:${actualPort}/api/info`);
    console.log('=================================\n');

    console.log('配置信息:');
    console.log(JSON.stringify(info(), null, 2));

    // 自动打开浏览器（--open 参数触发）
    if (shouldOpenBrowser) {
      const url = `http://${HOST}:${actualPort}`;
      setTimeout(() => {
        const cp = require('child_process');
        cp.exec(`start "" "${url}"`, (err) => {
          if (err) console.error('自动打开浏览器失败:', err.message);
        });
      }, 800);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 10) {
      console.log(`⚠️  端口 ${port} 被占用，尝试端口 ${port + 1} ...`);
      startServer(port + 1, attempt + 1);
    } else {
      console.error('启动服务器失败:', err.message);
      process.exit(1);
    }
  });
}

startServer(basePort, 0);

// 导出 app 供测试使用
module.exports = app;