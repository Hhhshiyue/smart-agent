/**
 * LLM 接口封装模块
 * 支持多种大语言模型提供商
 */

const axios = require('axios');
const { getDefaultModel, getDefaultBaseUrl, getProvider } = require('./providers');

class LLM {
  constructor(config = {}) {
    this.provider = config.provider || process.env.LLM_PROVIDER || 'deepseek';
    this.apiKey = config.apiKey || process.env.LLM_API_KEY || '';
    this.model = config.model || this.getDefaultModel();
    this.baseUrl = config.baseUrl || this.getDefaultBaseUrl();
    this.maxTokens = config.maxTokens || 2000;
    this.temperature = config.temperature || 0.7;
    this.timeout = config.timeout || 30000;
    const providerInfo = getProvider(this.provider);
    this.apiType = (providerInfo && providerInfo.apiType) || 'openai';
  }

  /**
   * 获取默认模型
   * @returns {string} 默认模型名称
   */
  getDefaultModel() {
    return getDefaultModel(this.provider);
  }

  /**
   * 获取默认API基础URL
   * @returns {string} API基础URL
   */
  getDefaultBaseUrl() {
    return getDefaultBaseUrl(this.provider);
  }

  /**
   * 发送聊天消息
   * @param {string} prompt - 用户输入
   * @param {string|object} options - 系统提示词或额外选项
   * @returns {Promise<string>} 模型回复
   */
  async chat(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('API Key 未设置，请检查配置或设置环境变量 LLM_API_KEY');
    }

    try {
      // 兼容字符串参数作为 systemPrompt
      let requestOptions = options;
      if (typeof options === 'string') {
        requestOptions = { systemPrompt: options };
      }
      
      const response = await this.makeRequest(prompt, requestOptions);
      return this.extractResponse(response);
    } catch (error) {
      console.error(`LLM 请求失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 发起API请求
   * @param {string} prompt - 用户输入
   * @param {object} options - 额外选项
   * @returns {Promise<object>} API响应
   */
  async makeRequest(prompt, options = {}) {
    const headers = this.getHeaders();
    const data = this.buildRequestBody(prompt, options);

    const endpoint = this.apiType === 'anthropic' ? `${this.baseUrl}/messages` : `${this.baseUrl}/chat/completions`;

    const response = await axios.post(
      endpoint,
      data,
      {
        headers,
        timeout: this.timeout
      }
    );

    return response.data;
  }

  /**
   * 获取请求头
   * @returns {object} 请求头对象
   */
  getHeaders() {
    if (this.apiType === 'anthropic') {
      return {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      };
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  /**
   * 构建请求体
   * @param {string} prompt - 用户输入
   * @param {object} options - 额外选项
   * @returns {object} 请求体对象
   */
  buildRequestBody(prompt, options = {}) {
    // Claude (Anthropic) 使用 messages API 格式
    if (this.apiType === 'anthropic') {
      const messages = [{ role: 'user', content: prompt }];
      const body = {
        model: options.model || this.model,
        messages,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature
      };
      if (options.systemPrompt) {
        body.system = options.systemPrompt;
      }
      return body;
    }

    const messages = [];
    
    // 如果有系统提示词，添加 system 角色
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }
    
    // 添加用户消息
    messages.push({
      role: 'user',
      content: prompt
    });
    
    return {
      model: options.model || this.model,
      messages,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      stream: false
    };
  }

  /**
   * 提取响应内容
   * @param {object} response - API响应
   * @returns {string} 响应文本
   */
  extractResponse(response) {
    if (this.apiType === 'anthropic') {
      if (response.content && response.content.length > 0) {
        return response.content.map(c => c.text || '').join('').trim();
      }
      throw new Error('无效的API响应格式');
    }
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content.trim();
    }
    throw new Error('无效的API响应格式');
  }

  /**
   * 流式聊天（用于长文本生成）
   * @param {string} prompt - 用户输入
   * @param {function} onChunk - 流式回调函数
   * @param {object} options - 额外选项（支持 messages 数组用于多轮对话）
   * @returns {Promise<string>} 完整回复
   */
  async streamChat(prompt, onChunk, options = {}) {
    if (!this.apiKey) {
      throw new Error('API Key 未设置');
    }

    const headers = this.getHeaders();
    const isAnthropic = this.apiType === 'anthropic';
    
    // 构建消息列表
    let messages = [];
    if (options.messages && Array.isArray(options.messages)) {
      // 使用提供的消息列表（Claude 不兼容 system 角色，需过滤）
      messages = [...options.messages].filter(m => !(isAnthropic && m.role === 'system'));
      // 添加当前用户消息
      messages.push({ role: 'user', content: prompt });
    } else {
      // 简单对话模式
      messages.push({ role: 'user', content: prompt });
    }
    
    const data = {
      model: options.model || this.model,
      messages,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      stream: true
    };
    if (isAnthropic) {
      if (options.systemPrompt) {
        data.system = options.systemPrompt;
      }
    } else if (options.systemPrompt) {
      messages.unshift({ role: 'system', content: options.systemPrompt });
    }

    const endpoint = isAnthropic ? `${this.baseUrl}/messages` : `${this.baseUrl}/chat/completions`;

    const response = await axios.post(
      endpoint,
      data,
      {
        headers,
        responseType: 'stream',
        timeout: this.timeout
      }
    );

    return new Promise((resolve, reject) => {
      let fullContent = '';

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              let content = '';
              if (isAnthropic) {
                // Claude 流式格式：content_block_delta
                if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
                  content = parsed.delta.text;
                }
              } else {
                content = parsed.choices[0]?.delta?.content || '';
              }
              if (content) {
                fullContent += content;
                if (onChunk) onChunk(content);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      response.data.on('end', () => resolve(fullContent));
      response.data.on('error', reject);
    });
  }

  /**
   * 多轮对话
   * @param {array} messages - 对话历史
   * @param {object} options - 额外选项
   * @returns {Promise<string>} 模型回复
   */
  async multiTurnChat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('API Key 未设置');
    }

    const headers = this.getHeaders();
    const isAnthropic = this.apiType === 'anthropic';
    let data, endpoint;

    if (isAnthropic) {
      // Claude 格式：system 放顶层字段
      const sys = messages.find(m => m.role === 'system');
      const filtered = messages.filter(m => m.role !== 'system');
      data = {
        model: options.model || this.model,
        messages: filtered,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature
      };
      if (sys) data.system = sys.content;
      endpoint = `${this.baseUrl}/messages`;
    } else {
      data = {
        model: options.model || this.model,
        messages,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        stream: false
      };
      endpoint = `${this.baseUrl}/chat/completions`;
    }

    const response = await axios.post(
      endpoint,
      data,
      {
        headers,
        timeout: this.timeout
      }
    );

    return this.extractResponse(response.data);
  }

  /**
   * 测试API连接
   * @returns {Promise<boolean>} 是否连接成功
   */
  async testConnection() {
    try {
      const response = await this.chat('Hello', { maxTokens: 50 });
      return response.length > 0;
    } catch (error) {
      console.error('API 连接测试失败:', error.message);
      return false;
    }
  }

  /**
   * 获取模型信息
   * @returns {object} 模型信息
   */
  getModelInfo() {
    return {
      provider: this.provider,
      model: this.model,
      baseUrl: this.baseUrl,
      maxTokens: this.maxTokens,
      temperature: this.temperature
    };
  }
}

module.exports = LLM;