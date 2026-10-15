/* 四级训练台 — 纯前端，无后端，进度存本地 */
'use strict';

const EXAM = new Date('2026-12-12T09:00:00+08:00');
const S = { bank: null, dict: null, listen: null };
const LS = {
  get(k, d) { try { const v = localStorage.getItem('cet4:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cet4:' + k, JSON.stringify(v)); } catch (e) {} }
};
let wrong = LS.get('wrong', []);
let vocab = LS.get('vocab', []);
let days = LS.get('days', []);
let prog = LS.get('prog', {});          // type -> 当前第几篇
let stats = LS.get('stats', { ans: 0, right: 0 });

const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* 日期一律按【本地日历】算。
   ⚠ 别用 toISOString().slice(0,10)：那按 UTC 输出，在 UTC+8 的晚上
   会算成第二天、凌晨 0-8 点又会算成前一天，跟 addDays 拼在一起还会
   互相错开一天（曾经导致"记得"按钮把复习日设回今天，队列永远清不空）。 */
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const today = () => ymd(new Date());
function addDays(dateStr, n) {
  const p = dateStr.split('-').map(Number);
  return ymd(new Date(p[0], p[1] - 1, p[2] + n));
}
function download(text, name, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'pop'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.remove('hide');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hide'), 2200);
}

/* ---------- 词形还原 / 查词 ----------
   本地词库是"四级新增词"表，不含 student / study / yet 这类初中基础词。
   所以这里把"可点的词"限定为词库收录的词 —— 正好就是该重点记的那些。
   同时补了一些不规则变化，提高命中率。 */
const IRREG = {
  shelves: 'shelf', leaves: 'leaf', knives: 'knife', lives: 'life', wives: 'wife',
  halves: 'half', wolves: 'wolf', thieves: 'thief', selves: 'self',
  men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth',
  mice: 'mouse', geese: 'goose', people: 'person', data: 'datum', media: 'medium',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', gone: 'go', went: 'go',
  been: 'be', was: 'be', were: 'be', is: 'be', are: 'be', am: 'be',
  has: 'have', had: 'have', does: 'do', did: 'do', done: 'do',
  made: 'make', took: 'take', taken: 'take', gave: 'give', given: 'give',
  found: 'find', told: 'tell', thought: 'think', knew: 'know', known: 'know',
  began: 'begin', begun: 'begin', became: 'become', brought: 'bring',
  built: 'build', bought: 'buy', caught: 'catch', chose: 'choose', chosen: 'choose',
  came: 'come', cost: 'cost', cut: 'cut', drew: 'draw', drawn: 'draw',
  drove: 'drive', driven: 'drive', fell: 'fall', fallen: 'fall', felt: 'feel',
  fought: 'fight', flew: 'fly', flown: 'fly', forgot: 'forget', forgotten: 'forget',
  got: 'get', gotten: 'get', grew: 'grow', grown: 'grow', held: 'hold',
  kept: 'keep', laid: 'lay', led: 'lead', left: 'leave', lent: 'lend',
  lost: 'lose', meant: 'mean', met: 'meet', paid: 'pay', put: 'put',
  ran: 'run', read: 'read', rode: 'ride', risen: 'rise', rose: 'rise',
  said: 'say', saw: 'see', seen: 'see', sold: 'sell', sent: 'send',
  sat: 'sit', slept: 'sleep', spoke: 'speak', spoken: 'speak', spent: 'spend',
  stood: 'stand', swam: 'swim', sworn: 'swear', threw: 'throw', thrown: 'throw',
  understood: 'understand', woke: 'wake', worn: 'wear', wore: 'wear',
  won: 'win', wrote: 'write', written: 'write',
  training: 'train', running: 'run', sitting: 'sit', getting: 'get',
  beginning: 'begin', planning: 'plan', referring: 'refer', occurred: 'occur'
};

function stem(w) {
  const out = [w];
  const push = x => { if (x && x.length >= 3 && !out.includes(x)) out.push(x); };
  if (IRREG[w]) push(IRREG[w]);
  if (w.endsWith("'s") || w.endsWith("s'")) push(w.replace(/'s?$/, ''));
  if (w.endsWith('ies')) push(w.slice(0, -3) + 'y');
  if (w.endsWith('ves')) push(w.slice(0, -3) + 'f');
  if (w.endsWith('es')) { push(w.slice(0, -1)); push(w.slice(0, -2)); }
  if (w.endsWith('s')) push(w.slice(0, -1));
  if (w.endsWith('ied')) push(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) { push(w.slice(0, -1)); push(w.slice(0, -2)); }
  if (w.endsWith('ing')) { push(w.slice(0, -3)); push(w.slice(0, -3) + 'e'); }
  if (w.endsWith('ly')) push(w.slice(0, -2));
  if (w.endsWith('er')) { push(w.slice(0, -2)); push(w.slice(0, -1)); }
  if (w.endsWith('est')) push(w.slice(0, -3));
  // 双写辅音：stopped → stop
  const m = /^(.+?)([bcdfglmnprst])\2(ed|ing)$/.exec(w);
  if (m) push(m[1] + m[2]);
  return out;
}

function lookup(word) {
  if (!S.dict) return null;
  const w = String(word).toLowerCase().replace(/^[^a-z]+|[^a-z'\-]+$/g, '');
  if (!w) return null;
  for (const c of stem(w)) {
    if (Object.prototype.hasOwnProperty.call(S.dict, c)) return { word: c, ...S.dict[c] };
  }
  return null;
}

/* ---------- 点词查义 ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('.w');
  const pop = $('#pop');
  if (!el) { if (!e.target.closest('#pop')) pop.classList.add('hide'); return; }
  const raw = el.dataset.w;
  const hit = lookup(raw);
  if (hit) {
    el.classList.add('hit');
    pop.innerHTML = `<b>${esc(hit.word)}</b> ${hit.p ? '<span style="opacity:.7">/' + esc(hit.p) + '/</span>' : ''}
      <div style="margin-top:4px">${esc(hit.m || '（暂无释义）')}</div>
      <div class="add"><button data-add="${esc(hit.word)}|${esc(hit.p || '')}|${esc(hit.m || '')}">加入生词本</button>
      <button class="sec" data-close="1">关闭</button></div>`;
  } else {
    el.classList.add('miss');
    pop.innerHTML = `<b>${esc(raw)}</b><div style="margin-top:4px">本地四级词库未收录（可先收藏，稍后补释义）</div>
      <div class="add"><button data-add="${esc(raw.toLowerCase())}||">仍要收藏</button>
      <button class="sec" data-close="1">关闭</button></div>`;
  }
  pop.classList.remove('hide');
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-add]');
  if (b) {
    const [w, p, m] = b.dataset.add.split('|');
    addVocab(w, p, m);
    $('#pop').classList.add('hide');
    toast('已加入生词本');
    return;
  }
  if (e.target.closest('[data-close]')) $('#pop').classList.add('hide');
});

function addVocab(word, phon, mean) {
  if (vocab.some(v => v.word === word)) return;
  vocab.unshift({ word, phon, mean, t: today(), n: 0, due: today() });
  LS.set('vocab', vocab);
}

function markDay() {
  const d = today();
  if (!days.includes(d)) { days.push(d); LS.set('days', days); }
}

function streak() {
  if (!days.length) return 0;
  let n = 0;
  const d = new Date();
  for (;;) {
    const s = ymd(d);          // 必须和 today() 同一套本地日历，否则凌晨会断
    if (days.includes(s)) { n++; d.setDate(d.getDate() - 1); } else break;
  }
  return n;
}

function daysToExam() {
  return Math.max(0, Math.ceil((EXAM - Date.now()) / 86400000));
}

/* ---------- 正文渲染 ----------
   只把本地词库收录的词包成可点 span。
   查不到的基本是初中阶段的词，本来也不用查 —— 这样点下去必有释义。 */
function wrap(text) {
  return esc(text).replace(/[A-Za-z][A-Za-z'\-]*/g, m => {
    if (!S.dict) return m;
    return lookup(m) ? `<span class="w" data-w="${m}">${m}</span>` : m;
  });
}

/* ---------- 路由 ---------- */
let route = 'home', readType = 'careful';

function go(r) {
  route = r;
  if (location.hash !== '#' + r) history.replaceState(null, '', '#' + r);
  document.querySelectorAll('nav button').forEach(b =>
    b.classList.toggle('on', b.dataset.nav === r || (r === 'read' && b.dataset.nav === 'read')));
  window.scrollTo(0, 0);
  render();
}

document.querySelectorAll('nav button').forEach(b =>
  b.addEventListener('click', () => go(b.dataset.nav)));

window.addEventListener('hashchange', () => {
  const h = location.hash.replace('#', '');
  if (h && h !== route) { route = h; render(); }
});

/* ---------- 顶栏 ---------- */
function header() {
  const map = { home: ['四级训练台', '把今天的量做完就行'], read: ['阅读', '三种题型对齐真题'],
                listen: ['听力听写', '浏览器朗读，跟读默写'], vocab: ['生词本', '点短文里的词就能收藏'],
                me: ['我的', '数据都在你自己手机上'] };
  const m = map[route] || map.home;
  $('#hdTitle').textContent = m[0];
  $('#hdSub').textContent = m[1];
  $('#hdCount').textContent = `距四级 ${daysToExam()} 天`;
  $('#hdClock').textContent = `连续 ${streak()} 天`;
}

/* ---------- 首页 ---------- */
function vHome() {
  const total = stats.ans, acc = total ? Math.round(stats.right / total * 100) : 0;
  const nRead = S.bank.types.reduce((a, t) => a + t.items.length, 0);
  return `
  <div class="card tight">
    <div class="ttl">距 ${S.bank.exam.date} 四级考试还有 <span style="color:var(--brand)">${daysToExam()}</span> 天</div>
    <div class="meta" style="margin:6px 0 0">${esc(S.bank.exam.note)}。写作 15% · 听力 35% · 阅读 35% · 翻译 15%。</div>
  </div>

  <div class="stat-grid">
    <div class="stat"><div class="k">连续打卡</div><div class="v">${streak()} <small>天</small></div></div>
    <div class="stat"><div class="k">累计答题</div><div class="v">${total} <small>题</small></div></div>
    <div class="stat"><div class="k">正确率</div><div class="v">${acc}<small>%</small></div></div>
    <div class="stat"><div class="k">生词 / 错题</div><div class="v">${vocab.length} <small>/ ${wrong.length}</small></div></div>
  </div>

  <div class="sec">开始练</div>
  <div class="entry">
    <a href="#read" data-go="read"><div class="n">📖 阅读</div><div class="d">${nRead} 篇 · 三种题型</div></a>
    <a href="#listen" data-go="listen"><div class="n">🎧 听力</div><div class="d">${S.listen ? S.listen.items.length : 0} 句听写</div></a>
    <a href="#vocab" data-go="vocab"><div class="n">🔖 生词本</div><div class="d">${vocab.length} 个词${srsDueCount() ? ' · 待复习 ' + srsDueCount() : ''}</div></a>
    <a href="#me" data-go="me"><div class="n">📊 我的</div><div class="d">错题 ${wrong.length} 条</div></a>
  </div>

  <div class="sec">今天做什么</div>
  <div class="card tight">
    <div style="font-size:14px;line-height:1.9">
      1. <b>仔细阅读 1 篇</b>（8 分钟）— 分值最高，每题 14.2 分<br>
      2. <b>听力听写 5 句</b>（6 分钟）— 练耳朵<br>
      3. <b>选词填空 1 篇</b>（8 分钟）— 最后做，别恋战<br>
      4. ${srsDueCount() ? `<b>复习生词 ${srsDueCount()} 个</b>（约 ${Math.max(2, Math.round(srsDueCount() * 0.25))} 分钟）— 在「生词本」里` : '做完把生词收藏，明天就会出现在复习队列里'}
    </div>
  </div>

  <div class="card tight">
    <div class="notice">
      <b>点词怎么用</b>：正文里<b>可以点的词</b>就是本地四级词库收录的 4544 个词
      —— 正好是该重点记的那些；没加下划线的是初中基础词，不用查。
      点一下即可看释义并收藏，全程离线。
    </div>
  </div>

  <div class="sec">关于题目来源</div>
  <div class="card tight">
    <div class="notice">
      选词填空与听力语料取自 <b>Project Gutenberg</b>（公有领域），由程序自动生成；
      仔细阅读与长篇匹配为<b>原创题目</b>——四级考的是说明文，而目前所有可访问的
      开源文本要么体裁不符、要么过难。详见「我的 → 关于与版权」。
    </div>
  </div>`;
}

/* ---------- 阅读 ---------- */
function stateOf(type) { return prog[type] || 0; }
function setState(type, i) { prog[type] = i; LS.set('prog', prog); }

function vRead() {
  if (!readType || !S.bank.types.some(t => t.type === readType)) readType = S.bank.types[0].type;
  const tabs = S.bank.types.map(t =>
    `<button class="tab${t.type === readType ? ' on' : ''}" data-rt="${t.type}">${esc(t.typeName)}<span class="n">${t.items.length}</span></button>`
  ).join('') + `<button class="tab${readType === 'wrong' ? ' on' : ''}" data-rt="wrong">错题本<span class="n">${wrong.length}</span></button>`;

  let body;
  if (readType === 'wrong') body = vWrong();
  else {
    const t = S.bank.types.find(x => x.type === readType);
    const i = Math.min(stateOf(readType), t.items.length - 1);
    body = vItem(t, i);
  }
  return `<div class="tabs">${tabs}</div>${body}`;
}

function originTag(it) {
  if (it.origin === 'local') return `<span class="tag" style="background:var(--brand-soft);color:var(--brand);border-color:transparent">自备材料</span>`;
  return it.origin === 'open'
    ? `<span class="tag open">开源语料</span>`
    : `<span class="tag orig">原创题</span>`;
}
function srcLine(it) {
  if (it.origin !== 'open' || !it.source) return '';
  const s = it.source;
  const b = s.book_id ? `#${s.book_id} ` : '';
  const link = s.url ? ` · <a class="link" href="${s.url}" target="_blank" rel="noopener">原书</a>` : '';
  return `<div class="meta">来源：${esc(b + (s.title || ''))}（${esc(s.license || '')}）${link}</div>`;
}

function vItem(t, i) {
  const it = t.items[i];
  const submitted = LS.get('ans:' + t.type + ':' + i, null);
  const done = !!submitted;
  // 关键：未提交时要用"作答草稿"渲染，否则点了选项界面不会显示选中
  const d = done ? { a: submitted.a || {}, p: submitted.p || {} } : ensureDraft(t, i);
  let h = `<div class="card">
    <div class="ttl">${esc(it.title || '（无标题）')}</div>
    <div class="meta">${originTag(it)}第 ${i + 1} / ${t.items.length} 篇 · 每题 ${t.scorePerQ} 分</div>
    ${srcLine(it)}`;

  if (t.type === 'careful') {
    h += `<div class="passage">${it.passage.map(p => '<p>' + wrap(p) + '</p>').join('')}</div></div><div class="card">`;
    it.questions.forEach((q, qi) => {
      const a = d.a[qi];
      h += `<div class="q"><div class="qt">${qi + 1}. ${esc(q.q)}</div>`;
      q.options.forEach((o, oi) => {
        let cls = 'opt';
        if (done) { if (oi === q.answer) cls += ' ok'; else if (a === oi) cls += ' bad'; }
        else if (a === oi) cls += ' sel';
        h += `<div class="${cls}" data-pick="${qi}:${oi}"><span class="k">${'ABCD'[oi]}</span><span>${wrap(o)}</span></div>`;
      });
      if (done) h += `<div class="exp">正确答案 <b>${'ABCD'[q.answer]}</b>。${esc(q.explain)}</div>`;
      h += `</div>`;
    });
    h += resultRow(t, i, it.questions.length, done, d);
  } else if (t.type === 'matching') {
    h += it.paragraphs.map(p => `<div class="para"><span class="lt">${p.letter}</span>${wrap(p.text)}</div>`).join('');
    h += `</div><div class="card"><div class="qt" style="margin-bottom:10px">把下面每句话匹配到对应段落（部分段落不对应任何句子）</div>`;
    it.statements.forEach((s, si) => {
      const a = d.a[si] || '';
      let cls = 'stmt';
      if (done) cls += (a === s.answer ? ' ok' : ' bad');
      h += `<div class="${cls}"><div class="no">${si + 1}</div><div class="s">${wrap(s.s)}</div>`;
      if (done) {
        h += `<div style="font-size:14px;font-weight:600;color:${a === s.answer ? 'var(--ok)' : 'var(--bad)'}">${a || '—'}</div>`;
        if (a !== s.answer) h += `<div style="font-size:12px;color:var(--fg2)">应为 ${s.answer}</div>`;
      } else {
        const opts = it.paragraphs.map(p => p.letter)
          .map(L => `<option value="${L}"${a === L ? ' selected' : ''}>${L}</option>`).join('');
        h += `<select data-sel="${si}"><option value="">—</option>${opts}</select>`;
      }
      h += `</div>`;
    });
    h += resultRow(t, i, it.statements.length, done, d);
  } else {
    const placed = d.p || {};
    const used = Object.values(placed);
    h += `<div class="passage">${clozeBody(it, placed, done)}</div>`;
    h += `<div class="bank">${it.options.map(w =>
      `<button class="chip${used.includes(w) ? ' used' : ''}${d.chip === w ? ' picked' : ''}" data-chip="${w}">${w}</button>`).join('')}</div>`;
    if (done) {
      h += `<div class="exp" style="margin-top:12px">`;
      for (let n = 1; n <= 10; n++) {
        const right = it.answers[n], got = placed[n], ok = got === right;
        h += `<div>${n}. ${ok ? '✓' : '✗'} ${esc(got || '未填')}${ok ? '' : ' → 应为 <b>' + right + '</b>'}</div>`;
      }
      h += `</div>`;
    }
    h += resultRow(t, i, 10, done, d);
  }
  h += `</div>`;
  return h;
}

function clozeBody(it, placed, done) {
  const parts = esc(it.passage).split(/\{\{(\d+)\}\}/);
  let out = '';
  parts.forEach((p, i) => {
    if (i % 2 === 1) {
      const n = p, w = placed[n];
      let cls = 'blank' + (w ? ' filled' : '');
      if (done) cls = 'blank ' + (w === it.answers[n] ? 'ok' : 'bad');
      out += `<span class="${cls}" data-blank="${n}">${w || n}</span>`;
    } else {
      out += wrap(p);
    }
  });
  return out.split('\n\n').map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
}

function resultRow(t, i, total, done, d) {
  if (!done) {
    const n = Object.keys(d.a || {}).length + Object.keys(d.p || {}).length;
    return `<div class="result"><button class="btn" data-submit="1">提交（已答 ${n}/${total}）</button>
      <button class="btn ghost sm" data-reset="1">重做</button></div>`;
  }
  let right = 0;
  const it = t.items[i];
  if (t.type === 'cloze') { for (let n = 1; n <= 10; n++) if (d.p[n] === it.answers[n]) right++; }
  else {
    const qs = t.type === 'careful' ? it.questions : it.statements;
    qs.forEach((q, k) => { if (d.a[k] === q.answer) right++; });
  }
  return `<div class="result">
    <span class="score">答对 <b>${right}/${total}</b> · 折算 <b>${(right * t.scorePerQ).toFixed(1)}</b> 分</span>
    <button class="btn ghost sm" data-next="1">下一篇 →</button>
    <button class="btn ghost sm" data-reset="1">重做</button></div>`;
}

let draft = null;   // 当前作答草稿

function ensureDraft(t, i) {
  const key = t.type + ':' + i;
  if (!draft || draft.key !== key) {
    const saved = LS.get('draft:' + key, null);
    draft = { key, a: (saved && saved.a) || {}, p: (saved && saved.p) || {}, chip: null };
  }
  return draft;
}

function vWrong() {
  if (!wrong.length) return `<div class="card"><div class="empty">还没有错题。答错的内容会自动记到这里。</div></div>`;
  return `<div class="card">` + wrong.slice().reverse().map(w => `
    <div class="item">
      <div class="h">${esc(w.q)}</div>
      <div class="m">${esc(w.typeName)} · ${esc(w.title || '')} · ${w.t}</div>
      <div class="m">你选 <span style="color:var(--bad)">${esc(w.got)}</span>　正确 <span style="color:var(--ok)">${esc(w.right)}</span></div>
    </div>`).join('') +
    `<div class="row"><button class="btn ghost sm" data-clearwrong="1">清空错题本</button></div></div>`;
}

/* ---------- 听力 ---------- */
let li = 0, curListen = null;
function vListen() {
  if (!S.listen || !S.listen.items.length) return `<div class="card"><div class="empty">听力语料未加载</div></div>`;
  li = Math.min(li, S.listen.items.length - 1);
  const it = S.listen.items[li];
  const st = LS.get('lc:' + it.id, null);
  const rates = [0.7, 0.85, 1.0];
  return `
  <div class="card audio-card">
    <div class="meta" style="text-align:center">第 ${li + 1} / ${S.listen.items.length} 句 · ${originTag(it)}</div>
    <button class="bigbtn" id="playBtn" data-play="1">▶</button>
    <div style="font-size:13px;color:var(--fg2)">点一下听发音（可重复听）</div>
    <div class="speed">
      ${rates.map(r => `<button class="chip" data-rate="${r}"${r === 1.0 ? ' style="border-color:var(--brand);color:var(--brand)"' : ''}>${r === 1 ? '原速' : r + '×'}</button>`).join('')}
    </div>
  </div>
  <div class="card">
    <div class="qt">听写：把你听到的句子打出来</div>
    <textarea id="linput" rows="3" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--fg);font-size:15px;font-family:inherit;line-height:1.6" placeholder="在这里输入…" ${st ? 'disabled' : ''}>${st ? esc(st.typed) : ''}</textarea>
    ${st ? lcResult(it, st) : `<div class="row"><button class="btn" data-lcheck="1">提交</button>
      <button class="btn ghost sm" data-lskip="1">跳过</button></div>`}
  </div>
  <div class="card tight">
    <div class="meta" style="margin:0">提示：听不清就多点几次。判断时忽略大小写和标点，只比对单词。</div>
  </div>`;
}

function lcResult(it, st) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
  const ok = norm(st.typed) === norm(it.text);
  return `<div class="result">
    <span class="score">${ok ? '<b style="color:var(--ok)">完全正确</b>' : '<b style="color:var(--bad)">有出入</b>'}</span>
    <button class="btn ghost sm" data-lnext="1">下一句 →</button>
  </div>
  <div class="exp" style="margin-top:12px">原文：<b>${esc(it.text)}</b></div>`;
}

/* ---------- 生词本 + 生词复习（内置遗忘曲线排期，不用装 Anki） ---------- */
/* 第 n 次答对之后，隔几天再见：1 → 2 → 4 → 7 → 15 → 30 → 60 → 120 天 */
const SRS_LADDER = [1, 2, 4, 7, 15, 30, 60, 120];

/* 老数据没有 due 字段，按"今天到期"处理，这样一上线就能复习 */
function srsDue(v) { return (v.due || '1970-01-01') <= today(); }
function srsDueCount() { return vocab.filter(srsDue).length; }

/* 复习态（不落盘；每次进来自动按到期时间组队） */
let vMode = 'list', vQueue = [], vIdx = 0, vShown = false, vRight = 0;

function startReview() {
  vQueue = vocab.filter(srsDue).slice();
  vIdx = 0; vShown = false; vRight = 0;
  if (!vQueue.length) { toast('今天没有要复习的生词'); return; }
  vMode = 'review';
  render();
}

function answerReview(ok) {
  const v = vQueue[vIdx];
  if (!v) return;
  const i = vocab.findIndex(x => x.word === v.word);
  if (i >= 0) {
    if (ok) {
      const n = Math.min((vocab[i].n || 0) + 1, SRS_LADDER.length);
      vocab[i].n = n;
      vocab[i].due = addDays(today(), SRS_LADDER[n - 1]);
    } else {
      vocab[i].n = 0;
      vocab[i].due = today();     // 今天还会再出现，直到你记住
    }
    LS.set('vocab', vocab);
  }
  if (ok) vRight++;
  vIdx++;
  vShown = false;
  if (vIdx >= vQueue.length) {
    markDay();
    const left = srsDueCount();
    toast(left ? ('这轮结束，还有 ' + left + ' 个今天要再来一遍')
               : ('这轮复习完成，记得 ' + vRight + ' / ' + vQueue.length));
    vMode = 'list';
  }
  render();
}

function vReviewCard() {
  const v = vQueue[vIdx];
  if (!v) { vMode = 'list'; return vVocab(); }
  return `<div class="card" style="text-align:center">
    <div class="meta" style="margin-bottom:18px">第 ${vIdx + 1} / ${vQueue.length} 个 · 已记得 ${vRight} 个</div>
    <div style="font-size:34px;font-weight:500;line-height:1.3">${esc(v.word)}</div>
    ${v.phon ? `<div style="color:var(--fg2);margin-top:6px">/${esc(v.phon)}/</div>` : ''}
    ${vShown ? `
      <div class="exp" style="margin-top:18px;text-align:left">${esc(v.mean || '（这个词没查到释义）')}</div>
      <div class="row" style="margin-top:18px">
        <button class="btn" data-vok="1">记得</button>
        <button class="btn ghost" data-vno="1">忘了</button>
      </div>`
    : `
      <div class="row" style="margin-top:26px"><button class="btn" data-vshow="1">看释义</button></div>
      <div class="meta" style="margin-top:10px">先在脑子里回想一遍再看答案，记得更牢</div>`}
  </div>
  <div class="card tight">
    <div class="row" style="margin:0"><button class="btn ghost sm" data-vback="1">返回列表</button></div>
  </div>`;
}

function vVocab() {
  if (!vocab.length) return `<div class="card"><div class="empty">生词本还是空的。去阅读里点任意一个单词试试。</div>
    <div class="row"><button class="btn" data-go="read">去阅读</button></div></div>`;

  if (vMode === 'review') return vReviewCard();

  const due = srsDueCount();
  return `<div class="card">
    <div class="ttl">生词本</div>
    <div class="meta">共 ${vocab.length} 个 · 今天待复习 <b>${due}</b> 个
      ${vocab.length - due ? ' · 已排期 ' + (vocab.length - due) + ' 个' : ''}</div>
    <div class="row" style="margin:12px 0 2px">
      ${due ? `<button class="btn" data-vstart="1">开始复习（${due} 个）</button>`
            : `<button class="btn ghost" disabled>今天没有要复习的</button>`}
    </div>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost sm" data-csvexport="1">导出 CSV（通用）</button>
      <button class="btn ghost sm" data-export="1">导出 Anki（TSV）</button>
      <button class="btn ghost sm" data-clearvocab="1">清空</button>
    </div>
  </div>
  <div class="card tight">
    <div class="notice">
      <b>不用装 Anki 也能背</b>：点「开始复习」，按遗忘曲线的节奏自动排期
      —— 记得的往后推（1 → 2 → 4 → 7 → 15 → 30 → 60 天），忘了的当天再来一遍。<br>
      想丢进 Anki 或欧路词典背，用上面两个导出：<b>TSV</b> 给 Anki，
      <b>CSV</b> 是通用格式（Excel / 欧路 / 不背单词等大多能导入）。
    </div>
  </div>
  <div class="card tight">
    <div class="vlist">${vocab.map(v => `<div class="v"><b>${esc(v.word)}</b><span>${esc(v.mean || '待补释义')}</span></div>`).join('')}</div>
  </div>`;
}

function exportTSV() {
  const lines = ['#separator:tab', '#html:false'];
  for (const v of vocab) lines.push([v.word, v.phon || '', v.mean || '', '四级训练台'].join('\t'));
  download('\ufeff' + lines.join('\n'), 'cet4_vocab.tsv', 'text/tab-separated-values;charset=utf-8');
}

/* 通用格式：带 BOM 的 CSV，Excel / 欧路词典 / 不背单词等大多能直接导入 */
function exportCSV() {
  const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const lines = ['word,phonetic,meaning'];
  for (const v of vocab) lines.push([q(v.word), q(v.phon), q(v.mean)].join(','));
  download('\ufeff' + lines.join('\r\n'), 'cet4_生词.csv', 'text/csv;charset=utf-8');
}

/* ---------- 我的 ---------- */
/* 只有在本机服务下才显示"手机扫码"入口（线上站没有 /qr 这个路由） */
function isLocalServe() {
  const h = location.hostname;
  return location.protocol.startsWith('http') &&
    (h === '127.0.0.1' || h === 'localhost' ||
     /^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h));
}

function vMe() {
  const total = stats.ans, acc = total ? Math.round(stats.right / total * 100) : 0;
  return `
  <div class="stat-grid">
    <div class="stat"><div class="k">连续打卡</div><div class="v">${streak()} <small>天</small></div></div>
    <div class="stat"><div class="k">累计答题</div><div class="v">${total}</div></div>
    <div class="stat"><div class="k">正确率</div><div class="v">${acc}<small>%</small></div></div>
    <div class="stat"><div class="k">错题 / 生词</div><div class="v">${wrong.length} <small>/ ${vocab.length}</small></div></div>
  </div>

  ${isLocalServe() ? `
  <div class="sec">手机上刷</div>
  <div class="card tight">
    <div class="meta" style="margin:0 0 10px">手机连同一个 WiFi，扫一下就能进，进度存在手机上。</div>
    <div class="row" style="margin:0">
      <a class="btn" href="/qr" target="_blank" rel="noopener">显示二维码 ↗</a>
    </div>
  </div>` : ''}

  <div class="sec">错题本</div>
  ${vWrong()}

  <div class="sec">关于与版权</div>
  <div class="card">
    <div class="ttl">这个站的内容从哪来</div>
    <div class="meta">一句话：能合法公开的都用开源，开源做不到的用原创，不碰真题。</div>

    <div class="item">
      <div class="h"><span class="tag open">开源语料</span>选词填空 · 听力听写</div>
      <div class="m">取自 <b>Project Gutenberg</b>（公有领域，可自由使用）：
        Stories of Inventors、Stories of Great Inventors、A Short History of the World、
        Giant Brains、Fables and Stories for Children、Among the Meadow People。
        题目由程序自动生成（挖空 + 按词性挑干扰项），每篇都标注了原书编号和链接。</div>
    </div>

    <div class="item">
      <div class="h"><span class="tag orig">原创题</span>仔细阅读 · 长篇匹配</div>
      <div class="m">按四级真题的体裁和难度撰写。之所以不用开源文本，是因为四级考的是<b>说明文</b>，
        而实测下来：Gutenberg 的文本难度能对上但体裁是故事/对话；
        OpenStax 教材是说明文但中位覆盖率只有 66.5%（四级是 77%），太难。</div>
    </div>

    <div class="item">
      <div class="h">为什么没有四级真题</div>
      <div class="m">真题版权属于教育部教育考试院，网上流传的题库（如 GitHub 上几个高星仓库）
        <b>都没有开源许可证</b>，等于没有授权，不能放进公开网站。</div>
    </div>

    <div class="item">
      <div class="h">难度是怎么校准的</div>
      <div class="m">用 NGSL 词频表（6363 词）+ 四级词表算"覆盖率"：
        我手写的四级题覆盖率是 70.8%~79.0%（中位 77.1%），
        据此把开源语料筛在 72%~86% 区间。实际入选的 18 篇落在 77.6%~85.4%。</div>
    </div>

    <div class="item">
      <div class="h">
        <span class="tag" style="background:var(--brand-soft);color:var(--brand);border-color:transparent">自备材料</span>
        本地真题（可选）</div>
      <div class="m">${S.bank.hasLocal
        ? `已加载 <b>${S.bank.hasLocal}</b> 篇自备材料，排在每个题型最前面。`
        : `还没有。把自己的真题放进 <code>tools/import_papers.py</code> 支持的格式里跑一下，
           就会生成 <code>site/data/bank.local.json</code>，刷新即可看到。
           <b>这个文件不会随公开站发布</b>——个人学习用自己买的资料，与把书扫描进电脑是一回事。`}</div>
    </div>

    <div class="item">
      <div class="h">你的数据</div>
      <div class="m">错题、生词、打卡记录全部存在<b>你自己浏览器本地</b>，不上传任何服务器。清浏览器数据会丢。</div>
    </div>
  </div>

  <div class="card tight">
    <div class="row" style="margin:0">
      <button class="btn ghost sm" data-resetall="1">清空全部本地数据</button>
    </div>
  </div>`;
}

/* ---------- 渲染 ---------- */
function render() {
  header();
  if (route !== 'vocab') vMode = 'list';   // 离开生词页就退出复习态
  const v = $('#view');
  if (route === 'read') v.innerHTML = vRead();
  else if (route === 'listen') v.innerHTML = vListen();
  else if (route === 'vocab') v.innerHTML = vVocab();
  else if (route === 'me') v.innerHTML = vMe();
  else v.innerHTML = vHome();
  if (route === 'listen') bindListen();
}

/* ---------- 事件 ---------- */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  const rt = e.target.closest('[data-rt]');
  if (rt) { readType = rt.dataset.rt; draft = null; render(); return; }
});

/* 阅读：选项 / 提交 / 下一题 / 重做 */
document.addEventListener('click', e => {
  if (route !== 'read' || readType === 'wrong') return;
  const t = S.bank.types.find(x => x.type === readType);
  if (!t) return;
  const i = Math.min(stateOf(readType), t.items.length - 1);
  const key = readType + ':' + i;
  if (LS.get('ans:' + key, null)) return;   // 已提交，只读

  const pk = e.target.closest('[data-pick]');
  if (pk) {
    const [qi, oi] = pk.dataset.pick.split(':').map(Number);
    const d = ensureDraft(t, i); d.a[qi] = oi;
    LS.set('draft:' + key, d); render(); return;
  }
  const ch = e.target.closest('[data-chip]');
  if (ch) {
    const d = ensureDraft(t, i);
    d.chip = (d.chip === ch.dataset.chip) ? null : ch.dataset.chip;
    LS.set('draft:' + key, d); render(); return;
  }
  const bl = e.target.closest('[data-blank]');
  if (bl) {
    const d = ensureDraft(t, i);
    const n = bl.dataset.blank;
    if (d.p[n]) { delete d.p[n]; }
    else if (d.chip) { d.p[n] = d.chip; d.chip = null; }
    LS.set('draft:' + key, d); render(); return;
  }
  const sub = e.target.closest('[data-submit]');
  if (sub) {
    const d = ensureDraft(t, i);
    if (t.type !== 'cloze' && Object.keys(d.a).length < (t.type === 'careful' ? t.items[i].questions.length : t.items[i].statements.length)) {
      if (!confirm('还有没答的题，确定提交？')) return;
    }
    submitRead(t, i, d); return;
  }
  const nx = e.target.closest('[data-next]');
  if (nx) { setState(readType, (i + 1) % t.items.length); draft = null; render(); return; }
  const rs = e.target.closest('[data-reset]');
  if (rs) { LS.set('ans:' + key, null); LS.set('draft:' + key, null); draft = null; render(); return; }
});

document.addEventListener('change', e => {
  const sel = e.target.closest('[data-sel]');
  if (!sel || route !== 'read' || readType === 'wrong') return;
  const t = S.bank.types.find(x => x.type === readType);
  const i = Math.min(stateOf(readType), t.items.length - 1);
  if (LS.get('ans:' + readType + ':' + i, null)) return;
  const d = ensureDraft(t, i);
  const si = +sel.dataset.sel;
  if (sel.value) d.a[si] = sel.value; else delete d.a[si];
  LS.set('draft:' + readType + ':' + i, d);
});

function submitRead(t, i, d) {
  const it = t.items[i];
  const key = readType + ':' + i;
  const st = { a: d.a, p: d.p };
  LS.set('ans:' + key, st);
  let right = 0, total = 0;
  const push = (q, got, ans) => {
    wrong.push({ type: t.type, typeName: t.typeName, title: it.title, q, got: String(got), right: String(ans), t: today() });
  };
  if (t.type === 'careful') {
    total = it.questions.length;
    it.questions.forEach((q, k) => {
      const got = d.a[k];
      if (got === q.answer) right++; else push(q.q, got === undefined ? '未答' : 'ABCD'[got], 'ABCD'[q.answer]);
    });
  } else if (t.type === 'matching') {
    total = it.statements.length;
    it.statements.forEach((s, k) => {
      const got = d.a[k];
      if (got === s.answer) right++; else push(s.s, got || '未选', s.answer);
    });
  } else {
    total = 10;
    for (let n = 1; n <= 10; n++) {
      const got = d.p[n], ans = it.answers[n];
      if (got === ans) right++; else push('第 ' + n + ' 空', got || '未填', ans);
    }
  }
  stats.ans += total; stats.right += right;
  LS.set('stats', stats); LS.set('wrong', wrong);
  markDay();
  render();
}

/* 听力 */
let rate = 0.85;
function bindListen() {
  document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
    rate = parseFloat(b.dataset.rate);
    document.querySelectorAll('[data-rate]').forEach(x => x.style.cssText = '');
    b.style.borderColor = 'var(--brand)'; b.style.color = 'var(--brand)';
  }));
}
function speak(text) {
  if (!('speechSynthesis' in window)) { toast('这个浏览器不支持语音合成'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = rate;
  const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  if (vs.length) u.voice = vs.find(v => /US|United States/i.test(v.name)) || vs[0];
  const btn = $('#playBtn'); if (btn) btn.classList.add('playing');
  u.onend = () => { if (btn) btn.classList.remove('playing'); };
  speechSynthesis.speak(u);
}

document.addEventListener('click', e => {
  if (route !== 'listen') return;
  const it = S.listen.items[li];
  if (e.target.closest('[data-play]')) { speak(it.text); return; }
  if (e.target.closest('[data-lcheck]')) {
    const typed = ($('#linput') || {}).value || '';
    if (!typed.trim()) { toast('先写点东西'); return; }
    LS.set('lc:' + it.id, { typed });
    const norm = s => s.toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
    const ok = norm(typed) === norm(it.text);
    stats.ans++; if (ok) stats.right++;
    LS.set('stats', stats); markDay();
    render(); return;
  }
  if (e.target.closest('[data-lskip]')) { li = (li + 1) % S.listen.items.length; render(); return; }
  if (e.target.closest('[data-lnext]')) { li = (li + 1) % S.listen.items.length; render(); return; }
});

/* 生词 / 错题 / 清空 */
document.addEventListener('click', e => {
  if (e.target.closest('[data-vstart]')) { startReview(); return; }
  if (e.target.closest('[data-vshow]')) { vShown = true; render(); return; }
  if (e.target.closest('[data-vok]')) { answerReview(true); return; }
  if (e.target.closest('[data-vno]')) { answerReview(false); return; }
  if (e.target.closest('[data-vback]')) { vMode = 'list'; render(); return; }
  if (e.target.closest('[data-csvexport]')) { exportCSV(); return; }
  if (e.target.closest('[data-export]')) { exportTSV(); return; }
  if (e.target.closest('[data-clearvocab]')) {
    if (confirm('清空生词本？')) { vocab = []; LS.set('vocab', vocab); render(); } return;
  }
  if (e.target.closest('[data-clearwrong]')) {
    if (confirm('清空错题本？')) { wrong = []; LS.set('wrong', wrong); render(); } return;
  }
  if (e.target.closest('[data-resetall]')) {
    if (confirm('清空全部本地数据？错题、生词、打卡、答题记录都会没。')) {
      Object.keys(localStorage).filter(k => k.startsWith('cet4:')).forEach(k => localStorage.removeItem(k));
      wrong = []; vocab = []; days = []; prog = {}; stats = { ans: 0, right: 0 }; draft = null;
      render();
    } return;
  }
});

/* ---------- 启动 ----------
   两种运行方式：
     1. 常规：从 data/*.json 读取（线上站、本地服务）
     2. 单文件：数据内联在 window.__INLINE_DATA__ 里（双击 .html 直接打开，无需服务器）
*/
async function boot() {
  try {
    const IN = window.__INLINE_DATA__;
    let bank, listen;
    if (IN) {
      bank = IN.bank;
      listen = IN.listen || null;
    } else {
      [bank, listen] = await Promise.all([
        fetch('data/bank.json').then(r => r.json()),
        fetch('data/listening.json').then(r => r.json()).catch(() => null)
      ]);
    }
    S.bank = bank; S.listen = listen;

    if (!IN) {
      // 合并本地自备题库（site/data/bank.local.json）。
      // 公开站上不会有这个文件，所以线上永远只有开源 + 原创内容。
      try {
        const local = await fetch('data/bank.local.json').then(r => r.json());
        if (local && Array.isArray(local.types) && local.types.length) {
          for (const lt of local.types) {
            const bt = S.bank.types.find(t => t.type === lt.type);
            if (!bt) S.bank.types.push(lt);
            else bt.items = lt.items.concat(bt.items);   // 自备材料排在前面
          }
          S.bank.hasLocal = local.types.reduce((a, t) => a + t.items.length, 0);
        }
      } catch (e) { /* 没有本地题库，正常情况 */ }
    }

    const h = location.hash.replace('#', '');
    if (['home', 'read', 'listen', 'vocab', 'me'].includes(h)) route = h;

    if (IN) {
      S.dict = IN.dict || {};
      render();
      if (S.dict && Object.keys(S.dict).length) { /* 词典已就绪 */ }
    } else {
      render();
      // 词典加载完成后要重绘一次：可点的词依赖词典
      fetch('data/dict.json').then(r => r.json())
        .then(d => { S.dict = d; render(); })
        .catch(() => {});
    }
  } catch (err) {
    $('#view').innerHTML = `<div class="card"><div class="ttl">加载失败</div>
      <div class="meta">${esc(err.message)}</div>
      <div class="notice">如果你是用 file:// 直接打开的，浏览器会拦住本地数据读取。
      请改用「单文件版」（双击即用，无需服务器），或通过已发布的网址打开。</div></div>`;
  }
}
boot();
