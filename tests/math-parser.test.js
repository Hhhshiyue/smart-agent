/**
 * 安全计算器单元测试
 * 测试数学表达式解析和安全验证
 */

const assert = require('assert');
const { safeCalculate, MathParser } = require('../server/tools/math-parser');

class MathParserTest {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  /**
   * 运行所有测试
   */
  async runAll() {
    console.log('\n=== 安全计算器单元测试 ===\n');
    
    // 基础运算测试
    this.testBasicOperations();
    
    // 括号表达式测试
    this.testParentheses();
    
    // 运算符优先级测试
    this.testOperatorPrecedence();
    
    // 小数和负数测试
    this.testDecimalsAndNegatives();
    
    // 复杂表达式测试
    this.testComplexExpressions();
    
    // 安全性测试
    this.testSecurity();
    
    // 边界情况测试
    this.testEdgeCases();
    
    // 错误处理测试
    this.testErrorHandling();
    
    // 打印结果
    this.printResults();
  }

  /**
   * 测试基础运算
   */
  testBasicOperations() {
    const test = '基础运算';
    console.log(`\n--- ${test} ---`);
    
    const testCases = [
      { expr: '1 + 2', expected: 3 },
      { expr: '10 - 5', expected: 5 },
      { expr: '3 * 4', expected: 12 },
      { expr: '20 / 4', expected: 5 },
      { expr: '10 % 3', expected: 1 },
      { expr: '2 + 3', expected: 5 },
      { expr: '100 - 50', expected: 50 },
      { expr: '7 * 8', expected: 56 },
      { expr: '100 / 10', expected: 10 },
    ];
    
    for (const { expr, expected } of testCases) {
      try {
        const result = safeCalculate(expr);
        this.assert(
          `${test}: ${expr}`,
          Math.abs(result - expected) < 0.0001,
          `期望 ${expected}，实际 ${result}`
        );
      } catch (error) {
        this.assert(`${test}: ${expr}`, false, `抛出异常: ${error.message}`);
      }
    }
  }

  /**
   * 测试括号表达式
   */
  testParentheses() {
    const test = '括号表达式';
    console.log(`\n--- ${test} ---`);
    
    const testCases = [
      { expr: '(1 + 2) * 3', expected: 9 },
      { expr: '(10 - 5) * 2', expected: 10 },
      { expr: '2 * (3 + 4)', expected: 14 },
      { expr: '((2 + 3) * 4)', expected: 20 },
      { expr: '(1 + (2 * 3))', expected: 7 },
      { expr: '((1 + 2) + (3 + 4))', expected: 10 },
      { expr: '10 / (2 + 3)', expected: 2 },
      { expr: '(8 - 2) / (1 + 2)', expected: 2 },
    ];
    
    for (const { expr, expected } of testCases) {
      try {
        const result = safeCalculate(expr);
        this.assert(
          `${test}: ${expr}`,
          Math.abs(result - expected) < 0.0001,
          `期望 ${expected}，实际 ${result}`
        );
      } catch (error) {
        this.assert(`${test}: ${expr}`, false, `抛出异常: ${error.message}`);
      }
    }
  }

  /**
   * 测试运算符优先级
   */
  testOperatorPrecedence() {
    const test = '运算符优先级';
    console.log(`\n--- ${test} ---`);
    
    const testCases = [
      { expr: '2 + 3 * 4', expected: 14 },
      { expr: '10 - 2 * 3', expected: 4 },
      { expr: '100 / 2 + 3', expected: 53 },
      { expr: '1 + 2 * 3 - 4', expected: 3 },
      { expr: '2 * 3 + 4 * 5', expected: 26 },
      { expr: '10 / 2 * 3', expected: 15 },
      { expr: '2 + 3 * 4 - 5', expected: 9 },
      { expr: '10 - 6 / 2 + 1', expected: 8 },
    ];
    
    for (const { expr, expected } of testCases) {
      try {
        const result = safeCalculate(expr);
        this.assert(
          `${test}: ${expr}`,
          Math.abs(result - expected) < 0.0001,
          `期望 ${expected}，实际 ${result}`
        );
      } catch (error) {
        this.assert(`${test}: ${expr}`, false, `抛出异常: ${error.message}`);
      }
    }
  }

  /**
   * 测试小数和负数
   */
  testDecimalsAndNegatives() {
    const test = '小数和负数';
    console.log(`\n--- ${test} ---`);
    
    const testCases = [
      { expr: '2.5 + 3.5', expected: 6 },
      { expr: '10.5 - 0.5', expected: 10 },
      { expr: '2.5 * 2', expected: 5 },
      { expr: '7.5 / 2.5', expected: 3 },
      { expr: '-5 + 10', expected: 5 },
      { expr: '10 + -3', expected: 7 },
      { expr: '-2 * -3', expected: 6 },
      { expr: '-10 / 2', expected: -5 },
      { expr: '3.14159 * 2', expected: 6.28318 },
      { expr: '-(-5)', expected: 5 },
    ];
    
    for (const { expr, expected } of testCases) {
      try {
        const result = safeCalculate(expr);
        this.assert(
          `${test}: ${expr}`,
          Math.abs(result - expected) < 0.0001,
          `期望 ${expected}，实际 ${result}`
        );
      } catch (error) {
        this.assert(`${test}: ${expr}`, false, `抛出异常: ${error.message}`);
      }
    }
  }

  /**
   * 测试复杂表达式
   */
  testComplexExpressions() {
    const test = '复杂表达式';
    console.log(`\n--- ${test} ---`);
    
    const testCases = [
      { expr: '2 + 3 * 4 - 5 / 5', expected: 13 },
      { expr: '(1 + 2) * (3 + 4)', expected: 21 },
      { expr: '10 + 2 * 3 - 4 / 2', expected: 14 },
      { expr: '((5 + 5) * 2) - 10', expected: 10 },
      { expr: '100 - (20 + 30) * 2', expected: 0 },
      { expr: '(2 + 3) * (4 + 5) - 10', expected: 35 },
      { expr: '1 + 2 + 3 + 4 + 5', expected: 15 },
      { expr: '10 * 10 - 5 * 5', expected: 75 },
    ];
    
    for (const { expr, expected } of testCases) {
      try {
        const result = safeCalculate(expr);
        this.assert(
          `${test}: ${expr}`,
          Math.abs(result - expected) < 0.0001,
          `期望 ${expected}，实际 ${result}`
        );
      } catch (error) {
        this.assert(`${test}: ${expr}`, false, `抛出异常: ${error.message}`);
      }
    }
  }

  /**
   * 测试安全性
   */
  testSecurity() {
    const test = '安全性测试';
    console.log(`\n--- ${test} ---`);
    
    const maliciousInputs = [
      'process.exit()',
      'eval("alert(1)")',
      'require("fs")',
      'console.log("hacked")',
      '__dirname',
      'global.process',
      'while(true){}',
      'function hack(){}',
      'alert(1)',
      'document.cookie',
      'window.location',
      'this.constructor',
      '(() => { throw new Error() })()',
      'Math.pow',
      'Date.now()',
    ];
    
    for (const expr of maliciousInputs) {
      try {
        const result = safeCalculate(expr);
        this.assert(
          `${test}: ${expr.substring(0, 20)}`,
          false,
          `危险代码被执行! 结果: ${result}`
        );
      } catch (error) {
        this.assert(
          `${test}: ${expr.substring(0, 20)}`,
          true,
          '正确拒绝危险代码'
        );
      }
    }
    
    // 测试合法但复杂的表达式
    try {
      const result = safeCalculate('2 + 2');
      this.assert(
        `${test}: 合法表达式`,
        result === 4,
        '合法表达式应正常执行'
      );
    } catch (error) {
      this.assert(`${test}: 合法表达式`, false, `合法表达式被拒绝: ${error.message}`);
    }
  }

  /**
   * 测试边界情况
   */
  testEdgeCases() {
    const test = '边界情况';
    console.log(`\n--- ${test} ---`);
    
    // 空格处理
    try {
      const result = safeCalculate('  2  +  3  ');
      this.assert(`${test}: 空格处理`, result === 5, '应正确处理空格');
    } catch (error) {
      this.assert(`${test}: 空格处理`, false, error.message);
    }
    
    // 嵌套括号
    try {
      const result = safeCalculate('(((((1)))))');
      this.assert(`${test}: 深度嵌套`, result === 1, '应正确处理深度嵌套');
    } catch (error) {
      this.assert(`${test}: 深度嵌套`, false, error.message);
    }
    
    // 连续运算符（应该失败）
    try {
      safeCalculate('2 ++ 3');
      this.assert(`${test}: 连续运算符`, false, '应拒绝连续运算符');
    } catch (error) {
      this.assert(`${test}: 连续运算符`, true, '正确拒绝');
    }
    
    // 非常大的数
    try {
      const result = safeCalculate('999999999 * 999999999');
      this.assert(`${test}: 大数运算`, !isNaN(result), '应能处理大数');
    } catch (error) {
      this.assert(`${test}: 大数运算`, false, error.message);
    }
    
    // 除零测试
    try {
      safeCalculate('10 / 0');
      this.assert(`${test}: 除零`, false, '应拒绝除零');
    } catch (error) {
      this.assert(`${test}: 除零`, true, '正确拒绝除零');
    }
    
    // 模零测试
    try {
      safeCalculate('10 % 0');
      this.assert(`${test}: 模零`, false, '应拒绝模零');
    } catch (error) {
      this.assert(`${test}: 模零`, true, '正确拒绝模零');
    }
  }

  /**
   * 测试错误处理
   */
  testErrorHandling() {
    const test = '错误处理';
    console.log(`\n--- ${test} ---`);
    
    const invalidExpressions = [
      '',
      'abc',
      '2 +',
      '+ 3',
      '(2 + 3',
      '2 + 3)',
      '2 + + 3',
      '2 / / 3',
      '2 * * 3',
      '((',
      '))',
    ];
    
    for (const expr of invalidExpressions) {
      try {
        safeCalculate(expr);
        this.assert(
          `${test}: "${expr}"`,
          false,
          '应抛出异常'
        );
      } catch (error) {
        this.assert(
          `${test}: "${expr}"`,
          true,
          '正确拒绝无效表达式'
        );
      }
    }
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
    console.log(`  安全计算器测试完成`);
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
}

// 运行测试
if (require.main === module) {
  const test = new MathParserTest();
  test.runAll().catch(console.error);
}

module.exports = MathParserTest;