/**
 * 自定义错误类
 * 提供统一的错误处理机制
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = '参数验证失败', errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = '认证失败') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

class ToolExecutionError extends AppError {
  constructor(toolName, message = '工具执行失败') {
    super(`${toolName}: ${message}`, 500, 'TOOL_EXECUTION_ERROR');
    this.toolName = toolName;
  }
}

class LLMError extends AppError {
  constructor(message = 'LLM 请求失败') {
    super(message, 502, 'LLM_ERROR');
  }
}

/**
 * 错误处理中间件
 * @param {Error} err - 错误对象
 * @param {object} req - Express 请求对象
 * @param {object} res - Express 响应对象
 * @param {function} next - 下一个中间件
 */
function errorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // 记录错误日志
  const logger = require('./logger');
  
  if (err.statusCode >= 500) {
    logger.error('服务器错误', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method
    });
  } else {
    logger.warn('客户端错误', {
      error: err.message,
      url: req.url,
      method: req.method
    });
  }
  
  // 发送错误响应
  const response = {
    success: false,
    error: err.message,
    code: err.code || 'UNKNOWN_ERROR'
  };
  
  // 开发环境返回堆栈信息
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err.errors || undefined;
  }
  
  res.status(err.statusCode).json(response);
}

/**
 * 异步错误捕获包装器
 * @param {function} fn - 异步函数
 * @returns {function} 包装后的函数
 */
function catchAsync(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ToolExecutionError,
  LLMError,
  errorHandler,
  catchAsync
};