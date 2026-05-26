# MANUSCRIPT_

MANUSCRIPT_ 是一个极简 AI 对话网站，已改造为 Next.js 前后端应用。浏览器只负责界面和同源请求，所有模型 API Key 都由服务端读取，不会暴露到前端代码、`public/` 目录或浏览器 localStorage。

## 功能

- Next.js App Router 页面与 API Routes
- 服务端 AI 代理：`/api/chat` 统一转发模型请求
- SSE 流式输出
- 支持 OpenAI-compatible、Anthropic、Gemini 风格接口
- DeepSeek reasoning 内容独立显示
- 服务端记忆与偏好存储
- Vercel / serverless 部署适配
- 有 `DATABASE_URL` 时使用 Postgres；本地没有数据库时 fallback 到 `data/db.json`

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

访问：

```text
http://localhost:3000
```

生产构建：

```bash
npm run build
npm run start
```

## Vercel 部署

在 Vercel 导入 GitHub 仓库后，构建设置保持默认即可：

```text
Framework Preset: Next.js
Build Command: npm run build
Output Directory: Next.js default
Install Command: default
```

建议创建 Prisma Postgres / Vercel Postgres / Neon / Supabase Postgres，并确保项目环境变量里有：

```env
DATABASE_URL=postgres://...
```

首次请求时服务端会自动创建 `manuscript_state` 表。

## 必填环境变量

至少配置一个可用模型。以 DeepSeek 为例：

```env
DATABASE_URL=你的 Postgres 连接串
MANUSCRIPT_API_TOKEN=一串很长的随机字符串

DEEPSEEK_V4_PRO_ENDPOINT=https://api.deepseek.com
DEEPSEEK_V4_PRO_API_KEY=你的 DeepSeek API Key
DEEPSEEK_V4_PRO_MODEL=deepseek-reasoner
DEEPSEEK_V4_PRO_REASONING_MODEL=deepseek-reasoner

ALLOWED_CUSTOM_ENDPOINT_HOSTS=api.deepseek.com,token-plan-cn.xiaomimimo.com,generativelanguage.googleapis.com,api.openai.com
```

其他模型按需配置：

```env
MIMO_V2_5_PRO_ENDPOINT=https://token-plan-cn.xiaomimimo.com/v1
MIMO_V2_5_PRO_API_KEYS=
MIMO_V2_5_PRO_MODEL=mimo-v2.5-pro

GPT_5_4_ENDPOINT=https://api.apikey.fun
GPT_5_4_API_KEY=
GPT_5_4_MODEL=gpt-5.4

CLAUDE_OPUS_4_6_ENDPOINT=https://api.apikey.fun
CLAUDE_OPUS_4_6_API_KEY=
CLAUDE_OPUS_4_6_MODEL=claude-opus-4-6

GEMINI_ENDPOINT=https://generativelanguage.googleapis.com
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-pro
```

不要给模型 Key 加 `NEXT_PUBLIC_` 前缀。带 `NEXT_PUBLIC_` 的变量会进入前端。

## 访问保护

公网部署建议设置：

```env
MANUSCRIPT_API_TOKEN=一串很长的随机字符串
```

设置后，浏览器需要在 localStorage 里保存同一个 token 才能调用后端 API。打开网站后，在浏览器 Console 执行：

```js
localStorage.setItem('manuscript.apiToken', '这里填 MANUSCRIPT_API_TOKEN')
location.reload()
```

如果只自己本地使用，可以不设置 `MANUSCRIPT_API_TOKEN`。公网使用建议一定设置。

## 自定义模型

前端自定义模型不会保存用户 API Key。它只保存环境变量前缀，例如：

```text
CUSTOM_OPENAI
```

服务端会读取：

```env
CUSTOM_OPENAI_ENDPOINT=https://api.openai.com
CUSTOM_OPENAI_API_KEY=sk-...
CUSTOM_OPENAI_MODEL=gpt-4.1
```

也支持轮换 Key：

```env
CUSTOM_OPENAI_API_KEYS=key1,key2,key3
```

## 常见问题

### Vercel 报 No Next.js version detected

通常是 Vercel 部署的分支不是包含 `package.json` 的分支，或 Root Directory 设置错了。确认项目部署的是包含 `package.json`、`app/`、`src/` 的 `main` 分支。

### 页面能打开，但发消息一直转

先看 Vercel Logs 的 `/api/chat`：

- `401 Unauthorized`：浏览器没有设置 `manuscript.apiToken`，或 token 不一致。
- `missing server API key`：对应模型的环境变量没填。
- `Model request failed (429)`：模型供应商额度不足或限流。
- Postgres / `DATABASE_URL` 报错：数据库连接串或数据库服务有问题。

### Gemini 返回 429 quota exceeded

这不是代码问题，是 Gemini 账号额度或 billing 问题。可以：

- 在界面里切换到 `DeepSeek-v4-Pro`
- 或去 Google AI Studio / Google Cloud 检查 Gemini API quota 和 billing

如果之前浏览器保存了 Gemini 作为当前模型，可以在 Console 里切回 DeepSeek：

```js
const saved = JSON.parse(localStorage.getItem('manuscript.v2.state') || '{}')
if (Array.isArray(saved.nodes)) {
  saved.nodes.forEach(node => {
    const name = Array.isArray(node.name) ? node.name[1] : node.name
    node.active = name === 'DeepSeek-v4-Pro'
  })
}
if (saved.convos) {
  Object.values(saved.convos).forEach(convo => {
    convo.model = 'DeepSeek-v4-Pro'
  })
}
localStorage.setItem('manuscript.v2.state', JSON.stringify(saved))
location.reload()
```

## 安全提醒

- 不要提交 `.env`、`data/db.json` 或任何真实 API Key。
- 所有真实模型 Key 只放在服务器 `.env` 或 Vercel Environment Variables。
- Vercel / serverless 部署请设置 `DATABASE_URL`，否则后端记忆数据不能可靠持久化。
- 当前数据库是全站共享状态；如果要开放给很多人使用，建议继续增加登录、用户隔离、配额和速率限制。
