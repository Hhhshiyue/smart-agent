# Smart Agent - 智能任务助手

一个基于 Node.js 的智能任务助手 Agent 系统，能够自主完成任务规划、工具调用和结果反思，支持多种大模型，可一键打包分发到其他电脑使用。

## 功能特性

### 核心功能
- **自主任务规划** - 根据任务描述自动分解为执行步骤
- **ReAct 循环模式** - 思考-行动-观察循环，更智能的执行策略
- **工具调用系统** - 内置多种实用工具，支持动态注册和参数验证
- **记忆管理** - 会话历史记录、自动摘要和向量检索
- **多 LLM 支持** - 内置 8 家 AI 模型提供商，安装向导一键配置

### 安装与分发
- **一键安装向导** - 首次启动自动引导：选择 AI 模型 → 跳转官网创建密钥 → 粘贴密钥 → 测试连接
- **8 家模型可选** - DeepSeek、OpenAI、Claude、智谱、通义千问、Kimi、Gemini、Ollama（本地免费）
- **一键打包脚本** - `build-package.ps1` 生成可分发的 zip 安装包（自动排除密钥与依赖）
- **含依赖完整包** - 可打包 node_modules，目标电脑免联网安装
- **端口冲突自动切换** - 端口被占用时自动改用下一可用端口，不崩溃
- **自动打开浏览器** - 服务就绪后自动弹出界面（`node app.js --open`）

### 安全特性
- **JWT 认证** - 完整的 API 认证和权限控制
- **密码加密** - scrypt 加密存储，密码不落明文（`data/users.json`）
- **向导设置密码** - 安装时可自定义管理员登录密码
- **参数验证** - 工具参数类型检查和安全验证
- **路径安全** - 防止路径遍历攻击
- **输入过滤** - 防止代码注入攻击

### 高级功能
- **流式响应** - 支持 SSE 实时流式输出（打字机效果）
- **向量存储** - 支持相似度搜索和知识库检索
- **会话摘要** - 自动压缩长会话历史
- **会话导出** - 一键备份所有会话为 JSON 文件
- **错误追踪** - 完善的日志系统和错误处理

## 技术架构

```
Smart Agent
├── Agent 核心模块（任务规划、执行、反思）
├── LLM 接口层（多模型适配，OpenAI 兼容 + Anthropic 格式）
├── 工具系统（可扩展）
├── 记忆管理（会话存储 + 向量检索）
└── Web 服务（Express + 前端界面）
```

## 快速开始

### 方式一：一键安装包（推荐给非开发者）

1. 运行 `build-package.ps1` 生成安装包，或直接使用项目目录
2. 在目标电脑上双击 **`setup.bat`**：
   - 自动检测 Node.js 并安装依赖（已包含依赖的完整包则跳过）
   - 自动生成配置文件（随机 JWT 密钥）
   - 启动服务并自动打开浏览器
3. 在浏览器配置向导中完成 3 步：
   - 选择 AI 模型
   - 点击官网链接创建 API Key 并粘贴
   - 测试连接（可选设置登录密码），完成
4. 日常使用双击 **`start.bat`** 启动

默认登录账号：`admin`，默认密码：`admin123`（建议在向导中修改）。

### 方式二：源码开发

```bash
cd smart-agent
npm install
cp .env.example .env   # 编辑 .env 填入 LLM_API_KEY
npm start              # 或 npm run dev（自动重启）
```

访问应用：

- Web 界面: http://localhost:3000
- API 信息: http://localhost:3000/api/info

## 支持的 LLM 提供商

| 提供商 | 官网密钥页面 | 说明 |
|--------|-------------|------|
| DeepSeek | https://platform.deepseek.com/api_keys | 默认，国产高性能 |
| OpenAI | https://platform.openai.com/api-keys | GPT 系列 |
| Claude | https://console.anthropic.com/settings/keys | Anthropic，长文本强 |
| 智谱 AI | https://open.bigmodel.cn/usercenter/apikeys | GLM，有免费额度 |
| 通义千问 | https://dashscope.console.aliyun.com/apiKey | 阿里云百炼 |
| Kimi | https://platform.moonshot.cn/console/api-keys | 超长上下文 |
| Google Gemini | https://aistudio.google.com/app/apikey | 免费额度充足 |
| Ollama | https://ollama.com/download | 本地免费，无需密钥 |

## API 接口

### 对话接口（流式，前端主用）

```http
POST /api/agent/chat/stream
Content-Type: application/json

{ "message": "帮我分析这个数据", "sessionId": "session_xxx" }
```

### 简单对话

```http
POST /api/agent/chat
Content-Type: application/json

{ "message": "你好", "sessionId": "session_xxx" }
```

### 执行任务

```http
POST /api/agent/run
Content-Type: application/json

{
  "task": "抓取某个网页的内容",
  "config": { "llm": { "provider": "deepseek", "apiKey": "your_key" } }
}
```

### 安装配置向导（无需认证）

```http
GET  /api/setup/status              # 检查是否已配置
GET  /api/setup/providers           # 获取可选模型列表（含官网链接）
POST /api/setup/test                # 测试连接 { provider, apiKey, model }
POST /api/setup/configure           # 保存配置 { provider, apiKey, model, password? }
POST /api/setup/reset               # 重置配置，重新进入向导
```

### 会话管理

```http
GET    /api/agent/sessions              # 会话列表
GET    /api/agent/sessions/export       # 导出全部会话（备份）
POST   /api/agent/session/new           # 新建会话
GET    /api/agent/session/:sessionId    # 会话详情
DELETE /api/agent/session/:sessionId    # 删除会话
POST   /api/agent/session/:sessionId/clear  # 清空会话历史
```

### 工具与认证

```http
GET  /api/tools                          # 工具列表
POST /api/tools/:toolName/execute        # 执行工具
POST /api/agent/register-tool            # 注册自定义工具
POST /api/login                          # 登录获取 Token（admin）
```

## 内置工具

| 工具名称 | 功能说明 | 参数 |
|---------|---------|------|
| web_scraper | 网页抓取和解析 | url |
| file_reader | 读取本地文件 | filepath |
| file_writer | 写入本地文件 | filepath, content |
| http_request | 发送 HTTP 请求 | url, method, data |
| data_analyzer | 数据分析统计 | data |
| calculator | 数学计算 | expression |

## 自定义工具

通过 API 动态注册自定义工具：

```http
POST /api/agent/register-tool
Content-Type: application/json

{
  "name": "my_tool",
  "description": "自定义工具描述",
  "keywords": ["关键词"],
  "params": ["param1"],
  "executeCode": "return { success: true, result: params.param1 };"
}
```

## 项目结构

```
smart-agent/
├── server/
│   ├── agent/          # Agent 核心逻辑（规划/执行/反思）
│   ├── llm/            # LLM 接口封装 + 提供商注册表
│   ├── tools/          # 工具系统
│   ├── memory/         # 记忆管理（会话/向量/摘要）
│   ├── api/            # API 路由（含配置向导 setup.js）
│   └── middleware/     # JWT 认证（scrypt 密码加密）
├── client/             # 前端界面（聊天页 + 配置向导）
├── config/             # 配置管理（本地配置优先于环境变量）
├── data/               # 运行时数据（会话/用户/本地配置）
├── app.js              # 应用入口（端口冲突自动切换）
├── setup.bat           # 一键安装脚本
├── start.bat           # 日常启动脚本
├── build-package.ps1   # 安装包生成脚本
└── package.json        # 项目配置
```

## 打包分发

生成可分发的安装包：

```powershell
powershell -ExecutionPolicy Bypass -File build-package.ps1
```

产物：`dist/smart-agent-v1.0.0.zip`（不含依赖，目标电脑需联网安装）。

如需含依赖的完整包（目标电脑免联网），手动复制 `node_modules` 后压缩，或参考项目内脚本自行调整。

## 开发计划

- [x] 向量数据库支持（RAG）
- [x] 流式响应
- [ ] 任务队列和调度
- [ ] 多 Agent 协作
- [ ] Webhook 通知
- [ ] 数据导入（恢复备份）

## 注意事项

1. 请妥善保管你的 API Key，`.env` 与 `data/config.json` 已加入 `.gitignore`，不会提交到仓库
2. 工具执行可能涉及网络请求或文件操作，注意安全性
3. 建议在生产环境中使用 HTTPS 和适当的认证机制
4. 首次使用建议在配置向导中设置自己的登录密码，避免使用默认密码

## License

MIT
