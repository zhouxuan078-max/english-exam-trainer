/* 四级训练台 — 纯前端，无后端，进度存本地 */
'use strict';

/* 考试信息。
   默认取题库自带的那条（大学英语四级 / 2026-12-12），
   使用者在「我的 → 我的考试」里可以改成**任何考试和任何日期** ——
   四级、六级、雅思、托福、高考、考研都行，站本身不限定考试类型。
   日期不写死：四级一年两场（6 月 / 12 月），每年日期由官方另行公布。 */
const EXAM_STRUCT = '写作 15% · 听力 35% · 阅读 35% · 翻译 15%';

function examInfo() {
  const e = LS.get('exam', null);
  if (e && e.date) {
    return { name: e.name || '我的考试', date: e.date, custom: true,
             note: '你自己设的考试' };
  }
  const d = (S.bank && S.bank.exam) || {};
  return { name: d.name || '大学英语四级', date: d.date || '',
           note: d.note || '', site: true };
}

function examShort() {
  const n = examInfo().name || '考试';
  return n.replace(/[（(].*$/, '').trim() || '考试';
}

function examDateObj() {
  const d = examInfo().date;
  if (!d) return null;
  const o = new Date(d + 'T09:00:00+08:00');
  return isNaN(o.getTime()) ? null : o;
}

function examPassed() {
  const o = examDateObj();
  return !!o && o.getTime() < Date.now();
}

function daysToExam() {
  const o = examDateObj();
  if (!o) return null;
  return Math.max(0, Math.ceil((o - Date.now()) / 86400000));
}

/* 「我的 → 我的考试」：名称 + 日期都能改 */
function vExamPick() {
  const cur = examInfo();
  const dn = daysToExam();
  return `
  <div class="sec">我的考试</div>
  <div class="card tight">
    <div class="meta">填你要考的考试和日期，首页倒计时按这个算。四级、六级、雅思、托福、高考、考研都能填。</div>
    <div class="row" style="margin-bottom:8px">
      <input id="examname" value="${esc(cur.name)}" placeholder="考试名称，如 雅思 / 高考"
        style="flex:1;min-width:120px;font-size:13px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-family:inherit">
      <input type="date" id="examdate" value="${cur.date}"
        style="font-size:13px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;font-family:inherit">
      <button class="btn sm" data-examsave="1">保存</button>
    </div>
    <div class="meta">当前：<b>${esc(cur.name)}</b>${
      cur.date ? ' · ' + cur.date : ' · <span style="color:var(--warn)">还没设日期</span>'}${
      cur.custom ? ' · 你自己设的' : ' · 默认值'}${
      examPassed() ? ' · <span style="color:var(--warn)">这场已经结束了</span>' : ''}${
      dn !== null ? ' · 还有 ' + dn + ' 天' : ''}</div>
  </div>`;
}
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
  clearTimeout(el._t);
  // 长提示多留一会儿，否则看不清
  el._t = setTimeout(() => el.classList.add('hide'),
                     Math.min(9000, 2200 + msg.length * 60));
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
/* 同一时刻只保留一个被标记的词，避免越点越花；
   再点同一个词、点空白处、或点弹层里的按钮，都会**取消标记**。 */
let markedEl = null;

function clearMark() {
  if (markedEl) { markedEl.classList.remove('hit', 'miss'); markedEl = null; }
}

document.addEventListener('click', e => {
  const el = e.target.closest('.w');
  const pop = $('#pop');
  if (!el) {
    if (!e.target.closest('#pop')) { clearMark(); pop.classList.add('hide'); }
    return;
  }
  if (el === markedEl) { clearMark(); pop.classList.add('hide'); return; }  // 再点一下 = 取消
  clearMark();
  const raw = el.dataset.w;
  const hit = lookup(raw);
  el.classList.add(hit ? 'hit' : 'miss');
  if (vocab.some(v => v.word === (hit ? hit.word : raw).toLowerCase())) el.classList.add('saved');
  pop.innerHTML = wordPopHtml(raw, hit);
  markedEl = el;
  pop.classList.remove('hide');
});

/* 弹层内容：加"已在生词本"状态 + 划线按钮 */
function wordPopHtml(raw, hit) {
  const lw = raw.toLowerCase();
  const key = (hit ? hit.word : lw).toLowerCase();
  const inVocab = vocab.some(v => v.word === key);
  const ctx = curReadItem();
  const ulOn = ctx ? (((marks[ctx.key] || {}).w) || []).indexOf(lw) >= 0 : false;
  const head = hit
    ? `<b>${esc(hit.word)}</b> ${hit.p ? '<span style="opacity:.7">/' + esc(hit.p) + '/</span>' : ''}
       <div style="margin-top:4px">${esc(hit.m || '（暂无释义）')}</div>`
    : `<b>${esc(raw)}</b><div style="margin-top:4px">本地词库未收录（可先收藏，稍后补释义）</div>`;
  const addBtn = inVocab
    ? `<button class="sec" disabled>已在生词本</button>`
    : `<button data-add="${esc(key)}|${esc(hit ? (hit.p || '') : '')}|${esc(hit ? (hit.m || '') : '')}">加入生词本</button>`;
  const ulBtn = ctx
    ? `<button class="sec" data-markw="${esc(lw)}">${ulOn ? '取消划线' : '划线'}</button>`
    : '';
  return head + `<div class="add">${addBtn}${ulBtn}<button class="sec" data-close="1">关闭</button></div>`;
}

document.addEventListener('click', e => {
  /* 划线 / 取消划线 */
  const mk = e.target.closest('[data-markw]');
  if (mk) {
    const ctx = curReadItem();
    if (ctx) {
      const w = mk.dataset.markw;
      const on = toggleWordMark(ctx.key, w);
      document.querySelectorAll('.w[data-w]').forEach(x => {
        if ((x.dataset.w || '').toLowerCase() === w) x.classList.toggle('ul', on);
      });
      mk.textContent = on ? '取消划线' : '划线';
    }
    return;
  }
  const b = e.target.closest('[data-add]');
  if (b) {
    const [w, p, m] = b.dataset.add.split('|');
    addVocab(w, p, m);
    // 不关闭弹层：让使用者看到"已加入"这个状态变化
    document.querySelectorAll('.w[data-w]').forEach(x => {
      if ((x.dataset.w || '').toLowerCase() === w) x.classList.add('saved');
    });
    b.textContent = '已在生词本';
    b.disabled = true;
    toast('已加入生词本');
    return;
  }
  if (e.target.closest('[data-close]')) { clearMark(); $('#pop').classList.add('hide'); }
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

/* ---------- 正文渲染 ----------
   只把本地词库收录的词包成可点 span。
   查不到的基本是初中阶段的词，本来也不用查 —— 这样点下去必有释义。 */
function wrap(text) {
  return esc(text).replace(/[A-Za-z][A-Za-z'\-]*/g, m => {
    if (!S.dict) return m;
    return lookup(m) ? `<span class="w" data-w="${m}">${m}</span>` : m;
  });
}

/* ---------- 做题时的标记：划线 / 排除选项 ----------
   按"题型:题目id"分开存，重渲染不会丢，也不会串到别的题上。 */
let marks = LS.get('marks', {});    // { 'careful:xxx': { w:['word'], o:['0:2'] } }

function curReadItem() {
  if (route !== 'read') return null;
  const t = S.bank && S.bank.types.find(x => x.type === readType);
  if (!t) return null;
  const i = prog[readType] || 0;
  const it = t.items[i];
  if (!it) return null;
  return { t, i, it, key: readType + ':' + it.id };
}

function getMarks(key) {
  if (!marks[key]) marks[key] = { w: [], o: [] };
  if (!Array.isArray(marks[key].w)) marks[key].w = [];
  if (!Array.isArray(marks[key].o)) marks[key].o = [];
  return marks[key];
}

function toggleWordMark(key, word) {
  const m = getMarks(key);
  const i = m.w.indexOf(word);
  if (i >= 0) m.w.splice(i, 1); else m.w.push(word);
  LS.set('marks', marks);
  return i < 0;                     // true = 现在划上了
}

function toggleOptMark(key, pick) {
  const m = getMarks(key);
  const i = m.o.indexOf(pick);
  if (i >= 0) m.o.splice(i, 1); else m.o.push(pick);
  LS.set('marks', marks);
  return i < 0;
}

/* 渲染完把标记画回去 */
function applyMarks() {
  const ctx = curReadItem();
  document.querySelectorAll('.w[data-w]').forEach(el => {
    const w = (el.dataset.w || '').toLowerCase();
    if (vocab.some(v => v.word === w)) el.classList.add('saved');
    if (ctx) {
      const m = marks[ctx.key];
      if (m && m.w.indexOf(w) >= 0) el.classList.add('ul');
    }
  });
  if (!ctx) return;
  const m = marks[ctx.key];
  if (!m) return;
  document.querySelectorAll('[data-pick]').forEach(el => {
    if (m.o.indexOf(el.dataset.pick) >= 0) el.classList.add('strike');
  });
}

/* ---------- 路由 ---------- */
let route = 'home', readType = 'careful';
let helpOpen = false;      // 右上角「!」展开的说明面板

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
  const dn = daysToExam();
  $('#hdCount').textContent = dn === null ? '未设考试日期'
    : (examPassed() ? '考试已结束' : `距${examShort()} ${dn} 天`);
  $('#hdClock').textContent = `连续 ${streak()} 天`;
}

/* ---------- 首页 ---------- */
function vHome() {
  const total = stats.ans, acc = total ? Math.round(stats.right / total * 100) : 0;
  const nRead = S.bank.types.reduce((a, t) => a + t.items.length, 0);
  return `
  <div class="card tight">
    ${(() => {
      const cur = examInfo(), dn = daysToExam();
      if (dn === null) {
        return `<div class="ttl">还没设置考试</div>
          <div class="meta" style="margin:6px 0 0">去「我的 → 我的考试」填一下考试名称和日期，这里就有倒计时了。</div>`;
      }
      if (examPassed()) {
        return `<div class="ttl">${esc(cur.name)}（${cur.date}）已经结束了</div>
          <div class="meta" style="margin:6px 0 0">去「我的 → 我的考试」改成你要考的下一场。</div>`;
      }
      return `<div class="ttl">距 ${esc(cur.name)} 还有 <span style="color:var(--brand)">${dn}</span> 天</div>
        <div class="meta" style="margin:6px 0 0">${cur.date}${cur.site ? ' · ' + EXAM_STRUCT : ''}。</div>`;
    })()}
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
  if (it.origin === 'mine') return `<span class="tag" style="background:var(--brand-soft);color:var(--brand);border-color:transparent">我的题目</span>`;
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

/* ---------- 我的题目（使用者自己导入，只存在他自己浏览器里） ----------
   设计意图：这个站是"工具"，不是"内容提供方"。
   官方 / 版权资料由使用者自己放进来，内容责任在那个人自己身上。
   和 Anki 一样：Anki 不带内容，牌组由用户自己导入。

   支持的输入：
     1. 文本格式（见 格式示例，照抄即可）—— 给不太懂技术的人用
     2. JSON 格式（本站"导出我的题目"产出的文件）—— 方便同学之间互传
   ---------------------------------------------------------- */

const MYFORMAT_DEMO = `（格式示例，照这个写就行。分节标题决定它归到哪一类，
  只用这四种标题：仔细阅读 / 长篇匹配 / 选词填空 / 听力）

=== 仔细阅读 ===
TITLE: 我的练习 · 仔细阅读
PASSAGE:
Many students believe that the best way to prepare for an examination is to sit still at a desk for hours. Research suggests that this habit may work against them.

A short walk before study can improve attention and memory.
Q: What do many students believe?
A. That they should study in groups.
B. That sitting still for hours is best.
C. That morning study works better.
D. That exercise should come first.
ANSWER: B
EXPLAIN: 解析写在这里，不写也行。
Q: What may improve attention and memory?
A. Studying in groups.
B. Reading aloud for an hour.
C. A short walk before study.
D. Listening to music while reading.
ANSWER: C
EXPLAIN: 第二段第一句直接说了。

=== 选词填空 ===
TITLE: 我的练习 · 选词填空
PASSAGE:
In many cities, people {{1}} to work by bicycle, and the {{2}} has grown quickly in recent years.
OPTIONS: choose number benefit
ANSWERS: 1:choose 2:number

=== 长篇匹配 ===
TITLE: 我的练习 · 长篇匹配
PARAGRAPHS:
A. Many adults begin a new language believing that the best years have passed.
B. When adults and children get the same instruction, adults often progress faster at first.
C. The biggest difficulty for most adult learners is not ability but time.
STATEMENTS:
- Adults think they have missed the best period for learning. | A
- Finding regular time to study is the biggest obstacle. | C

=== 听力 ===
TITLE: 我的练习 · 听力听写
- Many adults begin a new language believing that the best years have passed.
- The biggest difficulty for most adult learners is not ability but time.`;

function myBankTypes() {
  const my = LS.get('mybank', null);
  return (my && Array.isArray(my.types)) ? my.types : [];
}
/* 阅读类条数（不含听力，听力按"句"算） */
function myBankCount() {
  return myBankTypes().filter(t => t.type !== 'listen')
    .reduce((a, t) => a + t.items.length, 0);
}
function myListenCount() {
  const t = myBankTypes().find(x => x.type === 'listen');
  return t ? t.items.length : 0;
}

/* --- 文本格式解析 --- */

function _splitSections(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n');
  const blocks = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*={2,}\s*(.+?)\s*={2,}\s*$/);
    if (m) { cur = { name: m[1].trim(), lines: [] }; blocks.push(cur); continue; }
    if (cur) cur.lines.push(line);
  }
  return blocks;
}

function _parseCareful(lines) {
  let title = '';
  const paras = [], questions = [];
  let buf = [], q = null;
  const flush = () => { const s = buf.join('\n').trim(); if (s) paras.push(s); buf = []; };
  const closeQ = () => { if (q && q.q) questions.push(q); q = null; };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { if (!q) flush(); continue; }
    let m;
    if ((m = t.match(/^TITLE\s*[:：]\s*(.*)$/i))) { title = m[1].trim(); continue; }
    if ((m = t.match(/^PASSAGE\s*[:：]\s*(.*)$/i))) { flush(); if (m[1].trim()) buf.push(m[1].trim()); continue; }
    if ((m = t.match(/^Q\s*[:：]\s*(.*)$/i))) { closeQ(); flush(); q = { q: m[1].trim(), options: [], answer: 0, explain: '' }; continue; }
    if ((m = t.match(/^([A-Da-d])\s*[.．、:：]\s*(.*)$/))) {
      if (q) q.options.push(m[2].trim());
      continue;
    }
    if ((m = t.match(/^ANSWER\s*[:：]\s*([A-Da-d])/i))) {
      if (q) q.answer = m[1].toUpperCase().charCodeAt(0) - 65;
      continue;
    }
    if ((m = t.match(/^EXPLAIN\s*[:：]\s*(.*)$/i))) { if (q) q.explain = m[1].trim(); continue; }
    if (q) { if (q.explain) q.explain += t; else if (!q.options.length) q.q += t; }
    else buf.push(t);
  }
  closeQ(); flush();
  if (!questions.length) return null;
  return { title: title || '我的仔细阅读', passage: paras, questions };
}

function _parseCloze(lines) {
  let title = '', passage = '', options = [], answers = {};
  const buf = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    let m;
    if ((m = t.match(/^TITLE\s*[:：]\s*(.*)$/i))) { title = m[1].trim(); continue; }
    if ((m = t.match(/^PASSAGE\s*[:：]\s*(.*)$/i))) { if (m[1].trim()) buf.push(m[1].trim()); continue; }
    if ((m = t.match(/^OPTIONS\s*[:：]\s*(.*)$/i))) {
      options = m[1].split(/[\s,，、;；]+/).map(s => s.trim()).filter(Boolean);
      continue;
    }
    if ((m = t.match(/^ANSWERS?\s*[:：]\s*(.*)$/i))) {
      const re = /(\d+)\s*[:：.．]\s*([A-Za-z][A-Za-z'\-]*)/g;
      let mm;
      while ((mm = re.exec(m[1]))) answers[mm[1]] = mm[2];
      continue;
    }
    buf.push(t);
  }
  passage = buf.join('\n');
  if (!passage || !Object.keys(answers).length) return null;
  const words = Object.values(answers);
  const extra = words.filter(w => !options.includes(w));
  return { title: title || '我的选词填空', passage, options: options.concat(extra), answers };
}

function _parseMatching(lines) {
  let title = '', mode = '';
  const ps = [], sts = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    let m;
    if ((m = t.match(/^TITLE\s*[:：]\s*(.*)$/i))) { title = m[1].trim(); continue; }
    if (/^PARAGRAPHS?\s*[:：]/i.test(t)) { mode = 'p'; continue; }
    if (/^STATEMENTS?\s*[:：]/i.test(t)) { mode = 's'; continue; }
    if (mode === 'p' && (m = t.match(/^([A-Za-z])\s*[.．、:：]\s*(.*)$/))) {
      ps.push({ letter: m[1].toUpperCase(), text: m[2].trim() });
      continue;
    }
    if (mode === 's' && (m = t.match(/^[-*•]?\s*(.*?)\s*[|｜]\s*([A-Za-z])\s*$/))) {
      sts.push({ s: m[1].trim(), answer: m[2].toUpperCase() });
      continue;
    }
  }
  if (!ps.length || !sts.length) return null;
  return { title: title || '我的长篇匹配', paragraphs: ps, statements: sts };
}

/* 听力：一行一句。可带 "- " 或 "TEXT:" 前缀，也可以直接写句子。
   要求含连续英文字母（≥3 个），否则把中文说明行也当句子了（踩过）。 */
function _parseListen(lines) {
  const out = [];
  for (const raw of lines) {
    let t = raw.trim();
    if (!t) continue;
    if (/^TITLE\s*[:：]/i.test(t)) continue;
    t = t.replace(/^(TEXT|SENTENCE|SENT)\s*[:：]\s*/i, '');
    t = t.replace(/^[-*•]\s+/, '').replace(/^\d+\s*[.)、]\s+/, '');
    t = t.trim();
    if (t.length < 6) continue;
    if (!/[A-Za-z]{3}/.test(t)) continue;   // 不是英文句子，跳过
    out.push(t);
  }
  return out.length ? out : null;
}

function parseMyBankText(text) {
  const out = { careful: [], matching: [], cloze: [], listen: [] };
  const unknown = [];
  let seq = 0;
  for (const b of _splitSections(text)) {
    const nm = b.name;
    let item = null, type = null;
    if (/选词|cloze/i.test(nm)) { item = _parseCloze(b.lines); type = 'cloze'; }
    else if (/匹配|matching/i.test(nm)) { item = _parseMatching(b.lines); type = 'matching'; }
    else if (/听|listen/i.test(nm)) { item = _parseListen(b.lines); type = 'listen'; }
    else if (/阅读|careful|reading/i.test(nm)) { item = _parseCareful(b.lines); type = 'careful'; }
    if (!item) { unknown.push(nm); continue; }
    if (type === 'listen') {
      for (const t of item) {
        seq++;
        out.listen.push({ id: 'mine-listen-' + seq, text: t, origin: 'mine' });
      }
      continue;
    }
    seq++;
    item.id = 'mine-' + type + '-' + seq;
    item.origin = 'mine';
    out[type].push(item);
  }
  return { out, unknown };
}

const MY_TYPE_META = {
  careful: { name: '仔细阅读', score: 14.2, unit: '篇' },
  matching: { name: '长篇匹配', score: 7.1, unit: '篇' },
  cloze: { name: '选词填空', score: 3.55, unit: '篇' },
  listen: { name: '听力听写', score: 0, unit: '句' },
};

function parseMyBankInput(text) {
  const s = String(text || '').trim();
  if (!s) return { ok: false, msg: '内容是空的' };
  // JSON：本站导出的格式
  if (s[0] === '{' || s[0] === '[') {
    let obj;
    try { obj = JSON.parse(s); } catch (e) { return { ok: false, msg: 'JSON 格式有错：' + e.message }; }
    if (Array.isArray(obj)) return { ok: false, msg: '这像是一个数组，请用本站导出的完整文件（含 types 字段）' };
    if (!obj || !Array.isArray(obj.types)) return { ok: false, msg: 'JSON 里没有 types 字段，不是本站导出的格式' };
    const types = obj.types.map(t => ({
      type: t.type, typeName: t.typeName || (MY_TYPE_META[t.type] || {}).name || t.type,
      note: t.note || '', scorePerQ: t.scorePerQ || (MY_TYPE_META[t.type] || {}).score || 0,
      items: (t.items || []).map(i => Object.assign({}, i, { origin: 'mine' })),
    })).filter(t => t.items.length);
    if (!types.length) return { ok: false, msg: 'JSON 里没有任何题目' };
    return { ok: true, types, unknown: [] };
  }
  // 文本格式
  const parsed = parseMyBankText(s);
  const types = [];
  for (const k of ['careful', 'matching', 'cloze', 'listen']) {
    if (!parsed.out[k].length) continue;
    types.push({
      type: k, typeName: (MY_TYPE_META[k] || {}).name || k,
      note: k === 'listen'
        ? '我自己导入的听力句子，只保存在这台设备的浏览器里。'
        : '我自己导入的题目，只保存在这台设备的浏览器里。',
      scorePerQ: (MY_TYPE_META[k] || {}).score || 0,
      items: parsed.out[k],
    });
  }
  if (!types.length) {
    return {
      ok: false,
      msg: '没解析出内容。检查一下是不是缺少 === 仔细阅读 === 这样的分节标题',
      unknown: parsed.unknown,
    };
  }
  return { ok: true, types, unknown: parsed.unknown };
}

/* 把「我的题目」合并进当前题库（重建，避免重复叠加） */
function rebuildBank() {
  if (!S.base) return;
  const clone = JSON.parse(JSON.stringify(S.base));
  const myListen = [];
  const prepend = (types) => {
    for (const t of (types || [])) {
      // 听力是独立的一份数据（S.listen），不在 bank.types 里
      if (t.type === 'listen') { myListen.push.apply(myListen, t.items || []); continue; }
      const bt = clone.types.find(x => x.type === t.type);
      if (bt) bt.items = t.items.concat(bt.items);
      else clone.types.push(t);
    }
  };
  prepend(S.localTypes);
  prepend(myBankTypes());
  S.bank = clone;
  S.bank.hasLocal = S.localCount || 0;
  S.bank.hasMine = myBankCount();
  S.myListenCount = myListen.length;
  if (S.baseListen) {
    S.listen = { note: S.baseListen.note, items: myListen.concat(S.baseListen.items || []) };
  }
}

function importMyBank(text) {
  const r = parseMyBankInput(text);
  if (!r.ok) return r;
  const parts = r.types.map(t => {
    const m = MY_TYPE_META[t.type] || {};
    return (m.name || t.type) + ' ' + t.items.length + (m.unit || '篇');
  });
  const total = r.types.reduce((a, t) => a + t.items.length, 0);
  LS.set('mybank', { version: today(), types: r.types });
  rebuildBank();
  render();
  return { ok: true, n: total, types: parts.join('、'), unknown: r.unknown || [] };
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

  ${vExamPick()}

  <div class="sec">错题本</div>
  ${vWrong()}

  <div class="sec">我的题目（只有我自己看得见）</div>
  <div class="card tight">
    <div class="meta">
      这个站<b>不带任何版权资料</b>；你自己的资料导进来，只存在这台设备的浏览器里。
      ${(myBankCount() || myListenCount())
        ? ` 已导入 <b>${myBankCount()}</b> 篇${myListenCount() ? ' · <b>' + myListenCount() + '</b> 句听力' : ''}，排在每类最前面。`
        : ''}
    </div>
    <div class="row">
      <button class="btn ghost sm" data-mytoggle="1">导入我的题目</button>
      ${(myBankCount() || myListenCount()) ? `<button class="btn ghost sm" data-myexport="1">导出（可以传给别人）</button>
      <button class="btn ghost sm" data-myclear="1">清空</button>` : ''}
    </div>
    <div id="mypanel" style="display:none">
      <div class="meta" style="margin:8px 0 4px">
        分节标题决定它归到哪一类，照着写就行：
      </div>
      <div class="meta" style="font-size:12px;line-height:2;margin-bottom:6px">
        <code>=== 仔细阅读 ===</code> <code>=== 长篇匹配 ===</code><br>
        <code>=== 选词填空 ===</code> <code>=== 听力 ===</code>
      </div>
      <div style="margin:8px 0">
        <input type="file" id="myfile" accept=".txt,.json" style="font-size:12px">
      </div>
      <textarea id="mytext" rows="7" placeholder="也可以直接把内容粘贴在这里"
        style="width:100%;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;font-size:12px;padding:8px;border:1px solid var(--line);border-radius:8px"></textarea>
      <div class="row">
        <button class="btn" data-myimport="1">导入</button>
        <button class="btn ghost sm" data-myfmt="1">看格式示例</button>
      </div>
      <pre id="myfmt" style="display:none;font-size:11px;line-height:1.55;background:var(--bg);padding:10px;border-radius:8px;overflow:auto;margin:0">${esc(MYFORMAT_DEMO)}</pre>
      <div class="meta" style="margin-top:8px">
        ⚠ 只导入<b>你自己有权使用</b>的材料。这个站只是工具，不带内容。
      </div>
    </div>
  </div>

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
/* ---------- 每页的说明（藏在右上角「!」后面，点一下才展开） ---------- */
const HELP = {
  home: {
    t: '首页怎么看',
    items: [
      '<b>倒计时</b>按你在「我的 → 我的考试场次」里选的那一场算，不是写死的。',
      '<b>今天做什么</b>是建议量，做完就行，不用自己加码。',
      '<b>连续打卡</b>指有答题动作的天数，断一天就从头算。',
      '<b>点词怎么用</b>：正文里<b>颜色可点的词</b>就是词库收录的，点一下出释义，能一键收进生词本；再点一下或点空白处取消标记。',
      '题目来源：选词填空与听力取自 <b>Project Gutenberg</b>（公有领域）自动生成；仔细阅读与长篇匹配是原创题；不含真题。',
    ],
  },
  read: {
    t: '阅读怎么用',
    items: [
      '三种题型，分值按真题：<b>仔细阅读 14.2 分/题</b>（最高，优先练）· 长篇匹配 7.1 分/题 · 选词填空 3.55 分/题。',
      '选好答案点 <b>提交</b> 才判分，判完每题都有中文解析。答错的自动进 <b>错题本</b>。',
      '点正文里<b>颜色可点的词</b>：看释义、<b>加入生词本</b>、<b>划线</b>。点同一个词或点空白处取消标记。',
      '已经收进生词本的词会带一条<b>虚线</b>，一眼看得出哪些查过了；划过的线会一直留着。',
      '做题时点选项前面的<b>字母 A / B / C / D</b>，可以把这个选项<b>划掉</b>（不影响你作答），方便用排除法。',
      '如果导入过自己的题目，会带 <b>「我的题目」</b> 标签排在最前面。',
    ],
  },
  listen: {
    t: '听力怎么用',
    items: [
      '点 ▶ 播放（用浏览器自带朗读，不用联网下音频）。',
      '听不清就<b>多点几次</b>，也能切成 0.7× / 0.85× 慢速。',
      '把听到的句子打出来，点 <b>提交</b> 自动比对。',
      '判分<b>忽略大小写和标点</b>，只比单词，不用纠结标点。',
      '实在听不出来点 <b>跳过</b>，后面还会再遇到。',
    ],
  },
  vocab: {
    t: '生词本怎么用',
    items: [
      '<b>不用装 Anki 也能背</b>：点「开始复习」，按遗忘曲线排期（1 → 2 → 4 → 7 → 15 → 30 → 60 天），记得的往后推、忘了的当天再来一遍。',
      '<b>导出 CSV（通用）</b>：Excel / 欧路词典 / 不背单词 / 墨墨 等大多能导入，带 BOM 不乱码。',
      '<b>导出 Anki（TSV）</b>：给装了 Anki 的人，字段顺序是 单词 / 音标 / 释义 / 来源。',
      '生词只存在<b>你自己浏览器</b>里，别人看不到你的。',
    ],
  },
  me: {
    t: '这一页在说什么',
    items: [
      '<b>我的考试</b>：考试名称和日期都自己填，首页倒计时按这个算 —— 四级、六级、雅思、托福、高考、考研都行，站本身不限定考试类型。',
      '<b>我的题目</b>：这个站<b>不带任何版权资料</b>。你自己买的、老师发的资料，导进来只存在你这台设备的浏览器里，不上传、别人看不到。',
      '<b>关于与版权</b>：开源语料取自 Project Gutenberg（公有领域），原创题由作者撰写，<b>不含四级真题</b>。',
      '所有数据（错题 / 生词 / 打卡）都在<b>你自己浏览器本地</b>，清浏览器数据会丢。',
    ],
  },
};

function vHelp() {
  const h = HELP[route] || HELP.home;
  return `<div class="card tight helpcard">
    <div class="h">${esc(h.t)}</div>
    <ul>${h.items.map(x => '<li>' + x + '</li>').join('')}</ul>
  </div>`;
}

function render() {
  header();
  if (route !== 'vocab') vMode = 'list';   // 离开生词页就退出复习态
  const hb = $('#hdHelp');
  if (hb) hb.classList.toggle('on', helpOpen);
  const body = route === 'read' ? vRead()
    : route === 'listen' ? vListen()
    : route === 'vocab' ? vVocab()
    : route === 'me' ? vMe()
    : vHome();
  $('#view').innerHTML = (helpOpen ? vHelp() : '') + body;
  applyMarks();                        // 把划线/排除线画回去
  if (route === 'listen') bindListen();
}

/* ---------- 事件 ---------- */
document.addEventListener('click', e => {
  if (e.target.closest('#hdHelp')) { helpOpen = !helpOpen; render(); return; }
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

  // 点选项前面的字母 = 划掉这个选项（不影响作答），方便用排除法做题
  const kEl = e.target.closest('.k');
  if (kEl && kEl.closest('[data-pick]')) {
    const pkEl = kEl.closest('[data-pick]');
    const ctx = curReadItem();
    if (ctx) {
      const on = toggleOptMark(ctx.key, pkEl.dataset.pick);
      pkEl.classList.toggle('strike', on);
    }
    return;
  }

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
  /* 我的题目：导入 / 导出 / 清空 */
  if (e.target.closest('[data-mytoggle]')) {
    const p = $('#mypanel');
    if (p) p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    return;
  }
  if (e.target.closest('[data-myfmt]')) {
    const p = $('#myfmt');
    if (p) p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    return;
  }
  if (e.target.closest('[data-myimport]')) {
    const ta = $('#mytext');
    const r = importMyBank(ta ? ta.value : '');
    let msg;
    if (r.ok) {
      msg = '识别成功 → ' + r.types;
    } else {
      msg = '导入失败：' + r.msg;
    }
    if (r.unknown && r.unknown.length) {
      msg += '；有分节没认出来：「' + r.unknown.join('」「') +
             '」——分节标题请写成 仔细阅读 / 长篇匹配 / 选词填空 / 听力 之一';
    }
    toast(msg);
    return;
  }
  if (e.target.closest('[data-myexport]')) {
    download(JSON.stringify({
      version: today(), exportedAt: new Date().toISOString(),
      note: '四级训练台 · 我的题目。在「我的 → 导入我的题目」里粘贴或选这个文件即可。',
      types: myBankTypes(),
    }, null, 1), 'cet4_我的题目.json', 'application/json');
    return;
  }
  if (e.target.closest('[data-myclear]')) {
    if (confirm('清空我自己导入的题目？（其它数据不受影响）')) {
      LS.set('mybank', null); rebuildBank(); render(); toast('已清空我的题目');
    }
    return;
  }
  /* 我的考试：名称 + 日期都可改（站不限定考试类型） */
  if (e.target.closest('[data-examsave]')) {
    const nmEl = $('#examname'), dtEl = $('#examdate');
    const nm = ((nmEl && nmEl.value) || '').trim() || '我的考试';
    const dt = (dtEl && dtEl.value) || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) { toast('请先选一个考试日期'); return; }
    LS.set('exam', { name: nm, date: dt });
    render();
    toast('已保存：' + nm + ' · ' + dt);
    return;
  }
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

/* 选了文件 → 读进文本框（让使用者看得见内容，再自己点「导入」） */
document.addEventListener('change', e => {
  if (!e.target || e.target.id !== 'myfile') return;
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    const ta = $('#mytext');
    if (ta) ta.value = String(fr.result || '');
    toast('已读入 ' + f.name + '（' + Math.round(f.size / 1024) + ' KB），点「导入」');
  };
  fr.onerror = () => toast('文件读取失败');
  fr.readAsText(f, 'utf-8');
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
    S.base = bank; S.baseListen = listen; S.listen = listen;

    if (!IN) {
      // 自备题库（site/data/bank.local.json）：只有本地版才有这个文件
      try {
        const local = await fetch('data/bank.local.json').then(r => r.json());
        if (local && Array.isArray(local.types) && local.types.length) {
          S.localTypes = local.types;
          S.localCount = local.types.reduce((a, t) => a + t.items.length, 0);
        }
      } catch (e) { /* 没有本地题库，正常情况 */ }
    }
    // 把「自备材料」和「我自己导入的题目」合并进来。
    // 用重建而不是追加，避免重复调用时越叠越多。
    rebuildBank();

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
