/**
 * ReAct Agent 实现
 * 实现思考-行动-观察循环模式
 */

const Agent = require('./core');

class ReActAgent extends Agent {
  constructor(config = {}) {
    super(config);
    this.maxIterations = config.maxIterations || 15; // ReAct 需要更多迭代
    this.reflectionFrequency = config.reflectionFrequency || 3; // 每 N 步反思一次
  }

  /**
   * 执行 ReAct 循环
   * @param {string} task - 任务描述
   * @returns {Promise<object>} 执行结果
   */
  async run(task) {
    const sessionId = this.memory.createSession();
    this.memory.addMessage(sessionId, 'user', task);
    
    const trajectory = []; // 完整的执行轨迹
    let iteration = 0;
    let taskCompleted = false;
    let finalAnswer = '';
    
    try {
      // 初始思考
      let currentThought = await this.initialThought(task, sessionId);
      trajectory.push({ type: 'thought', content: currentThought, iteration });
      
      // ReAct 循环
      while (!taskCompleted && iteration < this.maxIterations) {
        iteration++;
        
        // 思考阶段
        const thought = await this.think(currentThought, sessionId, trajectory);
        trajectory.push({ type: 'thought', content: thought, iteration });
        this.memory.addMessage(sessionId, 'assistant', `Thought ${iteration}: ${thought}`);
        
        // 判断是否需要行动
        const actionDecision = await this.decideAction(thought, sessionId);
        
        if (actionDecision.shouldAct) {
          // 行动阶段
          const action = await this.act(actionDecision, sessionId);
          trajectory.push({ 
            type: 'action', 
            tool: action.tool,
            params: action.params,
            result: action.result,
            iteration 
          });
          
          // 观察阶段
          const observation = this.observe(action.result);
          trajectory.push({ type: 'observation', content: observation, iteration });
          this.memory.addMessage(sessionId, 'system', `Observation ${iteration}: ${observation}`);
          
          // 更新当前思考
          currentThought = await this.updateThought(thought, observation, sessionId);
        } else {
          // 任务完成
          taskCompleted = true;
          finalAnswer = actionDecision.answer || await this.generateFinalAnswer(task, trajectory, sessionId);
          trajectory.push({ type: 'answer', content: finalAnswer, iteration });
        }
        
        // 定期反思
        if (iteration % this.reflectionFrequency === 0) {
          const reflection = await this.periodicReflection(trajectory, sessionId);
          trajectory.push({ type: 'reflection', content: reflection, iteration });
        }
      }
      
      // 最终反思
      const finalReflection = await this.finalReflection(task, trajectory, sessionId);
      
      return {
        success: true,
        sessionId,
        task,
        iterations: iteration,
        completed: taskCompleted,
        finalAnswer,
        trajectory,
        reflection: finalReflection
      };
    } catch (error) {
      return {
        success: false,
        sessionId,
        task,
        error: error.message,
        trajectory
      };
    }
  }

  /**
   * 初始思考
   * @param {string} task - 任务描述
   * @param {string} sessionId - 会话ID
   * @returns {Promise<string>} 初始思考内容
   */
  async initialThought(task, sessionId) {
    const prompt = `任务：${task}

请分析这个任务：
1. 任务的目的是什么？
2. 需要哪些信息或资源？
3. 可能需要执行哪些操作？
4. 有什么潜在的风险或挑战？

思考：`;

    return await this.llm.chat(prompt);
  }

  /**
   * 思考阶段
   * @param {string} previousThought - 上一次思考
   * @param {string} sessionId - 会话ID
   * @param {array} trajectory - 执行轨迹
   * @returns {Promise<string>} 思考内容
   */
  async think(previousThought, sessionId, trajectory) {
    const recentHistory = trajectory.slice(-5).map(t => 
      `${t.type.toUpperCase()}: ${t.content}`
    ).join('\n');
    
    const prompt = `之前的思考：
${previousThought}

最近的执行历史：
${recentHistory}

接下来应该做什么？请思考下一步的最佳行动。

思考：`;

    return await this.llm.chat(prompt);
  }

  /**
   * 决定是否需要行动
   * @param {string} thought - 当前思考
   * @param {string} sessionId - 会话ID
   * @returns {Promise<object>} 决策结果
   */
  async decideAction(thought, sessionId) {
    const prompt = `基于当前思考：
${thought}

可用工具：
${this.tools.getToolDescriptions()}

请判断：
1. 是否需要调用工具？如果需要，选择哪个工具和参数？
2. 如果不需要工具，是否可以给出最终答案？

请以 JSON 格式回答：
{
  "shouldAct": true/false,
  "tool": "工具名称（如果需要）",
  "params": {参数对象},
  "reason": "决策理由",
  "answer": "最终答案（如果不需要工具）"
}`;

    const response = await this.llm.chat(prompt);
    
    try {
      // 提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // 解析失败，默认需要行动
    }
    
    return { shouldAct: false, answer: '无法确定下一步行动' };
  }

  /**
   * 执行行动
   * @param {object} actionDecision - 行动决策
   * @param {string} sessionId - 会话ID
   * @returns {Promise<object>} 执行结果
   */
  async act(actionDecision, sessionId) {
    const { tool, params } = actionDecision;
    
    try {
      const result = await this.executeToolCall({ tool, params }, sessionId);
      return {
        tool,
        params,
        result,
        success: true
      };
    } catch (error) {
      return {
        tool,
        params,
        result: { error: error.message },
        success: false
      };
    }
  }

  /**
   * 观察结果
   * @param {object} actionResult - 行动结果
   * @returns {string} 观察内容
   */
  observe(actionResult) {
    if (actionResult.success === false) {
      return `执行失败：${actionResult.result.error}`;
    }
    
    if (actionResult.result.success === false) {
      return `操作失败：${actionResult.result.error}`;
    }
    
    // 简化结果描述
    const result = actionResult.result;
    const summary = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
    
    if (summary.length > 500) {
      return `操作成功，结果：${summary.substring(0, 500)}...`;
    }
    
    return `操作成功，结果：${summary}`;
  }

  /**
   * 更新思考
   * @param {string} thought - 当前思考
   * @param {string} observation - 观察结果
   * @param {string} sessionId - 会话ID
   * @returns {Promise<string>} 更新后的思考
   */
  async updateThought(thought, observation, sessionId) {
    const prompt = `基于之前的思考和最新的观察：

之前思考：
${thought}

最新观察：
${observation}

请更新你的思考，考虑：
1. 观察结果如何影响任务进度？
2. 是否需要调整策略？
3. 下一步应该做什么？

更新后的思考：`;

    return await this.llm.chat(prompt);
  }

  /**
   * 定期反思
   * @param {array} trajectory - 执行轨迹
   * @param {string} sessionId - 会话ID
   * @returns {Promise<string>} 反思内容
   */
  async periodicReflection(trajectory, sessionId) {
    const recentSteps = trajectory.slice(-this.reflectionFrequency);
    
    const prompt = `回顾最近 ${this.reflectionFrequency} 步执行：

${recentSteps.map(t => `${t.type.toUpperCase()}: ${JSON.stringify(t.content || t.result)}`).join('\n')}

请反思：
1. 执行是否高效？
2. 是否有更好的方法？
3. 需要改变策略吗？

反思：`;

    return await this.llm.chat(prompt);
  }

  /**
   * 生成最终答案
   * @param {string} task - 任务描述
   * @param {array} trajectory - 执行轨迹
   * @param {string} sessionId - 会话ID
   * @returns {Promise<string>} 最终答案
   */
  async generateFinalAnswer(task, trajectory, sessionId) {
    const summary = trajectory
      .filter(t => t.type === 'observation' || t.type === 'answer')
      .map(t => t.content)
      .join('\n');
    
    const prompt = `任务：${task}

执行过程摘要：
${summary}

请给出任务的最终答案或结论：`;

    return await this.llm.chat(prompt);
  }

  /**
   * 最终反思
   * @param {string} task - 任务描述
   * @param {array} trajectory - 执行轨迹
   * @param {string} sessionId - 会话ID
   * @returns {Promise<object>} 最终反思
   */
  async finalReflection(task, trajectory, sessionId) {
    const prompt = `任务：${task}

完整执行轨迹：
${trajectory.map(t => `[${t.type}] ${t.iteration}: ${JSON.stringify(t.content || t.result)}`).join('\n')}

请对整个任务执行过程进行反思：
1. 任务是否成功完成？
2. 执行过程是否高效？
3. 有哪些经验教训？
4. 如何改进？

反思：`;

    const reflection = await this.llm.chat(prompt);
    
    return {
      summary: reflection,
      iterations: trajectory.length,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ReActAgent;