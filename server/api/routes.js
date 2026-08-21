/**
 * Express API 路由模块
 * 提供 HTTP 接口与 Agent 交互
 */

const express = require('express');
const router = express.Router();
const Agent = require('../agent/core');
const { config } = require('../../config');

// 创建 Agent 实例（全局共享）
let agentInstance = null;
let agentInitialized = false;

/**
 * 获取或创建 Agent 实例
 * @param {object} configOverride - 配置参数
 * @returns {Promise<Agent>} Agent 实例
 */
async function getAgent(configOverride = {}) {
  if (!agentInstance) {
    agentInstance = new Agent({
      ...config,
      ...configOverride
    });
    // 初始化 Agent（加载历史会话等）
    if (!agentInitialized) {
      await agentInstance.initialize();
      agentInitialized = true;
    }
  }
  return agentInstance;
}

/**
 * POST /api/agent/run
 * 执行任务
 */
router.post('/agent/run', async (req, res) => {
  try {
    const { task, config } = req.body;
    
    if (!task) {
      return res.status(400).json({
        success: false,
        error: '缺少任务描述'
      });
    }
    
    const agent = await getAgent(config);
    const result = await agent.run(task);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('执行任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agent/chat
 * 简单对话接口（直接调用 LLM，返回简洁答案）
 */
router.post('/agent/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: '缺少消息内容'
      });
    }
    
    const agent = await getAgent();
    const result = await agent.chat(message, sessionId);
    
    if (result.success) {
      // 添加模式提示
      const modeLabel = result.mode === 'tools' 
        ? '（工具模式）\n' 
        : result.mode === 'llm_chat' || result.mode === 'llm'
          ? '（AI 模式）\n' 
          : '';
      
      res.json({
        success: true,
        data: {
          response: modeLabel + result.response,
          sessionId: result.sessionId,
          mode: result.mode || 'unknown',
          toolsUsed: result.toolsUsed || []
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || '执行失败'
      });
    }
  } catch (error) {
    console.error('对话失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agent/chat/stream
 * 流式对话接口（逐字返回 AI 回复）
 */
router.post('/agent/chat/stream', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: '缺少消息内容'
      });
    }
    
    const agent = await getAgent();
    
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const llmWorks = await agent.checkLLM();
    
    if (!llmWorks) {
      // 降级到工具模式
      const sid = sessionId || agent.memory.createSession();
      await agent.memory.loadOrCreateSession(sid);
      agent.memory.addMessage(sid, 'user', message);
      const result = await agent.runWithTools(message, sid);
      
      // 发送工具模式结果
      const resultText = result.response || '（工具模式）' + JSON.stringify(result);
      res.write(`data: ${JSON.stringify({ content: resultText, done: true, sessionId: sid })}\n\n`);
      res.end();
      return;
    }
    
    const sid = sessionId || agent.memory.createSession();
    await agent.memory.loadOrCreateSession(sid);
    
    // 使用系统提示词
    const systemPrompt = `你是一个友好的智能助手。请直接回答用户的问题，不要展示你的思考过程或分析步骤。回答要简洁、准确。你可以根据对话历史理解上下文，回答要有关联性。`;
    
    // 获取对话历史
    const historyMessages = agent.memory.getMessages(sid, 20);
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message }
    ];
    
    // 使用流式 API
    let fullResponse = '';
    
    await agent.llm.streamChat(
      fullMessages[fullMessages.length - 1].content, // 用户消息
      async (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`);
      },
      { 
        messages: fullMessages.slice(0, -1), // 除了最后一条用户消息
        systemPrompt: systemPrompt
      }
    );
    
    // 保存对话到历史
    agent.memory.addMessage(sid, 'user', message);
    agent.memory.addMessage(sid, 'assistant', fullResponse);
    
    // 发送完成信号
    res.write(`data: ${JSON.stringify({ content: '', done: true, sessionId: sid, fullResponse })}\n\n`);
    res.end();
    
  } catch (error) {
    console.error('流式对话失败:', error);
    try {
      res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
      res.end();
    } catch (e) {
      // 忽略发送错误
    }
  }
});

/**
 * GET /api/agent/session/:sessionId
 * 获取会话历史
 */
router.get('/agent/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const agent = await getAgent();
    
    // 加载会话（从磁盘或内存）
    await agent.memory.loadOrCreateSession(sessionId);
    
    const history = agent.memory.getSession(sessionId);
    const messages = agent.memory.getMessages(sessionId);
    const stats = agent.memory.getStats(sessionId);
    
    res.json({
      success: true,
      data: {
        sessionId,
        history,
        messages,
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agent/sessions
 * 获取所有会话列表
 */
router.get('/agent/sessions', async (req, res) => {
  try {
    const agent = await getAgent();
    const sessions = await agent.memory.getAllSessions();
    
    res.json({
      success: true,
      data: {
        sessions,
        count: sessions.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agent/session/new
 * 创建新会话
 */
router.post('/agent/session/new', async (req, res) => {
  try {
    const agent = await getAgent();
    const sessionId = agent.memory.createSession();
    
    res.json({
      success: true,
      data: {
        sessionId,
        message: '新会话已创建'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agent/sessions/export
 * 导出所有会话（备份，下载 JSON 文件）
 */
router.get('/agent/sessions/export', async (req, res) => {
  try {
    const agent = await getAgent();
    const sessions = await agent.memory.exportAll();

    const backup = {
      app: 'Smart Agent',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      count: sessions.length,
      sessions
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="smart-agent-backup-${Date.now()}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/agent/session/:sessionId
 * 删除会话
 */
router.delete('/agent/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const agent = await getAgent();
    await agent.memory.deleteSession(sessionId);
    
    res.json({
      success: true,
      message: `会话 ${sessionId} 已删除`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agent/session/:sessionId/clear
 * 清空会话历史（保留会话ID）
 */
router.post('/agent/session/:sessionId/clear', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const agent = await getAgent();
    
    // 重新创建会话（清空历史）
    agent.memory.createSessionById(sessionId);
    
    res.json({
      success: true,
      message: `会话 ${sessionId} 历史已清空`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools
 * 获取可用工具列表
 */
router.get('/tools', async (req, res) => {
  try {
    const agent = await getAgent();
    const tools = agent.tools.listTools();
    
    res.json({
      success: true,
      data: {
        tools,
        count: tools.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/tools/:toolName/execute
 * 执行指定工具
 */
router.post('/tools/:toolName/execute', async (req, res) => {
  try {
    const { toolName } = req.params;
    const params = req.body;
    
    const agent = await getAgent();
    const result = await agent.tools.execute(toolName, params);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/llm/test
 * 测试 LLM 连接
 */
router.post('/llm/test', async (req, res) => {
  try {
    const { config } = req.body;
    const agent = await getAgent();
    const isConnected = await agent.llm.testConnection();
    
    res.json({
      success: true,
      data: {
        connected: isConnected,
        modelInfo: agent.llm.getModelInfo()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health
 * 健康检查
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Agent 服务运行正常',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/info
 * 获取服务信息
 */
router.get('/info', async (req, res) => {
  const agent = await getAgent();
  
  res.json({
    success: true,
    data: {
      name: 'Smart Agent API',
      version: '1.0.0',
      llm: agent.llm.getModelInfo(),
      toolsCount: agent.tools.getToolNames().length,
      activeSessions: agent.memory.getAllSessionIds().length
    }
  });
});

/**
 * POST /api/agent/register-tool
 * 注册自定义工具
 */
router.post('/agent/register-tool', async (req, res) => {
  try {
    const { name, description, keywords, params, executeCode } = req.body;
    
    if (!name || !executeCode) {
      return res.status(400).json({
        success: false,
        error: '缺少工具名称或执行代码'
      });
    }
    
    const agent = await getAgent();
    
    // 动态创建工具函数（注意安全性）
    const executeFunc = new Function('params', `
      return (async (params) => {
        ${executeCode}
      })(params);
    `);
    
    agent.registerTool(name, {
      description: description || '自定义工具',
      keywords: keywords || [],
      params: params || [],
      execute: executeFunc
    });
    
    res.json({
      success: true,
      message: `工具 "${name}" 注册成功`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 重置 Agent 实例（配置变更后调用，使新配置立即生效）
 */
function resetAgent() {
  agentInstance = null;
  agentInitialized = false;
}

module.exports = router;
module.exports.resetAgent = resetAgent;