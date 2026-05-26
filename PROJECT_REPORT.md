# MANUSCRIPT_ Project Report

## 1. Project Positioning

MANUSCRIPT_ is a minimalist AI messaging space for people who emotionally entrust part of their inner life to AI. The product deliberately avoids noisy technology aesthetics: no avatars, decorative illustrations, waveforms, light effects, or metallic UI language. Its core material is text, silence, spacing, borders, and paced replies.

The backend model identity is intentionally neutral and transparent, but the product surface is literary and intimate. Keep this distinction when modifying prompts:

- UI copy may be poetic, quiet, and emotionally resonant.
- Server system prompt should not force the model into a fake roleplay identity unless the user-defined persona for a specific letter asks for it.

## 2. Current Architecture

- `index.html`: single-file frontend application with all UI, state, rendering, streaming parser, pacing output, memory viewer, model management, and local persistence.
- `server.js`: zero-dependency Node HTTP server. It serves static files and exposes API endpoints for chat, model listing, memory viewing, memory optimization, and conversation deletion.
- `data/db.json`: local JSON database, ignored by Git. Stores conversations, messages, preferences, memories, and presets.
- `prisma/schema.prisma`: future database schema, SQLite-compatible, ready for later migration.
- `.env.example`: deployment and model configuration template.

Runtime has no package dependency. Start with:

```bash
PORT=4173 node server.js
```

## 3. Implemented Features

- 14-screen style single-page experience, with native Obsidian Void, iMessage-like, and WeChat-like themes.
- Default English UI, with Chinese/English toggle.
- Letter list with add/delete letter flow.
- AI settings page for name, persona, model, and isolated memory archive.
- Model management:
  - Five default server-managed models: DeepSeek-v4-Pro, MIMO v2.5 Pro, GPT 5.4, Claude Opus 4.6, Gemini.
  - Default models hide endpoint and key.
  - Custom models can be added, configured, deleted, and optionally fetch model IDs.
  - GPT 5.4 and Claude Opus 4.6 default to `https://api.apikey.fun`.
  - MIMO default endpoint is `https://token-plan-cn.xiaomimimo.com/v1`.
- Server-side model proxy so default API keys remain in `.env`.
- SSE streaming with frontend pacing:
  - punctuation slicing into independent bubbles,
  - randomized typing delay,
  - Markdown/LaTeX/code-block slice protection,
  - DeepSeek `reasoning_content` routed into a reasoning block.
- Deep thinking:
  - visible only in chat detail,
  - default expanded while reasoning streams,
  - collapses when final content begins or completes.
- Stream interruption:
  - user sends a new message while AI is streaming,
  - frontend aborts current fetch,
  - backend aborts upstream model request,
  - partial assistant text is preserved as interrupted.
- Scroll behavior:
  - user can scroll during streaming,
  - new content does not force-scroll unless pinned to bottom,
  - "New letter" notice appears when content arrives off-bottom.
- EMA preference analytics:
  - every 10 messages,
  - tracks brevity, tone, rhythm,
  - cold-start alpha 0.5 for first 3 calculations, then 0.3.
- Dynamic system prompt:
  - base preset,
  - per-letter persona,
  - EMA preference tags,
  - latest user instructions,
  - isolated long-term memory.

## 4. Memory System

Memory is isolated per letter/conversation. Deleting a letter deletes only that letter's server-side messages and memories, not the whole memory file.

Current memory layers shown in the AI settings page:

- Soul Identity Layer: letter name, selected model, persona.
- Memory Notes: facts, instructions, project notes, assistant-generated topic notes.
- User Profile: profile and preference memories.

The memory archive is read-only from the UI. The user can press "Optimize Memory", which asks the backend to merge duplicates, prune stale/low-value items, and return visible optimization results.

Current backend behavior:

- User instructions are remembered immediately during request preparation.
- Important phrases such as "remember", "以后", "默认", "叫我", "你叫", "不要", "下次" are captured.
- Latest user instructions are injected into the current prompt immediately, so they do not need to wait for long-term memory summarization.
- `instruction`, `profile`, and `preference` memories receive higher retrieval priority.
- Memory capacity is capped at 36 items per letter.

Known limitation:

- Memory extraction is heuristic, not LLM-summarized. It is much better than the original version, but it can still miss subtle emotional facts or over-save literal sentences.
- Future work should add a dedicated summarization/compaction model call, preferably cheap and asynchronous.

## 5. Context Handling

The frontend used to send every AI bubble fragment as a separate assistant message, which quickly crowded out recent user context. This has been fixed.

Current context building:

- Reasoning blocks are filtered out.
- Consecutive AI bubble fragments are merged.
- Consecutive same-role messages are merged.
- Recent user messages are force-kept.
- Backend performs a second normalization pass as a safety net.

This is important for future maintainers: do not send raw UI bubbles directly to the model as independent messages. The UI rendering format is not the same as model context format.

## 6. API Endpoints

- `POST /api/chat`
  - Starts an SSE model stream.
  - Body includes model, conversationId, persona, messages, optional customModel, deepThinking.

- `POST /api/models`
  - Lists available model IDs from an OpenAI-compatible or Gemini endpoint.
  - Uses the provided endpoint and key.

- `GET /api/memories?conversationId=...&userId=...`
  - Returns read-only grouped memory plus capacity.

- `POST /api/memories/optimize`
  - Optimizes one conversation's memory.
  - Returns before/after capacity, merged count, removed count, kept count.

- `DELETE /api/conversations/:id`
  - Deletes one conversation, its messages, and its isolated memories.

## 7. Security Notes

Already implemented:

- `.env`, `.env.*`, `data/`, `prisma/`, dotfiles, `server.js`, and `node_modules` are blocked from static serving.
- Static file serving uses `path.resolve` and root-boundary checks.
- All JSON DB writes are serialized through a queue and written atomically via temp file rename.
- SSE upstream errors are logged instead of silently swallowed.
- API keys in memory text are redacted before storage.
- Optional `MANUSCRIPT_API_TOKEN` protects API endpoints when deploying publicly.
- Custom model endpoints reject localhost, private networks, link-local addresses, and unsafe external HTTP.
- Optional `ALLOWED_CUSTOM_ENDPOINT_HOSTS` can restrict custom endpoints to known model providers.

Deployment warning:

- If `MANUSCRIPT_API_TOKEN` is empty on a public server, strangers can call `/api/chat` and spend your model credits.
- Frontend custom model keys are stored in browser localStorage. This is acceptable for user-supplied custom models, but not for server-owned default model keys.
- `data/db.json` is not a multi-user secure database. For public multi-user service, migrate to SQLite/Postgres and add real authentication.

## 8. Deployment Checklist

1. Copy `.env.example` to `.env`.
2. Fill real model keys in `.env`.
3. Set `MANUSCRIPT_API_TOKEN` for public deployment.
4. Consider setting `ALLOWED_CUSTOM_ENDPOINT_HOSTS`.
5. Run behind HTTPS with Nginx/Caddy/platform proxy.
6. Add rate limiting at proxy level.
7. Back up `data/db.json` if staying on JSON storage.
8. Prefer a process manager such as systemd, pm2, Docker, or platform-managed Node service.
9. Verify:

```bash
node --check server.js
PORT=4173 node server.js
curl http://127.0.0.1:4173/
```

## 9. Handoff Notes For Future AI Maintainers

Read these files first:

- `server.js`: backend API, model proxy, memory, DB queue.
- `index.html`: frontend state, UI, streaming, memory viewer, model management.
- `README.md`: run/deploy basics.
- `PROJECT_REPORT.md`: this handoff overview.
- `prisma/schema.prisma`: target relational schema.

Be careful with these areas:

- Do not expose real server API keys in `index.html`.
- Do not remove path traversal protections in `serveStatic`.
- Do not bypass `updateDb`; direct writes can corrupt `data/db.json`.
- Do not send raw UI bubbles as model context.
- Preserve memory isolation by `conversationId`.
- Preserve abort handling for streaming, or upstream model requests may keep spending tokens after the user interrupts.
- Preserve Markdown/LaTeX/code-block slicing guards, or code/math responses will break into unusable bubbles.

Recommended next directions:

- Migrate JSON DB to SQLite/Postgres with Prisma.
- Add real user accounts and per-user authorization.
- Move custom model keys to server-side encrypted storage if this becomes a hosted product.
- Add LLM-based memory summarization and contradiction handling.
- Add import/export for letters and memory archives.
- Add automated tests for:
  - context compaction,
  - memory extraction,
  - stream interruption,
  - path traversal rejection,
  - API token enforcement,
  - custom endpoint SSRF blocking.
- Split `index.html` into modules once the prototype stabilizes.
