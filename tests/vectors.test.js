/**
 * 向量存储测试
 */

const VectorStore = require('../../server/memory/vectors');
const path = require('path');

// 创建测试实例
const vectorStore = new VectorStore({
  storagePath: path.join(__dirname, '../data/test_vectors')
});

// 测试辅助函数
function assert(condition, message) {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
  console.log(`✓ ${message}`);
}

// 测试套件
async function runTests() {
  console.log('\n=== 向量存储测试 ===\n');
  
  try {
    // 测试 1: 添加文档
    console.log('测试 1: 添加文档');
    const doc1 = await vectorStore.addDocument('这是一个测试文档', { category: 'test' });
    assert(doc1.startsWith('doc_'), '文档 ID 应以 doc_ 开头');
    assert(vectorStore.documentCount === 1, '文档计数应为 1');
    
    // 测试 2: 批量添加文档
    console.log('\n测试 2: 批量添加文档');
    const docs = await vectorStore.addDocuments([
      { text: '机器学习是人工智能的子集', metadata: { topic: 'AI' } },
      { text: '深度学习使用神经网络', metadata: { topic: 'AI' } },
      { text: '自然语言处理是重要的AI应用', metadata: { topic: 'NLP' } }
    ]);
    assert(docs.length === 3, '应添加 3 个文档');
    assert(vectorStore.documentCount === 4, '总文档数应为 4');
    
    // 测试 3: 相似度搜索
    console.log('\n测试 3: 相似度搜索');
    const results = await vectorStore.search('人工智能', 2);
    assert(results.length === 2, '应返回 2 个结果');
    assert(results[0].score > 0, '相似度应大于 0');
    
    // 测试 4: 获取文档
    console.log('\n测试 4: 获取文档');
    const retrieved = vectorStore.getDocument(doc1);
    assert(retrieved !== null, '应能获取文档');
    assert(retrieved.text === '这是一个测试文档', '文档内容应匹配');
    
    // 测试 5: 删除文档
    console.log('\n测试 5: 删除文档');
    const deleted = await vectorStore.deleteDocument(doc1);
    assert(deleted === true, '应成功删除文档');
    assert(vectorStore.documentCount === 3, '文档数应减少到 3');
    
    const notFound = vectorStore.getDocument(doc1);
    assert(notFound === null, '删除后应无法找到文档');
    
    // 测试 6: 保存和加载
    console.log('\n测试 6: 保存和加载');
    await vectorStore.save();
    
    const newStore = new VectorStore({
      storagePath: path.join(__dirname, '../data/test_vectors')
    });
    await newStore.load();
    assert(newStore.documentCount === 3, '加载后文档数应为 3');
    
    // 测试 7: 清空存储
    console.log('\n测试 7: 清空存储');
    await vectorStore.clear();
    assert(vectorStore.documentCount === 0, '清空后文档数应为 0');
    
    // 测试 8: 统计信息
    console.log('\n测试 8: 统计信息');
    await vectorStore.addDocument('测试统计功能', { test: true });
    const stats = vectorStore.getStats();
    assert(stats.documentCount === 1, '统计中的文档数应正确');
    assert(stats.vocabularySize > 0, '词汇表大小应大于 0');
    
    console.log('\n✅ 所有测试通过！\n');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    throw error;
  }
}

// 运行测试
runTests().catch(error => {
  console.error('\n❌ 测试失败:', error.message);
  process.exit(1);
});