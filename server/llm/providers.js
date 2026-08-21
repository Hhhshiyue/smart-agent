/**
 * LLM 提供商注册表
 * 列出所有支持的 AI 模型提供商，供安装向导选择
 * 每个提供商包含官网密钥创建链接（signupUrl）
 */

const providers = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    desc: '深度求索，国产高性能大模型，价格实惠，中文效果好',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    baseUrl: 'https://api.deepseek.com/v1',
    signupUrl: 'https://platform.deepseek.com/api_keys',
    apiType: 'openai',
    freeTier: false
  },
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'GPT 系列模型，全球最流行的通用大模型',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    baseUrl: 'https://api.openai.com/v1',
    signupUrl: 'https://platform.openai.com/api-keys',
    apiType: 'openai',
    freeTier: false
  },
  {
    id: 'claude',
    name: 'Claude',
    desc: 'Anthropic 出品，擅长长文本、代码和复杂推理',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    baseUrl: 'https://api.anthropic.com/v1',
    signupUrl: 'https://console.anthropic.com/settings/keys',
    apiType: 'anthropic',
    freeTier: false
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    desc: '清华系 GLM 系列模型，国产模型，有免费额度',
    defaultModel: 'glm-4-flash',
    models: ['glm-4-flash', 'glm-4', 'glm-4-plus'],
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    signupUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    apiType: 'openai',
    freeTier: true
  },
  {
    id: 'qwen',
    name: '通义千问',
    desc: '阿里云百炼平台 Qwen 系列，国产模型，新用户有免费额度',
    defaultModel: 'qwen-plus',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'],
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    signupUrl: 'https://dashscope.console.aliyun.com/apiKey',
    apiType: 'openai',
    freeTier: true
  },
  {
    id: 'moonshot',
    name: 'Kimi',
    desc: '月之暗面出品，超长上下文，中文体验优秀',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    baseUrl: 'https://api.moonshot.cn/v1',
    signupUrl: 'https://platform.moonshot.cn/console/api-keys',
    apiType: 'openai',
    freeTier: false
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    desc: 'Google 出品，免费额度充足，支持多模态',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    signupUrl: 'https://aistudio.google.com/app/apikey',
    apiType: 'openai',
    freeTier: true
  },
  {
    id: 'ollama',
    name: 'Ollama（本地免费）',
    desc: '本地运行开源模型，无需联网无需密钥，先安装 Ollama 软件',
    defaultModel: 'qwen2.5',
    models: ['qwen2.5', 'llama3.1', 'deepseek-r1'],
    baseUrl: 'http://localhost:11434/v1',
    signupUrl: 'https://ollama.com/download',
    apiType: 'openai',
    freeTier: true,
    noKey: true
  }
];

/**
 * 获取所有提供商（公开信息，不含敏感配置）
 */
function getProviders() {
  return providers.map(p => ({
    id: p.id,
    name: p.name,
    desc: p.desc,
    models: p.models,
    defaultModel: p.defaultModel,
    baseUrl: p.baseUrl,
    signupUrl: p.signupUrl,
    freeTier: p.freeTier,
    noKey: !!p.noKey
  }));
}

/**
 * 根据 ID 获取提供商
 * @param {string} id - 提供商 ID
 */
function getProvider(id) {
  return providers.find(p => p.id === id) || null;
}

/**
 * 获取默认模型
 * @param {string} providerId - 提供商 ID
 */
function getDefaultModel(providerId) {
  const p = getProvider(providerId);
  return p ? p.defaultModel : 'deepseek-chat';
}

/**
 * 获取默认 API Base URL
 * @param {string} providerId - 提供商 ID
 */
function getDefaultBaseUrl(providerId) {
  const p = getProvider(providerId);
  return p ? p.baseUrl : 'https://api.deepseek.com/v1';
}

module.exports = {
  providers,
  getProviders,
  getProvider,
  getDefaultModel,
  getDefaultBaseUrl
};
