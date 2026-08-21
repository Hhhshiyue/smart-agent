/**
 * Agent 核心模块
 * 负责任务规划、执行和反思
 * 支持 LLM 模式和纯工具降级模式
 */

const LLM = require('../llm');
const ToolManager = require('../tools');
const MemoryManager = require('../memory');

class Agent {
  constructor(config = {}) {
    this.llm = new LLM(config.llm);
    this.tools = new ToolManager();
    this.memory = new MemoryManager(config.memory);
    this.maxIterations = config.maxIterations || 10;
    this.verbose = config.verbose || false;
    this.llmAvailable = false;
  }

  /**
   * 初始化 Agent（加载历史会话等）
   */
  async initialize() {
    await this.memory.initialize();
    console.log('[Agent] 初始化完成');
  }

  /**
   * 检查 LLM 是否可用
   */
  async checkLLM() {
    if (this.llmAvailable && this.llm.apiKey) return true;
    if (!this.llm.apiKey) {
      this.llmAvailable = false;
      return false;
    }
    try {
      this.llmAvailable = await this.llm.testConnection();
      return this.llmAvailable;
    } catch (e) {
      this.llmAvailable = false;
      return false;
    }
  }

  /**
   * 执行任务
   * @param {string} task - 任务描述
   * @returns {Promise<object>} 执行结果
   */
  async run(task) {
    const sessionId = this.memory.createSession();
    
    try {
      this.memory.addMessage(sessionId, 'user', task);
      
      // 检查 LLM 是否可用
      const llmWorks = await this.checkLLM();
      
      if (llmWorks) {
        // LLM 模式：规划 -> 执行 -> 反思
        const plan = await this.plan(task, sessionId);
        const result = await this.execute(plan, sessionId);
        const reflection = await this.reflect(result, sessionId);
        
        // 提取最终答案
        const finalAnswer = this.extractFinalAnswer(reflection, result);
        
        return {
          success: true,
          sessionId,
          task,
          mode: 'llm',
          response: finalAnswer,
          plan,
          result,
          reflection
        };
      } else {
        // 纯工具降级模式：直接匹配工具执行
        return await this.runWithTools(task, sessionId);
      }
    } catch (error) {
      return {
        success: false,
        sessionId,
        task,
        error: error.message
      };
    }
  }

  /**
   * 简单对话模式（支持上下文多轮对话）
   * @param {string} message - 用户消息
   * @param {string} sessionId - 会话ID
   * @returns {Promise<object>} 对话结果
   */
  async chat(message, sessionId) {
    try {
      const llmWorks = await this.checkLLM();
      const sid = sessionId || this.memory.createSession();
      
      // 加载或创建会话
      await this.memory.loadOrCreateSession(sid);
      
      if (!llmWorks) {
        // 降级到工具模式
        this.memory.addMessage(sid, 'user', message);
        return await this.runWithTools(message, sid);
      }
      
      // ===== 智能融合模式：先检测是否需要工具 =====
      const toolResult = await this.tryExecuteTools(message);
      
      // 使用系统提示词
      const systemPrompt = `你是一个友好的智能助手。请直接回答用户的问题，不要展示你的思考过程或分析步骤。回答要简洁、准确。你可以根据对话历史理解上下文，回答要有关联性。`;
      
      // 获取对话历史（用于上下文）
      const historyMessages = this.memory.getMessages(sid, 20);
      
      // 构建完整的消息列表
      const fullMessages = [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message }
      ];
      
      let response;
      let toolsUsed = [];
      let mode = 'llm_chat';
      
      if (toolResult && toolResult.success && toolResult.toolsUsed.length > 0) {
        // 有工具执行结果，整合到 AI 回答中
        toolsUsed = toolResult.toolsUsed;
        
        // 构建增强的用户消息，包含工具结果
        const enhancedMessage = this.buildEnhancedMessage(message, toolResult);
        
        // 使用增强的消息
        const messagesWithTools = [
          { role: 'system', content: systemPrompt + '\n\n你可以使用工具执行结果来帮助回答问题。' },
          ...historyMessages,
          { role: 'user', content: enhancedMessage }
        ];
        
        response = await this.llm.multiTurnChat(messagesWithTools);
        mode = 'hybrid'; // 混合模式
      } else {
        // 纯 AI 对话
        response = await this.llm.multiTurnChat(fullMessages);
      }
      
      // 保存对话到历史
      this.memory.addMessage(sid, 'user', message);
      this.memory.addMessage(sid, 'assistant', response);
      
      return {
        success: true,
        sessionId: sid,
        task: message,
        mode,
        response: response,
        toolsUsed: toolsUsed
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 尝试执行工具（用于融合模式）
   * @param {string} message - 用户消息
   * @returns {Promise<object>} 工具执行结果
   */
  async tryExecuteTools(message) {
    const results = [];
    
    // 简化的关键词检测
    const keywordMap = {
      '计算': 'calculator',
      '算': 'calculator',
      '等于': 'calculator',
      '抓取': 'web_scraper',
      '爬': 'web_scraper',
      '网站': 'web_scraper',
      '网页': 'web_scraper',
      '读取': 'file_reader',
      '读': 'file_reader',
      '文件': 'file_reader',
      '写入': 'file_writer',
      '保存': 'file_writer',
      '请求': 'http_request',
      'API': 'http_request',
      '分析': 'data_analyzer',
      '统计': 'data_analyzer'
    };
    
    for (const [keyword, toolName] of Object.entries(keywordMap)) {
      if (message.includes(keyword)) {
        const tool = this.tools.getTool(toolName);
        const params = this.extractParams(message, toolName);
        
        if (params && Object.keys(params).length > 0) {
          try {
            const toolResult = await this.tools.execute(toolName, params);
            results.push({
              tool: toolName,
              params,
              result: toolResult
            });
          } catch (error) {
            results.push({
              tool: toolName,
              params,
              error: error.message
            });
          }
          break; // 只执行第一个匹配的工具
        }
      }
    }
    
    return {
      success: true,
      results,
      toolsUsed: results.map(r => r.tool)
    };
  }
  
  /**
   * 构建增强的用户消息（包含工具结果）
   * @param {string} message - 原始用户消息
   * @param {object} toolResult - 工具执行结果
   * @returns {string} 增强的消息
   */
  buildEnhancedMessage(message, toolResult) {
    let toolContext = '\n\n[工具执行结果]\n';
    
    for (const r of toolResult.results) {
      if (r.error) {
        toolContext += `- 工具 ${r.tool} 执行失败: ${r.error}\n`;
      } else {
        toolContext += `- 工具 ${r.tool}: ${this.formatToolResult(r.tool, r.params, r.result)}\n`;
      }
    }
    
    toolContext += '\n请基于以上工具结果回答用户的问题。';
    
    return message + toolContext;
  }

  /**
   * 从反思结果中提取最终答案
   * @param {object} reflection - 反思结果
   * @param {array} results - 执行结果
   * @returns {string} 最终答案
   */
  extractFinalAnswer(reflection, results) {
    // 尝试从反思中提取最终答案
    if (reflection?.summary) {
      const summary = reflection.summary;
      // 查找"最终答案"或"结论"等关键词后的内容
      const answerPatterns = [
        /最终答案[：:]\s*(.+)/s,
        /结论[是为：:]\s*(.+)/s,
        /答案[：:]\s*(.+)/s,
      ];
      
      for (const pattern of answerPatterns) {
        const match = summary.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      
      // 如果没有匹配到关键词，返回整个摘要（去除反思部分）
      const cleanedSummary = summary
        .replace(/##?\s*反思与总结/g, '')
        .replace(/##?\s*[一二三四五六七八九十]+[、.]\s*.+/g, '')
        .replace(/\*\*.+?\*\*/g, '')
        .trim();
      
      if (cleanedSummary.length > 50) {
        // 返回最后一段（通常是结论）
        const paragraphs = cleanedSummary.split(/\n+/).filter(p => p.trim().length > 20);
        if (paragraphs.length > 0) {
          return paragraphs[paragraphs.length - 1].trim();
        }
      }
      
      return summary;
    }
    
    // 从执行结果中提取
    if (results && results.length > 0) {
      const lastResult = results[results.length - 1];
      if (lastResult.reasoning) {
        return lastResult.reasoning;
      }
      if (lastResult.result) {
        return typeof lastResult.result === 'string' 
          ? lastResult.result 
          : JSON.stringify(lastResult.result);
      }
    }
    
    return '任务已完成。';
  }

  /**
   * 纯工具降级模式
   * 当 LLM 不可用时，直接匹配关键词调用工具
   */
  async runWithTools(task, sessionId) {
    const results = [];
    const toolNames = this.tools.getToolNames();
    
    // 关键词到工具的映射
    const keywordMap = {
      '计算': 'calculator',
      '算': 'calculator',
      '等于': 'calculator',
      '抓取': 'web_scraper',
      '爬': 'web_scraper',
      '网站': 'web_scraper',
      '网页': 'web_scraper',
      '读取': 'file_reader',
      '读': 'file_reader',
      '文件': 'file_reader',
      '写入': 'file_writer',
      '保存': 'file_writer',
      '请求': 'http_request',
      'API': 'http_request',
      '分析': 'data_analyzer',
      '统计': 'data_analyzer'
    };
    
    // 尝试匹配工具
    for (const [keyword, toolName] of Object.entries(keywordMap)) {
      if (task.includes(keyword)) {
        const tool = this.tools.getTool(toolName);
        const params = this.extractParams(task, toolName);
        
        if (params && Object.keys(params).length > 0) {
          try {
            const toolResult = await this.tools.execute(toolName, params);
            results.push({
              tool: toolName,
              params,
              result: toolResult
            });
            this.memory.addMessage(sessionId, 'assistant', `工具 ${toolName} 执行成功`);
          } catch (error) {
            results.push({
              tool: toolName,
              params,
              error: error.message
            });
          }
        }
        break; // 只执行第一个匹配的工具
      }
    }
    
    // 如果没有匹配到工具，返回提示
    if (results.length === 0) {
      const availableTools = toolNames.join('、');
      return {
        success: true,
        sessionId,
        task,
        mode: 'tools',
        response: `当前为纯工具模式（未配置 LLM API Key）。\n\n我可以帮你执行以下操作：\n• ${availableTools}\n\n你可以尝试：\n• "计算 2 + 3 * 4"\n• "抓取 https://example.com"\n• "读取 data/test.txt"\n• "分析数据 [1,2,3,4,5]"`,
        toolsUsed: []
      };
    }
    
    // 格式化结果
    let response = '';
    for (const r of results) {
      if (r.error) {
        response += `❌ 工具 ${r.tool} 执行失败: ${r.error}\n`;
      } else {
        response += this.formatToolResult(r.tool, r.params, r.result);
      }
    }
    
    return {
      success: true,
      sessionId,
      task,
      mode: 'tools',
      response: response.trim(),
      toolsUsed: results.map(r => r.tool)
    };
  }

  /**
   * 格式化工具执行结果为可读文本
   */
  formatToolResult(toolName, params, result) {
    let text = `✅ 工具 ${toolName} 执行成功\n`;
    
    switch (toolName) {
      case 'calculator':
        text += `   ${result.expression} = ${result.result}`;
        break;
      case 'web_scraper':
        text += `   标题: ${result.title}\n`;
        text += `   内容摘要: ${result.content?.substring(0, 200)}...`;
        break;
      case 'file_reader':
        text += `   文件大小: ${result.size} 字节\n`;
        text += `   内容: ${result.content?.substring(0, 300)}`;
        break;
      case 'file_writer':
        text += `   ${result.message}`;
        break;
      case 'http_request':
        text += `   状态: ${result.status}\n`;
        text += `   数据: ${typeof result.data === 'string' ? result.data.substring(0, 200) : JSON.stringify(result.data).substring(0, 200)}`;
        break;
      case 'data_analyzer':
        text += `   数据量: ${result.analysis?.count}\n`;
        text += `   类型: ${result.analysis?.type}`;
        break;
      default:
        text += `   ${JSON.stringify(result).substring(0, 300)}`;
    }
    
    return text;
  }

  /**
   * 任务规划
   * @param {string} task - 任务描述
   * @param {string} sessionId - 会话ID
   * @returns {Promise<object>} 执行计划
   */
  async plan(task, sessionId) {
    const prompt = `作为一个智能助手，请为以下任务制定执行计划：

任务：${task}

可用工具：
${this.tools.getToolDescriptions()}

请按以下格式输出计划：
1. 分析任务需求
2. 列出需要的工具
3. 确定执行步骤

计划：`;

    const response = await this.llm.chat(prompt);
    this.memory.addMessage(sessionId, 'assistant', `规划：${response}`);
    
    // 解析计划为步骤
    const steps = this.parsePlan(response);
    
    return {
      raw: response,
      steps
    };
  }

  /**
   * 执行计划
   * @param {object} plan - 执行计划
   * @param {string} sessionId - 会话ID
   * @returns {Promise<object>} 执行结果
   */
  async execute(plan, sessionId) {
    const results = [];
    
    for (let i = 0; i < plan.steps.length && i < this.maxIterations; i++) {
      const step = plan.steps[i];
      
      if (this.verbose) {
        console.log(`执行步骤 ${i + 1}: ${step}`);
      }
      
      // 判断是否需要调用工具
      const toolCall = this.detectToolCall(step);
      
      if (toolCall) {
        const toolResult = await this.executeToolCall(toolCall, sessionId);
        results.push({
          step: i + 1,
          action: step,
          toolUsed: toolCall.tool,
          result: toolResult
        });
      } else {
        // 普通推理步骤
        const reasoning = await this.llm.chat(`执行以下步骤：${step}\n\n上下文：\n${this.memory.getContext(sessionId)}`);
        results.push({
          step: i + 1,
          action: step,
          reasoning
        });
      }
      
      this.memory.addMessage(sessionId, 'assistant', `步骤${i + 1}结果：${JSON.stringify(results[results.length - 1])}`);
    }
    
    return results;
  }

  /**
   * 执行工具调用
   * @param {object} toolCall - 工具调用信息
   * @param {string} sessionId - 会话ID
   * @returns {Promise<any>} 工具执行结果
   */
  async executeToolCall(toolCall, sessionId) {
    const { tool, params } = toolCall;
    
    try {
      const result = await this.tools.execute(tool, params);
      this.memory.addToolCall(sessionId, tool, params, result);
      return result;
    } catch (error) {
      return {
        error: true,
        message: `工具 ${tool} 执行失败: ${error.message}`
      };
    }
  }

  /**
   * 反思与总结
   * @param {array} results - 执行结果
   * @param {string} sessionId - 会话ID
   * @returns {Promise<object>} 反思结果
   */
  async reflect(results, sessionId) {
    const prompt = `请对以下执行结果进行反思和总结：

执行结果：
${JSON.stringify(results, null, 2)}

请评估：
1. 是否完成了任务目标？
2. 哪些步骤执行得当？
3. 有哪些可以改进的地方？
4. 最终结论是什么？

反思：`;

    const response = await this.llm.chat(prompt);
    this.memory.addMessage(sessionId, 'assistant', `反思：${response}`);
    
    return {
      summary: response,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 解析计划为步骤数组
   * @param {string} planText - 计划文本
   * @returns {array} 步骤数组
   */
  parsePlan(planText) {
    const lines = planText.split('\n').filter(line => line.trim());
    const steps = [];
    
    for (const line of lines) {
      // 匹配数字编号的步骤
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match) {
        steps.push(match[1].trim());
      }
    }
    
    return steps.length > 0 ? steps : [planText];
  }

  /**
   * 检测工具调用
   * @param {string} step - 执行步骤
   * @returns {object|null} 工具调用信息
   */
  detectToolCall(step) {
    const availableTools = this.tools.getToolNames();
    
    for (const tool of availableTools) {
      if (step.includes(tool) || step.includes(this.tools.getTool(tool).keywords)) {
        return {
          tool,
          params: this.extractParams(step, tool)
        };
      }
    }
    
    return null;
  }

  /**
   * 提取工具参数
   * @param {string} text - 文本内容
   * @param {string} tool - 工具名称
   * @returns {object} 参数对象
   */
  extractParams(text, tool) {
    const params = {};
    
    switch (tool) {
      case 'calculator':
        // 提取数学表达式：匹配数字和运算符的组合
        const mathMatch = text.match(/[-+*/%()\d.\s]+/);
        if (mathMatch) {
          params.expression = mathMatch[0].trim();
        }
        break;
        
      case 'web_scraper':
        // 提取URL
        const urlMatch = text.match(/https?:\/\/[^\s，。,]+/);
        if (urlMatch) {
          params.url = urlMatch[0];
        }
        break;
        
      case 'file_reader':
      case 'file_writer':
        // 提取文件路径
        const fileMatch = text.match(/[a-zA-Z0-9_\\\-\/.]+\.(txt|json|csv|js|py|md|log|xml|html|css)/);
        if (fileMatch) {
          params.filepath = fileMatch[0];
        } else {
          // 尝试匹配路径
          const pathMatch = text.match(/[a-zA-Z]:\\[^\s，。,]+/);
          if (pathMatch) {
            params.filepath = pathMatch[0];
          }
        }
        // file_writer 需要内容
        if (tool === 'file_writer' && !params.content) {
          const contentMatch = text.match(/(?:写入|保存|内容[为是])[：:]\s*(.+)/);
          if (contentMatch) {
            params.content = contentMatch[1].trim();
          }
        }
        break;
        
      case 'http_request':
        const httpUrlMatch = text.match(/https?:\/\/[^\s，。,]+/);
        if (httpUrlMatch) {
          params.url = httpUrlMatch[0];
        }
        // 尝试提取方法
        if (text.includes('POST') || text.includes('post')) {
          params.method = 'POST';
        } else if (text.includes('PUT') || text.includes('put')) {
          params.method = 'PUT';
        } else if (text.includes('DELETE') || text.includes('delete')) {
          params.method = 'DELETE';
        } else {
          params.method = 'GET';
        }
        break;
        
      case 'data_analyzer':
        // 提取数组数据
        const arrayMatch = text.match(/\[.*?\]/);
        if (arrayMatch) {
          try {
            params.data = JSON.parse(arrayMatch[0]);
          } catch (e) {
            // 尝试解析为数字数组
            const nums = arrayMatch[0].match(/[\d.]+/g);
            if (nums) {
              params.data = nums.map(Number);
            }
          }
        }
        break;
        
      default:
        // 通用提取：URL
        const urlMatch2 = text.match(/https?:\/\/[^\s，。,]+/);
        if (urlMatch2) params.url = urlMatch2[0];
        
        // 通用提取：文件路径
        const fileMatch2 = text.match(/[a-zA-Z0-9_\\\-\/.]+\.(txt|json|csv|js|py|md)/);
        if (fileMatch2) params.filepath = fileMatch2[0];
    }
    
    return params;
  }

  /**
   * 注册自定义工具
   * @param {string} name - 工具名称
   * @param {object} tool - 工具对象
   */
  registerTool(name, tool) {
    this.tools.register(name, tool);
  }

  /**
   * 获取会话历史
   * @param {string} sessionId - 会话ID
   * @returns {array|null} 会话历史
   */
  getSessionHistory(sessionId) {
    const session = this.memory.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return session.messages;
  }
}

module.exports = Agent;