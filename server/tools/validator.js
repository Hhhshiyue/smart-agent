/**
 * 工具参数验证器
 * 提供参数验证和安全检查功能
 */

const path = require('path');
const fs = require('fs');

class ToolValidator {
  constructor() {
    this.schemas = this.initSchemas();
    this.allowedDirectories = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'temp')
    ];
    this.forbiddenPatterns = [
      /\.\./,           // 禁止路径遍历
      /\/etc\//,        // 禁止访问系统目录
      /\/root\//,       // 禁止访问root目录
      /\\windows\\/i,   // 禁止访问Windows系统目录
    ];
  }

  /**
   * 初始化工具参数schema
   * @returns {object} Schema定义
   */
  initSchemas() {
    return {
      web_scraper: {
        url: {
          type: 'string',
          required: true,
          pattern: /^https?:\/\/.+/,
          maxLength: 2048
        }
      },
      file_reader: {
        filepath: {
          type: 'string',
          required: true,
          custom: this.validateFilePath.bind(this)
        }
      },
      file_writer: {
        filepath: {
          type: 'string',
          required: true,
          custom: this.validateFilePath.bind(this)
        },
        content: {
          type: 'string',
          required: true,
          maxLength: 1024 * 1024 // 1MB 限制
        }
      },
      http_request: {
        url: {
          type: 'string',
          required: true,
          pattern: /^https?:\/\/.+/,
          maxLength: 2048
        },
        method: {
          type: 'string',
          required: false,
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
        },
        data: {
          type: 'object',
          required: false
        }
      },
      data_analyzer: {
        data: {
          type: ['string', 'object', 'array'],
          required: true
        }
      },
      calculator: {
        expression: {
          type: 'string',
          required: true,
          maxLength: 100,
          custom: this.validateMathExpression.bind(this)
        }
      }
    };
  }

  /**
   * 验证参数
   * @param {string} toolName - 工具名称
   * @param {object} params - 参数对象
   * @returns {object} 验证结果 {valid, errors}
   */
  validate(toolName, params) {
    const schema = this.schemas[toolName];
    
    if (!schema) {
      // 没有schema的工具，允许执行但记录警告
      return {
        valid: true,
        warnings: [`工具 ${toolName} 没有参数验证schema`]
      };
    }

    const errors = [];
    const warnings = [];
    const sanitizedParams = {};

    // 检查必需参数
    for (const [paramName, paramSchema] of Object.entries(schema)) {
      const value = params[paramName];

      // 检查必需参数
      if (paramSchema.required && (value === undefined || value === null || value === '')) {
        errors.push(`参数 ${paramName} 是必需的`);
        continue;
      }

      // 如果参数未提供且非必需，跳过验证
      if (value === undefined || value === null) {
        continue;
      }

      // 类型检查
      if (!this.validateType(value, paramSchema.type)) {
        const expectedType = Array.isArray(paramSchema.type) 
          ? paramSchema.type.join(' 或 ') 
          : paramSchema.type;
        errors.push(`参数 ${paramName} 类型错误，期望 ${expectedType}`);
        continue;
      }

      // 字符串长度检查
      if (typeof value === 'string' && paramSchema.maxLength) {
        if (value.length > paramSchema.maxLength) {
          errors.push(`参数 ${paramName} 超过最大长度 ${paramSchema.maxLength}`);
          continue;
        }
      }

      // 正则模式检查
      if (paramSchema.pattern && typeof value === 'string') {
        if (!paramSchema.pattern.test(value)) {
          errors.push(`参数 ${paramName} 格式不正确`);
          continue;
        }
      }

      // 枚举值检查
      if (paramSchema.enum && !paramSchema.enum.includes(value)) {
        errors.push(`参数 ${paramName} 必须是以下值之一: ${paramSchema.enum.join(', ')}`);
        continue;
      }

      // 自定义验证
      if (paramSchema.custom) {
        const customResult = paramSchema.custom(value);
        if (!customResult.valid) {
          errors.push(...customResult.errors);
          continue;
        }
        if (customResult.warnings) {
          warnings.push(...customResult.warnings);
        }
        if (customResult.sanitized !== undefined) {
          sanitizedParams[paramName] = customResult.sanitized;
          continue;
        }
      }

      sanitizedParams[paramName] = value;
    }

    // 检查未知参数
    const unknownParams = Object.keys(params).filter(key => !schema[key]);
    if (unknownParams.length > 0) {
      warnings.push(`未知参数: ${unknownParams.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedParams
    };
  }

  /**
   * 验证参数类型
   * @param {any} value - 参数值
   * @param {string|Array} type - 期望类型
   * @returns {boolean} 是否匹配
   */
  validateType(value, type) {
    const types = Array.isArray(type) ? type : [type];
    const valueType = Array.isArray(value) ? 'array' : typeof value;
    
    return types.some(t => {
      if (t === 'array') return Array.isArray(value);
      if (t === 'object') return valueType === 'object' && !Array.isArray(value);
      return valueType === t;
    });
  }

  /**
   * 验证文件路径安全性
   * @param {string} filepath - 文件路径
   * @returns {object} 验证结果
   */
  validateFilePath(filepath) {
    const errors = [];
    const warnings = [];

    // 检查路径遍历攻击
    for (const pattern of this.forbiddenPatterns) {
      if (pattern.test(filepath)) {
        errors.push(`文件路径包含禁止的路径模式`);
        return { valid: false, errors };
      }
    }

    // 解析绝对路径
    let resolvedPath;
    try {
      resolvedPath = path.resolve(filepath);
    } catch (error) {
      errors.push(`无效的文件路径: ${error.message}`);
      return { valid: false, errors };
    }

    // 检查是否在允许的目录内
    const isAllowed = this.allowedDirectories.some(dir => {
      return resolvedPath.startsWith(dir);
    });

    if (!isAllowed) {
      warnings.push(`文件路径不在允许的目录内: ${resolvedPath}`);
      warnings.push(`允许的目录: ${this.allowedDirectories.join(', ')}`);
    }

    return {
      valid: true,
      warnings,
      sanitized: resolvedPath
    };
  }

  /**
   * 验证数学表达式安全性
   * @param {string} expression - 数学表达式
   * @returns {object} 验证结果
   */
  validateMathExpression(expression) {
    const errors = [];
    
    // 只允许数字、基本运算符和括号
    const safePattern = /^[0-9+\-*/().\s]+$/;
    
    if (!safePattern.test(expression)) {
      errors.push('表达式包含不允许的字符');
      return { valid: false, errors };
    }

    // 检查括号匹配
    let stack = 0;
    for (const char of expression) {
      if (char === '(') stack++;
      if (char === ')') stack--;
      if (stack < 0) {
        errors.push('括号不匹配');
        return { valid: false, errors };
      }
    }
    if (stack !== 0) {
      errors.push('括号不匹配');
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * 添加允许的目录
   * @param {string} dir - 目录路径
   */
  addAllowedDirectory(dir) {
    const resolvedDir = path.resolve(dir);
    if (!this.allowedDirectories.includes(resolvedDir)) {
      this.allowedDirectories.push(resolvedDir);
    }
  }

  /**
   * 添加工具schema
   * @param {string} toolName - 工具名称
   * @param {object} schema - 参数schema
   */
  addSchema(toolName, schema) {
    this.schemas[toolName] = schema;
  }
}

module.exports = ToolValidator;