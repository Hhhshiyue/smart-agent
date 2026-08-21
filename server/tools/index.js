/**
 * 工具管理模块
 * 负责工具的注册、管理和调用
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const ToolValidator = require('./validator');
const { safeCalculate } = require('./math-parser');

class ToolManager {
  constructor() {
    this.tools = new Map();
    this.validator = new ToolValidator();
    this.registerBuiltinTools();
  }

  /**
   * 注册内置工具
   */
  registerBuiltinTools() {
    // 网页抓取工具
    this.register('web_scraper', {
      description: '抓取网页内容并提取信息',
      keywords: ['抓取', '网页', '网站', '爬取'],
      params: ['url'],
      execute: async (params) => {
        try {
          const response = await axios.get(params.url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const $ = cheerio.load(response.data);
          return {
            success: true,
            title: $('title').text(),
            content: $('body').text().replace(/\s+/g, ' ').trim().substring(0, 1000),
            links: $('a').map((i, el) => $(el).attr('href')).get().slice(0, 10)
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });

    // 文件读取工具
    this.register('file_reader', {
      description: '读取本地文件内容',
      keywords: ['读取', '文件', '查看'],
      params: ['filepath'],
      execute: async (params) => {
        try {
          const content = await fs.readFile(params.filepath, 'utf-8');
          return {
            success: true,
            content: content.substring(0, 2000),
            size: content.length
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });

    // 文件写入工具
    this.register('file_writer', {
      description: '写入内容到本地文件',
      keywords: ['写入', '保存', '创建文件'],
      params: ['filepath', 'content'],
      execute: async (params) => {
        try {
          await fs.writeFile(params.filepath, params.content, 'utf-8');
          return {
            success: true,
            message: `文件已保存到 ${params.filepath}`
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });

    // HTTP 请求工具
    this.register('http_request', {
      description: '发送 HTTP 请求',
      keywords: ['请求', 'API', '调用'],
      params: ['url', 'method', 'data'],
      execute: async (params) => {
        try {
          const method = params.method || 'GET';
          const config = {
            method,
            url: params.url,
            timeout: 10000
          };
          
          if (params.data && method !== 'GET') {
            config.data = params.data;
          }
          
          const response = await axios(config);
          return {
            success: true,
            status: response.status,
            data: response.data
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });

    // 数据分析工具
    this.register('data_analyzer', {
      description: '分析数据并生成统计报告',
      keywords: ['分析', '统计', '数据'],
      params: ['data'],
      execute: async (params) => {
        try {
          const data = typeof params.data === 'string' ? JSON.parse(params.data) : params.data;
          
          if (!Array.isArray(data)) {
            return { success: false, error: '数据必须是数组格式' };
          }
          
          return {
            success: true,
            analysis: {
              count: data.length,
              type: typeof data[0],
              sample: data.slice(0, 3)
            }
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });

    // 计算器工具
    this.register('calculator', {
      description: '执行数学计算（支持加减乘除、括号、小数）',
      keywords: ['计算', '数学', '运算'],
      params: ['expression'],
      execute: async (params) => {
        try {
          const result = safeCalculate(params.expression);
          return {
            success: true,
            expression: params.expression,
            result
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });
  }

  /**
   * 注册自定义工具
   * @param {string} name - 工具名称
   * @param {object} tool - 工具对象
   */
  register(name, tool) {
    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error('工具必须包含 execute 方法');
    }
    
    this.tools.set(name, {
      name,
      description: tool.description || '无描述',
      keywords: tool.keywords || [],
      params: tool.params || [],
      execute: tool.execute
    });
  }

  /**
   * 执行工具
   * @param {string} name - 工具名称
   * @param {object} params - 工具参数
   * @returns {Promise<any>} 执行结果
   */
  async execute(name, params) {
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new Error(`工具 "${name}" 不存在`);
    }
    
    // 参数验证和安全检查
    const validation = this.validator.validate(name, params || {});
    
    if (!validation.valid) {
      throw new Error(`参数验证失败: ${validation.errors.join(', ')}`);
    }
    
    // 记录警告
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn(`工具 ${name} 验证警告:`, validation.warnings);
    }
    
    // 使用净化后的参数
    const sanitizedParams = validation.sanitizedParams || params;
    
    console.log(`执行工具: ${name}`, sanitizedParams);
    
    try {
      const result = await tool.execute(sanitizedParams);
      console.log(`工具执行成功: ${name}`);
      return result;
    } catch (error) {
      console.error(`工具执行失败: ${name}`, error);
      throw error;
    }
  }

  /**
   * 获取工具
   * @param {string} name - 工具名称
   * @returns {object} 工具对象
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具名称
   * @returns {array} 工具名称列表
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取工具描述列表
   * @returns {string} 工具描述文本
   */
  getToolDescriptions() {
    const descriptions = [];
    
    this.tools.forEach((tool, name) => {
      descriptions.push(`- ${name}: ${tool.description} (参数: ${tool.params.join(', ')})`);
    });
    
    return descriptions.join('\n');
  }

  /**
   * 批量执行工具
   * @param {array} toolCalls - 工具调用列表
   * @returns {Promise<array>} 执行结果列表
   */
  async executeBatch(toolCalls) {
    const results = [];
    
    for (const call of toolCalls) {
      try {
        const result = await this.execute(call.name, call.params);
        results.push({
          tool: call.name,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          tool: call.name,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * 检查工具是否存在
   * @param {string} name - 工具名称
   * @returns {boolean} 是否存在
   */
  hasTool(name) {
    return this.tools.has(name);
  }

  /**
   * 移除工具
   * @param {string} name - 工具名称
   */
  removeTool(name) {
    this.tools.delete(name);
  }

  /**
   * 获取工具列表
   * @returns {array} 工具列表
   */
  listTools() {
    const tools = [];
    
    this.tools.forEach((tool, name) => {
      tools.push({
        name,
        description: tool.description,
        keywords: tool.keywords,
        params: tool.params
      });
    });
    
    return tools;
  }
}

module.exports = ToolManager;