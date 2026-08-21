/**
 * 安装配置向导 API
 * 供首次安装用户在网页上选择 AI 模型、填写 API Key
 */

const express = require('express');
const router = express.Router();
const LLM = require('../llm');
const { getProviders, getProvider } = require('../llm/providers');
const { saveLocalConfig, loadLocalConfig, isConfigured, localConfig, config } = require('../../config');
const apiRoutes = require('./routes');

/**
 * GET /api/setup/status
 * 检查是否已完成 AI 模型配置
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      configured: isConfigured(),
      // 是否由本地安装向导配置（区别于环境变量预配置）
      fromLocal: !!(localConfig.llm && localConfig.llm.apiKey),
      current: {
        provider: config.llm.provider,
        model: config.llm.model,
        baseUrl: config.llm.baseUrl,
        hasApiKey: !!(config.llm.apiKey)
      }
    }
  });
});

/**
 * GET /api/setup/providers
 * 获取所有可选的 AI 模型提供商列表
 */
router.get('/providers', (req, res) => {
  res.json({
    success: true,
    data: {
      providers: getProviders(),
      count: getProviders().length
    }
  });
});

/**
 * POST /api/setup/test
 * 测试所选模型的 API 连接
 * body: { provider, apiKey, model, baseUrl? }
 */
router.post('/test', async (req, res) => {
  const { provider, apiKey, model, baseUrl } = req.body || {};

  if (!provider) {
    return res.status(400).json({ success: false, error: '缺少模型提供商' });
  }

  const providerInfo = getProvider(provider);
  if (!providerInfo) {
    return res.status(400).json({ success: false, error: '不支持的模型提供商' });
  }

  // Ollama 本地模型无需密钥
  if (!providerInfo.noKey && !apiKey) {
    return res.status(400).json({ success: false, error: '请输入 API Key' });
  }

  const llm = new LLM({
    provider,
    apiKey: apiKey || '',
    model: model || providerInfo.defaultModel,
    baseUrl: baseUrl || providerInfo.baseUrl
  });

  const startTime = Date.now();
  const connected = await llm.testConnection();

  res.json({
    success: true,
    data: {
      connected,
      provider,
      model: llm.model,
      elapsedMs: Date.now() - startTime
    }
  });
});

/**
 * POST /api/setup/configure
 * 保存所选模型的配置，可选设置管理员登录密码
 * body: { provider, apiKey, model, baseUrl?, password? }
 */
router.post('/configure', (req, res) => {
  const { provider, apiKey, model, baseUrl, password } = req.body || {};

  if (!provider) {
    return res.status(400).json({ success: false, error: '缺少模型提供商' });
  }

  const providerInfo = getProvider(provider);
  if (!providerInfo) {
    return res.status(400).json({ success: false, error: '不支持的模型提供商' });
  }

  if (!providerInfo.noKey && !apiKey) {
    return res.status(400).json({ success: false, error: '请输入 API Key' });
  }

  try {
    saveLocalConfig({
      llm: {
        provider,
        apiKey: apiKey || '',
        model: model || providerInfo.defaultModel,
        baseUrl: baseUrl || providerInfo.baseUrl
      }
    });

    // 可选：设置管理员登录密码
    if (password) {
      const auth = req.app.locals.authMiddleware;
      if (auth && typeof auth.updatePassword === 'function') {
        if (!auth.updatePassword('admin', password)) {
          return res.status(400).json({ success: false, error: '密码设置失败（至少 4 位）' });
        }
      }
    }

    // 重置 Agent 实例，使新配置立即生效
    if (typeof apiRoutes.resetAgent === 'function') {
      apiRoutes.resetAgent();
    }

    res.json({
      success: true,
      data: {
        configured: true,
        provider,
        model: model || providerInfo.defaultModel,
        passwordSet: !!password,
        message: '配置已保存，AI 智能体已就绪'
      }
    });
  } catch (error) {
    console.error('保存配置失败:', error);
    res.status(500).json({ success: false, error: '保存配置失败: ' + error.message });
  }
});

/**
 * POST /api/setup/reset
 * 清除本地配置，重新进入配置向导
 */
router.post('/reset', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../../data/config.json');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    loadLocalConfig();
    if (typeof apiRoutes.resetAgent === 'function') {
      apiRoutes.resetAgent();
    }
    res.json({ success: true, data: { configured: false }, message: '配置已重置' });
  } catch (error) {
    res.status(500).json({ success: false, error: '重置配置失败: ' + error.message });
  }
});

module.exports = router;
