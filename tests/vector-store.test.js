/**
 * 向量数据库单元测试
 * 测试 TF-IDF 嵌入和相似度搜索功能
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const VectorStore = require('../server/memory/vectors');

class VectorStoreTest {
  constructor() {
    this.testDir = path.join(__dirname, 'test_data', 'vectors');
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  /**
   * 运行所有测试
   */
  async runAll() {
    console.log('\n=== 向量数据库单元测试 ===\n');
    
    try {
      // 准备测试环境
      await fs.mkdir(this.testDir, { recursive: true });
      
      // 执行测试
      await this.testTokenization();
      await this.testVocabularyBuilding();
      await this.testTFIDFEmbedding();
      await this.testDocumentAddition();
      await this.testSimilaritySearch();
      await this.testCosineSimilarity();
      await this.testDocumentRetrieval();
      await this.testPersistence();
      await this.testEdgeCases();
      await this.testChineseSupport();
      
      // 打印结果
      this.printResults();
      
    } finally {
      // 清理测试数据
      await this.cleanup();
    }
  }

  /**
   * 测试分词功能
   */
  async testTokenization() {
    const test = '测试分词功能';
    const store = new VectorStore({ storagePath: this.testDir });
    
    // 测试中文分词
    const chineseTokens = store.tokenize('人工智能是计算机科学的一个分支');
    this.assert(
      test + ' - 中文分词',
      chineseTokens.length > 0,
      `期望分词结果非空，实际: ${chineseTokens.length} 个 token`
    );
    
    // 测试英文分词
    const englishTokens = store.tokenize('machine learning is amazing');
    this.assert(
      test + ' - 英文分词',
      englishTokens.includes('machine') && englishTokens.includes('learning'),
      `期望包含英文单词，实际: ${englishTokens.join(', ')}`
    );
    
    // 测试数字分词
    const numberTokens = store.tokenize('123 456');
    this.assert(
      test + ' - 数字分词',
      numberTokens.includes('123') && numberTokens.includes('456'),
      `期望包含数字，实际: ${numberTokens.join(', ')}`
    );
    
    // 测试混合内容
    const mixedTokens = store.tokenize('Python 3.9 版本发布');
    this.assert(
      test + ' - 混合分词',
      mixedTokens.length > 5,
      `期望混合分词结果丰富，实际: ${mixedTokens.length} 个 token`
    );
  }

  /**
   * 测试词汇表构建
   */
  async testVocabularyBuilding() {
    const test = '测试词汇表构建';
    const store = new VectorStore({ storagePath: this.testDir });
    
    store.buildVocabulary('人工智能 机器学习');
    this.assert(
      test + ' - 词汇表扩展',
      store.vocabulary.size > 0,
      `期望词汇表非空，实际大小: ${store.vocabulary.size}`
    );
    
    // 检查词汇表索引
    let hasValidIndex = true;
    for (const [token, index] of store.vocabulary) {
      if (typeof index !== 'number' || index < 0) {
        hasValidIndex = false;
        break;
      }
    }
    this.assert(test + ' - 索引有效性', hasValidIndex, '所有词汇索引应为非负数');
    
    // 测试重复添加
    const sizeBefore = store.vocabulary.size;
    store.buildVocabulary('人工智能');
    this.assert(
      test + ' - 重复词不增加',
      store.vocabulary.size === sizeBefore,
      `期望重复词不增加词汇表大小`
    );
  }

  /**
   * 测试 TF-IDF 嵌入
   */
  async testTFIDFEmbedding() {
    const test = '测试TF-IDF嵌入';
    const store = new VectorStore({ storagePath: this.testDir });
    
    // 先构建词汇表
    store.buildVocabulary('人工智能 机器学习 深度学习');
    
    const embedding = await store.embed('人工智能');
    
    this.assert(
      test + ' - 嵌入结构',
      embedding.hasOwnProperty('indices') && 
      embedding.hasOwnProperty('values') && 
      embedding.hasOwnProperty('dimension'),
      '嵌入应包含 indices, values, dimension'
    );
    
    this.assert(
      test + ' - 嵌入维度',
      embedding.dimension === store.vocabulary.size,
      `嵌入维度应等于词汇表大小: ${embedding.dimension} vs ${store.vocabulary.size}`
    );
    
    this.assert(
      test + ' - 非零向量',
      embedding.values.length > 0,
      '嵌入向量应非空'
    );
    
    // 测试归一化
    const norm = Math.sqrt(embedding.values.reduce((sum, v) => sum + v * v, 0));
    this.assert(
      test + ' - L2归一化',
      Math.abs(norm - 1.0) < 0.01,
      `L2范数应接近1，实际: ${norm}`
    );
  }

  /**
   * 测试文档添加
   */
  async testDocumentAddition() {
    const test = '测试文档添加';
    const store = new VectorStore({ storagePath: this.testDir, autoSave: false });
    
    const id1 = await store.addDocument('文档一', { category: 'test' });
    const id2 = await store.addDocument('文档二', { category: 'test' });
    
    this.assert(
      test + ' - 返回ID',
      typeof id1 === 'string' && typeof id2 === 'string',
      '添加文档应返回ID'
    );
    
    this.assert(
      test + ' - ID唯一',
      id1 !== id2,
      '不同文档应有不同ID'
    );
    
    this.assert(
      test + ' - 文档计数',
      store.documents.length === 2,
      `文档数组应有2个元素，实际: ${store.documents.length}`
    );
    
    this.assert(
      test + ' - 嵌入存储',
      store.embeddings.length === 2,
      `嵌入数组应有2个元素，实际: ${store.embeddings.length}`
    );
    
    this.assert(
      test + ' - 元数据存储',
      store.metadata.length === 2,
      `元数据数组应有2个元素，实际: ${store.metadata.length}`
    );
    
    // 测试文档频率更新
    this.assert(
      test + ' - 文档频率',
      store.docCount === 2,
      `文档计数应为2，实际: ${store.docCount}`
    );
  }

  /**
   * 测试相似度搜索
   */
  async testSimilaritySearch() {
    const test = '测试相似度搜索';
    const store = new VectorStore({ storagePath: this.testDir, autoSave: false });
    
    await store.addDocument('人工智能是计算机科学的一个分支', { topic: 'AI' });
    await store.addDocument('机器学习使用算法从数据中学习', { topic: 'ML' });
    await store.addDocument('深度学习是机器学习的子集', { topic: 'DL' });
    await store.addDocument('Python 是一种编程语言', { topic: 'PL' });
    
    // 搜索相关文档
    const results = await store.search('人工智能', 3);
    
    this.assert(
      test + ' - 结果数量',
      results.length === 3,
      `期望返回3个结果，实际: ${results.length}`
    );
    
    this.assert(
      test + ' - 结果结构',
      results[0].hasOwnProperty('id') &&
      results[0].hasOwnProperty('text') &&
      results[0].hasOwnProperty('score'),
      '结果应包含 id, text, score'
    );
    
    this.assert(
      test + ' - 非零相似度',
      results.some(r => r.score > 0),
      '至少应有非零相似度'
    );
    
    // 测试排序（相似度降序）
    const isSorted = results.every((r, i) => 
      i === 0 || results[i - 1].score >= r.score
    );
    this.assert(test + ' - 结果排序', isSorted, '结果应按相似度降序排列');
    
    // 测试 topK 参数
    const top1Results = await store.search('编程', 1);
    this.assert(
      test + ' - topK参数',
      top1Results.length === 1,
      `期望返回1个结果，实际: ${top1Results.length}`
    );
  }

  /**
   * 测试余弦相似度计算
   */
  async testCosineSimilarity() {
    const test = '测试余弦相似度';
    const store = new VectorStore({ storagePath: this.testDir });
    
    // 相同向量
    const vec1 = { indices: [0, 1], values: [0.707, 0.707], dimension: 2 };
    const vec2 = { indices: [0, 1], values: [0.707, 0.707], dimension: 2 };
    const sim1 = store.cosineSimilarity(vec1, vec2);
    this.assert(
      test + ' - 相同向量',
      Math.abs(sim1 - 1.0) < 0.01,
      `相同向量相似度应接近1，实际: ${sim1}`
    );
    
    // 正交向量
    const vec3 = { indices: [0, 1], values: [1.0, 0.0], dimension: 2 };
    const vec4 = { indices: [0, 1], values: [0.0, 1.0], dimension: 2 };
    const sim2 = store.cosineSimilarity(vec3, vec4);
    this.assert(
      test + ' - 正交向量',
      Math.abs(sim2) < 0.01,
      `正交向量相似度应接近0，实际: ${sim2}`
    );
    
    // 零向量
    const vec5 = { indices: [], values: [], dimension: 0 };
    const vec6 = { indices: [0], values: [1.0], dimension: 1 };
    const sim3 = store.cosineSimilarity(vec5, vec6);
    this.assert(
      test + ' - 零向量',
      sim3 === 0,
      `零向量相似度应为0`
    );
  }

  /**
   * 测试文档检索
   */
  async testDocumentRetrieval() {
    const test = '测试文档检索';
    const store = new VectorStore({ storagePath: this.testDir, autoSave: false });
    
    const id = await store.addDocument('测试文档', { key: 'value' });
    
    const doc = store.getDocument(id);
    this.assert(
      test + ' - 检索存在文档',
      doc && doc.text === '测试文档',
      '应能检索到添加的文档'
    );
    
    this.assert(
      test + ' - 包含元数据',
      doc && doc.metadata && doc.metadata.key === 'value',
      '检索的文档应包含元数据'
    );
    
    const nonExistent = store.getDocument('non_existent_id');
    this.assert(
      test + ' - 不存在文档',
      nonExistent === null,
      '不存在的文档应返回null'
    );
    
    // 测试删除
    const deleted = await store.deleteDocument(id);
    this.assert(test + ' - 删除成功', deleted === true, '删除应返回true');
    
    this.assert(
      test + ' - 删除后检索',
      store.getDocument(id) === null,
      '删除后应无法检索'
    );
  }

  /**
   * 测试持久化
   */
  async testPersistence() {
    const test = '测试持久化';
    const testPath = path.join(this.testDir, 'persistence_test');
    const store1 = new VectorStore({ storagePath: testPath });
    
    await store1.addDocument('持久化测试', { type: 'test' });
    await store1.save();
    
    // 加载到新实例
    const store2 = new VectorStore({ storagePath: testPath });
    await store2.load();
    
    this.assert(
      test + ' - 加载文档',
      store2.documents.length === store1.documents.length,
      '加载后文档数量应相同'
    );
    
    this.assert(
      test + ' - 加载词汇表',
      store2.vocabulary.size === store1.vocabulary.size,
      '加载后词汇表大小应相同'
    );
    
    this.assert(
      test + ' - 加载文档频率',
      store2.docCount === store1.docCount,
      '加载后文档计数应相同'
    );
  }

  /**
   * 测试边界情况
   */
  async testEdgeCases() {
    const test = '测试边界情况';
    const store = new VectorStore({ storagePath: this.testDir });
    
    // 空文档
    try {
      await store.addDocument('');
      this.assert(test + ' - 空文档', true, '应能处理空文档');
    } catch (error) {
      this.assert(test + ' - 空文档', false, `空文档处理失败: ${error.message}`);
    }
    
    // 超长文档
    const longText = '测试'.repeat(10000);
    const id = await store.addDocument(longText);
    this.assert(test + ' - 超长文档', id !== null, '应能处理超长文档');
    
    // 空搜索
    const emptyStore = new VectorStore({ storagePath: path.join(this.testDir, 'empty') });
    const results = await emptyStore.search('test');
    this.assert(test + ' - 空搜索', results.length === 0, '空存储搜索应返回空数组');
    
    // 单字文档
    const singleId = await store.addDocument('测');
    this.assert(test + ' - 单字文档', singleId !== null, '应能处理单字文档');
  }

  /**
   * 测试中文支持
   */
  async testChineseSupport() {
    const test = '测试中文支持';
    const store = new VectorStore({ storagePath: this.testDir, autoSave: false });
    
    await store.addDocument('人工智能发展迅速', { lang: 'zh' });
    await store.addDocument('机器学习应用广泛', { lang: 'zh' });
    await store.addDocument('深度学习技术先进', { lang: 'zh' });
    
    const results = await store.search('人工智能', 3);
    
    this.assert(
      test + ' - 中文搜索',
      results.length > 0 && results.some(r => r.text.includes('人工智能')),
      '中文搜索应返回相关文档'
    );
    
    // 测试 bigram 分词效果
    const tokens = store.tokenize('人工智能');
    this.assert(
      test + ' - bigram分词',
      tokens.includes('人工') || tokens.includes('智能'),
      '中文应产生 bigram token'
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
    console.log(`  向量数据库测试完成`);
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
  const test = new VectorStoreTest();
  test.runAll().catch(console.error);
}

module.exports = VectorStoreTest;