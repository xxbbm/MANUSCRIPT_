# MANUSCRIPT_

AI 极简聊天网站，已改造为 Next.js 前后端应用。页面由 Next.js App Router 提供，模型调用、记忆数据和所有 API Key 都留在服务端。

## 已实现

- Next.js 应用入口：`app/page.jsx` 挂载现有 MANUSCRIPT 客户端体验。
- 服务端 API：`app/api/chat`、`app/api/models`、`app/api/memories`、`app/api/memories/optimize`、`app/api/conversations/[id]`。
- 服务端 AI 代理：浏览器只请求同源 `/api/*`，真实模型 Key 从服务器 `.env` 或部署平台 Secrets 读取。
- SSE 流式输出：后端按 OpenAI-compatible、Anthropic、Gemini 供应商转发流。
- 密钥安全边界：前端不会保存或发送模型 API Key；自定义节点只保存环境变量前缀。
- 数据层：有 `DATABASE_URL` 时写入 Postgres；没有时本地写入 `data/db.json`。
- Vercel 适配：生产环境使用 Postgres `jsonb` 持久化，避免 serverless 文件系统丢数据。

## 密钥

真实 API Key 不要写进前端代码、浏览器 localStorage、`public/` 目录或 Git。把 Key 放在服务器 `.env` 或部署平台 Secrets 中，由 Next.js Route Handlers 在服务端读取。

默认模型使用 `.env.example` 中的固定变量名，例如 `DEEPSEEK_V4_PRO_API_KEY`。

自定义模型在前端填写的是环境变量前缀，例如 `CUSTOM_OPENAI`。服务端会读取：

```bash
CUSTOM_OPENAI_ENDPOINT=https://api.openai.com
CUSTOM_OPENAI_API_KEY=sk-...
CUSTOM_OPENAI_MODEL=gpt-4.1
```

也可以使用可轮换密钥：

```bash
CUSTOM_OPENAI_API_KEYS=key1,key2,key3
```

## 运行

先复制环境变量模板：

```bash
cp .env.example .env
```

把真实 API Key 填进 `.env` 后安装依赖并启动：

```bash
npm install
npm run dev
```

访问 `http://localhost:3000/`。

生产构建：

```bash
npm run build
npm run start
```

## Vercel 部署

在 Vercel Project 的 Environment Variables 里配置：

```bash
DATABASE_URL=你的 Postgres 连接串
MANUSCRIPT_API_TOKEN=一串很长的随机值
DEEPSEEK_V4_PRO_API_KEY=...
MIMO_V2_5_PRO_API_KEYS=...
GPT_5_4_API_KEY=...
CLAUDE_OPUS_4_6_API_KEY=...
GEMINI_API_KEY=...
ALLOWED_CUSTOM_ENDPOINT_HOSTS=api.openai.com,api.deepseek.com,generativelanguage.googleapis.com
```

可以使用 Vercel Postgres、Neon 或 Supabase Postgres。首次请求时服务端会自动创建 `manuscript_state` 表。

## 服务器部署安全清单

- 不要提交 `.env`、`data/db.json` 或任何真实 API Key。
- 公网部署时建议设置 `MANUSCRIPT_API_TOKEN`，否则任何能访问服务的人都可以调用 `/api/chat` 消耗服务器模型额度。
- 设置 `MANUSCRIPT_API_TOKEN` 后，浏览器端需要在本地保存同一个 token，并随请求发送 `Authorization: Bearer <token>`。当前前端已预留 `localStorage` key：`manuscript.apiToken`。
- 自定义模型端点会经过 SSRF 基础防护：禁止 localhost、内网地址、link-local 地址和非安全 HTTP 外部地址。
- 更严格的生产环境可以设置 `ALLOWED_CUSTOM_ENDPOINT_HOSTS`，只允许指定模型服务域名。
- Vercel / serverless 部署务必设置 `DATABASE_URL`，否则后端记忆数据不会可靠持久化。
- 当前数据库是全站共享状态；多人公网开放前建议继续加登录、用户隔离、配额和速率限制。
