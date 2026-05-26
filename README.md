# MANUSCRIPT_

MANUSCRIPT_ 是一个为安静对话而设计的 AI 书信空间。

它不像传统聊天工具那样追求效率、按钮和信息密度，而是把一次对话处理成一封慢慢抵达的信。界面收起大多数噪音，只留下文字、留白、时间和一个可以被反复命名的收信人。

## 产品理念

MANUSCRIPT_ 的出发点很简单：AI 对话不一定总要像工作台，也可以像一张纸。

在这里，模型不是被包装成一个无所不能的助手，而是一个被放进文字关系里的回应者。用户可以为每个收信人设定语气、边界和称呼，也可以在不同主题之间切换，让同一段对话呈现出不同的情绪距离。

它关心的不是“更快完成任务”，而是：

- 让对话有可停留的质感
- 让 AI 的回应不打断人的情绪节奏
- 让界面退到文字之后
- 让记忆成为轻微的连续性，而不是过度侵入的画像
- 让模型能力留在后端，避免 API Key 暴露到浏览器

## 体验特征

- **书信式对话**：每个聊天对象都像一位收信人，而不是普通会话窗口。
- **极简视觉语言**：低干扰排版、留白、慢节奏动画和文学化字体。
- **多种氛围主题**：原生文艺主题、iMessage 仿真、微信仿真。
- **中英文界面**：可在中文与英文之间切换。
- **可配置收信人**：为不同 AI 收信人设置名字、模型和 persona。
- **流式回信**：通过 SSE 展示逐步生成的回应。
- **Reasoning 独立显示**：DeepSeek reasoning 内容不会混入普通气泡。
- **记忆与偏好**：服务端保存对话记忆、用户偏好和收信人状态。
- **模型节点管理**：支持 DeepSeek、MIMO、GPT、Claude、Gemini 以及服务端自定义节点。

## 安全设计

MANUSCRIPT_ 的模型调用发生在后端。浏览器只请求同源 API，不直接接触真实模型 Key。

核心原则：

- 真实 API Key 只放在服务器 `.env` 或 Vercel Environment Variables
- 前端不会保存模型 API Key
- 自定义模型只保存环境变量前缀，不保存用户密钥
- 服务端可通过 `MANUSCRIPT_API_TOKEN` 限制公网访问
- 自定义端点带有基础 SSRF 防护和 allowlist 配置

## 技术实现

- Next.js App Router
- Server Route Handlers
- SSE streaming
- Postgres / JSON fallback 数据层
- Prisma Postgres / Vercel / Neon / Supabase 兼容
- OpenAI-compatible、Anthropic、Gemini provider adapter

有 `DATABASE_URL` 时，服务端使用 Postgres 持久化数据；本地开发未配置数据库时，会 fallback 到 `data/db.json`。

## 部署

项目可以部署到 Vercel。生产环境建议配置：

```env
DATABASE_URL=...
MANUSCRIPT_API_TOKEN=...
DEEPSEEK_V4_PRO_ENDPOINT=https://api.deepseek.com
DEEPSEEK_V4_PRO_API_KEY=...
DEEPSEEK_V4_PRO_MODEL=deepseek-reasoner
DEEPSEEK_V4_PRO_REASONING_MODEL=deepseek-reasoner
ALLOWED_CUSTOM_ENDPOINT_HOSTS=api.deepseek.com,token-plan-cn.xiaomimimo.com,generativelanguage.googleapis.com,api.openai.com
```

不要给模型 Key 添加 `NEXT_PUBLIC_` 前缀。

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

## 状态

MANUSCRIPT_ 目前更适合个人使用、小范围分享和原型部署。若要开放给大量用户，后续需要继续加入正式账号系统、用户隔离、配额、速率限制和更完整的运营后台。
