/**
 * 配置管理模块
 * 管理应用的全局配置
 */

const path = require('path');
const fs = require('fs');

// 本地用户配置文件（由安装向导写入，优先于环境变量）
const LOCAL_CONFIG_PATH = path.join(__dirname, '../data/config.json');
let localConfig = {};

const config = {
  // 应用配置
  app: {
    name: 'Smart Agent',
    version: '1.0.0',
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },

  // LLM 配置
  llm: {
    provider: process.env.LLM_PROVIDER || 'deepseek',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'deepseek-chat',
    baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 2000,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
    timeout: parseInt(process.env.LLM_TIMEOUT) || 30000
  },

  // Agent 配置
  agent: {
    maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS) || 10,
    verbose: process.env.AGENT_VERBOSE === 'true'
  },

  // 记忆配置
  memory: {
    maxHistoryLength: parseInt(process.env.MEMORY_MAX_HISTORY) || 50,
    storagePath: path.join(__dirname, '../data/memory'),
    autoSave: process.env.MEMORY_AUTO_SAVE !== 'false'
  },

  // 工具配置
  tools: {
    timeout: parseInt(process.env.TOOL_TIMEOUT) || 10000,
    maxRetries: parseInt(process.env.TOOL_MAX_RETRIES) || 3
  },

  // 服务器配置
  server: {
    cors: {
      enabled: true,
      origin: process.env.CORS_ORIGIN || '*'
    },
    rateLimit: {
      enabled: true,
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    }
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || path.join(__dirname, '../data/app.log')
  }
};

/**
 * 获取配置
 * @param {string} key - 配置键（支持点分隔，如 'llm.apiKey'）
 * @returns {any} 配置值
 */
function get(key) {
  const keys = key.split('.');
  let value = config;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * 设置配置
 * @param {string} key - 配置键
 * @param {any} value - 配置值
 */
function set(key, value) {
  const keys = key.split('.');
  let obj = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in obj)) {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]];
  }
  
  obj[keys[keys.length - 1]] = value;
}

/**
 * 验证必要配置
 * @returns {object} 验证结果
 */
function validate() {
  const errors = [];
  const warnings = [];
  
  if (!config.llm.apiKey) {
    warnings.push('LLM API Key 未设置，Agent 将使用纯工具模式运行（设置后可启用 AI 模式）');
  }
  
  if (config.app.port < 1 || config.app.port > 65535) {
    errors.push('无效的端口号');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 打印配置信息（隐藏敏感信息）
 * @returns {object} 配置信息
 */
function info() {
  return {
    app: config.app,
    llm: {
      ...config.llm,
      apiKey: config.llm.apiKey ? '***已设置***' : '未设置'
    },
    agent: config.agent,
    memory: {
      ...config.memory,
      storagePath: config.memory.storagePath
    }
  };
}

/**
 * 加载本地用户配置（data/config.json）
 * @returns {object} 本地配置
 */
function loadLocalConfig() {
  try {
    if (fs.existsSync(LOCAL_CONFIG_PATH)) {
      const raw = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8');
      localConfig = JSON.parse(raw) || {};
    }
  } catch (error) {
    console.error('读取本地配置失败:', error.message);
    localConfig = {};
  }
  return localConfig;
}

/**
 * 将本地配置应用到全局配置（本地配置优先于环境变量）
 */
function applyLocalConfig() {
  const llm = localConfig.llm;
  if (llm) {
    if (llm.provider) config.llm.provider = llm.provider;
    if (llm.apiKey) config.llm.apiKey = llm.apiKey;
    if (llm.model) config.llm.model = llm.model;
    if (llm.baseUrl) config.llm.baseUrl = llm.baseUrl;
  }
}

/**
 * 保存本地用户配置
 * @param {object} settings - 配置项，如 { llm: { provider, apiKey, model } }
 * @returns {object} 保存后的本地配置
 */
function saveLocalConfig(settings = {}) {
  const next = { ...localConfig, ...settings };
  if (settings.llm) {
    next.llm = { ...localConfig.llm, ...settings.llm };
  }
  next.configured = true;
  next.configuredAt = next.configuredAt || new Date().toISOString();
  localConfig = next;

  const dir = path.dirname(LOCAL_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(localConfig, null, 2), 'utf8');
  applyLocalConfig();
  return localConfig;
}

/**
 * 重新加载配置（运行时修改 .env 或本地配置后调用）
 */
function reload() {
  loadLocalConfig();
  applyLocalConfig();
  return config;
}

/**
 * 是否已完成 AI 模型配置
 * @returns {boolean} 是否已配置
 */
function isConfigured() {
  const apiKey = (localConfig.llm && localConfig.llm.apiKey) || process.env.LLM_API_KEY;
  return !!apiKey;
}

// 启动时加载本地配置
loadLocalConfig();
applyLocalConfig();

module.exports = {
  config,
  get,
  set,
  validate,
  info,
  loadLocalConfig,
  saveLocalConfig,
  reload,
  isConfigured,
  localConfig
};