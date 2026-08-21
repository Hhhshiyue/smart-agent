/**
 * 流式响应路由
 * 使用 Server-Sent Events (SSE) 实现实时响应
 */

const express = require('express');
const router = express.Router();
const Agent = require('../agent/core');
const { config } = require('../../config');

// 共享的 Agent 实例
let agentInstance = null;
let agentInitialized = false;

async function getAgent(configOverride = {}) {
  if (!agentInstance) {
    agentInstance = new Agent({
      ...config,
      ...configOverride
    });
    if (!agentInitialized) {
      await agentInstance.initialize();
      agentInitialized = true;
    }
  }
  return agentInstance;
}

/**
 * POST /api/stream/chat
 * 流式对话接口
 */
router.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: '缺少消息内容'
    });
  }
  
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
  
  // 发送事件的辅助函数
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    const agent = await getAgent();
    
    // 发送开始事件
    sendEvent('start', { message: '开始处理任务' });
    
    // 获取或创建会话
    const sid = sessionId || agent.memory.createSession();
    await agent.memory.loadOrCreateSession(sid);
    
    // 添加用户消息
    agent.memory.addMessage(sid, 'user', message);
    
    // 使用 LLM 流式响应
    if (agent.llm.streamChat) {
      sendEvent('status', { status: 'planning', message: '正在规划任务...' });
      
      let fullResponse = '';
      
      await agent.llm.streamChat(
        `作为一个智能助手，请分析以下任务：\n\n${message}\n\n请提供你的分析和建议。`,
        (chunk) => {
          fullResponse += chunk;
          sendEvent('chunk', { content: chunk });
        },
        { maxTokens: 1000 }
      );
      
      // 保存 AI 回复
      agent.memory.addMessage(sid, 'assistant', fullResponse);
      
      // 发送完成事件
      sendEvent('complete', {
        response: fullResponse,
        sessionId: sid
      });
    } else {
      // 如果不支持流式，使用普通响应
      sendEvent('status', { status: 'processing', message: '正在处理...' });
      
      const result = await agent.run(message);
      
      sendEvent('complete', {
        response: result.reflection?.summary || '任务已完成',
        sessionId: result.sessionId
      });
    }
    
    res.end();
  } catch (error) {
    console.error('流式处理错误:', error);
    sendEvent('error', { error: error.message });
    res.end();
  }
});

/**
 * POST /api/stream/agent
 * 流式执行 Agent 任务
 */
router.post('/agent', async (req, res) => {
  const { task } = req.body;
  
  if (!task) {
    return res.status(400).json({
      success: false,
      error: '缺少任务描述'
    });
  }
  
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    const agent = await getAgent();
    
    sendEvent('start', { task });
    
    // 执行任务并流式返回进度
    sendEvent('status', { status: 'planning', message: '正在规划任务...' });
    
    const sessionId = agent.memory.createSession();
    const plan = await agent.plan(task, sessionId);
    sendEvent('plan', { plan: plan.steps });
    
    // 执行每个步骤
    sendEvent('status', { status: 'executing', message: '开始执行任务...' });
    
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      
      sendEvent('step', {
        step: i + 1,
        total: plan.steps.length,
        action: step
      });
    }
    
    const result = await agent.run(task);
    
    // 发送最终结果
    sendEvent('complete', {
      success: result.success,
      sessionId: result.sessionId,
      reflection: result.reflection
    });
    
    res.end();
  } catch (error) {
    console.error('Agent 执行错误:', error);
    sendEvent('error', { error: error.message });
    res.end();
  }
});

/**
 * GET /api/stream/test
 * 测试 SSE 连接
 */
router.get('/test', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  let count = 0;
  const interval = setInterval(() => {
    count++;
    sendEvent('message', {
      count,
      timestamp: new Date().toISOString(),
      message: `测试消息 ${count}`
    });
    
    if (count >= 10) {
      sendEvent('complete', { message: '测试完成' });
      clearInterval(interval);
      res.end();
    }
  }, 1000);
  
  // 客户端断开连接时清理
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

module.exports = router;