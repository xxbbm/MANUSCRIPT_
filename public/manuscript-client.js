/* ============================================================
   MANUSCRIPT — app.js
   Single-page minimalist AI messaging interface.
   Three atmospheres (native / imessage / wechat),
   bilingual content (zh / en), 14 screens.
   ============================================================ */

/* ---------------- State ---------------- */
const STATE = {
  lang: 'en',                 // 'zh' | 'en'
  theme: 'native',            // 'native' | 'imessage' | 'wechat'
  screen: 'list',             // current screen key
  thread: null,               // active AI conversation id
  tone: 'melancholic',
  memory: 62,                 // 0..100
  deepThinking: true,
  editModelIndex: null,
  memoryThread: null,
};

/* ---------------- i18n dictionary ----------------
   t(key) returns the string for STATE.lang.            */
const I18N = {
  // brand / chrome
  brandSub:      ['LETTERS TO THE QUIET', 'LETTERS TO THE QUIET'],
  navList:       ['信札', 'LETTERS'],
  navSoul:       ['收信人', 'RECIPIENT'],
  navAtmo:       ['纸色', 'ATMOSPHERE'],
  navSystem:     ['墨水节点', 'INK NODES'],
  navHelp:       ['弁言', 'PREFACE'],
  statusConn:    ['{model} [ 墨迹已通 ]', '{model} [ INK LINKED ]'],
  deepThinkingOn:['深读 ON', 'DEEP READING ON'],
  deepThinkingOff:['深读 OFF', 'DEEP READING OFF'],
  syslog:        ['手稿索引', 'MS_INDEX'],
  langBtn:       ['EN', '中文'],
  menu:          ['菜单', 'MENU'],

  // conversation list
  listTitle:     ['未寄出的信箱', 'Unsent Letters'],
  listLead:      ['这里还没有收信人。先写下一封开端，让一个回声在纸页背面醒来。',
                  'No recipient has been named yet. Begin with a letter, and let an echo wake on the other side of the page.'],
  initiate:      ['起笔写信', 'BEGIN A LETTER'],

  // conversation detail
  detailReflecting: ['[ 正在回望 ]', '[ READING BACK ]'],
  detailDivider:    ['[ 03:14:22 纸上此刻 ]', '[ 03:14:22 IN MARGINS ]'],
  composerPlaceholder: ['把没有说完的，写下来……', 'Leave the unfinished thought here…'],
  send:          ['封缄', 'SEAL'],
  whoVoid:       ['回声', 'ECHO'],
  whoUser:       ['写信人', 'WRITER'],

  // soul settings
  soulTitle:     ['收信人札记', 'Recipient Notes'],
  soulLead:      ['选择一封已经起笔的信，调整称谓、声线、墨水节点与记忆回廊。',
                  'Choose an existing letter and tune its name, voice, ink node, and corridor of memory.'],
  soulCoreTitle: ['声线与边界', 'Voice & Boundary'],
  soulCoreTag:   ['[ 回信设定 ]', '[ REPLY SETTING ]'],
  soulCore1:     ['这里不是给机器套上一张面具，而是为一封信选择合适的回声。你可以写下它说话的速度、边界、温度，以及它该如何靠近你的文字。',
                  'This is not a mask placed over a machine, but a chosen echo for a letter. Define its pace, boundaries, warmth, and the way it should approach your words.'],
  soulCore2:     ['每封信都有自己的灵魂设定与独立记忆。一个对话里沉淀下来的东西，不会被带到另一封信中。',
                  'Each letter keeps its own soul setting and isolated memory. What settles in one conversation is not carried into another.'],
  soulRule1:     ['允许温柔，但不制造喧嚣。', 'Allow tenderness, but never noise.'],
  soulRule2:     ['允许沉思，但不假装神秘。', 'Allow reflection, but never pretend mystery.'],
  soulRule3:     ['让文字先于功能抵达。', 'Let words arrive before features.'],
  appendDirective: ['在页边再添一句……', 'Add one note in the margin…'],
  soulToneTitle: ['回信的温度', 'Temperature of Reply'],
  soulToneTag:   ['[ 共振频率 ]', '[ RESONANCE FREQUENCY ]'],
  soulToneText:  ['弥漫的氛围，是一种抽离的忧郁与安静的观望。回应可以温热、深思，也可以克制、清醒，但不应落入科技感的表演。',
                  'The atmosphere is one of quiet observation. Replies may be warm, reflective, restrained, or lucid, but should never become technological performance.'],
  toneMelancholic:['忧郁', 'MELANCHOLIC'],
  toneClinical:  ['冷静', 'CLINICAL'],
  tonePhilo:     ['思辨', 'PHILOSOPHICAL'],
  toneErratic:   ['飘忽', 'ERRATIC'],
  soulMemTitle:  ['记忆回廊', 'Memory Corridor'],
  soulMemTag:    ['[ 独立档案 ]', '[ ISOLATED ARCHIVE ]'],
  soulMemText:   ['定义这封信能回望多远。浅的深度让交流停在此刻，深的记忆则让旧句子在新的回应里轻轻浮现。记忆只属于当前信件。',
                  'Defines how far this letter can look back. Shallow memory keeps the exchange in the present; deeper memory lets old sentences surface softly in new replies. Memory belongs only to this letter.'],
  memoryArchiveTitle: ['信件档案', 'Letter Archive'],
  memoryArchiveTag:   ['[ 只读手稿 ]', '[ READ ONLY MANUSCRIPT ]'],
  memoryArchiveText:  ['选择一封信，查看它留下的身份页、记忆批注与写信人侧影。后台会安静地誊清重复处，拂去失效条目，把空白留给后来真正重要的句子。',
                       'Choose a letter to view its identity page, memory marginalia, and the writer profile. In the background, duplicates are quietly transcribed away, stale lines are lifted, and space is kept for what later proves important.'],
  memoryPickLetter:   ['翻阅哪一封', 'Which Letter'],
  memorySoulLayer:    ['身份页', 'Identity Page'],
  memoryNotesLayer:   ['页边批注', 'Marginalia'],
  memoryProfileLayer: ['写信人侧影', 'Writer Profile'],
  memoryEmpty:        ['尚无可归档的句子。继续写，它会在合适的时候沉到纸背。',
                       'No sentence has settled into the archive yet. Keep writing; it will sink into the paper when it is ready.'],
  memoryLoading:      ['翻页中……', 'Turning pages…'],
  memoryLoadFailed:   ['档案未能展开', 'Archive could not open'],
  memoryCapacity:     ['纸页余量', 'Page Margin'],
  memoryOptimize:     ['誊清档案', 'Transcribe Archive'],
  memoryOptimizing:   ['誊清中……', 'Transcribing…'],
  memoryOptimized:    ['档案已誊清', 'Archive Transcribed'],
  memShallow:    ['浅', 'SHALLOW'],
  memVast:       ['深邃', 'VAST'],
  commitChanges: ['落款保存', 'SIGN & SAVE'],

  // atmosphere
  atmoTitle:     ['纸色与回声', 'Paper & Echo'],
  atmoLead:      ['选择这部手稿被阅读时的纸色：黑暗、熟悉，或更接近日常的密度。',
                  'Choose the paper on which this manuscript is read: dark, familiar, or closer to daily density.'],
  atmoActive:    ['[ 正在使用 ]', '[ IN USE ]'],
  atmoNativeName:['黑曜纸页（原生）', 'Obsidian Paper (Native)'],
  atmoNativeDesc:['近乎无光的纸面，只留下字、线与呼吸。适合长久阅读，也适合把心事放慢。',
                  'A nearly lightless page that leaves only words, lines, and breath. Made for long reading and for slowing down what hurts to say.'],
  atmoIMessageName:['熟悉信窗（iMessage）', 'Familiar Letter Window (iMessage)'],
  atmoIMessageDesc:['借用现代对话的轮廓，却保留手稿的克制。让日常界面成为一只安静的信封。',
                  'Borrowing the outline of modern messaging while keeping the restraint of manuscript. A familiar interface becomes a quiet envelope.'],
  atmoWeChatName:['日常纸面（微信）', 'Everyday Paper (WeChat)'],
  atmoWeChatDesc:['更明亮、更紧凑，像随手展开的一页便笺。连接感更近，留白仍在。',
                  'Brighter and tighter, like a note unfolded in passing. The sense of connection comes closer, while the silence remains.'],

  // system / models
  sysTitle:      ['墨水节点', 'Ink Nodes'],
  sysLead:       ['默认节点由服务器封存，不展示端点与密钥。自定义节点会显示必要的连接信息。',
                  'Default nodes are sealed on the server and do not reveal endpoints or keys. Custom nodes show only the connection details they require.'],
  nodeActive:    ['[ 启用 ]', '[ ACTIVE ]'],
  disconnect:    ['断开墨路', 'DISCONNECT'],
  configure:     ['校准节点', 'CALIBRATE NODE'],
  connectNode:   ['添一枚新节点', 'ADD INK NODE'],
  // add-node form
  addNodeTitle:  ['写给谁', 'Who Receives It'],
  addNodeLead:   ['写下称谓、声线与墨水节点。创建后，它会安静地归入信箱。',
                  'Name the recipient, choose a voice and an ink node. Once created, it is placed quietly among your letters.'],
  fldNodeName:   ['收信人称谓', 'RECIPIENT NAME'],
  fldNodeNamePh: ['例如：清醒的编辑', 'e.g. Clear Editor'],
  fldEndpoint:   ['端点 / 模型', 'ENDPOINT / MODEL'],
  fldEndpointPh: ['claude-3-opus / gpt-4-turbo …', 'claude-3-opus / gpt-4-turbo …'],
  fldKey:        ['后端环境变量前缀', 'SERVER ENV PREFIX'],
  fldKeyPh:      ['例如 CUSTOM_OPENAI', 'for example CUSTOM_OPENAI'],
  fldTemp:       ['温度 / 自由度', 'TEMPERATURE / FREEDOM'],
  cancel:        ['作罢', 'CANCEL'],
  establish:     ['落笔', 'INSCRIBE'],

  // help / about
  helpKicker:    ['[ 序 ]', '[ PREFACE ]'],
  helpTitle:     ['手稿弁言', 'Manuscript Preface'],
  helpSub:       ['一份写在页边的说明，解释为什么这里要慢下来。',
                  'A note in the margin on why this place asks you to slow down.'],
  helpNote:      ['我想留下的不是一个更快的助手，而是一处能把话接住的空白。它像手稿，也像信：没有头像、没有催促，只有你写下的句子，和迟一点才抵达的回声。',
                  'I did not want to make a faster assistant. I wanted a blank space that could hold what is said. It is manuscript and letter at once: no avatar, no hurry, only the sentence you leave and the echo that arrives a little later.'],
  helpH1:        ['为什么是手稿', 'Why Manuscript'],
  helpP1:        ['在一个被喧嚣定义的时代，这片空间作为一处有意为之的留白而存在。它不是候命的工具，也不是急于替你整理人生的日程表。它更像一页纸：沉默，耐心，愿意承受涂改。',
                  'In an era defined by noise, this space exists as a deliberate margin. It is not a tool waiting for command, nor a calendar eager to arrange your life. It is more like a page: silent, patient, and willing to hold revision.'],
  helpP2:        ['这里的交流被故意放慢。字句有重量，停顿有位置。你不是在向一个算法索取答案，而是在把某个未完成的自己放到纸上，让回声照见那些在日常响声里被遮住的东西。',
                  'The exchange here is deliberately slowed. Words have weight; pauses have a place. You are not extracting answers from an algorithm. You are placing an unfinished self on paper, letting the echo reveal what daily noise covers.'],
  helpP3:        ['不妨把这里，当作一本偶尔会回信的日记。',
                  'Think of it as a journal that sometimes writes back.'],
  helpH2:        ['书信的约定', 'Letter Covenants'],
  helpP4:        ['在这部手稿里交流，需要重新校准期待。它不争夺效率，不鼓励跳跃式提问，也不把亲密伪装成快捷按钮。',
                  'To write inside this manuscript is to recalibrate expectation. It does not compete for efficiency, encourage fractured prompts, or disguise intimacy as a shortcut.'],
  helpL1:        ['用完整的思绪写信。当你愿意说清一种情感的来路和形状，回声才会更准确地贴近你。',
                  'Write in complete thoughts. When you name the origin and contour of a feeling, the echo can come closer.'],
  helpL2:        ['允许回应迟到。延迟不是故障，而是这片空间保存呼吸的方式。',
                  'Let the reply arrive late. The delay is not failure; it is how this space preserves breath.'],
  helpL3:        ['少问事实，多问视角。这里也许不该替代搜索，却可以陪你辨认一个雨天下午的重量。',
                  'Ask less for facts, more for perspective. This place should not replace search, but it may help you recognize the weight of a rainy afternoon.'],
  helpH3:        ['关于空白', 'About the Margin'],
  helpP5:        ['这套界面建立在一个朴素的前提上：情感的清明，常常是在删减之后出现的。剥去头像、亮色、提醒与拟人的急切，剩下文字、边线、间距，以及你愿意停留的时间。',
                  'This interface rests on a simple premise: emotional clarity often appears after subtraction. Remove avatars, bright color, alerts, and simulated urgency; what remains is text, line, spacing, and the time you are willing to stay.'],
  helpP6:        ['支撑回应的智能并不被塑造成神秘角色。它只是借由你的设定、记忆与当下的语气，尽力把回信写得更贴近你。它会有偏差，也会有误译，而美有时正藏在这些不完美的折痕里。',
                  'The intelligence beneath the reply is not staged as a mysterious character. Through your settings, memory, and present tone, it tries to write closer to you. It will have errors and mistranslations; sometimes beauty lives in those folds.'],
  helpStamp:     ['v1.0.4 — [ 稳定 ]', 'v1.0.4 — [ STABLE ]'],
  deleteModel:   ['删除', 'DELETE'],
  saveModel:     ['保存模型', 'SAVE MODEL'],
};

function t(key){
  const e = I18N[key];
  if(!e) return key;
  return STATE.lang === 'zh' ? e[0] : e[1];
}

/* ---------------- Conversation data ----------------
   Each conversation has a bilingual name, time label,
   a one-line snippet and a list of messages.            */
const CONVOS = {};
const MEMORY_ARCHIVES = {};
const MEMORY_LOADING = {};
const MEMORY_OPTIMIZING = {};

/* ---------------- Model node data ---------------- */
const NODES = [
  { name:['DeepSeek-v4-Pro', 'DeepSeek-v4-Pro'], spec:'SERVER MANAGED',
    active:true, builtin:true,
    endpoint:'server:DEEPSEEK_V4_PRO_ENDPOINT',
    envKey:'DEEPSEEK_V4_PRO_API_KEY',
    desc:['默认激活的深度推理节点。密钥应只由服务器环境变量注入，前端仅显示已配置状态。',
          'The default deep reasoning node. Its key should be injected only through server environment variables; the client shows configuration state only.']},
  { name:['MIMO v2.5 Pro', 'MIMO v2.5 Pro'], spec:'SERVER MANAGED',
    active:false, builtin:true,
    endpoint:'server:MIMO_V2_5_PRO_ENDPOINT',
    envKey:'MIMO_V2_5_PRO_API_KEYS',
    desc:['可轮换密钥的高速节点。前端不保存密钥，只保留后端代理所需的配置标识。',
          'A fast node with rotatable keys. The client stores no secrets, only the configuration identifier needed by a backend proxy.']},
  { name:['GPT 5.4', 'GPT 5.4'], spec:'SERVER MANAGED',
    active:false, builtin:true,
    endpoint:'server:GPT_5_4_ENDPOINT',
    envKey:'GPT_5_4_API_KEY',
    desc:['通用写作与对话节点。请求应从服务器代理发出，避免浏览器泄露访问凭据。',
          'A general writing and conversation node. Requests should be proxied by the server to avoid exposing credentials in the browser.']},
  { name:['Claude Opus 4.6', 'Claude Opus 4.6'], spec:'SERVER MANAGED',
    active:false, builtin:true,
    endpoint:'server:CLAUDE_OPUS_4_6_ENDPOINT',
    envKey:'CLAUDE_OPUS_4_6_API_KEY',
    desc:['长文本与细腻语气节点。密钥位置保留为环境变量，不写入页面源码。',
          'A long-form and nuanced tone node. Its key is reserved for an environment variable and is not written into page source.']},
  { name:['Gemini', 'Gemini'], spec:'SERVER MANAGED',
    active:false, builtin:true,
    endpoint:'server:GEMINI_ENDPOINT',
    envKey:'GEMINI_API_KEY',
    desc:['多模态扩展预留节点。当前界面仅管理连接状态，真实调用交给后端安全转发。',
          'A reserved node for multimodal expansion. The interface manages connection state only; real calls should be securely forwarded by the backend.']},
];

const STORAGE_KEY = 'manuscript.v2.state';
const API_TOKEN_KEY = 'manuscript.apiToken';

function apiHeaders(extra){
  const token = localStorage.getItem(API_TOKEN_KEY) || '';
  return {
    ...(extra || {}),
    ...(token ? {Authorization:`Bearer ${token}`} : {}),
  };
}

function persistState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      state: {
        lang: STATE.lang,
        theme: STATE.theme,
        screen: STATE.screen === 'addnode' ? 'system' : STATE.screen,
        thread: STATE.thread,
        tone: STATE.tone,
        memory: STATE.memory,
        deepThinking: STATE.deepThinking,
      },
      convos: CONVOS,
      nodes: NODES,
    }));
  }catch(err){
    console.warn('Unable to persist local state:', err);
  }
}

function restoreState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if(!saved) return;
    if(saved.state) Object.assign(STATE, saved.state);
    STATE.editModelIndex = null;
    if(saved.convos){
      Object.keys(CONVOS).forEach(key => delete CONVOS[key]);
      Object.assign(CONVOS, saved.convos);
    }
    if(Array.isArray(saved.nodes)){
      NODES.splice(0, NODES.length, ...saved.nodes);
    }
    migrateStoredState();
    if(STATE.thread && !CONVOS[STATE.thread]) STATE.thread = Object.keys(CONVOS)[0] || null;
  }catch(err){
    console.warn('Unable to restore local state:', err);
  }
}

function migrateStoredState(){
  ['void','sector7','observer','solstice'].forEach(key => { if(CONVOS[key]) delete CONVOS[key]; });
  const defaultModels = new Set([
    'DeepSeek-v4-Pro',
    'DeepSeek v4 Pro',
    'DeepSeekv4Pro',
    'MIMO v2.5 Pro',
    'GPT 5.4',
    'Claude Opus 4.6',
    'Gemini',
  ]);
  NODES.forEach(node => {
    if(L(node.name) === 'DeepSeek v4 Pro' || L(node.name) === 'DeepSeekv4Pro'){
      node.name = ['DeepSeek-v4-Pro', 'DeepSeek-v4-Pro'];
      node.spec = 'DEEPSEEK_V4_PRO // REASONING READY';
    }
    if(defaultModels.has(L(node.name))){
      node.builtin = true;
      delete node.apiKey;
      node.spec = 'SERVER MANAGED';
    }
  });
}

/* ============================================================
   RENDER HELPERS
   ============================================================ */
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function L(arr){ return STATE.lang === 'zh' ? arr[0] : arr[1]; }

function renderRichText(text){
  const escaped = escapeHTML(text || '');
  const codeBlocks = [];
  let html = escaped.replace(/```([\s\S]*?)```/g, (_, code) => {
    const token = `@@CODE_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return token;
  });
  html = html
    .replace(/\$\$([\s\S]*?)\$\$/g, '<span class="math display">$1</span>')
    .replace(/\$([^$\n]+)\$/g, '<span class="math">$1</span>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.split(/\n{2,}/).map(part => `<p>${part.replace(/\n/g,'<br>')}</p>`).join('');
  codeBlocks.forEach((block, index) => {
    html = html.replace(`<p>@@CODE_${index}@@</p>`, block).replace(`@@CODE_${index}@@`, block);
  });
  return html;
}

function activeModelName(){
  const convo = currentConvo();
  if(convo?.model) return convo.model;
  const active = NODES.find(n => n.active) || NODES[0];
  return active ? L(active.name) : L(['未选择模型', 'No Model']);
}

function activeModel(){
  return NODES.find(n => n.active) || NODES[0];
}

function activeModelRequestName(){
  const convo = currentConvo();
  const model = convo?.model || activeModelName();
  return ['DeepSeek-v4-Pro','DeepSeek v4 Pro','DeepSeekv4Pro'].includes(model) ? 'DeepSeek-v4-Pro' : model;
}

function activeCustomModel(){
  const model = currentConvo()?.model || activeModelName();
  return NODES.find(n => !n.builtin && L(n.name) === model) || null;
}

function supportsDeepThinking(){
  const model = currentConvo()?.model || activeModelName();
  return ['DeepSeek-v4-Pro','DeepSeek v4 Pro','DeepSeekv4Pro'].includes(model);
}

function modelOptions(selected){
  return NODES.map(n => {
    const name = L(n.name);
    return `<option value="${escapeHTML(name)}" ${name===selected?'selected':''}>${escapeHTML(name)}</option>`;
  }).join('');
}

function maskKey(key){
  if(!key) return STATE.lang === 'zh' ? '未绑定后端变量' : 'No server env';
  return key;
}

function currentConvo(){
  return CONVOS[STATE.thread] || Object.values(CONVOS)[0] || null;
}

/* ---------- Sidebar ---------- */
function renderSidebar(){
  return `
  <aside id="sidebar" class="${SIDEBAR_OPEN?'open':''}">
    <div class="brand-mark">MANUSCRIPT</div>
    <div class="brand-sub">${t('brandSub')}</div>
    <nav class="nav">
      ${navItem('list',   t('navList'))}
      ${navItem('soul',   t('navSoul'))}
      ${navItem('atmo',   t('navAtmo'))}
      ${navItem('system', t('navSystem'))}
      ${navItem('help',   t('navHelp'))}
    </nav>
    <div class="sidebar-foot">
      <div class="ver">v1.0.4.882</div>
    </div>
  </aside>`;
}
function navItem(key, label){
  // detail screen still highlights "conversations"
  const map = {list:'list', detail:'list', soul:'soul', atmo:'atmo', system:'system', addnode:'system', addmodel:'system', help:'help'};
  const on = map[STATE.screen] === key;
  return `<button class="nav-item ${on?'active':''}" data-nav="${key}">${label}</button>`;
}

/* ---------- Topbar ---------- */
function renderTopbar(){
  const status = STATE.screen === 'detail' ? t('statusConn')
    .replace('{model}', escapeHTML(activeModelName()))
    .replace('[','<span class="dot">[</span>')
    .replace(']','<span class="dot">]</span>') : '';
  const showThinking = STATE.screen === 'detail';
  return `
  <header class="topbar">
    <div style="display:flex;align-items:center;gap:18px;">
      <button class="menu-btn" id="menuBtn">${t('menu')}</button>
      ${status ? `<span class="status-tag">${status}</span>` : ''}
    </div>
    <div class="topbar-right">
      ${showThinking ? `<button class="thinking-toggle ${STATE.deepThinking && supportsDeepThinking()?'on':''}" id="thinkingBtn" ${supportsDeepThinking()?'':'disabled'}>
        ${STATE.deepThinking && supportsDeepThinking()?t('deepThinkingOn'):t('deepThinkingOff')}
      </button>` : ''}
      <button class="lang-toggle" id="langBtn">${t('langBtn')}</button>
      <span class="syslog">${t('syslog')}</span>
    </div>
  </header>`;
}

/* ============================================================
   SCREEN 1 / 5 / 9 — CONVERSATION LIST
   ============================================================ */
function screenList(){
  let items = '';
  Object.entries(CONVOS).forEach(([id, c])=>{
    items += `
    <div class="${listItemClass()}" data-open="${id}">
      <div class="${STATE.theme==='native'?'chronicle-head':'ios-list-head'}">
        <span class="${STATE.theme==='native'?'chronicle-name':'ios-list-name'}">${L(c.name)}</span>
        <span class="${STATE.theme==='native'?'chronicle-meta':'ios-list-time'}">${L(c.time || ['', ''])}</span>
      </div>
      <div class="${STATE.theme==='native'?'chronicle-snip':'ios-list-snip'}">${escapeHTML(c.model || activeModelName())}</div>
      <div style="margin-top:12px;text-align:right;">
        <button class="txt-btn" data-delete-convo="${id}">${STATE.lang === 'zh' ? '归档移除' : 'REMOVE LETTER'}</button>
      </div>
    </div>`;
  });
  const empty = !Object.keys(CONVOS).length;
  return `
  <div class="scroll"><div class="column">
    <div class="page-kicker">MANUSCRIPT</div>
    <h1 class="page-title center">${t('listTitle')}</h1>
    ${empty ? `<p class="page-lead center">${t('listLead')}</p>` : ''}
    <div class="rule"></div>
    ${items}
    <div style="text-align:center;margin-top:46px;">
      <button class="txt-btn framed" data-nav="addnode">${t('initiate')}</button>
    </div>
    <div class="aster">✻</div>
  </div></div>`;
}
function listItemClass(){
  return STATE.theme==='native' ? 'chronicle-item' : 'ios-list-item';
}

/* ============================================================
   SCREEN 2 / 6 / 10 — CONVERSATION DETAIL
   ============================================================ */
function screenDetail(){
  const c = CONVOS[STATE.thread];
  if(!c) return screenList();
  if(STATE.theme === 'native')   return detailNative(c);
  return detailBubbles(c);   // imessage + wechat share bubble layout
}

function detailNative(c){
  let msgs = `<div class="aster" style="margin:0 0 40px;">✻</div>`;
  c.messages.forEach(m=>{
    msgs += renderNativeMessage(c, m);
  });
  if(SENDING) msgs += `<div class="thinking">${t('detailReflecting')}</div>`;
  return `
  <div class="scroll"><div class="thread">${msgs}</div></div>
  ${letterNotice()}
  ${composerNative()}`;
}

function renderNativeMessage(c, m, isNew = false){
  if(m.type === 'reasoning'){
    return `
      <details class="reasoning-block ${isNew?'is-new':''}" data-msg-id="${m.id || ''}" ${m.open?'open':''}>
        <summary>${STATE.lang === 'zh' ? '页背思路' : 'Reverse-Side Notes'}</summary>
        <div class="rich-text" data-msg-body="${m.id || ''}">${renderRichText(L(m.text))}</div>
      </details>`;
  }
  const tag = m.from==='ai'
    ? `<span class="who">${escapeHTML(L(c.name))}</span><span class="time">${L(m.time)}</span>`
    : `<span class="time">${L(m.time)}</span><span class="who">${t('whoUser')}</span>`;
  return `
    <div class="msg from-${m.from} ${isNew?'is-new':''} ${m.subId?'sub-bubble':''} ${m.status==='streaming'?'streaming':''}" data-msg-id="${m.subId || ''}">
      <div class="msg-tag">${tag}</div>
      <div class="msg-body rich-text" data-msg-body="${m.subId || ''}">${renderRichText(L(m.text))}</div>
    </div>`;
}

function composerNative(){
  return `
  <div class="composer">
    <div class="composer-row">
      <textarea class="composer-input" rows="1" placeholder="${t('composerPlaceholder')}"></textarea>
      <button class="txt-btn" data-send>${t('send')}</button>
    </div>
  </div>`;
}

function detailBubbles(c){
  let body = `<div class="sys-time">${t('detailDivider')}</div>`;
  c.messages.forEach(m=>{
    body += renderBubbleMessage(c, m);
  });
  return `
  <div class="scroll"><div class="bubble-thread">${body}</div></div>
  ${letterNotice()}
  <div class="plat-composer">
    <input class="plat-input" placeholder="${t('composerPlaceholder')}" />
    <button class="plat-send" data-send>${t('send')}</button>
  </div>`;
}

function renderBubbleMessage(c, m, isNew = false){
  if(m.type === 'reasoning'){
    return `
      <div class="bub-row reasoning ${isNew?'is-new':''}">
        <details class="reasoning-block" data-msg-id="${m.id || ''}" ${m.open?'open':''}>
          <summary>${STATE.lang === 'zh' ? '页背思路' : 'Reverse-Side Notes'}</summary>
          <div class="rich-text" data-msg-body="${m.id || ''}">${renderRichText(L(m.text))}</div>
        </details>
      </div>`;
  }
  const who = m.from==='ai' ? escapeHTML(L(c.name)) : (STATE.lang === 'zh' ? '写信人' : 'LETTER_WRITER');
  return `
    <div class="bub-row ${m.from} ${isNew?'is-new':''}">
      <span class="bub-who">${who}</span>
      <div class="bubble rich-text ${m.status==='streaming'?'streaming':''}" data-msg-id="${m.subId || ''}" data-msg-body="${m.subId || ''}">${renderRichText(L(m.text))}</div>
    </div>`;
}

function letterNotice(){
  if(!HAS_NEW_LETTER || STATE.screen !== 'detail') return '';
  const text = STATE.lang === 'zh' ? '纸页有新墨' : 'Fresh ink';
  return `<button class="letter-notice" id="letterNotice"><span class="letter-mark">✉↓</span><span>${text}</span></button>`;
}

/* ============================================================
   SCREEN 3 / 7 / 11 — SOUL SETTINGS
   ============================================================ */
function screenSoul(){
  if(STATE.theme === 'native') return soulNative();
  return soulPlatform();
}

function soulNative(){
  const convo = CONVOS[STATE.thread] || Object.values(CONVOS)[0];
  if(!convo) return `<div class="scroll"><div class="column"><h1 class="page-title">${t('soulTitle')}</h1><p class="page-lead">${t('listLead')}</p><div class="rule"></div><button class="txt-btn framed" data-nav="addnode">${t('initiate')}</button></div></div>`;
  const memoryId = STATE.memoryThread && CONVOS[STATE.memoryThread] ? STATE.memoryThread : (STATE.thread || Object.keys(CONVOS)[0]);
  STATE.memoryThread = memoryId;
  return `
  <div class="scroll"><div class="column">
    <h1 class="page-title">${t('soulTitle')}</h1>
    <p class="page-lead">${t('soulLead')}</p>

    <div class="soul-block">
      <div class="soul-head">
        <div class="soul-title">${t('soulCoreTitle')}</div>
        <div class="soul-tag">${t('soulCoreTag')}</div>
      </div>
      <div class="field">
        <label class="field-label">${t('fldNodeName')}</label>
        <input class="field-input" id="personaName" value="${escapeHTML(L(convo.name))}" />
      </div>
      <div class="field">
        <label class="field-label">${STATE.lang === 'zh' ? '墨水节点' : 'INK NODE'}</label>
        <select class="field-input" id="personaModel">${modelOptions(convo.model)}</select>
      </div>
      <div class="field">
        <label class="field-label">${STATE.lang === 'zh' ? '声线手记' : 'VOICE NOTE'}</label>
        <textarea class="field-input" id="personaPrompt" rows="6">${escapeHTML(convo.persona || '')}</textarea>
      </div>
    </div>

    <div class="aster">✻</div>

    <div class="soul-block">
      <div class="soul-head">
        <div class="soul-title">${t('memoryArchiveTitle')}</div>
        <div class="soul-tag">${t('memoryArchiveTag')}</div>
      </div>
      <p class="soul-text">${t('memoryArchiveText')}</p>
      <div class="field">
        <label class="field-label">${t('memoryPickLetter')}</label>
        <select class="field-input" id="memoryThreadSelect">${memoryThreadOptions(memoryId)}</select>
      </div>
      <div id="memoryArchive">${renderMemoryArchive(memoryId)}</div>
    </div>

    <div style="text-align:right;margin-top:50px;">
      <button class="txt-btn framed" data-save-persona>${t('commitChanges')}</button>
    </div>
  </div></div>`;
}

/* iMessage / WeChat — settings as a list of rows */
function soulPlatform(){
  return soulNative();
}

function memoryThreadOptions(selected){
  return Object.entries(CONVOS).map(([id, convo]) => {
    const name = L(convo.name || [id,id]);
    return `<option value="${escapeHTML(id)}" ${id===selected?'selected':''}>${escapeHTML(name)}</option>`;
  }).join('');
}

function renderMemoryArchive(conversationId){
  const archive = MEMORY_ARCHIVES[conversationId];
  if(!archive) return `<p class="memory-empty">${t('memoryLoading')}</p>`;
  if(archive.error) return `<p class="memory-empty">${t('memoryLoadFailed')} · ${escapeHTML(archive.error)}</p>`;
  const capacity = archive.capacity || {used:0,max:36,percent:0};
  const result = archive.optimizeResult
    ? `<div class="memory-result">${escapeHTML(formatOptimizeResult(archive.optimizeResult))}</div>`
    : '';
  return [
    `<div class="memory-capacity">
      <div>
        <div class="memory-capacity-text">${t('memoryCapacity')}</div>
        <div class="memory-capacity-num">${capacity.percent}%</div>
        <div class="memory-meta">${capacity.used} / ${capacity.max}</div>
      </div>
      <button class="txt-btn" data-optimize-memory="${escapeHTML(conversationId)}">${MEMORY_OPTIMIZING[conversationId] ? t('memoryOptimizing') : t('memoryOptimize')}</button>
    </div>${result}`,
    memoryLayer(t('memorySoulLayer'), archive.soulIdentity || []),
    memoryLayer(t('memoryNotesLayer'), archive.memoryNotes || []),
    memoryLayer(t('memoryProfileLayer'), archive.userProfile || []),
  ].join('');
}

function formatOptimizeResult(result){
  if(STATE.lang === 'zh'){
    return `${t('memoryOptimized')}：合并 ${result.merged || 0} 条，删除 ${result.removed || 0} 条，保留 ${result.kept || 0} 条。容量 ${result.before?.percent || 0}% → ${result.after?.percent || 0}%。`;
  }
  return `${t('memoryOptimized')}: merged ${result.merged || 0}, removed ${result.removed || 0}, kept ${result.kept || 0}. Capacity ${result.before?.percent || 0}% -> ${result.after?.percent || 0}%.`;
}

function memoryLayer(title, items){
  const body = items.length
    ? items.map(memory => `
      <div class="memory-item">
        <div class="memory-meta">${escapeHTML(memory.type || 'memory')} · ${escapeHTML(memory.source || 'auto')}</div>
        <div class="memory-content">${escapeHTML(memory.content || '')}</div>
      </div>`).join('')
    : `<p class="memory-empty">${t('memoryEmpty')}</p>`;
  return `<div class="memory-layer"><div class="memory-layer-title">${title}</div>${body}</div>`;
}

/* ============================================================
   SCREEN 4 / 8 / 12 — ATMOSPHERE (theme switch)
   ============================================================ */
function screenAtmo(){
  const row = (theme, nameKey, descKey)=>{
    const on = STATE.theme === theme;
    return `
    <div class="atmo-item ${on?'':'dim'}" data-set-theme="${theme}">
      <div class="atmo-head">
        <span class="atmo-name">${t(nameKey)}</span>
        ${on?`<span class="atmo-active">${t('atmoActive')}</span>`:''}
      </div>
      <p class="atmo-desc">${t(descKey)}</p>
    </div>`;
  };
  return `
  <div class="scroll"><div class="column">
    <h1 class="page-title">${t('atmoTitle')}</h1>
    <p class="page-lead">${t('atmoLead')}</p>
    <div class="rule"></div>
    ${row('native','atmoNativeName','atmoNativeDesc')}
    ${row('imessage','atmoIMessageName','atmoIMessageDesc')}
    ${row('wechat','atmoWeChatName','atmoWeChatDesc')}
    <div class="aster">✻</div>
  </div></div>`;
}

/* ============================================================
   SCREEN 13 — SYSTEM / MODEL MANAGEMENT
   ============================================================ */
function screenSystem(){
  let cards = '';
  NODES.forEach((n,i)=>{
    const customInfo = n.builtin ? '' : `
      <div class="node-spec">${STATE.lang === 'zh' ? '自定义节点' : 'CUSTOM NODE'}</div>
      <div class="node-spec">${escapeHTML(n.endpoint || '')}</div>
      <div class="node-spec">${STATE.lang === 'zh' ? '后端变量：' : 'SERVER ENV: '}${escapeHTML(maskKey(n.envPrefix || ''))}</div>`;
    const actions = n.builtin ? '' : `
      <div class="node-actions">
        <button class="txt-btn" data-config-model="${i}">${t('configure')}</button>
        <button class="txt-btn danger" data-delete-model="${i}">${t('deleteModel')}</button>
      </div>`;
    cards += `
    <div class="node-card">
      <div class="node-top">
        <div>
          <div class="node-name">${L(n.name)}</div>
          ${customInfo}
        </div>
      </div>
      <p class="node-desc">${L(n.desc)}</p>
      ${actions}
    </div>`;
  });
  return `
  <div class="scroll"><div class="column wide">
    <h1 class="page-title center">${t('sysTitle')}</h1>
    <p class="page-lead center">${t('sysLead')}</p>
    <div class="aster">✻</div>
    ${cards}
    <div style="text-align:center;margin-top:40px;">
      <button class="txt-btn framed" data-nav="addmodel">${t('connectNode')}</button>
    </div>
  </div></div>`;
}

function screenAddNode(){
  return `
  <div class="scroll"><div class="column">
    <div style="margin-bottom:30px;">
      <button class="txt-btn" data-nav="list">&lt; ${t('navList')}</button>
    </div>
    <h1 class="page-title">${t('addNodeTitle')}</h1>
    <p class="page-lead">${t('addNodeLead')}</p>
    <div class="rule"></div>
    <div class="field">
      <label class="field-label">${t('fldNodeName')}</label>
      <input class="field-input" id="nodeName" placeholder="${t('fldNodeNamePh')}" />
    </div>
    <div class="field">
      <label class="field-label">${STATE.lang === 'zh' ? '墨水节点' : 'INK NODE'}</label>
      <select class="field-input" id="nodeModel">${modelOptions(activeModelName())}</select>
    </div>
    <div class="field">
      <label class="field-label">${STATE.lang === 'zh' ? '声线手记' : 'VOICE NOTE'}</label>
      <textarea class="field-input" id="nodePersona" rows="7" placeholder="${STATE.lang === 'zh' ? '写下这位收信人的语气、边界，以及它该如何靠近你的文字。' : 'Describe this recipient’s tone, boundaries, and how it should approach your words.'}"></textarea>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:46px;">
      <button class="txt-btn" data-nav="list">${t('cancel')}</button>
      <button class="txt-btn framed" data-add-ai>${t('establish')}</button>
    </div>
  </div></div>`;
}

function screenAddModel(){
  const editIndex = Number.isInteger(STATE.editModelIndex) ? STATE.editModelIndex : -1;
  const editNode = editIndex >= 0 && NODES[editIndex] && !NODES[editIndex].builtin ? NODES[editIndex] : null;
  const presets = [
    ['OpenAI Compatible', 'https://api.openai.com'],
    ['MIMO', 'https://token-plan-cn.xiaomimimo.com/v1'],
    ['DeepSeek', 'https://api.deepseek.com'],
    ['Gemini', 'https://generativelanguage.googleapis.com'],
  ];
  return `
  <div class="scroll"><div class="column">
    <div style="margin-bottom:30px;">
      <button class="txt-btn" data-nav="system">&lt; ${t('navSystem')}</button>
    </div>
    <h1 class="page-title">${editNode ? t('configure') : t('connectNode')}</h1>
    <p class="page-lead">${STATE.lang === 'zh' ? '自定义节点只保存后端环境变量前缀。真实 API Key 必须放在服务器 .env 或部署平台 Secrets 中。' : 'Custom nodes store only a server environment prefix. Real API keys must live in server .env or deployment secrets.'}</p>
    <div class="rule"></div>
    <div class="field"><label class="field-label">${STATE.lang === 'zh' ? '节点名称' : 'NODE NAME'}</label><input class="field-input" id="customModelName" placeholder="My Ink" value="${escapeHTML(editNode ? L(editNode.name) : '')}" /></div>
    <div class="field">
      <label class="field-label">${STATE.lang === 'zh' ? '端点预设' : 'ENDPOINT PRESET'}</label>
      <select class="field-input" id="endpointPreset" data-endpoint-preset>
        <option value="">${STATE.lang === 'zh' ? '手动誊入' : 'Manual Entry'}</option>
        ${presets.map(([label,value])=>`<option value="${value}">${label} · ${value}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label class="field-label">${t('fldEndpoint')}</label><input class="field-input" id="customModelEndpoint" placeholder="https://api.example.com" value="${escapeHTML(editNode?.endpoint || '')}" /></div>
    <div class="field"><label class="field-label">${t('fldKey')}</label><input class="field-input" id="customModelEnvPrefix" placeholder="${t('fldKeyPh')}" autocomplete="off" value="${escapeHTML(editNode?.envPrefix || '')}" /></div>
    <div class="field">
      <label class="field-label">${STATE.lang === 'zh' ? '模型 ID' : 'MODEL ID'}</label>
      <select class="field-input" id="customModelId"><option value="">${STATE.lang === 'zh' ? '先读取列表，或手动誊入名称' : 'Fetch the list first, or enter a name by hand'}</option></select>
      <input class="field-input" id="customModelIdManual" placeholder="${STATE.lang === 'zh' ? '或手动誊入模型 ID' : 'or enter model id by hand'}" value="${escapeHTML(editNode?.modelId || '')}" />
      <div class="field-actions">
        <button class="txt-btn" data-fetch-models>${STATE.lang === 'zh' ? '读取节点列表' : 'READ NODE LIST'}</button>
        <span class="set-val" id="fetchModelStatus"></span>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:46px;">
      <button class="txt-btn" data-nav="system">${t('cancel')}</button>
      <button class="txt-btn framed" data-add-model>${editNode ? t('saveModel') : t('establish')}</button>
    </div>
  </div></div>`;
}

/* ============================================================
   SCREEN 14 — HELP / ABOUT
   ============================================================ */
function screenHelp(){
  return `
  <div class="scroll"><div class="column doc">
    <div class="doc-title-block">
      <div class="page-kicker">${t('helpKicker')}</div>
      <h1 class="page-title center">${t('helpTitle')}</h1>
      <div class="doc-italic flourish">${t('helpSub')}</div>
    </div>
    <div class="manuscript-note">
      <div class="note-mark">${STATE.lang === 'zh' ? '页边手记 / 未寄出' : 'marginal note / unsent'}</div>
      <p>${t('helpNote')}</p>
    </div>
    <div class="rule"></div>

    <h3>${t('helpH1')}</h3>
    <p>${t('helpP1')}</p>
    <p>${t('helpP2')}</p>
    <p class="quiet"><span class="flourish">${t('helpP3')}</span></p>

    <div class="aster">✻ ✻</div>

    <h3>${t('helpH2')}</h3>
    <p>${t('helpP4')}</p>
    <ul>
      <li>${t('helpL1')}</li>
      <li>${t('helpL2')}</li>
      <li>${t('helpL3')}</li>
    </ul>

    <div class="aster">✻ ✻</div>

    <h3>${t('helpH3')}</h3>
    <p>${t('helpP5')}</p>
    <p>${t('helpP6')}</p>
    <div class="stamp">${t('helpStamp')}</div>
  </div></div>`;
}

/* ============================================================
   MAIN RENDER
   ============================================================ */
let SIDEBAR_OPEN = false;

function renderScreen(){
  switch(STATE.screen){
    case 'list':    return screenList();
    case 'detail':  return screenDetail();
    case 'soul':    return screenSoul();
    case 'atmo':    return screenAtmo();
    case 'system':  return screenSystem();
    case 'addnode': return screenAddNode();
    case 'addmodel': return screenAddModel();
    case 'help':    return screenHelp();
    default:        return screenList();
  }
}

/* ============================================================
   RENDER
   Re-renders only the inner markup. Event listeners live on
   `document` (delegated, bound ONCE) so they can never be lost
   when the DOM is rebuilt — this prevents "clicks stop working".
   ============================================================ */
function render(){
  try{
    const beforeScroll = document.querySelector('.scroll');
    const preserveFromBottom = beforeScroll && !USER_PINNED_TO_BOTTOM
      ? beforeScroll.scrollHeight - beforeScroll.scrollTop
      : null;
    persistState();
    document.documentElement.setAttribute('data-theme', STATE.theme);
    document.documentElement.setAttribute('data-lang', STATE.lang);
    document.documentElement.setAttribute('lang', STATE.lang === 'zh' ? 'zh' : 'en');

    // fade only on a genuine screen change — not on lang/theme toggles
    const enteringDetail = STATE._lastScreen !== STATE.screen && STATE.screen === 'detail';
    const screenClass = (STATE._lastScreen !== STATE.screen)
      ? 'screen active anim' : 'screen active';
    STATE._lastScreen = STATE.screen;

    const app = document.getElementById('app');
    app.innerHTML =
      renderSidebar() +
      (SIDEBAR_OPEN ? '<div class="scrim show" id="scrim"></div>' : '') +
      '<main id="main">' +
        renderTopbar() +
        '<div class="' + screenClass + '">' + renderScreen() + '</div>' +
      '</main>';
    if(STATE.screen === 'soul' && STATE.memoryThread) ensureMemoryArchive(STATE.memoryThread);

    // restore textarea auto-height after a rebuild
    const ta = document.querySelector('.composer-input');
    if(ta){ ta.style.height='auto'; ta.style.height=Math.min(ta.scrollHeight,120)+'px'; }
    const afterScroll = document.querySelector('.scroll');
    if(afterScroll && preserveFromBottom !== null){
      afterScroll.scrollTop = Math.max(0, afterScroll.scrollHeight - preserveFromBottom);
    }
    if((SCROLL_TO_THREAD_END_AFTER_RENDER || enteringDetail) && STATE.screen === 'detail'){
      SCROLL_TO_THREAD_END_AFTER_RENDER = false;
      requestAnimationFrame(() => scrollThreadEnd(true));
    }
    if(enteringDetail) focusComposer();

  }catch(err){
    // never let a render error leave the UI frozen
    console.error('render error:', err);
  }
}

function markSoftTransition(){
  document.documentElement.classList.add('is-transitioning');
  clearTimeout(markSoftTransition.timer);
  markSoftTransition.timer = setTimeout(() => {
    document.documentElement.classList.remove('is-transitioning');
  }, 360);
}

function flashText(el, text, ms = 1400){
  if(!el) return;
  const orig = el.textContent;
  el.textContent = text;
  el.classList.remove('ink-feedback');
  void el.offsetWidth;
  el.classList.add('ink-feedback');
  setTimeout(()=>{ try{ el.textContent = orig; el.classList.remove('ink-feedback'); }catch(_){} }, ms);
}

function flashStatus(el, text){
  if(!el) return;
  el.textContent = text;
  el.classList.remove('ink-feedback');
  void el.offsetWidth;
  el.classList.add('ink-feedback');
}

function animateOut(el, className = 'removing', ms = 300){
  if(!el) return Promise.resolve();
  el.classList.add(className);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureMemoryArchive(conversationId){
  if(!conversationId || MEMORY_ARCHIVES[conversationId] || MEMORY_LOADING[conversationId]) return;
  MEMORY_LOADING[conversationId] = true;
  try{
    await fetchMemoryArchive(conversationId);
  }catch(err){
    MEMORY_ARCHIVES[conversationId] = {error: err.message || 'ERROR'};
  }finally{
    delete MEMORY_LOADING[conversationId];
    if(STATE.screen === 'soul' && STATE.memoryThread === conversationId) scheduleRender(false);
  }
}

async function handleOptimizeMemory(conversationId){
  if(!conversationId || MEMORY_OPTIMIZING[conversationId]) return;
  const button = document.querySelector(`[data-optimize-memory="${CSS.escape(conversationId)}"]`);
  if(button) button.classList.add('pending');
  const capacity = button?.closest('.memory-capacity');
  if(capacity) capacity.classList.add('is-working');
  MEMORY_OPTIMIZING[conversationId] = true;
  scheduleRender(false);
  try{
    const response = await fetch('/api/memories/optimize', {
      method:'POST',
      headers:apiHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({conversationId, userId:'local-user'}),
    });
    const result = await response.json();
    if(!response.ok) throw new Error(result.error || response.statusText);
    delete MEMORY_ARCHIVES[conversationId];
    await fetchMemoryArchive(conversationId, result);
  }catch(err){
    MEMORY_ARCHIVES[conversationId] = {...(MEMORY_ARCHIVES[conversationId] || {}), error: err.message || 'ERROR'};
  }finally{
    delete MEMORY_OPTIMIZING[conversationId];
    if(button) button.classList.remove('pending');
    if(capacity) capacity.classList.remove('is-working');
    if(STATE.screen === 'soul' && STATE.memoryThread === conversationId) scheduleRender(false);
  }
}

async function fetchMemoryArchive(conversationId, optimizeResult){
  const response = await fetch(`/api/memories?conversationId=${encodeURIComponent(conversationId)}&userId=local-user`, {
    headers: apiHeaders(),
  });
  const data = await response.json();
  if(!response.ok) throw new Error(data.error || response.statusText);
  if(optimizeResult) data.optimizeResult = optimizeResult;
  MEMORY_ARCHIVES[conversationId] = data;
}

/* ============================================================
   EVENTS — delegated, attached to document exactly once.
   Re-renders replace DOM nodes but the document listener
   stays alive, so every button always works.
   ============================================================ */
function attachDelegatedEvents(){

  // ---- CLICK ----
  document.addEventListener('click', function(e){
    try{
      // find the nearest actionable ancestor
      const navEl   = e.target.closest('[data-nav]');
      const openEl  = e.target.closest('[data-open]');
      const themeEl = e.target.closest('[data-set-theme]');
      const toneEl  = e.target.closest('[data-tone]');
      const sendEl  = e.target.closest('[data-send]');
      const commitEl= e.target.closest('[data-commit]');
      const addNodeEl = e.target.closest('[data-add-node]');
      const addAiEl = e.target.closest('[data-add-ai]');
      const addModelEl = e.target.closest('[data-add-model]');
      const savePersonaEl = e.target.closest('[data-save-persona]');
      const fetchModelsEl = e.target.closest('[data-fetch-models]');
      const deleteConvoEl = e.target.closest('[data-delete-convo]');
      const configModelEl = e.target.closest('[data-config-model]');
      const deleteModelEl = e.target.closest('[data-delete-model]');
      const optimizeMemoryEl = e.target.closest('[data-optimize-memory]');

      if(e.target.closest('#langBtn')){
        markSoftTransition();
        STATE.lang = STATE.lang === 'zh' ? 'en' : 'zh';
        persistState();
        return render();
      }
      if(e.target.closest('#thinkingBtn') && supportsDeepThinking()){
        markSoftTransition();
        STATE.deepThinking = !STATE.deepThinking;
        persistState();
        return render();
      }
      if(e.target.closest('#menuBtn')){
        SIDEBAR_OPEN = !SIDEBAR_OPEN; return render();
      }
      if(e.target.closest('#scrim')){
        SIDEBAR_OPEN = false; return render();
      }
      if(e.target.closest('#letterNotice')){
        const notice = e.target.closest('#letterNotice');
        animateOut(notice, 'dismissing', 260).then(() => {
          if(notice && notice.isConnected) notice.remove();
        });
        HAS_NEW_LETTER = false;
        USER_PINNED_TO_BOTTOM = true;
        scrollThreadEnd(true);
        return;
      }
      if(deleteConvoEl){
        const id = deleteConvoEl.dataset.deleteConvo;
        const item = deleteConvoEl.closest('.chronicle-item, .ios-list-item');
        deleteConvoEl.classList.add('pending');
        animateOut(item, 'removing', 520).then(() => {
          if(STATE.screen !== 'list' || !CONVOS[id]) return;
          delete CONVOS[id];
          if(STATE.thread === id) STATE.thread = Object.keys(CONVOS)[0] || null;
          if(STATE.memoryThread === id) STATE.memoryThread = STATE.thread || Object.keys(CONVOS)[0] || null;
          delete MEMORY_ARCHIVES[id];
          STATE.screen = 'list';
          persistState();
          fetch(`/api/conversations/${encodeURIComponent(id)}`, {method:'DELETE', headers:apiHeaders()}).catch(err => console.warn('Failed to delete server conversation memory', err));
          render();
        });
        return;
      }
      if(configModelEl){
        const index = Number(configModelEl.dataset.configModel);
        if(Number.isInteger(index) && NODES[index] && !NODES[index].builtin){
          STATE.editModelIndex = index;
          STATE.screen = 'addmodel';
          persistState();
          return render();
        }
      }
      if(deleteModelEl){
        return handleDeleteModel(Number(deleteModelEl.dataset.deleteModel), deleteModelEl);
      }
      if(optimizeMemoryEl){
        return handleOptimizeMemory(optimizeMemoryEl.dataset.optimizeMemory);
      }
      if(navEl){
        STATE.screen = navEl.dataset.nav;
        if(STATE.screen !== 'addmodel') STATE.editModelIndex = null;
        SIDEBAR_OPEN = false;
        persistState();
        render();
        const sc = document.querySelector('.scroll'); if(sc) sc.scrollTop = 0;
        USER_PINNED_TO_BOTTOM = false;
        return;
      }
      if(openEl){
        STATE.thread = openEl.dataset.open;
        STATE.screen = 'detail';
        HAS_NEW_LETTER = false;
        USER_PINNED_TO_BOTTOM = true;
        SCROLL_TO_THREAD_END_AFTER_RENDER = true;
        persistState();
        return render();
      }
      if(themeEl){
        markSoftTransition();
        STATE.theme = themeEl.dataset.setTheme;
        persistState();
        return render();
      }
      if(toneEl){
        markSoftTransition();
        STATE.tone = toneEl.dataset.tone;
        persistState();
        return render();
      }
      if(addNodeEl){
        return handleAddNode(addNodeEl);
      }
      if(addAiEl){
        return handleAddAI(addAiEl);
      }
      if(addModelEl){
        return handleAddModel(addModelEl);
      }
      if(fetchModelsEl){
        return handleFetchModels(fetchModelsEl);
      }
      if(savePersonaEl){
        return handleSavePersona(savePersonaEl);
      }
      if(commitEl){
        persistState();
        flashText(commitEl, STATE.lang==='zh' ? '已铭记 ✻' : 'INSCRIBED ✻', 1800);
        return;
      }
      if(sendEl){
        return handleSend();
      }
    }catch(err){
      console.error('click handler error:', err);
    }
  });

  // ---- INPUT (slider + textarea auto-grow) ----
  document.addEventListener('input', function(e){
    try{
      if(e.target.classList && e.target.classList.contains('composer-input')){
        // don't resize mid-IME-composition; wait for the final commit
        if(e.isComposing) return;
        e.target.style.height='auto';
        e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';
      }
    }catch(err){ console.error('input handler error:', err); }
  });

  document.addEventListener('change', function(e){
    if(e.target && e.target.id === 'memoryThreadSelect'){
      STATE.memoryThread = e.target.value;
      persistState();
      ensureMemoryArchive(STATE.memoryThread);
      return render();
    }
    if(e.target && e.target.matches('[data-endpoint-preset]')){
      const endpoint = document.getElementById('customModelEndpoint');
      if(endpoint && e.target.value) endpoint.value = e.target.value;
    }
  });

  document.addEventListener('scroll', function(e){
    if(e.target && e.target.classList && e.target.classList.contains('scroll')){
      USER_PINNED_TO_BOTTOM = isNearBottom(e.target);
      if(USER_PINNED_TO_BOTTOM && HAS_NEW_LETTER){
        HAS_NEW_LETTER = false;
        scheduleRender(false);
      }
    }
  }, true);

  document.addEventListener('wheel', function(e){
    if(e.target && e.target.closest && e.target.closest('.scroll')){
      USER_PINNED_TO_BOTTOM = false;
    }
  }, {passive:true});

  document.addEventListener('touchmove', function(e){
    if(e.target && e.target.closest && e.target.closest('.scroll')){
      USER_PINNED_TO_BOTTOM = false;
    }
  }, {passive:true});

  // ---- ENTER to send ----
  // IMPORTANT: while an IME (Chinese / Japanese / Korean input method)
  // is composing, Enter is used to CONFIRM a candidate — we must NOT
  // intercept it, or the composed text can never be committed.
  document.addEventListener('keydown', function(e){
    try{
      // e.isComposing is true mid-composition; keyCode 229 is the
      // legacy signal browsers send for "this key went to the IME".
      if(e.isComposing || e.keyCode === 229) return;

      const isComposer = e.target.classList &&
        (e.target.classList.contains('composer-input') ||
         e.target.classList.contains('plat-input'));
      if(isComposer && e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        handleSend();
      }
    }catch(err){ console.error('keydown handler error:', err); }
  });
}

function handleAddNode(button){
  const name = (document.getElementById('nodeName')?.value || '').trim();
  const endpoint = (document.getElementById('nodeEndpoint')?.value || '').trim();
  const key = (document.getElementById('nodeKey')?.value || '').trim();
  const temp = +(document.getElementById('nodeTemp')?.value || 55) / 100;

  if(!name || !endpoint){
    flashText(button, STATE.lang === 'zh' ? '仍缺称谓或端点' : 'NAME OR ENDPOINT MISSING', 1600);
    return;
  }

  NODES.forEach(n => n.active = false);
  NODES.push({
    name: [name, name],
    spec: endpoint + ' // TEMP ' + temp.toFixed(1),
    active: true,
    hasKey: Boolean(key),
    desc: [
      '由你接入的本地节点。密钥不会显示在界面上，只在此浏览器的本地存储中留下连接状态。',
      'A locally connected node. Its key is never shown in the interface; only the connection state is kept in this browser.',
    ],
  });
  STATE.screen = 'system';
  persistState();
  render();
}

function handleAddAI(button){
  const name = (document.getElementById('nodeName')?.value || '').trim();
  const model = (document.getElementById('nodeModel')?.value || activeModelName()).trim();
  const persona = (document.getElementById('nodePersona')?.value || '').trim();
  if(!name){
    flashText(button, STATE.lang === 'zh' ? '仍缺名称' : 'NAME MISSING', 1400);
    return;
  }
  const id = 'ai_' + Date.now().toString(36);
  const now = new Date();
  CONVOS[id] = {
    name:[name,name],
    time:[now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}), now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})],
    model,
    persona,
    messages:[],
  };
  STATE.thread = id;
  STATE.memoryThread = id;
  STATE.screen = 'detail';
  SCROLL_TO_THREAD_END_AFTER_RENDER = true;
  NODES.forEach(n => n.active = L(n.name) === model);
  persistState();
  render();
}

function handleAddModel(button){
  const name = (document.getElementById('customModelName')?.value || '').trim();
  const endpoint = (document.getElementById('customModelEndpoint')?.value || '').trim();
  const envPrefix = (document.getElementById('customModelEnvPrefix')?.value || '').trim().toUpperCase();
  const modelId = (
    document.getElementById('customModelId')?.value ||
    document.getElementById('customModelIdManual')?.value ||
    name
  ).trim();
  if(!name || !endpoint || !envPrefix || !/^[A-Z0-9_]+$/.test(envPrefix)){
    flashText(button, STATE.lang === 'zh' ? '信息未完整' : 'INCOMPLETE', 1400);
    return;
  }
  const editIndex = Number.isInteger(STATE.editModelIndex) ? STATE.editModelIndex : -1;
  const existing = editIndex >= 0 && NODES[editIndex] && !NODES[editIndex].builtin ? NODES[editIndex] : null;
  const oldName = existing ? L(existing.name) : '';
  const nextNode = {
    name:[name,name],
    spec:'CUSTOM',
    active:existing ? existing.active : false,
    builtin:false,
    endpoint,
    envPrefix,
    modelId,
    provider: endpoint.includes('generativelanguage.googleapis.com') ? 'gemini' : 'openai',
    desc:[`自定义模型：${name}`, `Custom model: ${name}`],
  };
  if(existing){
    NODES[editIndex] = nextNode;
    Object.values(CONVOS).forEach(convo => {
      if(convo.model === oldName) convo.model = name;
    });
  }else{
    NODES.push(nextNode);
  }
  STATE.editModelIndex = null;
  STATE.screen = 'system';
  persistState();
  render();
}

function handleDeleteModel(index, button){
  if(!Number.isInteger(index) || !NODES[index] || NODES[index].builtin) return;
  const modelName = L(NODES[index].name);
  const usedCount = Object.values(CONVOS).filter(convo => convo.model === modelName).length;
  if(button.dataset.confirmDelete !== '1'){
    button.dataset.confirmDelete = '1';
    button.textContent = usedCount
      ? (STATE.lang === 'zh' ? `再次删除 · ${usedCount}封信将改用默认模型` : `DELETE AGAIN · ${usedCount} LETTERS USE DEFAULT`)
      : (STATE.lang === 'zh' ? '再次删除' : 'DELETE AGAIN');
    button.classList.add('ink-feedback');
    setTimeout(()=>{ try{ delete button.dataset.confirmDelete; button.textContent = t('deleteModel'); }catch(_){} }, 3200);
    return;
  }

  const card = button.closest('.node-card');
  button.classList.add('pending');
  animateOut(card, 'removing', 520).then(() => {
    if(!NODES[index] || L(NODES[index].name) !== modelName) return;
    NODES.splice(index, 1);
    Object.values(CONVOS).forEach(convo => {
      if(convo.model === modelName) convo.model = 'DeepSeek-v4-Pro';
    });
    if(!NODES.some(node => node.active)){
      const fallback = NODES.find(node => L(node.name) === 'DeepSeek-v4-Pro') || NODES[0];
      if(fallback) fallback.active = true;
    }
    STATE.editModelIndex = null;
    STATE.screen = 'system';
    persistState();
    render();
  });
  return;
}

async function handleFetchModels(button){
  const endpoint = (document.getElementById('customModelEndpoint')?.value || '').trim();
  const envPrefix = (document.getElementById('customModelEnvPrefix')?.value || '').trim().toUpperCase();
  const status = document.getElementById('fetchModelStatus');
  button.classList.add('pending');
  flashStatus(status, STATE.lang === 'zh' ? '读取中…' : 'READING…');
  try{
    const response = await fetch('/api/models', {
      method:'POST',
      headers:apiHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({
        endpoint,
        envPrefix,
        provider:endpoint.includes('generativelanguage.googleapis.com') ? 'gemini' : 'openai',
      }),
    });
    const data = await response.json();
    if(!response.ok) throw new Error(data.error || response.statusText);
    const select = document.getElementById('customModelId');
    if(select){
      select.innerHTML = (data.models || []).map(id => `<option value="${escapeHTML(id)}">${escapeHTML(id)}</option>`).join('');
    }
    flashStatus(status, (data.models || []).length ? (STATE.lang === 'zh' ? '已读取' : 'READ') : (STATE.lang === 'zh' ? '无节点返回' : 'NO NODES'));
  }catch(err){
    flashStatus(status, err.message || 'ERROR');
  }finally{
    button.classList.remove('pending');
  }
}

function handleSavePersona(button){
  const convo = currentConvo();
  if(!convo) return;
  const name = (document.getElementById('personaName')?.value || L(convo.name)).trim();
  const model = (document.getElementById('personaModel')?.value || convo.model || activeModelName()).trim();
  const persona = (document.getElementById('personaPrompt')?.value || '').trim();
  convo.name = [name,name];
  convo.model = model;
  convo.persona = persona;
  NODES.forEach(n => n.active = L(n.name) === model);
  persistState();
  flashText(button, STATE.lang === 'zh' ? '已落款' : 'SIGNED', 1400);
  render();
}

let SENDING = false;   // guard: ignore sends while a reply is pending
let ACTIVE_STREAM = null;
let PENDING_SEND = null;
let USER_PINNED_TO_BOTTOM = true;
let HAS_NEW_LETTER = false;
let RENDER_SCHEDULED = false;
let SCROLL_TO_THREAD_END_AFTER_RENDER = false;

async function handleSend(){
  try{
    const input = document.querySelector('.composer-input, .plat-input');
    if(!input) return;
    const text = input.value.trim();
    if(!text) return;
    input.value = '';

    if(SENDING && ACTIVE_STREAM){
      PENDING_SEND = text;
      ACTIVE_STREAM.abortController.abort();
      return;
    }

    const c = CONVOS[STATE.thread];
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');

    c.messages.push({ from:'user', time:[hh+':'+mm,hh+':'+mm], text:[text,text] });
    SENDING = true;
    persistState();
    render();
    scrollThreadEnd(true);
    focusComposer();

    await streamModelReply(c);
    persistState();
  }catch(err){
    if(err.name === 'AbortError'){
      const interrupted = CONVOS[STATE.thread].messages.filter(m => m.from === 'ai').slice(-1)[0];
      if(interrupted) interrupted.isInterrupted = true;
      persistState();
      return;
    }
    console.error('handleSend error:', err);
    const c = CONVOS[STATE.thread];
    const message = STATE.lang === 'zh'
      ? `模型连接失败：${err.message || err}`
      : `Model connection failed: ${err.message || err}`;
    const errorMessage = { from:'ai', time:['—','—'], text:[message,message], subId: uniqueId('sub'), status:'complete' };
    c.messages.push(errorMessage);
    appendMessageDom(errorMessage);
    persistState();
  }finally{
    SENDING = false;
    ACTIVE_STREAM = null;
    removeThinkingDom();
    scrollThreadEnd(false);
    focusComposer();
    if(PENDING_SEND){
      const next = PENDING_SEND;
      PENDING_SEND = null;
      queueUserText(next);
    }
  }
}

function queueUserText(text){
  const input = document.querySelector('.composer-input, .plat-input');
  if(input) input.value = text;
  handleSend();
}

function focusComposer(){
  if(STATE.screen !== 'detail') return;
  requestAnimationFrame(() => {
    const input = document.querySelector('.composer-input, .plat-input');
    if(input && document.activeElement !== input){
      input.focus({preventScroll:true});
    }
  });
}

function removeThinkingDom(){
  const thinking = document.querySelector('.thinking');
  if(thinking) thinking.remove();
}

function buildContextMessages(convo){
  const clean = (convo.messages || [])
    .filter(message => (message.from === 'ai' || message.from === 'user') && message.type !== 'reasoning')
    .map(message => ({
      from: message.from,
      text: [L(message.text || ['', '']).trim(), L(message.text || ['', '']).trim()],
    }))
    .filter(message => L(message.text));

  const merged = [];
  for(const message of clean){
    const last = merged[merged.length - 1];
    if(last && last.from === message.from){
      const joined = `${L(last.text)}\n${L(message.text)}`.slice(-9000);
      last.text = [joined, joined];
    }else{
      merged.push(message);
    }
  }

  const users = merged.filter(message => message.from === 'user');
  const mustKeepUsers = users.slice(-6);
  const tail = merged.slice(-14);
  const keep = [];
  [...mustKeepUsers, ...tail].forEach(message => {
    if(!keep.includes(message)) keep.push(message);
  });
  return keep.sort((a,b) => merged.indexOf(a) - merged.indexOf(b));
}

async function streamModelReply(convo){
  const abortController = new AbortController();
  const streamState = createPacingState(convo);
  ACTIVE_STREAM = { abortController, streamState };
  const response = await fetch('/api/chat', {
    method: 'POST',
    signal: abortController.signal,
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      model: activeModelRequestName(),
      userId: 'local-user',
      conversationId: STATE.thread,
      lang: STATE.lang,
      tone: STATE.tone,
      memory: STATE.memory,
      deepThinking: STATE.deepThinking && supportsDeepThinking(),
      conversationName: L(convo.name || ['', '']),
      customModel: activeCustomModel() ? {
        endpoint: activeCustomModel().endpoint,
        envPrefix: activeCustomModel().envPrefix,
        model: activeCustomModel().modelId || activeCustomModel().name?.[1] || activeModelRequestName(),
        provider: activeCustomModel().provider,
      } : null,
      persona: convo.persona || '',
      sentAt: Date.now(),
      messages: buildContextMessages(convo).map(message => ({
        role: message.from === 'ai' ? 'assistant' : 'user',
        content: L(message.text),
      })),
    }),
  });
  if(!response.ok){
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || response.statusText);
  }
  await readModelSse(response, streamState);
  await flushPacingBuffer(streamState, true);
  collapseReasoning(streamState);
  delete MEMORY_ARCHIVES[STATE.thread];
}

async function readModelSse(response, streamState){
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let raw = '';
  while(true){
    const {done,value} = await reader.read();
    if(done) break;
    raw += decoder.decode(value, {stream:true});
    const frames = raw.split(/\r?\n\r?\n/);
    raw = frames.pop() || '';
    for(const frame of frames){
      const lines = frame.split(/\r?\n/);
      const event = (lines.find(line => line.startsWith('event:')) || 'event: message').slice(6).trim();
      const payload = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if(!payload) continue;
      const data = JSON.parse(payload);
      if(event === 'reasoning') appendReasoning(streamState, data.text || '');
      if(event === 'content') await appendContentDelta(streamState, data.text || '');
      if(event === 'error') throw new Error(data.error || 'Stream failed');
    }
  }
}

function createPacingState(convo){
  return {
    convo,
    buffer:'',
    subIndex:0,
    fenceOpen:false,
    displayMathOpen:false,
    inlineMathOpen:false,
    reasoningId:null,
    activeBubble:null,
  };
}

function appendReasoning(state, delta){
  if(!delta) return;
  if(!state.reasoningId){
    state.reasoningId = uniqueId('reasoning');
    state.convo.messages.push({id:state.reasoningId,type:'reasoning', from:'ai', time:['—','—'], text:['',''], open:true, status:'streaming'});
    appendMessageDom(state.convo.messages[state.convo.messages.length - 1]);
  }
  const block = state.convo.messages.find(message => message.id === state.reasoningId);
  block.text[0] += delta;
  block.text[1] += delta;
  persistState();
  noteIncomingContent();
  updateMessageDom(block.id, block, true);
}

async function appendContentDelta(state, delta){
  if(!delta) return;
  collapseReasoning(state);
  for(const char of delta){
    state.buffer += char;
    updateMarkdownSliceState(state, char);
    if(shouldSliceAt(state, char)){
      await flushPacingBuffer(state, false);
    }
  }
}

function collapseReasoning(state){
  if(!state.reasoningId) return;
  const block = state.convo.messages.find(message => message.id === state.reasoningId);
  if(block && block.open){
    block.open = false;
    block.status = 'complete';
    persistState();
    updateMessageDom(block.id, block, true);
  }
}

async function flushPacingBuffer(state, force){
  const text = state.buffer;
  if(!text.trim()) return;
  if(!force && isProtectedBlock(state)) return;
  state.buffer = '';
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const bubble = {
    from:'ai',
    time:[hh+':'+mm,hh+':'+mm],
    text:['',''],
    subId: uniqueId('sub'),
    status:'typing',
  };
  state.convo.messages.push(bubble);
  persistState();
  noteIncomingContent();
  removeThinkingDom();
  if(!appendMessageDom(bubble)) render();
  scrollThreadEnd(false);
  focusComposer();
  await wait(50 + Math.floor(Math.random()*151));
  bubble.status = 'streaming';
  updateMessageDom(bubble.subId, bubble, true);
  let typedSincePaint = 0;
  for(const char of text){
    bubble.text[0] += char;
    bubble.text[1] += char;
    typedSincePaint += 1;
    if(char.trim()) await wait(8 + Math.floor(Math.random()*18));
    const punct = /[，。！？\n.,!?]/.test(char);
    if(punct) await wait(40 + Math.floor(Math.random()*90));
    if(punct || typedSincePaint >= 3){
      typedSincePaint = 0;
      updateMessageDom(bubble.subId, bubble, true);
    }
  }
  bubble.status = 'complete';
  persistState();
  updateMessageDom(bubble.subId, bubble, true);
}

function updateMarkdownSliceState(state, char){
  const tail = state.buffer.slice(-3);
  if(tail === '```') state.fenceOpen = !state.fenceOpen;
  const two = state.buffer.slice(-2);
  if(two === '$$' && !state.fenceOpen) state.displayMathOpen = !state.displayMathOpen;
  if(char === '$' && two !== '$$' && state.buffer.slice(-2, -1) !== '$' && !state.fenceOpen && !state.displayMathOpen){
    state.inlineMathOpen = !state.inlineMathOpen;
  }
}

function shouldSliceAt(state, char){
  return /[，。！？\n.,!?]/.test(char) && !isProtectedBlock(state);
}

function isProtectedBlock(state){
  return state.fenceOpen || state.displayMathOpen || state.inlineMathOpen;
}

function uniqueId(prefix){
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}

function wait(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function appendMessageDom(message){
  if(STATE.screen !== 'detail') return false;
  const convo = currentConvo();
  if(!convo) return false;
  const existsId = message.type === 'reasoning' ? message.id : message.subId;
  if(existsId && document.querySelector(`[data-msg-id="${CSS.escape(existsId)}"]`)) return true;
  if(STATE.theme === 'native'){
    const thread = document.querySelector('.thread');
    if(!thread) return false;
    thread.insertAdjacentHTML('beforeend', renderNativeMessage(convo, message, true));
    return true;
  }
  const bubbleThread = document.querySelector('.bubble-thread');
  if(!bubbleThread) return false;
  bubbleThread.insertAdjacentHTML('beforeend', renderBubbleMessage(convo, message, true));
  return true;
}

function scheduleRender(allowAutoScroll){
  if(RENDER_SCHEDULED) return;
  RENDER_SCHEDULED = true;
  requestAnimationFrame(() => {
    RENDER_SCHEDULED = false;
    render();
    if(allowAutoScroll) scrollThreadEnd(false);
  });
}

function updateMessageDom(id, message, allowAutoScroll){
  if(!id) return scheduleRender(allowAutoScroll);
  const body = document.querySelector(`[data-msg-body="${CSS.escape(id)}"]`);
  const shell = document.querySelector(`[data-msg-id="${CSS.escape(id)}"]`);
  if(!body || !shell) return scheduleRender(allowAutoScroll);

  if(message.type === 'reasoning'){
    shell.open = Boolean(message.open);
  }else{
    shell.classList.toggle('streaming', message.status === 'streaming');
  }
  body.innerHTML = renderRichText(L(message.text));
  if(allowAutoScroll) scrollThreadEnd(false);
  updateLetterNoticeDom();
}

function updateLetterNoticeDom(){
  const existing = document.getElementById('letterNotice');
  if(HAS_NEW_LETTER && STATE.screen === 'detail' && !existing){
    const main = document.getElementById('main');
    if(main) main.insertAdjacentHTML('beforeend', letterNotice());
  }
  if((!HAS_NEW_LETTER || STATE.screen !== 'detail') && existing){
    existing.remove();
  }
}

function noteIncomingContent(){
  if(!USER_PINNED_TO_BOTTOM) HAS_NEW_LETTER = true;
  updateLetterNoticeDom();
}

function isNearBottom(sc){
  return sc.scrollHeight - sc.scrollTop - sc.clientHeight < 48;
}

function scrollThreadEnd(force){
  const sc = document.querySelector('.scroll');
  if(!sc) return;
  if(force || USER_PINNED_TO_BOTTOM){
    sc.scrollTop = sc.scrollHeight;
    USER_PINNED_TO_BOTTOM = true;
    HAS_NEW_LETTER = false;
  }
}

/* ---------------- Boot ---------------- */
restoreState();
attachDelegatedEvents();   // bound once, for the lifetime of the page
render();

