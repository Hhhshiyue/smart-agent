/**
 * 会话摘要模块
 * 提供会话内容压缩和摘要功能
 */

const LLM = require('../llm');
const VectorStore = require('./vectors');

class SessionSummarizer {
  constructor(config = {}) {
    this.llm = new LLM(config.llm);
    this.vectorStore = new VectorStore(config.vectorStore);
    this.maxMessagesBeforeSummary = config.maxMessagesBeforeSummary || 10;
    this.summaryMinLength = config.summaryMinLength || 5; // 最少消息数才触发摘要
  }

  /**
   * 检查是否需要摘要
   * @param {array} messages - 消息历史
   * @returns {boolean} 是否需要摘要
   */
  shouldSummarize(messages) {
    return messages.length >= this.maxMessagesBeforeSummary;
  }

  /**
   * 生成会话摘要
   * @param {array} messages - 消息历史
   * @param {object} options - 选项
   * @returns {Promise<object>} 摘要结果
   */
  async summarize(messages, options = {}) {
    if (messages.length < this.summaryMinLength) {
      return {
        summary: null,
        reason: '消息数量不足以生成摘要'
      };
    }

    try {
      // 提取关键信息
      const keyInformation = await this.extractKeyInformation(messages);
      
      // 生成摘要
      const summary = await this.generateSummary(messages, keyInformation);
      
      // 提取主题
      const topics = await this.extractTopics(messages);
      
      // 保存到向量存储
      if (options.saveToVectorStore) {
        await this.vectorStore.addDocument(summary, {
          type: 'session_summary',
          messageCount: messages.length,
          topics
        });
      }
      
      return {
        summary,
        keyInformation,
        topics,
        messageCount: messages.length,
        compressedFrom: messages.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('生成摘要失败:', error);
      return {
        summary: null,
        error: error.message
      };
    }
  }

  /**
   * 提取关键信息
   * @param {array} messages - 消息历史
   * @returns {Promise<array>} 关键信息列表
   */
  async extractKeyInformation(messages) {
    const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const prompt = `分析以下对话，提取关键信息：

${conversation}

请提取：
1. 用户的主要需求或问题
2. 提供的重要信息或数据
3. 做出的决策或结论
4. 未解决的问题或待办事项

以 JSON 数组格式输出：["信息1", "信息2", ...]`;

    const response = await this.llm.chat(prompt);
    
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // 解析失败
    }
    
    return [];
  }

  /**
   * 生成摘要
   * @param {array} messages - 消息历史
   * @param {array} keyInformation - 关键信息
   * @returns {Promise<string>} 摘要文本
   */
  async generateSummary(messages, keyInformation) {
    const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const prompt = `请为以下对话生成一个简洁的摘要：

对话内容：
${conversation}

关键信息：
${keyInformation.join('\n')}

摘要要求：
1. 保留重要信息和决策
2. 突出核心问题和解决方案
3. 简洁明了（100-200字）
4. 便于后续查询和理解

摘要：`;

    return await this.llm.chat(prompt);
  }

  /**
   * 提取主题
   * @param {array} messages - 消息历史
   * @returns {Promise<array>} 主题列表
   */
  async extractTopics(messages) {
    const conversation = messages.map(m => m.content).join(' ');
    
    const prompt = `分析以下对话内容，提取主要主题：

${conversation.substring(0, 500)}

请提取 3-5 个主要主题，以 JSON 数组格式输出：["主题1", "主题2", ...]`;

    const response = await this.llm.chat(prompt);
    
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // 解析失败
    }
    
    return [];
  }

  /**
   * 压缩会话历史
   * @param {array} messages - 完整消息历史
   * @param {number} keepLast - 保留最近N条消息
   * @returns {Promise<object>} 压缩后的历史和摘要
   */
  async compress(messages, keepLast = 3) {
    if (!this.shouldSummarize(messages)) {
      return {
        messages,
        summary: null,
        compressed: false
      };
    }

    // 保留最近的消息
    const recentMessages = messages.slice(-keepLast);
    
    // 对前面的消息生成摘要
    const messagesToSummarize = messages.slice(0, -keepLast);
    
    if (messagesToSummarize.length > 0) {
      const summaryResult = await this.summarize(messagesToSummarize, {
        saveToVectorStore: true
      });
      
      // 创建摘要消息
      const summaryMessage = {
        role: 'system',
        content: `之前的对话摘要：\n${summaryResult.summary}\n\n关键信息：\n${summaryResult.keyInformation.join('\n')}`,
        timestamp: new Date().toISOString(),
        type: 'summary'
      };
      
      return {
        messages: [summaryMessage, ...recentMessages],
        summary: summaryResult,
        compressed: true,
        originalLength: messages.length,
        compressedLength: keepLast + 1
      };
    }
    
    return {
      messages,
      summary: null,
      compressed: false
    };
  }

  /**
   * 检索相关历史
   * @param {string} query - 查询内容
   * @param {number} topK - 返回数量
   * @returns {Promise<array>} 相关历史记录
   */
  async retrieveRelevantHistory(query, topK = 3) {
    return await this.vectorStore.search(query, topK);
  }

  /**
   * 自动摘要检查
   * @param {string} sessionId - 会话ID
   * @param {object} memoryManager - 记忆管理器
   * @returns {Promise<object|null>} 摘要结果
   */
  async autoSummarize(sessionId, memoryManager) {
    const messages = memoryManager.getSession(sessionId);
    
    if (this.shouldSummarize(messages)) {
      const result = await this.compress(messages);
      
      if (result.compressed) {
        // 更新会话历史
        memoryManager.sessions.get(sessionId).messages = result.messages;
        
        // 更新元数据
        memoryManager.updateMetadata(sessionId, {
          lastSummary: result.summary.timestamp,
          summaryCount: (memoryManager.getMetadata(sessionId).summaryCount || 0) + 1
        });
        
        return result;
      }
    }
    
    return null;
  }
}

module.exports = SessionSummarizer;