/**
 * 记忆管理模块
 * 负责会话历史和上下文管理
 */

const fs = require('fs').promises;
const path = require('path');

class MemoryManager {
  constructor(config = {}) {
    this.sessions = new Map();
    this.maxHistoryLength = config.maxHistoryLength || 50;
    this.storagePath = config.storagePath || path.join(__dirname, '../../data/memory');
    this.autoSave = config.autoSave !== false;
    this._saveQueue = Promise.resolve(); // 保存队列，确保顺序执行
  }

  /**
   * 初始化：确保存储目录存在，加载历史会话
   */
  async initialize() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      await this.loadAllSessions();
      console.log(`[Memory] 初始化完成，加载 ${this.sessions.size} 个历史会话`);
    } catch (error) {
      console.error(`[Memory] 初始化失败: ${error.message}`);
    }
  }

  /**
   * 创建新会话
   * @returns {string} 会话ID
   */
  createSession() {
    const sessionId = this.generateSessionId();
    
    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date().toISOString(),
      messages: [],
      toolCalls: [],
      metadata: {}
    });
    
    return sessionId;
  }

  /**
   * 生成会话ID
   * @returns {string} 会话ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 添加消息到会话历史
   * @param {string} sessionId - 会话ID
   * @param {string} role - 角色（user/assistant/system）
   * @param {string} content - 消息内容
   */
  addMessage(sessionId, role, content) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }
    
    session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    
    // 限制历史长度
    if (session.messages.length > this.maxHistoryLength) {
      session.messages = session.messages.slice(-this.maxHistoryLength);
    }
    
    if (this.autoSave) {
      this.saveSession(sessionId); // 使用保存队列
    }
  }

  /**
   * 添加工具调用记录
   * @param {string} sessionId - 会话ID
   * @param {string} tool - 工具名称
   * @param {object} params - 工具参数
   * @param {any} result - 执行结果
   */
  addToolCall(sessionId, tool, params, result) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }
    
    session.toolCalls.push({
      tool,
      params,
      result,
      timestamp: new Date().toISOString()
    });
    
    if (this.autoSave) {
      this.saveSession(sessionId);
    }
  }

  /**
   * 获取会话历史
   * @param {string} sessionId - 会话ID
   * @returns {array} 消息历史
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  /**
   * 获取上下文文本（用于提示词）
   * @param {string} sessionId - 会话ID
   * @param {number} maxTokens - 最大token数（近似）
   * @returns {string} 上下文文本
   */
  getContext(sessionId, maxTokens = 2000) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return '';
    }
    
    // 构建上下文
    let context = '';
    const messages = session.messages.slice(-10); // 最近10条消息
    
    for (const msg of messages) {
      const prefix = msg.role === 'user' ? '用户' : '助手';
      context += `${prefix}: ${msg.content}\n\n`;
    }
    
    // 添加工具调用历史
    if (session.toolCalls.length > 0) {
      context += '\n工具调用历史：\n';
      const recentToolCalls = session.toolCalls.slice(-5);
      
      for (const call of recentToolCalls) {
        context += `- ${call.tool}(${JSON.stringify(call.params)}) => ${JSON.stringify(call.result).substring(0, 100)}\n`;
      }
    }
    
    // 简单的长度限制（假设平均每token约4个字符）
    if (context.length > maxTokens * 4) {
      context = context.substring(context.length - maxTokens * 4);
    }
    
    return context;
  }

  /**
   * 获取对话历史消息数组（用于多轮对话 API）
   * @param {string} sessionId - 会话ID
   * @param {number} maxMessages - 最大消息数
   * @returns {array} 消息数组 [{role, content}]
   */
  getMessages(sessionId, maxMessages = 20) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return [];
    }
    
    // 获取最近的消息，过滤掉系统消息
    const messages = session.messages
      .filter(msg => msg.role !== 'system')
      .slice(-maxMessages)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    
    return messages;
  }

  /**
   * 获取所有会话列表
   * @returns {array} 会话摘要列表
   */
  async getAllSessions() {
    // 首先从内存获取
    const sessions = [];
    
    for (const [id, session] of this.sessions) {
      sessions.push({
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.messages.length > 0 
          ? session.messages[session.messages.length - 1].timestamp 
          : session.createdAt,
        messageCount: session.messages.length,
        title: this.generateSessionTitle(session)
      });
    }
    
    // 然后从磁盘加载额外的会话
    try {
      const filenames = await fs.readdir(this.storagePath);
      const fileSessions = filenames.filter(f => f.endsWith('.json'));
      
      for (const filename of fileSessions) {
        const sessionId = filename.replace('.json', '');
        if (!this.sessions.has(sessionId)) {
          try {
            const data = await fs.readFile(path.join(this.storagePath, filename), 'utf-8');
            const session = JSON.parse(data);
            sessions.push({
              id: session.id,
              createdAt: session.createdAt,
              lastActivity: session.messages && session.messages.length > 0 
                ? session.messages[session.messages.length - 1].timestamp 
                : session.createdAt,
              messageCount: session.messages ? session.messages.length : 0,
              title: this.generateSessionTitle(session)
            });
          } catch (e) {
            // 忽略无效文件
          }
        }
      }
    } catch (e) {
      // 目录不存在时忽略
    }
    
    // 按最后活动时间排序（最新的在前）
    sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    
    return sessions;
  }

  /**
   * 生成会话标题
   * @param {object} session - 会话对象
   * @returns {string} 标题
   */
  generateSessionTitle(session) {
    if (!session.messages || session.messages.length === 0) {
      return '新会话';
    }
    
    // 从第一条用户消息生成标题
    const firstUserMessage = session.messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return '新会话';
    }
    
    // 截取前20个字符作为标题
    const title = firstUserMessage.content.replace(/\n/g, ' ').trim();
    return title.length > 20 ? title.substring(0, 20) + '...' : title;
  }

  /**
   * 加载会话（如果存在）
   * @param {string} sessionId - 会话ID
   * @returns {Promise<object>} 会话对象
   */
  async loadOrCreateSession(sessionId) {
    // 先检查内存
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }
    
    // 尝试从磁盘加载
    const loaded = await this.loadSession(sessionId);
    if (loaded) {
      return loaded;
    }
    
    // 创建新会话
    return this.createSessionById(sessionId);
  }

  /**
   * 按指定 ID 创建会话
   * @param {string} sessionId - 会话ID
   * @returns {object} 会话对象
   */
  createSessionById(sessionId) {
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      messages: [],
      toolCalls: [],
      metadata: {}
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 获取会话元数据
   * @param {string} sessionId - 会话ID
   * @returns {object} 元数据
   */
  getMetadata(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.metadata : {};
  }

  /**
   * 更新会话元数据
   * @param {string} sessionId - 会话ID
   * @param {object} metadata - 元数据
   */
  updateMetadata(sessionId, metadata) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }
    
    session.metadata = { ...session.metadata, ...metadata };
    
    if (this.autoSave) {
      this.saveSession(sessionId);
    }
  }

  /**
   * 保存会话到文件（使用保存队列确保顺序执行）
   * @param {string} sessionId - 会话ID
   */
  saveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return;
    }
    
    // 将保存操作加入队列，确保顺序执行
    this._saveQueue = this._saveQueue.then(async () => {
      try {
        await fs.mkdir(this.storagePath, { recursive: true });
        const filename = path.join(this.storagePath, `${sessionId}.json`);
        await fs.writeFile(filename, JSON.stringify(session, null, 2), 'utf-8');
      } catch (error) {
        console.error(`保存会话失败: ${error.message}`);
      }
    }).catch(err => {
      console.error(`保存队列错误: ${err.message}`);
    });
  }

  /**
   * 从文件加载会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<object|null>} 会话对象
   */
  async loadSession(sessionId) {
    try {
      const filename = path.join(this.storagePath, `${sessionId}.json`);
      const data = await fs.readFile(filename, 'utf-8');
      const session = JSON.parse(data);
      
      this.sessions.set(sessionId, session);
      return session;
    } catch (error) {
      return null;
    }
  }

  /**
   * 加载所有历史会话（并行读取，加快启动速度）
   */
  async loadAllSessions() {
    try {
      const filenames = await fs.readdir(this.storagePath);
      const jsonFiles = filenames.filter(f => f.endsWith('.json'));

      // 并行读取所有会话文件
      const results = await Promise.all(jsonFiles.map(async (filename) => {
        try {
          const sessionId = filename.replace('.json', '');
          const data = await fs.readFile(path.join(this.storagePath, filename), 'utf-8');
          const session = JSON.parse(data);
          // 验证会话数据有效性
          if (session && session.id && Array.isArray(session.messages)) {
            return { sessionId, session };
          }
        } catch (e) {
          // 跳过无效文件
        }
        return null;
      }));

      let loadedCount = 0;
      for (const item of results) {
        if (item) {
          this.sessions.set(item.sessionId, item.session);
          loadedCount++;
        }
      }

      if (loadedCount > 0) {
        console.log(`[Memory] 从磁盘加载 ${loadedCount} 个历史会话`);
      }
    } catch (error) {
      // 目录不存在时忽略
    }
  }

  /**
   * 删除会话
   * @param {string} sessionId - 会话ID
   */
  async deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    
    try {
      const filename = path.join(this.storagePath, `${sessionId}.json`);
      await fs.unlink(filename);
    } catch (error) {
      // 文件不存在时忽略
    }
  }

  /**
   * 清空所有会话
   */
  clearAllSessions() {
    this.sessions.clear();
  }

  /**
   * 获取所有会话ID
   * @returns {array} 会话ID列表
   */
  getAllSessionIds() {
    return Array.from(this.sessions.keys());
  }

  /**
   * 获取会话统计信息
   * @param {string} sessionId - 会话ID
   * @returns {object} 统计信息
   */
  getStats(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    return {
      messageCount: session.messages.length,
      toolCallCount: session.toolCalls.length,
      createdAt: session.createdAt,
      lastActivity: session.messages.length > 0 
        ? session.messages[session.messages.length - 1].timestamp 
        : session.createdAt
    };
  }

  /**
   * 导出所有会话（内存 + 磁盘）完整数据
   * @returns {Promise<array>} 会话数据数组
   */
  async exportAll() {
    const all = [];

    // 内存中的会话
    for (const session of this.sessions.values()) {
      all.push(JSON.parse(JSON.stringify(session)));
    }

    // 磁盘上的额外会话
    try {
      const filenames = await fs.readdir(this.storagePath);
      const results = await Promise.all(filenames
        .filter(f => f.endsWith('.json'))
        .map(async (filename) => {
          const sessionId = filename.replace('.json', '');
          if (this.sessions.has(sessionId)) return null;
          try {
            const data = await fs.readFile(path.join(this.storagePath, filename), 'utf-8');
            return JSON.parse(data);
          } catch (e) {
            return null;
          }
        }));
      for (const session of results) {
        if (session) all.push(session);
      }
    } catch (e) {
      // 目录不存在时忽略
    }

    return all;
  }

  /**
   * 搜索会话历史
   * @param {string} sessionId - 会话ID
   * @param {string} keyword - 搜索关键词
   * @returns {array} 匹配的消息
   */
  searchHistory(sessionId, keyword) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return [];
    }
    
    const results = [];
    const lowerKeyword = keyword.toLowerCase();
    
    for (const msg of session.messages) {
      if (msg.content.toLowerCase().includes(lowerKeyword)) {
        results.push(msg);
      }
    }
    
    return results;
  }

  /**
   * 导出会话数据
   * @param {string} sessionId - 会话ID
   * @returns {object} 会话数据
   */
  exportSession(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? JSON.parse(JSON.stringify(session)) : null;
  }

  /**
   * 导入会话数据
   * @param {object} sessionData - 会话数据
   */
  importSession(sessionData) {
    if (!sessionData.id) {
      throw new Error('会话数据缺少ID');
    }
    
    this.sessions.set(sessionData.id, sessionData);
    
    if (this.autoSave) {
      this.saveSession(sessionData.id);
    }
  }
}

module.exports = MemoryManager;