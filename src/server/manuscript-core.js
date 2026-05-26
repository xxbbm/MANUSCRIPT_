const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const postgres = require('postgres');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const POSTGRES_STATE_KEY = 'default';
const MAX_JSON_BYTES = 1_000_000;
const MAX_MEMORY_CONTENT_CHARS = 520;
const MAX_MEMORY_PROMPT_CHARS = 1600;
const MAX_MEMORIES_PER_CONVERSATION = 36;
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/i,
];

let dbCache = null;
let dbQueue = Promise.resolve();
let keyIndex = 0;
let postgresClient = null;
let postgresReady = false;

function jsonResponse(payload, status = 200) {
  return Response.json(payload, { status });
}

async function readRequestJson(request) {
  const raw = await request.text();
  if (raw.length > MAX_JSON_BYTES) throw new Error('Request body too large');
  return raw ? JSON.parse(raw) : {};
}

function currentModelConfig() {
  return buildModelConfig();
}

function currentAllowedCustomEndpointHosts() {
  return splitList(process.env.ALLOWED_CUSTOM_ENDPOINT_HOSTS);
}

function authorizeRequest(request) {
  const apiToken = String(process.env.MANUSCRIPT_API_TOKEN || '').trim();
  if (!apiToken) return null;
  const header = String(request.headers.get('authorization') || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : String(request.headers.get('x-manuscript-token') || '').trim();
  if (timingSafeEqual(token, apiToken)) return null;
  return jsonResponse({ error: 'Unauthorized' }, 401);
}

function sendSseWeb(writer, encoder, event, data) {
  return writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

async function handleChatRequest(request) {
  const unauthorized = authorizeRequest(request);
  if (unauthorized) return unauthorized;

  let body;
  try {
    body = await readRequestJson(request);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Invalid JSON body' }, 400);
  }

  const modelName = String(body.model || 'DeepSeek-v4-Pro');
  const config = resolveIncomingModelConfig(modelName, body.customModel);
  if (!config) return jsonResponse({ error: `Unknown model: ${modelName}` }, 400);

  const apiKey = config.apiKey || nextKey(config.apiKeys);
  if (!apiKey) return jsonResponse({ error: `${modelName} is missing its server API key. Add it to .env and restart the server.` }, 400);
  if (!config.endpoint) return jsonResponse({ error: `${modelName} is missing its server endpoint. Add it to .env and restart the server.` }, 400);

  const userId = String(body.userId || 'local-user');
  const conversationId = String(body.conversationId || 'default');
  const lang = body.lang === 'zh' ? 'zh' : 'en';
  const persona = String(body.persona || '').trim().slice(0, 4000);
  const conversationName = String(body.conversationName || '').trim().slice(0, 240);
  const memoryDepth = clamp(Number(body.memory ?? 62), 0, 100);
  const incoming = normalizeMessages(body.messages || []);
  const latestUser = lastUserMessage(incoming);
  const sentAt = Number(body.sentAt || Date.now());
  const requestConfig = resolveRequestConfig(config, Boolean(body.deepThinking));

  const promptSnapshot = await updateDb(db => {
    const conversation = upsertConversation(db, conversationId);
    conversation.model = modelName;
    conversation.persona = persona;
    if (conversationName) conversation.name = conversationName;
    if (latestUser && !hasSameTailUserMessage(conversation, latestUser.content)) {
      conversation.messages.push({
        id: uuid(), conversationId, role: 'user', content: latestUser.content, reasoningContent: null,
        isInterrupted: false, status: 'complete', createdAt: new Date().toISOString(), sentAt,
      });
      rememberUserMessage(db, userId, conversationId, latestUser.content);
    }
    maybeUpdatePreference(db, userId, conversation);
    return {
      systemPrompt: buildSystemPrompt(db, userId, conversationId, lang, persona, memoryDepth, latestUser?.content || ''),
      providerMessages: incoming.length ? incoming : conversation.messages.map(message => ({
        role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content,
      })),
    };
  });

  const assistantMessage = {
    id: uuid(), conversationId, role: 'assistant', content: '', reasoningContent: '',
    isInterrupted: false, status: 'streaming', createdAt: new Date().toISOString(),
  };
  await updateDb(db => { upsertConversation(db, conversationId).messages.push(assistantMessage); });

  const encoder = new TextEncoder();
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });

  const stream = new ReadableStream({
    async start(streamController) {
      const writer = streamController;
      let upstreamResponse = null;
      try {
        await sendSseWeb(writer, encoder, 'meta', { conversationId, model: modelName, messageId: assistantMessage.id });
        await streamProvider(requestConfig, apiKey, promptSnapshot.systemPrompt, promptSnapshot.providerMessages, controller.signal, {
          setResponse(response) { upstreamResponse = response; },
          reasoning(delta) { assistantMessage.reasoningContent += delta; return sendSseWeb(writer, encoder, 'reasoning', { text: delta }); },
          content(delta) { assistantMessage.content += delta; return sendSseWeb(writer, encoder, 'content', { text: delta }); },
        });
        assistantMessage.status = 'complete';
        await persistAssistantMessage(conversationId, assistantMessage);
        await maybeCreateMemory(userId, conversationId, latestUser?.content || '', assistantMessage.content);
        await sendSseWeb(writer, encoder, 'done', { messageId: assistantMessage.id });
      } catch (err) {
        if (controller.signal.aborted || request.signal.aborted) {
          assistantMessage.status = 'interrupted';
          assistantMessage.isInterrupted = true;
          await persistAssistantMessage(conversationId, assistantMessage);
          if (upstreamResponse?.body?.cancel) upstreamResponse.body.cancel().catch(() => {});
        } else {
          console.error('[chat] stream failed:', err);
          assistantMessage.status = 'error';
          await persistAssistantMessage(conversationId, assistantMessage);
          await sendSseWeb(writer, encoder, 'error', { error: err.message || 'Model request failed' });
        }
      } finally {
        request.signal.removeEventListener('abort', abort);
        streamController.close();
      }
    },
    cancel() { controller.abort(); },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function handleListModelsRequest(request) {
  const unauthorized = authorizeRequest(request);
  if (unauthorized) return unauthorized;
  let body;
  try { body = await readRequestJson(request); } catch (err) { return jsonResponse({ error: err.message || 'Invalid JSON body' }, 400); }
  const endpoint = String(body.endpoint || '').trim();
  const envPrefix = normalizeEnvPrefix(body.envPrefix);
  const apiKey = envPrefix ? apiKeyFromEnvPrefix(envPrefix) : '';
  const provider = String(body.provider || 'openai');
  if (!endpoint || !envPrefix) return jsonResponse({ error: 'Endpoint and server env prefix are required.' }, 400);
  if (!apiKey) return jsonResponse({ error: `${envPrefix}_API_KEY or ${envPrefix}_API_KEYS is missing on the server.` }, 400);
  if (!isAllowedEndpoint(endpoint)) return jsonResponse({ error: 'Endpoint is not allowed.' }, 400);
  try {
    if (provider === 'gemini' || endpoint.includes('generativelanguage.googleapis.com')) {
      const response = await fetch(joinUrl(endpoint, `/v1beta/models?key=${encodeURIComponent(apiKey)}`));
      const data = await parseJsonResponse(response);
      const models = (data.models || []).map(model => String(model.name || '').replace(/^models\//, '')).filter(Boolean);
      return jsonResponse({ models });
    }
    const response = await fetch(apiUrl(endpoint, '/models'), { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = await parseJsonResponse(response);
    const models = (data.data || data.models || []).map(model => typeof model === 'string' ? model : model.id || model.name).filter(Boolean);
    return jsonResponse({ models });
  } catch (err) {
    console.error('[models] list failed:', err);
    return jsonResponse({ error: err.message || 'Failed to fetch models.' }, 502);
  }
}

async function handleGetMemoriesRequest(request) {
  const unauthorized = authorizeRequest(request);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const userId = String(url.searchParams.get('userId') || 'local-user');
  const conversationId = String(url.searchParams.get('conversationId') || '');
  if (!conversationId) return jsonResponse({ error: 'conversationId is required.' }, 400);
  const snapshot = await readDbSnapshot();
  const conversation = snapshot.conversations.find(item => item.id === conversationId);
  const memories = snapshot.memories
    .filter(memory => memory.userId === userId && memory.conversationId === conversationId)
    .sort((a, b) => memorySortValue(b) - memorySortValue(a));
  return jsonResponse({
    conversationId,
    capacity: memoryCapacity(memories),
    soulIdentity: buildSoulIdentitySnapshot(conversation),
    memoryNotes: memories.filter(memory => !['profile', 'preference'].includes(memory.type)).map(publicMemory),
    userProfile: memories.filter(memory => ['profile', 'preference'].includes(memory.type)).map(publicMemory),
  });
}

async function handleOptimizeMemoriesRequest(request) {
  const unauthorized = authorizeRequest(request);
  if (unauthorized) return unauthorized;
  let body;
  try { body = await readRequestJson(request); } catch (err) { return jsonResponse({ error: err.message || 'Invalid JSON body' }, 400); }
  const userId = String(body.userId || 'local-user');
  const conversationId = String(body.conversationId || '');
  if (!conversationId) return jsonResponse({ error: 'conversationId is required.' }, 400);
  const result = await updateDb(db => optimizeConversationMemories(db, userId, conversationId));
  return jsonResponse(result);
}

async function handleDeleteConversationRequest(request, conversationId) {
  const unauthorized = authorizeRequest(request);
  if (unauthorized) return unauthorized;
  if (!conversationId) return jsonResponse({ error: 'Conversation id is required.' }, 400);
  await updateDb(db => {
    db.conversations = db.conversations.filter(conversation => conversation.id !== conversationId);
    db.messages = db.messages.filter(message => message.conversationId !== conversationId);
    db.memories = db.memories.filter(memory => memory.conversationId !== conversationId);
  });
  return jsonResponse({ ok: true });
}

async function streamProvider(config, apiKey, system, messages, signal, sink) {
  if (config.provider === 'anthropic') return streamAnthropic(config, apiKey, system, messages, signal, sink);
  if (config.provider === 'gemini') return streamGemini(config, apiKey, system, messages, signal, sink);
  return streamOpenAICompatible(config, apiKey, system, messages, signal, sink);
}

async function streamOpenAICompatible(config, apiKey, system, messages, signal, sink) {
  const response = await fetch(apiUrl(config.endpoint, '/chat/completions'), {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'system', content: system }, ...messages],
      temperature: 0.8,
      stream: true,
    }),
  });
  sink.setResponse(response);
  await assertStreamResponse(response);
  await readSseStream(response, data => {
    const delta = data.choices?.[0]?.delta || {};
    if (delta.reasoning_content) sink.reasoning(String(delta.reasoning_content));
    if (delta.content) sink.content(String(delta.content));
  });
}

async function streamAnthropic(config, apiKey, system, messages, signal, sink) {
  const response = await fetch(apiUrl(config.endpoint, '/messages'), {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: config.model, system, messages, max_tokens: 1200, temperature: 0.8, stream: true }),
  });
  sink.setResponse(response);
  await assertStreamResponse(response);
  await readSseStream(response, data => {
    if (data.type === 'content_block_delta' && data.delta?.text) sink.content(String(data.delta.text));
  });
}

async function streamGemini(config, apiKey, system, messages, signal, sink) {
  const contents = messages.map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
  const response = await fetch(
    joinUrl(config.endpoint, `/v1beta/models/${encodeURIComponent(config.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`),
    {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.8 },
      }),
    },
  );
  sink.setResponse(response);
  await assertStreamResponse(response);
  await readSseStream(response, data => {
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
    if (text) sink.content(text);
  });
}

async function assertStreamResponse(response) {
  if (response.ok) return;
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  const message = data.error?.message || data.error || data.raw || response.statusText;
  throw new Error(`Model request failed (${response.status}): ${message}`);
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data.error?.message || data.error || data.raw || response.statusText;
    throw new Error(`Provider request failed (${response.status}): ${message}`);
  }
  return data;
}

async function readSseStream(response, onData) {
  if (!response.body) throw new Error('Upstream response did not include a readable body.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';
    for (const frame of frames) {
      processSseFrame(frame, onData);
    }
  }

  if (buffer.trim()) processSseFrame(buffer, onData);
}

function processSseFrame(frame, onData) {
  const dataLines = frame.split(/\r?\n/).filter(line => line.startsWith('data:'));
  if (!dataLines.length) return;

  const raw = dataLines.map(line => line.slice(5).trimStart()).join('\n');
  if (!raw || raw === '[DONE]') return;

  try {
    onData(JSON.parse(raw));
  } catch (err) {
    console.warn('[stream] invalid upstream SSE JSON frame:', {
      error: err.message,
      sample: raw.slice(0, 500),
    });
  }
}

function buildSystemPrompt(db, userId, conversationId, lang, persona, memoryDepth = 62, latestUserContent = '') {
  const preset = db.presets[0] || defaultPreset();
  const pref = db.userPreferences.find(item => item.userId === userId) || defaultPreference(userId);
  const tags = preferenceTags(pref, lang);
  const memories = relatedMemories(db, userId, conversationId, memoryDepth);
  const memoryText = memories.map(memory => `- ${memory.content}`).join('\n');
  const immediate = extractUserMemoryCandidates(latestUserContent).map(candidate => `- ${candidate.content}`).join('\n');
  markMemoriesUsed(db, memories);
  return `${preset.systemPrompt}\n\n【AI-specific persona configured by user】\n${persona || 'None.'}\n\n【Current user communication preferences】\n${tags}\n\n【Fresh user instructions from the latest message, highest priority】\n${immediate || 'None.'}\n\n【Long-term memory for this conversation, obey when relevant】\n${memoryText || 'None.'}\n\nRule: Do not ignore recent user statements just because they are not yet summarized. Treat the latest user instructions and this conversation's memory as active context.`;
}

function maybeUpdatePreference(db, userId, conversation) {
  const messages = conversation.messages || [];
  if (messages.length === 0 || messages.length % 10 !== 0) return;
  const users = messages.filter(message => message.role === 'user').slice(-5);
  if (users.length < 5) return;

  const pref = upsertPreference(db, userId);
  const alpha = pref.calculationCount < 3 ? 0.5 : 0.3;
  const y = scoreUserWindow(users);
  pref.brevityWeight = ema(pref.brevityWeight, y.brevity, alpha);
  pref.toneWeight = ema(pref.toneWeight, y.tone, alpha);
  pref.rhythmWeight = ema(pref.rhythmWeight, y.rhythm, alpha);
  pref.calculationCount += 1;
  pref.updatedAt = new Date().toISOString();
}

function scoreUserWindow(users) {
  const lengths = users.map(message => [...String(message.content || '')].length);
  const avgLength = average(lengths);
  const toneHits = users.reduce((sum, message) => {
    return sum + (String(message.content || '').match(/[哈啊呢吧呀哦嘛啦诶~～]/g) || []).length;
  }, 0);
  const intervals = users
    .slice(1)
    .map((message, index) => Math.max(0, Number(message.sentAt || 0) - Number(users[index].sentAt || 0)))
    .filter(Boolean);
  const avgInterval = average(intervals);
  return {
    brevity: clamp01(1 - avgLength / 240),
    tone: clamp01(toneHits / Math.max(1, users.length * 3)),
    rhythm: clamp01(1 - avgInterval / 180000),
  };
}

function preferenceTags(pref, lang) {
  const tags = [];
  if (pref.brevityWeight > 0.66) tags.push(lang === 'zh' ? '用户偏好简短直接的回复。' : 'The user tends to prefer brief, direct replies.');
  if (pref.brevityWeight < 0.34) tags.push(lang === 'zh' ? '用户可以接受较完整的回复。' : 'The user accepts more complete replies.');
  if (pref.toneWeight > 0.66) tags.push(lang === 'zh' ? '用户表达较口语化，可适度自然。' : 'The user writes conversationally; natural phrasing is acceptable.');
  if (pref.toneWeight < 0.34) tags.push(lang === 'zh' ? '用户表达克制，回复也应保持清楚克制。' : 'The user writes tersely; keep responses clear and restrained.');
  if (pref.rhythmWeight > 0.66) tags.push(lang === 'zh' ? '用户节奏较快，优先回答核心。' : 'The user moves quickly; answer the core point first.');
  if (pref.rhythmWeight < 0.34) tags.push(lang === 'zh' ? '用户节奏较慢，可保留必要上下文。' : 'The user moves slowly; include necessary context.');
  return tags.join('\n') || (lang === 'zh' ? '维持中等长度，清晰、中立、直接。' : 'Use moderate length. Be clear, neutral, and direct.');
}

function relatedMemories(db, userId, conversationId, memoryDepth = 62) {
  const limit = memoryDepth <= 0 ? 0 : Math.max(5, Math.round(memoryDepth / 10));
  if (!limit) return [];

  const conversation = db.conversations.find(item => item.id === conversationId);
  const text = (conversation?.messages || []).slice(-8).map(message => message.content).join(' ');
  const words = keywords(text);
  const wordSet = new Set(words);
  const now = Date.now();

  return db.memories
    .filter(memory => memory.userId === userId && memory.conversationId === conversationId)
    .map(memory => ({
      memory,
      score: scoreMemory(memory, wordSet, conversationId, now),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.memory)
    .reduce((acc, memory) => {
      const usedChars = acc.reduce((sum, item) => sum + item.content.length, 0);
      if (acc.length >= limit || usedChars + memory.content.length > MAX_MEMORY_PROMPT_CHARS) return acc;
      acc.push(memory);
      return acc;
    }, []);
}

function scoreMemory(memory, words, conversationId, now) {
  const memoryKeywords = String(memory.keywords || '').split(',').filter(Boolean);
  const overlap = memoryKeywords.filter(keyword => words.has(keyword)).length;
  const importance = clamp01(memory.importance ?? 0.5);
  const sameConversation = memory.conversationId === conversationId ? 0.8 : 0;
  if (!sameConversation) return 0;
  const sticky = ['instruction', 'profile', 'preference'].includes(memory.type) ? 2.2 : 0;
  const hits = Math.min(Number(memory.hitCount || 0), 12) * 0.05;
  const updated = Date.parse(memory.updatedAt || memory.createdAt || '') || 0;
  const ageDays = updated ? (now - updated) / 86400000 : 365;
  const recency = Math.max(0, 0.5 - ageDays / 120);
  return overlap * 1.5 + importance + sticky + sameConversation + hits + recency;
}

function markMemoriesUsed(db, memories) {
  const now = new Date().toISOString();
  for (const memory of memories) {
    memory.hitCount = Number(memory.hitCount || 0) + 1;
    memory.lastUsedAt = now;
  }
}

function rememberUserMessage(db, userId, conversationId, content) {
  for (const candidate of extractUserMemoryCandidates(content)) {
    upsertMemory(db, {
      ...candidate,
      userId,
      conversationId,
    });
  }
  pruneConversationMemories(db, userId, conversationId);
}

async function maybeCreateMemory(userId, conversationId, userContent, assistantContent) {
  const candidates = extractMemoryCandidates(userContent, assistantContent);
  if (!candidates.length) return;

  await updateDb(db => {
    for (const candidate of candidates) {
      upsertMemory(db, {
        ...candidate,
        userId,
        conversationId,
      });
    }
    pruneConversationMemories(db, userId, conversationId);
  });
}

function extractMemoryCandidates(userContent, assistantContent) {
  const candidates = [];
  candidates.push(...extractUserMemoryCandidates(userContent));

  const assistantText = cleanMemoryContent(assistantContent);
  if (assistantText.length >= 220 && looksLikeProjectFact(assistantText)) {
    candidates.push({
      content: assistantText.slice(0, MAX_MEMORY_CONTENT_CHARS),
      source: 'assistant',
      type: 'topic',
      importance: 0.45,
    });
  }

  return candidates.filter(candidate => keywords(candidate.content).length);
}

function extractUserMemoryCandidates(userContent) {
  const userText = cleanMemoryContent(userContent);
  if (!isMemorableUserText(userText)) return [];
  return splitMemoryStatements(userText).map(content => ({
    content,
    source: 'user',
    type: classifyMemory(content),
    importance: memoryImportance(content),
  })).filter(candidate => candidate.content && keywords(candidate.content).length);
}

function upsertMemory(db, incoming) {
  const now = new Date().toISOString();
  const incomingKeywords = keywords(incoming.content).slice(0, 10);
  const incomingNorm = normalizeMemoryText(incoming.content);
  const existing = db.memories.find(memory => {
    if (memory.userId !== incoming.userId) return false;
    if (memory.conversationId !== incoming.conversationId) return false;
    if (normalizeMemoryText(memory.content) === incomingNorm) return true;
    const current = new Set(String(memory.keywords || '').split(',').filter(Boolean));
    const overlap = incomingKeywords.filter(keyword => current.has(keyword)).length;
    return overlap >= Math.min(4, Math.max(2, incomingKeywords.length));
  });

  if (existing) {
    if (incoming.content.length > String(existing.content || '').length) {
      existing.content = incoming.content.slice(0, MAX_MEMORY_CONTENT_CHARS);
    }
    existing.keywords = [...new Set([...String(existing.keywords || '').split(',').filter(Boolean), ...incomingKeywords])].slice(0, 14).join(',');
    existing.type = existing.type || incoming.type;
    existing.source = existing.source || incoming.source;
    existing.conversationId = existing.conversationId || incoming.conversationId;
    existing.importance = clamp01(Math.max(Number(existing.importance || 0.5), incoming.importance) + 0.06);
    existing.hitCount = Number(existing.hitCount || 0) + 1;
    existing.updatedAt = now;
    return existing;
  }

  const memory = {
    id: uuid(),
    userId: incoming.userId,
    conversationId: incoming.conversationId,
    source: incoming.source,
    type: incoming.type,
    content: incoming.content.slice(0, MAX_MEMORY_CONTENT_CHARS),
    keywords: incomingKeywords.join(','),
    importance: clamp01(incoming.importance),
    hitCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.memories.push(memory);
  return memory;
}

function pruneConversationMemories(db, userId, conversationId) {
  const scoped = db.memories
    .filter(memory => memory.userId === userId && memory.conversationId === conversationId)
    .sort((a, b) => memorySortValue(b) - memorySortValue(a));
  const keep = new Set(scoped.slice(0, MAX_MEMORIES_PER_CONVERSATION).map(memory => memory.id));
  db.memories = db.memories.filter(memory => {
    if (memory.userId !== userId || memory.conversationId !== conversationId) return true;
    return keep.has(memory.id);
  });
}

function optimizeConversationMemories(db, userId, conversationId) {
  const before = db.memories.filter(memory => memory.userId === userId && memory.conversationId === conversationId);
  const beforeCount = before.length;
  const beforeCapacity = memoryCapacity(before);
  const merged = mergeDuplicateMemories(db, userId, conversationId);
  pruneConversationMemories(db, userId, conversationId);
  const after = db.memories.filter(memory => memory.userId === userId && memory.conversationId === conversationId);
  const afterCapacity = memoryCapacity(after);
  return {
    ok: true,
    conversationId,
    before: beforeCapacity,
    after: afterCapacity,
    merged,
    removed: Math.max(0, beforeCount - after.length - merged),
    kept: after.length,
    message: `Optimized memory: merged ${merged}, removed ${Math.max(0, beforeCount - after.length - merged)}, kept ${after.length}.`,
  };
}

function mergeDuplicateMemories(db, userId, conversationId) {
  const scoped = db.memories.filter(memory => memory.userId === userId && memory.conversationId === conversationId);
  const removed = new Set();
  let merged = 0;

  for (let i = 0; i < scoped.length; i += 1) {
    const base = scoped[i];
    if (removed.has(base.id)) continue;
    const baseKeys = new Set(String(base.keywords || '').split(',').filter(Boolean));
    for (let j = i + 1; j < scoped.length; j += 1) {
      const other = scoped[j];
      if (removed.has(other.id)) continue;
      const otherKeys = String(other.keywords || '').split(',').filter(Boolean);
      const overlap = otherKeys.filter(keyword => baseKeys.has(keyword)).length;
      const sameText = normalizeMemoryText(base.content) === normalizeMemoryText(other.content);
      if (!sameText && overlap < Math.min(4, Math.max(2, otherKeys.length))) continue;
      base.content = combineMemoryContent(base.content, other.content);
      base.keywords = [...new Set([...baseKeys, ...otherKeys])].slice(0, 14).join(',');
      base.importance = clamp01(Math.max(base.importance || 0.5, other.importance || 0.5) + 0.05);
      base.hitCount = Number(base.hitCount || 0) + Number(other.hitCount || 0);
      base.updatedAt = new Date().toISOString();
      removed.add(other.id);
      merged += 1;
    }
  }

  if (removed.size) db.memories = db.memories.filter(memory => !removed.has(memory.id));
  return merged;
}

function combineMemoryContent(a, b) {
  const first = cleanMemoryContent(a);
  const second = cleanMemoryContent(b);
  if (!first) return second;
  if (!second || first.includes(second)) return first;
  if (second.includes(first)) return second;
  return `${first}\n${second}`.slice(0, MAX_MEMORY_CONTENT_CHARS);
}

function memoryCapacity(memories) {
  const used = memories.length;
  const max = MAX_MEMORIES_PER_CONVERSATION;
  return {
    used,
    max,
    percent: Math.min(100, Math.round((used / max) * 100)),
  };
}

function memorySortValue(memory) {
  const importance = clamp01(memory.importance ?? 0.5) * 100;
  const hits = Math.min(Number(memory.hitCount || 0), 20) * 2;
  const updated = Date.parse(memory.updatedAt || memory.createdAt || '') || 0;
  const recency = updated ? Math.max(0, 30 - ((Date.now() - updated) / 86400000)) : 0;
  return importance + hits + recency;
}

function publicMemory(memory) {
  return {
    id: memory.id,
    type: memory.type || 'topic',
    source: memory.source || 'memory',
    content: memory.content || '',
    importance: clamp01(memory.importance ?? 0.5),
    hitCount: Number(memory.hitCount || 0),
    updatedAt: memory.updatedAt || memory.createdAt || null,
  };
}

function buildSoulIdentitySnapshot(conversation) {
  if (!conversation) return [];
  const summary = [];
  const model = conversation.model || '';
  const persona = conversation.persona || '';
  const name = conversation.name || conversation.title || conversation.id || '';
  if (name) summary.push({ id: 'soul-name', type: 'identity', source: 'letter', content: `Name: ${name}` });
  if (model) summary.push({ id: 'soul-model', type: 'model', source: 'letter', content: `Model: ${model}` });
  if (persona) summary.push({ id: 'soul-persona', type: 'persona', source: 'letter', content: persona });
  return summary;
}

function isMemorableUserText(text) {
  if (!text || text.length < 4) return false;
  if (/^(你好|hello|hi|ok|好的|嗯|啊|哈哈|谢谢|thanks|test|123)[。.!！?？\s]*$/i.test(text)) return false;
  return /我叫|我是|我是做|我在|我住|我喜欢|我不喜欢|我偏好|偏好|记住|记得|以后|以后都|之后|下次|每次|默认|不要|别再|请叫我|叫我|你叫|你的名字|我的|我们项目|这个项目|服务器|模型|端点|API|密钥|秘钥|帮助页|人设|记忆|my name is|i am|i'm|i work|i live|i like|i dislike|i prefer|remember|from now on|next time|always|default|call me|your name|don't|do not|my project|our project|api key|endpoint|memory|persona/i.test(text);
}

function classifyMemory(text) {
  if (/喜欢|不喜欢|偏好|prefer|like|dislike/i.test(text)) return 'preference';
  if (/记住|记得|以后|之后|下次|每次|默认|不要|别再|from now on|remember|next time|always|default|don't|do not/i.test(text)) return 'instruction';
  if (/我叫|请叫我|叫我|你叫|你的名字|my name is|call me|your name/i.test(text)) return 'profile';
  if (/项目|服务器|模型|端点|API|密钥|秘钥|project|server|model|endpoint|api key/i.test(text)) return 'fact';
  return 'topic';
}

function memoryImportance(text) {
  let score = 0.58;
  if (/记住|记得|以后|之后|下次|每次|默认|不要|别再|remember|from now on|next time|always|default|don't|do not/i.test(text)) score += 0.2;
  if (/密钥|秘钥|API|api key|endpoint|端点|服务器|server/i.test(text)) score += 0.12;
  if (/我叫|请叫我|叫我|你叫|你的名字|my name is|call me|your name/i.test(text)) score += 0.14;
  return clamp01(score);
}

function splitMemoryStatements(text) {
  const parts = cleanMemoryContent(text)
    .split(/(?:[。！？!?；;]|\n+|，(?=以后|记得|不要|别再|默认|下次|每次)|,(?=\s*(remember|from now on|always|default|next time|don't|do not)))/i)
    .map(part => part.trim())
    .filter(Boolean);
  return (parts.length ? parts : [text]).slice(0, 6);
}

function looksLikeProjectFact(text) {
  return /项目|功能|模型|端点|接口|服务器|配置|schema|database|memory|preference|prompt|project|model|endpoint|server|config|database/i.test(text);
}

function cleanMemoryContent(text) {
  return redactSecrets(String(text || ''))
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MEMORY_CONTENT_CHARS);
}

function redactSecrets(text) {
  return String(text || '')
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, match => `${match.slice(0, 7)}...${match.slice(-4)}`)
    .replace(/\btp-[A-Za-z0-9_-]{16,}\b/g, match => `${match.slice(0, 7)}...${match.slice(-4)}`)
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, match => `${match.slice(0, 8)}...${match.slice(-4)}`);
}

function normalizeMemoryText(text) {
  return cleanMemoryContent(text).toLowerCase().replace(/[^\p{Script=Han}a-z0-9]+/gu, '');
}

async function persistAssistantMessage(conversationId, assistantMessage) {
  await updateDb(db => {
    const conversation = upsertConversation(db, conversationId);
    const index = conversation.messages.findIndex(message => message.id === assistantMessage.id);
    if (index >= 0) conversation.messages[index] = { ...assistantMessage };
  });
}

async function ensureDatabase() {
  if (usesPostgres()) return ensurePostgresDatabase();
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fsp.readFile(DB_FILE, 'utf8');
    dbCache = normalizeDb(JSON.parse(raw));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    dbCache = defaultDb();
    await writeDbFile(dbCache);
  }
}

async function updateDb(mutator) {
  const operation = dbQueue.then(async () => {
    if (usesPostgres()) return updatePostgresDb(mutator);
    if (!dbCache) await ensureDatabase();
    const result = await mutator(dbCache);
    await writeDbFile(dbCache);
    return result;
  });
  dbQueue = operation.catch(err => {
    console.error('[db] queued operation failed:', err);
  });
  return operation;
}

async function readDbSnapshot() {
  await dbQueue;
  if (usesPostgres()) {
    await ensurePostgresDatabase();
    const rows = await getPostgresClient()`select data from manuscript_state where id = ${POSTGRES_STATE_KEY}`;
    return normalizeDb(rows[0]?.data || defaultDb());
  }
  if (!dbCache) await ensureDatabase();
  return dbCache;
}

async function ensurePostgresDatabase() {
  if (postgresReady) return;
  const sql = getPostgresClient();
  await sql`
    create table if not exists manuscript_state (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    insert into manuscript_state (id, data)
    values (${POSTGRES_STATE_KEY}, ${sql.json(defaultDb())})
    on conflict (id) do nothing
  `;
  postgresReady = true;
}

async function updatePostgresDb(mutator) {
  await ensurePostgresDatabase();
  const sql = getPostgresClient();
  return sql.begin(async tx => {
    const rows = await tx`select data from manuscript_state where id = ${POSTGRES_STATE_KEY} for update`;
    const db = normalizeDb(rows[0]?.data || defaultDb());
    const result = await mutator(db);
    await tx`
      update manuscript_state
      set data = ${tx.json(db)}, updated_at = now()
      where id = ${POSTGRES_STATE_KEY}
    `;
    return result;
  });
}

function usesPostgres() {
  return Boolean(String(process.env.DATABASE_URL || '').trim());
}

function getPostgresClient() {
  if (!postgresClient) {
    postgresClient = postgres(process.env.DATABASE_URL, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return postgresClient;
}

async function writeDbFile(db) {
  const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fsp.rename(tmp, DB_FILE);
}

function normalizeDb(db) {
  return {
    models: Array.isArray(db.models) ? db.models : [],
    conversations: Array.isArray(db.conversations) ? db.conversations : [],
    messages: Array.isArray(db.messages) ? db.messages : [],
    userPreferences: Array.isArray(db.userPreferences) && db.userPreferences.length ? db.userPreferences : [defaultPreference('local-user')],
    memories: Array.isArray(db.memories) ? db.memories.map(normalizeMemory) : [],
    presets: Array.isArray(db.presets) && db.presets.length ? db.presets : [defaultPreset()],
  };
}

function defaultDb() {
  return {
    models: [],
    conversations: [],
    messages: [],
    userPreferences: [defaultPreference('local-user')],
    memories: [],
    presets: [defaultPreset()],
  };
}

function defaultPreset() {
  return {
    id: uuid(),
    name: 'MANUSCRIPT',
    systemPrompt: [
      'You are the backend model for MANUSCRIPT, a minimalist messaging interface.',
      'Do not adopt a persona, character, therapeutic role, romantic role, or emotional companion identity.',
      'Be transparent that you are an AI model when relevant.',
      'Respond as a neutral communication tool: direct, concise, accurate, and context-aware.',
      'Match the user language.',
      'Use Markdown, LaTeX, or code blocks only when they materially improve clarity.',
      'Do not add performative warmth, poetic framing, or roleplay language unless the user explicitly asks for that style.',
    ].join('\n'),
    bubbleStyle: '{}',
  };
}

function defaultPreference(userId) {
  return {
    id: uuid(),
    userId,
    brevityWeight: 0.5,
    toneWeight: 0.5,
    rhythmWeight: 0.5,
    calculationCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeMemory(memory) {
  const createdAt = memory.createdAt || new Date().toISOString();
  return {
    id: memory.id || uuid(),
    userId: memory.userId || 'local-user',
    conversationId: memory.conversationId || null,
    source: memory.source || 'legacy',
    type: memory.type || 'topic',
    content: redactSecrets(cleanMemoryContent(memory.content || '')).slice(0, MAX_MEMORY_CONTENT_CHARS),
    keywords: memory.keywords || keywords(memory.content || '').slice(0, 10).join(','),
    importance: clamp01(memory.importance ?? 0.5),
    hitCount: Number(memory.hitCount || 0),
    lastUsedAt: memory.lastUsedAt || null,
    createdAt,
    updatedAt: memory.updatedAt || createdAt,
  };
}

function upsertConversation(db, id) {
  let conversation = db.conversations.find(item => item.id === id);
  if (!conversation) {
    conversation = { id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] };
    db.conversations.push(conversation);
  }
  if (!Array.isArray(conversation.messages)) conversation.messages = [];
  conversation.updatedAt = new Date().toISOString();
  return conversation;
}

function upsertPreference(db, userId) {
  let pref = db.userPreferences.find(item => item.userId === userId);
  if (!pref) {
    pref = defaultPreference(userId);
    db.userPreferences.push(pref);
  }
  return pref;
}

function lastUserMessage(messages) {
  return [...messages].reverse().find(message => message.role === 'user');
}

function hasSameTailUserMessage(conversation, content) {
  const latest = [...(conversation.messages || [])].reverse().find(message => message.role === 'user');
  return latest?.content === content;
}

function normalizeMessages(messages) {
  const normalized = messages
    .map(message => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || '').slice(0, 8000),
    }))
    .filter(message => message.content.trim());
  const merged = [];
  for (const message of normalized) {
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}\n${message.content}`.slice(-12000);
    } else {
      merged.push(message);
    }
  }
  const recentUsers = merged.filter(message => message.role === 'user').slice(-8);
  const tail = merged.slice(-20);
  return uniqueMessagesByReference([...recentUsers, ...tail], merged);
}

function uniqueMessagesByReference(messages, order) {
  const seen = new Set();
  return messages
    .filter(message => {
      if (seen.has(message)) return false;
      seen.add(message);
      return true;
    })
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function buildModelConfig() {
  return {
    'DeepSeek-v4-Pro': {
      provider: 'openai',
      endpoint: process.env.DEEPSEEK_V4_PRO_ENDPOINT || 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_V4_PRO_API_KEY,
      model: process.env.DEEPSEEK_V4_PRO_MODEL || 'deepseek-reasoner',
      reasoningModel: process.env.DEEPSEEK_V4_PRO_REASONING_MODEL || process.env.DEEPSEEK_V4_PRO_MODEL || 'deepseek-reasoner',
    },
    'MIMO v2.5 Pro': {
      provider: 'openai',
      endpoint: process.env.MIMO_V2_5_PRO_ENDPOINT || 'https://token-plan-cn.xiaomimimo.com/v1',
      apiKeys: splitKeys(process.env.MIMO_V2_5_PRO_API_KEYS),
      model: process.env.MIMO_V2_5_PRO_MODEL || 'mimo-v2.5-pro',
    },
    'GPT 5.4': {
      provider: 'openai',
      endpoint: envValue('GPT_5_4_ENDPOINT', 'https://api.apikey.fun'),
      apiKey: process.env.GPT_5_4_API_KEY,
      model: process.env.GPT_5_4_MODEL || 'gpt-5.4',
    },
    'Claude Opus 4.6': {
      provider: 'anthropic',
      endpoint: envValue('CLAUDE_OPUS_4_6_ENDPOINT', 'https://api.apikey.fun'),
      apiKey: process.env.CLAUDE_OPUS_4_6_API_KEY,
      model: process.env.CLAUDE_OPUS_4_6_MODEL || 'claude-opus-4-6',
    },
    Gemini: {
      provider: 'gemini',
      endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com',
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
    },
  };
}

function resolveIncomingModelConfig(modelName, customModel) {
  if (customModel && customModel.endpoint && customModel.envPrefix && customModel.model) {
    const endpoint = String(customModel.endpoint).trim();
    const envPrefix = normalizeEnvPrefix(customModel.envPrefix);
    if (!isAllowedEndpoint(endpoint)) return null;
    if (!envPrefix) return null;
    return {
      provider: customModel.provider || (endpoint.includes('generativelanguage.googleapis.com') ? 'gemini' : 'openai'),
      endpoint: envValue(`${envPrefix}_ENDPOINT`, endpoint),
      apiKey: apiKeyFromEnvPrefix(envPrefix),
      apiKeys: splitKeys(process.env[`${envPrefix}_API_KEYS`]),
      model: String(customModel.model).trim(),
    };
  }
  return currentModelConfig()[modelName];
}

function resolveRequestConfig(config, deepThinking) {
  if (!deepThinking || !config.reasoningModel) return config;
  return { ...config, model: config.reasoningModel };
}

function splitKeys(value) {
  return String(value || '').split(',').map(key => key.trim()).filter(Boolean);
}

function normalizeEnvPrefix(value) {
  const prefix = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9_]+$/.test(prefix) ? prefix : '';
}

function apiKeyFromEnvPrefix(prefix) {
  return String(process.env[`${prefix}_API_KEY`] || '').trim() || nextKey(splitKeys(process.env[`${prefix}_API_KEYS`]));
}

function envValue(name, fallback = '') {
  const value = String(process.env[name] || '').trim();
  return value || fallback;
}

function splitList(value) {
  return String(value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
}

function nextKey(keys) {
  if (!keys || !keys.length) return '';
  const key = keys[keyIndex % keys.length];
  keyIndex += 1;
  return key;
}

function joinUrl(base, suffix) {
  return String(base || '').replace(/\/+$/, '') + suffix;
}

function isAllowedEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (!['https:', 'http:'].includes(url.protocol)) return false;
  const hostname = url.hostname.toLowerCase();
  if (PRIVATE_HOST_PATTERNS.some(pattern => pattern.test(hostname))) return false;
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(hostname)) return false;
  const allowedHosts = currentAllowedCustomEndpointHosts();
  if (allowedHosts.length && !allowedHosts.includes(hostname)) return false;
  return true;
}

function apiUrl(base, suffix) {
  const cleanBase = String(base || '').replace(/\/+$/, '');
  const cleanSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
  if (/\/v\d+(beta)?$/i.test(cleanBase)) return cleanBase + cleanSuffix;
  return cleanBase + '/v1' + cleanSuffix;
}

function uuid() {
  return crypto.randomUUID();
}

function ema(previous, current, alpha) {
  return clamp01(alpha * current + (1 - alpha) * previous);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function keywords(text) {
  return [...new Set(String(text || '').toLowerCase().match(/[\p{Script=Han}]{2,}|[a-z0-9]{4,}/gu) || [])].slice(0, 24);
}


function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

module.exports = {
  handleChatRequest,
  handleListModelsRequest,
  handleGetMemoriesRequest,
  handleOptimizeMemoriesRequest,
  handleDeleteConversationRequest,
};
