/**
 * 统一日志系统
 * 提供结构化的日志记录功能
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(config = {}) {
    this.level = config.level || process.env.LOG_LEVEL || 'info';
    this.logFile = config.logFile || process.env.LOG_FILE;
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    if (this.logFile) {
      this.ensureLogDir();
    }
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDir() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * 格式化日志消息
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {object} meta - 元数据
   * @returns {string} 格式化后的日志
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logObject = {
      timestamp,
      level,
      message,
      ...meta
    };
    
    if (Object.keys(meta).length === 0) {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    }
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}\n`;
  }

  /**
   * 写入日志文件
   * @param {string} message - 日志消息
   */
  writeToFile(message) {
    if (!this.logFile) return;
    
    try {
      // 检查文件大小，超过限制则重命名
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxFileSize) {
          const backupFile = `${this.logFile}.${Date.now()}.bak`;
          fs.renameSync(this.logFile, backupFile);
        }
      }
      
      fs.appendFileSync(this.logFile, message);
    } catch (error) {
      console.error('写入日志文件失败:', error);
    }
  }

  /**
   * 检查日志级别
   * @param {string} level - 日志级别
   * @returns {boolean} 是否应该记录
   */
  shouldLog(level) {
    const currentLevel = this.levels[this.level] || this.levels.info;
    const messageLevel = this.levels[level] || this.levels.info;
    return messageLevel <= currentLevel;
  }

  /**
   * 记录错误日志
   * @param {string} message - 日志消息
   * @param {object} meta - 元数据
   */
  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage('error', message, meta);
      console.error(formatted.trim());
      this.writeToFile(formatted);
    }
  }

  /**
   * 记录警告日志
   * @param {string} message - 日志消息
   * @param {object} meta - 元数据
   */
  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message, meta);
      console.warn(formatted.trim());
      this.writeToFile(formatted);
    }
  }

  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {object} meta - 元数据
   */
  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message, meta);
      console.log(formatted.trim());
      this.writeToFile(formatted);
    }
  }

  /**
   * 记录调试日志
   * @param {string} message - 日志消息
   * @param {object} meta - 元数据
   */
  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message, meta);
      console.log(formatted.trim());
      this.writeToFile(formatted);
    }
  }

  /**
   * 记录 HTTP 请求
   * @param {object} req - Express 请求对象
   * @param {object} res - Express 响应对象
   * @param {number} responseTime - 响应时间（毫秒）
   */
  logRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };
    
    if (res.statusCode >= 400) {
      this.warn(`HTTP ${req.method} ${req.url}`, meta);
    } else {
      this.info(`HTTP ${req.method} ${req.url}`, meta);
    }
  }
}

// 创建全局日志实例
const logger = new Logger();

module.exports = logger;