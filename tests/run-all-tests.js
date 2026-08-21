/**
 * 统一测试运行器
 * 运行所有单元测试并生成报告
 */

const path = require('path');
const fs = require('fs').promises;

class TestRunner {
  constructor() {
    this.results = {
      vectorStore: null,
      mathParser: null,
      agentToolMode: null
    };
    this.totalPassed = 0;
    this.totalFailed = 0;
  }

  /**
   * 运行所有测试
   */
  async runAll() {
    console.log('\n' + '='.repeat(60));
    console.log('  Smart Agent 单元测试套件');
    console.log('  测试核心修复点覆盖');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    try {
      // 运行向量数据库测试
      console.log('\n[1/3] 向量数据库测试...');
      const VectorStoreTest = require('./vector-store.test.js');
      const vectorTest = new VectorStoreTest();
      await vectorTest.runAll();
      this.results.vectorStore = vectorTest;
      
      // 运行安全计算器测试
      console.log('\n[2/3] 安全计算器测试...');
      const MathParserTest = require('./math-parser.test.js');
      const mathTest = new MathParserTest();
      await mathTest.runAll();
      this.results.mathParser = mathTest;
      
      // 运行 Agent 工具模式测试
      console.log('\n[3/3] Agent 工具模式测试...');
      const AgentToolModeTest = require('./agent-tool-mode.test.js');
      const agentTest = new AgentToolModeTest();
      await agentTest.runAll();
      this.results.agentToolMode = agentTest;
      
      // 计算总数
      this.calculateTotals();
      
      // 生成报告
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.generateReport(duration);
      
    } catch (error) {
      console.error('\n❌ 测试运行失败:', error);
      throw error;
    }
  }

  /**
   * 计算总数
   */
  calculateTotals() {
    this.totalPassed = Object.values(this.results)
      .filter(r => r !== null)
      .reduce((sum, r) => sum + r.passed, 0);
    
    this.totalFailed = Object.values(this.results)
      .filter(r => r !== null)
      .reduce((sum, r) => sum + r.failed, 0);
  }

  /**
   * 生成测试报告
   */
  generateReport(duration) {
    console.log('\n' + '='.repeat(60));
    console.log('  测试报告');
    console.log('='.repeat(60));
    
    console.log('\n📊 测试统计:\n');
    console.log(`  总测试数: ${this.totalPassed + this.totalFailed}`);
    console.log(`  ✅ 通过: ${this.totalPassed}`);
    console.log(`  ❌ 失败: ${this.totalFailed}`);
    console.log(`  📈 成功率: ${((this.totalPassed / (this.totalPassed + this.totalFailed)) * 100).toFixed(1)}%`);
    console.log(`  ⏱️  耗时: ${duration} 秒`);
    
    console.log('\n📦 模块覆盖:\n');
    
    if (this.results.vectorStore) {
      const r = this.results.vectorStore;
      console.log(`  向量数据库 (TF-IDF):`);
      console.log(`    ✅ ${r.passed} / ${r.passed + r.failed} 通过`);
    }
    
    if (this.results.mathParser) {
      const r = this.results.mathParser;
      console.log(`  安全计算器 (递归下降解析器):`);
      console.log(`    ✅ ${r.passed} / ${r.passed + r.failed} 通过`);
    }
    
    if (this.results.agentToolMode) {
      const r = this.results.agentToolMode;
      console.log(`  Agent 工具模式 (降级模式):`);
      console.log(`    ✅ ${r.passed} / ${r.passed + r.failed} 通过`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (this.totalFailed === 0) {
      console.log('  ✅ 所有测试通过！');
    } else {
      console.log(`  ❌ 有 ${this.totalFailed} 个测试失败`);
    }
    
    console.log('='.repeat(60) + '\n');
  }
}

// 运行测试
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAll().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;