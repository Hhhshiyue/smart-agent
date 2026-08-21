/**
 * 向量存储模块
 * 基于 TF-IDF 的稀疏向量嵌入和余弦相似度搜索
 */

const fs = require('fs').promises;
const path = require('path');

class VectorStore {
  constructor(config = {}) {
    this.documents = [];
    this.embeddings = [];
    this.metadata = [];
    this.storagePath = config.storagePath || path.join(__dirname, '../../data/vectors');
    this.autoSave = config.autoSave !== false;
    
    // 词汇表: token -> 索引位置
    this.vocabulary = new Map();
    // 文档频率: token -> 包含该token的文档数
    this.documentFrequency = new Map();
    // 文档总数（用于IDF计算）
    this.docCount = 0;
  }

  /**
   * 中文分词：基于字符组合的简单分词
   * 对中文使用bigram，对英文/数字使用空格分词
   */
  tokenize(text) {
    const tokens = [];
    // 匹配连续的中文字符
    const chineseMatches = text.match(/[\u4e00-\u9fa5]+/g) || [];
    // 匹配英文单词和数字
    const wordMatches = text.match(/[a-zA-Z0-9]+/g) || [];
    
    // 对中文进行 bigram 分词
    chineseMatches.forEach(segment => {
      if (segment.length === 1) {
        tokens.push(segment);
      } else {
        for (let i = 0; i < segment.length - 1; i++) {
          tokens.push(segment.substring(i, i + 2));
        }
        // 同时保留单字
        for (let i = 0; i < segment.length; i++) {
          tokens.push(segment[i]);
        }
      }
    });
    
    // 英文和数字直接作为 token
    wordMatches.forEach(word => {
      const lower = word.toLowerCase();
      if (lower.length > 0) {
        tokens.push(lower);
      }
    });
    
    return tokens.filter(t => t.length > 0);
  }

  /**
   * 构建词汇表（增量式）
   * @param {string} text - 文档文本
   */
  buildVocabulary(text) {
    const tokens = this.tokenize(text);
    tokens.forEach(token => {
      if (!this.vocabulary.has(token)) {
        this.vocabulary.set(token, this.vocabulary.size);
      }
    });
  }

  /**
   * 基于 TF-IDF 的文本嵌入
   * @param {string} text - 输入文本
   * @returns {object} 稀疏向量 {indices: [], values: [], dimension: number}
   */
  async embed(text) {
    const tokens = this.tokenize(text);
    const dimension = this.vocabulary.size;
    
    if (dimension === 0) {
      return { indices: [], values: [], dimension: 0 };
    }
    
    // 计算词频 (TF)
    const termFreq = new Map();
    tokens.forEach(token => {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    });
    
    const indices = [];
    const values = [];
    const totalTokens = tokens.length || 1;
    
    // 计算 TF-IDF 权重
    for (const [token, freq] of termFreq) {
      const vocabIdx = this.vocabulary.get(token);
      if (vocabIdx === undefined) continue;
      
      const tf = freq / totalTokens;
      const df = this.documentFrequency.get(token) || 0;
      const idf = this.docCount > 0 
        ? Math.log((this.docCount + 1) / (df + 1)) + 1 
        : 1;
      
      indices.push(vocabIdx);
      values.push(tf * idf);
    }
    
    // L2 归一化
    const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < values.length; i++) {
        values[i] /= norm;
      }
    }
    
    return { indices, values, dimension };
  }

  /**
   * 添加文档
   */
  async addDocument(text, metadata = {}) {
    // 先扩展词汇表
    this.buildVocabulary(text);
    
    // 更新文档频率
    const tokens = this.tokenize(text);
    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach(token => {
      this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
    });
    this.docCount++;
    
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const embedding = await this.embed(text);
    
    this.documents.push({ id, text });
    this.embeddings.push(embedding);
    this.metadata.push({ id, ...metadata, createdAt: new Date().toISOString() });
    
    if (this.autoSave) {
      await this.save();
    }
    
    return id;
  }

  /**
   * 批量添加文档
   */
  async addDocuments(documents) {
    const ids = [];
    for (const doc of documents) {
      const id = await this.addDocument(doc.text, doc.metadata || {});
      ids.push(id);
    }
    return ids;
  }

  /**
   * 计算稀疏向量的余弦相似度
   */
  cosineSimilarity(sparse1, sparse2) {
    // 使用较大的维度作为统一维度
    const maxDim = Math.max(sparse1.dimension, sparse2.dimension);
    
    // 使用哈希表加速稀疏向量点积
    const vec2Map = new Map();
    for (let i = 0; i < sparse2.indices.length; i++) {
      vec2Map.set(sparse2.indices[i], sparse2.values[i]);
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < sparse1.indices.length; i++) {
      const idx = sparse1.indices[i];
      const val1 = sparse1.values[i];
      norm1 += val1 * val1;
      const val2 = vec2Map.get(idx);
      if (val2 !== undefined) {
        dotProduct += val1 * val2;
      }
    }
    
    for (let i = 0; i < sparse2.values.length; i++) {
      norm2 += sparse2.values[i] * sparse2.values[i];
    }
    
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) return 0;
    
    return dotProduct / denominator;
  }

  /**
   * 相似度搜索
   */
  async search(query, topK = 5) {
    if (this.documents.length === 0) {
      return [];
    }
    
    // 先扩展词汇表以包含查询中的新词
    this.buildVocabulary(query);
    
    const queryEmbedding = await this.embed(query);
    const similarities = [];
    
    for (let i = 0; i < this.embeddings.length; i++) {
      const similarity = this.cosineSimilarity(queryEmbedding, this.embeddings[i]);
      similarities.push({
        id: this.documents[i].id,
        text: this.documents[i].text,
        score: similarity,
        metadata: this.metadata[i]
      });
    }
    
    similarities.sort((a, b) => b.score - a);
    
    return similarities.slice(0, topK);
  }

  /**
   * 获取文档
   */
  getDocument(id) {
    const index = this.documents.findIndex(doc => doc.id === id);
    if (index === -1) return null;
    
    return {
      ...this.documents[index],
      metadata: this.metadata[index]
    };
  }

  /**
   * 删除文档
   */
  async deleteDocument(id) {
    const index = this.documents.findIndex(doc => doc.id === id);
    if (index === -1) return false;
    
    // 更新文档频率
    const tokens = this.tokenize(this.documents[index].text);
    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach(token => {
      const count = this.documentFrequency.get(token) || 0;
      if (count > 1) {
        this.documentFrequency.set(token, count - 1);
      } else {
        this.documentFrequency.delete(token);
      }
    });
    this.docCount--;
    
    this.documents.splice(index, 1);
    this.embeddings.splice(index, 1);
    this.metadata.splice(index, 1);
    
    if (this.autoSave) {
      await this.save();
    }
    
    return true;
  }

  /**
   * 保存到文件
   */
  async save() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      
      const data = {
        documents: this.documents,
        embeddings: this.embeddings,
        metadata: this.metadata,
        vocabulary: Array.from(this.vocabulary.entries()),
        documentFrequency: Array.from(this.documentFrequency.entries()),
        docCount: this.docCount
      };
      
      const filePath = path.join(this.storagePath, 'vector_store.json');
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存向量存储失败:', error);
    }
  }

  /**
   * 从文件加载
   */
  async load() {
    try {
      const filePath = path.join(this.storagePath, 'vector_store.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      this.documents = parsed.documents || [];
      this.embeddings = parsed.embeddings || [];
      this.metadata = parsed.metadata || [];
      this.vocabulary = new Map(parsed.vocabulary || []);
      this.documentFrequency = new Map(parsed.documentFrequency || []);
      this.docCount = parsed.docCount || 0;
      
      console.log(`加载了 ${this.documents.length} 个文档，词汇表大小: ${this.vocabulary.size}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('加载向量存储失败:', error);
      }
    }
  }

  /**
   * 清空所有文档
   */
  async clear() {
    this.documents = [];
    this.embeddings = [];
    this.metadata = [];
    this.vocabulary = new Map();
    this.documentFrequency = new Map();
    this.docCount = 0;
    
    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      documentCount: this.documents.length,
      vocabularySize: this.vocabulary.size,
      docCount: this.docCount
    };
  }
}

module.exports = VectorStore;