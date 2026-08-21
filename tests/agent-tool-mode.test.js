/**
 * Agent 工具模式单元测试
 * 测试工具降级模式、参数提取和结果格式化
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const Agent = require('../server/agent/core');

class AgentToolModeTest {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
    this.testDir = path.join(__dirname, 'test_data', 'agent');
  }

  /**
   * 运行所有测试
   */
  async runAll() {
    console.log('\n=== Agent 工具模式单元测试 ===\n');
    
    try {
      // 准备测试环境
      await fs.mkdir(this.testDir, { recursive: true });
      
      // 执行测试
      await this.testToolModeDetection();
      await this.testCalculatorExecution();
      await this.testWebScraperExecution();
      await this.testDataAnalyzerExecution();
      await this.testParameterExtraction();
      await this.testResultFormatting();
      await this.testSessionManagement();
      await this.testEdgeCases();
      await this.testErrorHandling();
      
      // 打印结果
      this.printResults();
      
    } finally {
      // 清理测试数据
      await this.cleanup();
    }
  }

  /**
   * 测试工具模式检测
   */
  async testToolModeDetection() {
    const test = '工具模式检测';
    console.log(`\n--- ${test} ---`);
    
    const agent = new Agent({
      llm: { apiKey: '' } // 不设置 API Key
    });
    
    // 测试 LLM 不可用
    const available = await agent.checkLLM();
    this.assert(
      `${test}: LLM不可用`,
      available === false,
      '无 API Key 时 LLM 应不可用'
    );
    
    // 测试运行任务进入工具模式
    const result = await agent.run('你好');
    this.assert(
      `${test}: 进入工具模式`,
      result.mode === 'tools',
      '应进入工具模式'
    );
    
    this.assert(
      `${test}: 返回成功`,
      result.success === true,
      '工具模式应返回成功'
    );
  }

  /**
   * 测试计算器执行
   */
  async testCalculatorExecution() {
    const test = '计算器执行';
    console.log(`\n--- ${test} ---`);
    
    const agent = new Agent({ llm: { apiKey: '' } });
    
    const testCases = [
      { input: '计算 2 + 3', expected: 5 },
      { input: '算 10 * 5', expected: 50 },
      { input: '计算 (5 + 3) * 2', expected: 16 },
      { input: '等于 100 / 4', expected: 25 },
    ];
    
    for (const { input, expected } of testCases) {
      const result = await agent.run(input);
      this.assert(
        `${test}: ${input}`,
        result.success && result.response.includes(expected.toString()),
        `期望结果包含 ${expected}`
      );
    }
    
    // 测试无参数情况
    const noParamResult = await agent.run('计算');
    this.assert(
      `${test}: 无参数`,
      noParamResult.success,
      '无参数应返回成功（但提示参数缺失）'
    );
  }

  /**
   * 测试网页抓取执行
   */
  async testWebScraperExecution() {
    const test = '网页抓取执行';
    console.log(`\n--- ${test} ---`);
    
    const agent = new Agent({ llm: { apiKey: '' } });
    
    // 测试真实 URL（example.com）
    const result = await agent.run('抓取 https://example.com');
    this.assert(
      `${test}: 真实URL`,
      result.success && result.toolsUsed.includes('web_scraper'),
      '应成功执行网页抓取'
    );
    
    // 测试不同关键词
    const result2 = await agent.run('爬 https://example.com');
    this.assert(
      `${test}: 爬关键词`,
      result2.success && result2.toolsUsed.includes('web_scraper'),
      '应识别"爬"关键词'
    );
    
    // 测试无效 URL
    const invalidResult = await agent.run('抓取 not_a_url');
    this.assert(
      `${test}: 无参数`,
      invalidResult.success === true,
      '无有效参数时应返回提示信息'
    );
  }

  /**
   * 测试数据分析执行
   */
  async testDataAnalyzerExecution() {
    const test = '数据分析执行';
    console.log(`\n--- ${test} ---`);
    
    const agent = new Agent({ llm: { apiKey: '' } });
    
    const testCases = [
      { input: '分析数据 [1,2,3,4,5]', desc: '简单数组' },
      { input: '统计 [10,20,30,40,50]', desc: '统计关键词' },
    ];
    
    for (const { input, desc } of testCases) {
      const result = await agent.run(input);
      this.assert(
        `${test}: ${desc}`,
        result.success && result.toolsUsed.includes('data_analyzer'),
        `应成功执行数据分析`
      );
    }
    
    // 测试复杂数据
    const complexResult = await agent.run('分析数据 [[1,2],[3,4]]');
    this.assert(
      `${test}: 复杂数据`,
      complexResult.success,
      '应能处理复杂数据结构'
    );
  }

  /**
   * 测试参数提取
   */
  async testParameterExtraction() {
    const test = '参数提取';
    console.log(`\n--- ${test} ---`);
    
    const agent = new Agent({ llm: { apiKey: '' } });
    
    // 测试计算器参数提取
    const calcParams = agent.extractParams('计算 (2 + 3) * 4', 'calculator');
    this.assert(
      `${test}: 计算器`,
      calcParams.expression && calcParams.expression.includes('('),
      '应提取括号表达式'
    );
    
    // 测试网页抓取参数提取
    const scraperParams = agent.extractParams('抓取 https://example.com/page', 'web_scraper');
    this.assert(
      `${test}: 网页抓取`,
      scraperParams.url === 'https://example.com/page',
      '应提取完整 URL'
    );
    
    // 测试文件路径提取
    const fileParams = agent.extractParams('读取 data/test.json', 'file_reader');
    this.assert(
      `${test}: 文件路径`,
      fileParams.filepath && fileParams.filepath.includes('.json'),
      '应提取文件路径'
    );
    
    // 测试 HTTP 请求方法提取
    const httpParams1 = agent.extractParams('POST请求 https://api.example.com', 'http_request');
    this.assert(
      `${test}: POST方法`,
      httpParams1.method === 'POST',
      '应提取 POST 方法'
    );
    
    const httpParams2 = agent.extractParams('请求 https://api.example.com', 'http_request');
    this.assert(
      `${test}: 默认GET`,
      httpParams2.method === 'GET',
      '默认应为 GET 方法'
    );
    
    // 测试数组数据提取
    const analyzerParams = agent.extractParams('分析数据 [10, 20, 30]', 'data_analyzer');
    this.assert(
      `${test}: 数组数据`,
      Array.isArray(analyzerParams.data) && analyzerParams.data.length === 3,
      '应提取数组数据'
    );
  }

  /**
   * 测试结果格式化
   */
  async testResultFormatting() {
    const test = '结果格式化';
    console.log(`\n--- ${test} ---`);
    
    const agent = new Agent({ llm: { apiKey: '' } });
    
    // 格式化计算器结果
    const calcResult = agent.formatToolResult('calculator', { expression: '2+2' }, { result: 4 });
    this.assert(
      `${test}: 计算器格式`,
      calcResult.includes('✅') && calcResult.includes('4'),
      '应包含成功标记和结果'
    );
    
    // 格式化网页抓取结果
    const scraperResult = agent.formatToolResult('web_scraper', {}, { 
      title: 'Test Page', 
      content: 'This is test content for verification' 
    });
    this.assert(
      `${test}: 网页抓取格式`,
      scraperResult.includes('标题') && scraperResult.includes('Test Page'),
      '应包含标题信息'
    );
    
    // 格式化数据分析结果
    const analyzerResult = agent.formatToolResult('data_analyzer', {}, { 
      analysis: { count: 5, type: 'number' } 
    });
    this.assert(
      `${test}: 数据分析格式`,
      analyzerResult.includes('数据量') && analyzerResult.includes('5'),
      '应包含数据量信息'
    );
  }

  /**
   * 测试会话管理
   */
  async testSessionManagement() {
    const test = '会话管理';
    console.log(`\n--- ${test} ---`);
    
    const agent = new Agent({ llm: { apiKey: '' } });
    
    // 创建会话
    const result = await agent.run('测试消息');
    this.assert(
      `${test}: 创建会话`,
      result.sessionId && result.sessionId.startsWith('session_'),
      '应返回会话 ID'
    );
    
    // 获取会话历史
    const history = agent.getSessionHistory(result.sessionId);
    this.assert(
      `${test}: 获取历史`,
      Array.isArray(history) && history.length > 0,
      '应返回会话历史'
    );
    
    // 验证历史内容
    const hasUserMessage = history.some(msg => msg.role === 'user');
    this.assert(
      `${test}: 历史内容`,
      hasUserMessage,
      '历史应包含用户消息'
    );
    
    // 不存在的会话
    const nonExistent = agent.getSessionHistory('non_existent_session');
    this.assert(
      `${test}: 不存在的会话`,
      nonExistent === null || nonExistent === undefined,
      '不存在的会话应返回空'
    );
  }

  /**
   * 测试边界情况
   */
  async testEdgeCases() {
    const test = '边界情况';
    console.log(`\n--- ${test} ---`);
    
    const agent = new Agent({ llm: { apiKey: '' } });
    
    // 空消息
    const emptyResult = await agent.run('');
    this.assert(
      `${test}: 空消息`,
      emptyResult.success === true,
      '空消息应返回成功（显示使用指引）'
    );
    
    // 超长消息
    const longMessage = '测试'.repeat(1000);
    const longResult = await agent.run(longMessage);
    this.assert(
      `${test}: 超长消息`,
      longResult.success === true,
      '应能处理超长消息'
    );
    
    // 特殊字符
    const specialResult = await agent.run('计算 2 + 3 !@#$%^&*()');
    this.assert(
      `${test}: 特殊字符`,
      specialResult.success === true,
      '应能处理特殊字符'
    );
    
    // 混合关键词
    const mixedResult = await agent.run('计算抓取分析数据');
    this.assert(
      `${test}: 混合关键词`,
      mixedResult.success === true,
      '应处理混合关键词（匹配第一个）'
    );
    
    // 未知工具关键词
    const unknownResult = await agent.run('唱歌跳舞');
    this.assert(
      `${test}: 未知关键词`,
      unknownResult.success === true && unknownResult.response.includes('纯工具模式'),
      '未知关键词应返回使用指引'
    );
  }

  /**
   * 测试错误处理
   */
  async testErrorHandling() {
    const test = '错误处理';
    console.log(`\n--- ${test} ---`);
    
    const agent = new Agent({ llm: { apiKey: '' } });
    
    // 无效的计算表达式
    const invalidCalc = await agent.run('计算 abc');
    this.assert(
      `${test}: 无效计算`,
      invalidCalc.success === true,
      '无效计算应返回成功（但工具执行失败）'
    );
    
    // 不存在的文件
    const fileResult = await agent.run('读取 non_existent_file_12345.txt');
    this.assert(
      `${test}: 不存在的文件`,
      fileResult.success === true,
      '读取不存在的文件应返回成功（但工具执行失败）'
    );
    
    // 无效的 URL
    const urlResult = await agent.run('抓取 javascript:alert(1)');
    this.assert(
      `${test}: 无效URL`,
      urlResult.success === true,
      '无效 URL 应返回成功（但工具执行失败）'
    );
  }

  /**
   * 断言辅助方法
   */
  assert(name, condition, message) {
    if (condition) {
      this.passed++;
      this.tests.push({ name, passed: true });
      console.log(`  ✅ ${name}`);
    } else {
      this.failed++;
      this.tests.push({ name, passed: false, message });
      console.log(`  ❌ ${name}: ${message}`);
    }
  }

  /**
   * 打印测试结果
   */
  printResults() {
    console.log('\n========================================');
    console.log(`  Agent 工具模式测试完成`);
    console.log(`  ✅ 通过: ${this.passed}`);
    console.log(`  ❌ 失败: ${this.failed}`);
    console.log(`  总计: ${this.tests.length}`);
    console.log('========================================\n');
    
    if (this.failed > 0) {
      console.log('失败的测试:');
      this.tests
        .filter(t => !t.passed)
        .forEach(t => console.log(`  - ${t.name}: ${t.message}`));
      console.log('');
    }
  }

  /**
   * 清理测试数据
   */
  async cleanup() {
    try {
      await fs.rm(this.testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  }
}

// 运行测试
if (require.main === module) {
  const test = new AgentToolModeTest();
  test.runAll().catch(console.error);
}

module.exports = AgentToolModeTest;