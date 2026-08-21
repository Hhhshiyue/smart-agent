/**
 * 工具验证器测试
 */

const ToolValidator = require('../../server/tools/validator');
const validator = new ToolValidator();

// 测试辅助函数
function assert(condition, message) {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function assertThrows(fn, errorMessage) {
  try {
    fn();
    throw new Error(`预期抛出异常: ${errorMessage}`);
  } catch (error) {
    if (!error.message.includes(errorMessage)) {
      throw new Error(`异常消息不匹配，期望包含: ${errorMessage}, 实际: ${error.message}`);
    }
    console.log(`✓ 正确抛出异常: ${errorMessage}`);
  }
}

// 测试套件
async function runTests() {
  console.log('\n=== 工具验证器测试 ===\n');
  
  // 测试 1: 验证必需参数
  console.log('测试 1: 验证必需参数');
  const result1 = validator.validate('web_scraper', {});
  assert(!result1.valid, '缺少必需参数时应返回无效');
  assert(result1.errors.length > 0, '应包含错误信息');
  
  // 测试 2: 验证 URL 格式
  console.log('\n测试 2: 验证 URL 格式');
  const result2 = validator.validate('web_scraper', { url: 'invalid-url' });
  assert(!result2.valid, '无效 URL 应返回无效');
  
  const result3 = validator.validate('web_scraper', { url: 'https://example.com' });
  assert(result3.valid, '有效 URL 应返回有效');
  
  // 测试 3: 验证文件路径安全
  console.log('\n测试 3: 验证文件路径安全');
  const result4 = validator.validate('file_reader', { filepath: '../../../etc/passwd' });
  assert(!result4.valid, '路径遍历攻击应被拒绝');
  
  // 测试 4: 验证数学表达式
  console.log('\n测试 4: 验证数学表达式安全');
  const result5 = validator.validate('calculator', { expression: '2+2' });
  assert(result5.valid, '简单数学表达式应有效');
  
  const result6 = validator.validate('calculator', { expression: 'alert("hack")' });
  assert(!result6.valid, '包含危险代码的表达式应被拒绝');
  
  // 测试 5: 参数类型验证
  console.log('\n测试 5: 参数类型验证');
  const result7 = validator.validate('http_request', { url: 'https://example.com', method: 'INVALID' });
  assert(!result7.valid, '无效的 HTTP 方法应被拒绝');
  
  const result8 = validator.validate('http_request', { url: 'https://example.com', method: 'GET' });
  assert(result8.valid, '有效的 HTTP 方法应通过');
  
  // 测试 6: 字符串长度验证
  console.log('\n测试 6: 字符串长度验证');
  const longString = 'a'.repeat(3000);
  const result9 = validator.validate('web_scraper', { url: `https://example.com/${longString}` });
  assert(!result9.valid, '超长 URL 应被拒绝');
  
  console.log('\n✅ 所有测试通过！\n');
}

// 运行测试
runTests().catch(error => {
  console.error('\n❌ 测试失败:', error.message);
  process.exit(1);
});