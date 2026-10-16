/* 英语备考训练台 — 纯前端，无后端，进度存本地 */
'use strict';

/* 站名。改名字只改这一处（另外 index.html 的 <title>/<h1> 和
   构建\tools\build_single_file.py 里的文件名也要跟着改）。 */
const APP_NAME = '英语备考训练台';

/* ==================== 考试 与 题型 ====================
   QTYPES 是题型登记表：impl 为 true 才是"能出题、能判分"的题型。
   EXAMS  是考试清单：每个考试如实声明它考核的全部题型。

   ⚠️⚠️ 两条硬规矩（都踩过，别再犯）：

   1. 考试声明的题型必须【如实、完整】—— **包括还没实现的**。
      ⛔ 绝不能因为"没实现"就把某个题型从考试里删掉。
         踩过：四级的 types 里只有仔细阅读/长篇匹配/选词填空/听力听写，
         因为写作和翻译"还没做"就被我漏掉了 ——
         结果四级的结构成了错的（它写作、翻译各占 15%）。
      正确做法：如实列出来，让界面把"还没做"标出来。

   2. 题型清单要按**官方试卷结构**整理，别凭印象。
      四级官方结构（中国教育考试网）：
         写作 15% | 听力理解 25 题 35% | 阅读理解 30 题 35% | 翻译 15%
      顺带一个易错点：**四级听力是"选择题 + 真实音频"，不是"听写"。**
      "听写"是专四（TEM-4）才考的题型。
   ==================================================== */

const QTYPES = {
  careful:   { name: '仔细阅读', impl: true, unit: '篇' },
  matching:  { name: '长篇匹配', impl: true, unit: '篇' },
  cloze:     { name: '选词填空', impl: true, unit: '篇' },
  listen:    { name: '听力听写', impl: true, unit: '句' },
  single:    { name: '单项选择', impl: true, unit: '组' },
  judge:     { name: '判断题',   impl: true, unit: '组' },
  listening: { name: '听力理解', impl: true, unit: '组' },
  quant:     { name: '数学',     impl: true, unit: '组' },
  gap:       { name: '填空题',   impl: true, unit: '篇' },
  write:     { name: '写作',     impl: true, unit: '篇' },
  translate: { name: '翻译',     impl: true, unit: '篇' },
  speak:     { name: '口语',     impl: true, unit: '组' },
};

/* ⚠️ 现在**每一种题型都有内容**，界面上不再有"还没做"这个状态。
   一种题型要么有题，要么显示"还没有题目"（去导入）。
   impl 这个标记保留着，是为了将来真加新题型时能挡住半成品。 */

/* 开放式作答：写 / 译 / 说 —— 没法自动判分，提交后给参考内容自己对照。
   这几类不进正确率统计，只记打卡。 */
const OPEN_TYPES = ['write', 'translate', 'speak'];

/* 这四种题型共用同一个答题界面：材料（可无）+ 若干道带选项的小题。
   判断题的 T/F/NG、GRE 数量比较的四个固定选项，都是"选项写在题目上"，
   所以题目自带的 options 优先，其次是整条题目的 options。 */
const CHOICE_TYPES = ['single', 'judge', 'listening', 'quant'];

/* 考试清单。只收**大学阶段及以上**的考试（本科 / 研究生 / 出国 / 职场），不含中小学。

   ⚠️ 每个考试的 `paper` 是它的**试卷结构**，`types` 完全由 paper 派生 ——
   试卷结构本身就是题型清单，"漏了写作翻译"那种错在结构上不可能再犯。

   一行四个数：
     count  题量
     pct    占比(%) —— 官方试卷结构就是这么公布的
     score  这个题型的**分值**，按本考试的满分制折算
     parts  题量细分（只写事实：几篇、几题，不写说明文字）
     drill  这一行要练的题型。默认就是 t；只有"卷面不细分、但实际要分头练"
            的才需要 —— 比如雅思阅读官方只给"40 题 / 25%"，
            实际上得练 选择 / 判断 / 填空 三种。

   ⚠️⚠️ 分值的尺度必须和**判分**一致。
   四级判分用的是 710 分制（题库里的 scorePerQ：仔细阅读 14.2/题 × 10 = 142、
   长篇阅读 7.1 × 10 = 71、选词填空 3.55 × 10 = 35.5），
   所以这张表也必须是 710 制的折合分。
   ⛔ 之前这里写的是 15 / 35 / 5 / 10 / 20 / 15 —— 那是**百分比**，
      却挂在「分值」列下面，和站内实际判分对不上，是错的。

   ⚠️ 这里**不写任何说明性文字**（出处、通过线、考试时长、注意事项…）。
      要解释就放进右上角「!」的帮助面板（见 HELP）。

   ⚠️ 有的考试分方向（考研英语一/二、雅思 A/G、BEC 初/中/高），
      方向会改变题目构成，放在 `variants` 里，由使用者选一次。
*/

/* 考研英语一 / 英语二：只有 翻译、写作 的分值不同 */
const KY_PAPER = (trPct, wrPct) => [
  { t: 'cloze',     label: '完形填空',        count: 20, pct: 10, score: 10 },
  { t: 'careful',   label: '阅读理解 Part A', count: 20, pct: 40, score: 40 },
  { t: 'matching',  label: '阅读 Part B（新题型）', count: 5, pct: 10, score: 10 },
  { t: 'translate', label: '翻译',            count: 5,  pct: trPct, score: trPct },
  { t: 'write',     label: '写作',            count: 2,  pct: wrPct, score: wrPct,
    parts: '应用文 + 短文' },
];

/* 雅思 A 类 / G 类：题量和占比完全一样（四项各 25%），
   差在阅读的文章类型和写作 Task 1 的形式 */
const IELTS_PAPER = cls => [
  { t: 'listening', label: '听力', count: 40, pct: 25, parts: '4 段录音' },
  // 官方只给"阅读 40 题 / 25%"，不细分；但实际要练这三种
  { t: 'single',    label: '阅读', count: 40, pct: 25,
    parts: cls === 'a'
      ? '3 篇长文 · 选择 · 判断（T/F/NG）· 标题匹配 · 填空 / 简答'
      : '5 个部分 · 生活题材 · 判断 · 匹配 · 填空 / 简答',
    drill: ['single', 'judge', 'gap'] },
  { t: 'write',     label: '写作', count: 2, pct: 25,
    parts: cls === 'a'
      ? 'Task 1 图表描述 150 词 · Task 2 议论文 250 词'
      : 'Task 1 书信 150 词 · Task 2 议论文 250 词' },
  { t: 'speak',     label: '口语', count: 3, pct: 25, parts: '3 个部分' },
];

/* BEC 初 / 中 / 高：四项各占 25%，但**总分的量表上限不一样**
   （剑桥英语分数量表：初级 102–170、中级 122–190、高级 142–210），
   阅读的"部分数"也不同（7 / 5 / 6）—— 这是各级别唯一确切的差别，
   题量本身都是 阅读 45 + 听力 30 + 写作 2 + 口语 3。
   分值列留空：剑桥只公布"四科单项分的平均分即总分"，
   不给每部分占多少分，硬折算就是编数字。 */
const BEC_PAPER = part => [
  { t: 'single',    label: '阅读', count: 45, pct: 25, parts: part + ' 个部分' },
  { t: 'write',     label: '写作', count: 2,  pct: 25 },
  { t: 'listening', label: '听力', count: 30, pct: 25 },
  { t: 'speak',     label: '口语', count: 3,  pct: 25 },
];

const EXAMS = [
  /* ———————————————— 大学 ———————————————— */
  { id: 'cet4', group: '大学', name: '大学英语四级（CET-4）', short: '大学英语四级',
    q: 57, full: 710,
    paper: [
      { t: 'write',     label: '写作',     count: 1,  pct: 15, score: 106.5 },
      { t: 'listening', label: '听力理解', count: 25, pct: 35, score: 248.5,
        parts: '短篇新闻 7 · 长对话 8 · 听力篇章 10' },
      { t: 'cloze',     label: '选词填空', count: 10, pct: 5,  score: 35.5 },
      { t: 'matching',  label: '长篇阅读', count: 10, pct: 10, score: 71 },
      { t: 'careful',   label: '仔细阅读', count: 10, pct: 20, score: 142 },
      { t: 'translate', label: '翻译',     count: 1,  pct: 15, score: 106.5 },
    ] },

  { id: 'cet6', group: '大学', name: '大学英语六级（CET-6）', short: '大学英语六级',
    q: 57, full: 710,
    paper: [
      { t: 'write',     label: '写作',     count: 1,  pct: 15, score: 106.5 },
      { t: 'listening', label: '听力理解', count: 25, pct: 35, score: 248.5,
        parts: '长对话 8 · 听力篇章 7 · 讲话/报道/讲座 10' },
      { t: 'cloze',     label: '选词填空', count: 10, pct: 5,  score: 35.5 },
      { t: 'matching',  label: '长篇阅读', count: 10, pct: 10, score: 71 },
      { t: 'careful',   label: '仔细阅读', count: 10, pct: 20, score: 142 },
      { t: 'translate', label: '翻译',     count: 1,  pct: 15, score: 106.5 },
    ] },

  { id: 'tem4', group: '大学', name: '英语专业四级（TEM-4）', short: '英语专业四级',
    q: 67, full: 100,
    paper: [
      { t: 'listen',    label: '听写',     count: 1,  pct: 10, score: 10 },
      { t: 'listening', label: '听力理解', count: 20, pct: 20, score: 20,
        parts: '讲座 10 · 对话 10' },
      { t: 'single',    label: '语言知识', count: 20, pct: 20, score: 20 },
      { t: 'cloze',     label: '完形填空', count: 10, pct: 10, score: 10 },
      { t: 'careful',   label: '阅读理解', count: 15, pct: 20, score: 20 },
      { t: 'write',     label: '写作',     count: 1,  pct: 20, score: 20,
        parts: '便条 + 作文' },
    ] },

  { id: 'kaoyan', group: '大学', name: '考研英语', short: '考研英语',
    q: 52, full: 100,
    variants: [
      { id: 'en1', name: '英语一', note: '学术型硕士', paper: KY_PAPER(10, 30) },
      { id: 'en2', name: '英语二', note: '专业型硕士', paper: KY_PAPER(15, 25) },
    ],
    paper: KY_PAPER(10, 30) },

  /* ———————————————— 出国 ———————————————— */
  { id: 'ielts', group: '出国', name: '雅思 IELTS', short: '雅思',
    q: 85, full: 9,
    variants: [
      { id: 'a', name: 'A 类（学术）', note: '出国留学用', paper: IELTS_PAPER('a') },
      { id: 'g', name: 'G 类（培训）', note: '移民 / 工作用', paper: IELTS_PAPER('g') },
    ],
    paper: IELTS_PAPER('a') },

  { id: 'toefl', group: '出国', name: '托福 TOEFL iBT', short: '托福',
    q: 54, full: 120,
    paper: [
      { t: 'single',    label: '阅读', count: 20, pct: 25, score: 30, parts: '2 篇' },
      { t: 'listening', label: '听力', count: 28, pct: 25, score: 30 },
      { t: 'speak',     label: '口语', count: 4,  pct: 25, score: 30 },
      { t: 'write',     label: '写作', count: 2,  pct: 25, score: 30,
        parts: '综合写作 + 学术讨论' },
    ] },

  { id: 'duolingo', group: '出国', name: '多邻国英语测试（DET）', short: '多邻国',
    full: 160,
    paper: [
      { t: 'single',    label: '选择', count: 0, pct: 0, parts: '读选 · 听选' },
      { t: 'judge',     label: '判断', count: 0, pct: 0, parts: '真词 / 假词' },
      { t: 'gap',       label: '填空', count: 0, pct: 0, parts: '读填空 · 听写' },
      { t: 'listening', label: '听力', count: 0, pct: 0 },
      { t: 'write',     label: '写作', count: 0, pct: 0, parts: '看图写作 · 写作样本' },
      { t: 'speak',     label: '口语', count: 0, pct: 0, parts: '看图说话 · 口语样本' },
    ] },

  { id: 'pte', group: '出国', name: 'PTE Academic', short: 'PTE',
    full: 90,
    paper: [
      { t: 'speak',     label: '口语', count: 0, pct: 0, parts: '朗读 · 复述 · 描述图表' },
      { t: 'write',     label: '写作', count: 0, pct: 0, parts: '总结听写 · 议论文' },
      { t: 'single',    label: '阅读', count: 0, pct: 0 },
      { t: 'gap',       label: '填空', count: 0, pct: 0 },
      { t: 'listening', label: '听力', count: 0, pct: 0 },
    ] },

  { id: 'gre', group: '出国', name: 'GRE', short: 'GRE',
    q: 55, full: 340,
    // 官方：文字推理 2 部分 27 题（130–170 分）、数量推理 2 部分 27 题（130–170 分）、
    //       分析性写作 1 题（0–6 分，单独计分，不计入 340）
    paper: [
      { t: 'single', label: '文字推理（Verbal）', count: 27, pct: 50, score: 170,
        parts: '填空（Text Completion · Sentence Equivalence）· 阅读理解',
        drill: ['single', 'gap'] },
      { t: 'quant',  label: '数量推理（Quant）', count: 27, pct: 50, score: 170,
        parts: '数量比较 · 单选 · 数值填空' },
      { t: 'write',  label: '分析性写作', count: 1, pct: 0, score: null,
        parts: 'Analyze an Issue（单独计分 0–6）' },
    ] },

  { id: 'sat', group: '出国', name: 'SAT', short: 'SAT',
    q: 98, full: 1600,
    paper: [
      { t: 'single', label: '阅读与文法', count: 54, pct: 50, score: 800 },
      { t: 'single', label: '数学',       count: 44, pct: 50, score: 800 },
    ] },

  /* ———————————————— 职场 ———————————————— */
  { id: 'bec', group: '职场', name: '商务英语 BEC', short: 'BEC',
    q: 80, full: 170,
    variants: [
      { id: 'p', name: '初级', note: 'Preliminary · 满分 170',
        full: 170, paper: BEC_PAPER(7) },
      { id: 'v', name: '中级', note: 'Vantage · 满分 190',
        full: 190, paper: BEC_PAPER(5) },
      { id: 'h', name: '高级', note: 'Higher · 满分 210',
        full: 210, paper: BEC_PAPER(6) },
    ],
    paper: BEC_PAPER(7) },

  { id: 'toeic', group: '职场', name: '托业 TOEIC（听力与阅读）', short: '托业',
    q: 200, full: 990,
    paper: [
      { t: 'listening', label: '听力', count: 100, pct: 50, score: 495,
        parts: '照片 6 · 问答 25 · 对话 39 · 独白 30' },
      { t: 'single',    label: '阅读', count: 100, pct: 50, score: 495,
        parts: '句子填空 30 · 短文填空 16 · 阅读理解 54' },
    ] },
];

/* ---------- 每场考试**自己的**配置：方向 + 考试日期 ----------
   ⚠️ 别把方向/日期塞进"当前看的是哪一场"那个槽位（键 `exam`）——
      那样一换考试就被清掉：同时备考四级(6 月)和雅思(8 月)的人，
      来回切一次，另一个的日期和方向就全没了。
      所以：`exam` 只记"现在看哪一场"，方向/日期按考试各存一份。 */
function cfgKey(id) { return 'examcfg:' + id; }
function getCfg(id) { return LS.get(cfgKey(id), null) || {}; }
function setCfg(id, patch) {
  const rec = Object.assign({}, getCfg(id), patch);
  Object.keys(rec).forEach(k => {
    if (rec[k] === null || rec[k] === undefined || rec[k] === '') delete rec[k];
  });
  LS.set(cfgKey(id), rec);
  return rec;
}

/* 有方向的考试：拿到"当前生效的方向"。
   ⚠️ vid 参数很关键 —— 确认页上方向还没落盘（存在 onboardVariant 里），
      只看本地存储的话，页面上选什么都读不到，表格永远显示基础卷面。
      踩过：考研英语一/二点了没区别，就是因为这里只认存储里的值。 */
function variantFor(ex, vid) {
  ex = ex || curExam();
  if (vid) return (ex.variants || []).find(v => v.id === vid) || null;
  const cur = getCfg(ex.id).variant;
  if (!cur) return null;
  return (ex.variants || []).find(v => v.id === cur) || null;
}
function curVariant(ex) { return variantFor(ex, null); }

/* 当前方向下的试卷结构。方向自带 paper 就用它的
   （考研英语一/二只有翻译和写作的分值不同） */
function paperOf(ex, vid) {
  ex = ex || curExam();
  const v = variantFor(ex, vid);
  if (v && v.paper && v.paper.length) return v.paper;
  return ex.paper || [];
}

/* 本场考试的满分（四级 710、托福 120、雅思 9…） */
function fullOf(ex, vid) {
  ex = ex || curExam();
  const v = variantFor(ex, vid);
  return (v && v.full) || ex.full || null;
}

/* 本场考试的卷面总题量 */
function qOf(ex, vid) {
  ex = ex || curExam();
  const v = variantFor(ex, vid);
  return (v && v.q) || ex.q || null;
}

/* 题型从试卷结构派生 —— 唯一来源。
   row.t 是这一行的主题型；row.drill 是"官方不细分、但要分头练"的额外题型
   （目前只有雅思阅读用：官方只给"40 题 / 25%"，实际要练选择/判断/填空）。 */
function typesOf(ex, vid) {
  ex = ex || curExam();
  const seen = [];
  paperOf(ex, vid).forEach(p => {
    [p.t].concat(p.drill || []).forEach(t => {
      if (t && seen.indexOf(t) < 0) seen.push(t);
    });
  });
  return seen;
}

/* 某个题型在当前考试里的规格（题量 / 占比 / 分值 / 细分）。
   注意 drill：雅思阅读那行官方只给"40 题 / 25%"，实际要练选择/判断/填空，
   所以按 drill 反查时要能命中那一行。 */
function paperRowOf(typeId, ex, vid) {
  const rows = paperOf(ex, vid).filter(r =>
    r.t === typeId || (r.drill || []).indexOf(typeId) >= 0);
  if (!rows.length) return null;
  const sum = k => rows.reduce((n, r) => n + (r[k] || 0), 0);
  return {
    label: rows[0].label,
    count: sum('count'), pct: sum('pct'), score: sum('score'),
    // drilling = 官方没单独给这个题型数字（雅思阅读），数字属于整行
    drilling: rows[0].t !== typeId,
  };
}

/* 这一题答对折算多少分 = 该题型的分值 ÷ 题量。
   四级：仔细阅读 142÷10 = 14.2、选词填空 35.5÷10 = 3.55 —— 与官方折合分一致。
   雅思/多邻国那种官方不给分项分值的返回 null，页面就不显示折算分了。 */
function scorePerQOf(typeId, ex, vid) {
  const r = paperRowOf(typeId, ex, vid);
  if (r && r.count > 0 && r.score > 0) return r.score / r.count;
  return null;
}

/* 表尾「合计」。用考试自己声明的总数 —— 它才是这场考试的卷面总量；
   靠每行相加会算少（雅思阅读那行官方不给细分题量/分值）。 */
function paperTotals(ex, vid) {
  ex = ex || curExam();
  const rows = paperOf(ex, vid);
  // 占比：把**有占比的行**加起来，正好 100 就是 100%。
  // 不要求"每行都有" —— GRE 的写作不计入 340，它没有占比，
  // 但不该因此把整行合计拖成 "—"。自适应考试（多邻国 / PTE）每行都是 0，
  // 加起来是 0，合计自然显示 "—"，这符合"官方本来就没有"的事实。
  const sumPct = rows.reduce((n, r) => n + (r.pct || 0), 0);
  return {
    q: qOf(ex, vid), full: fullOf(ex, vid),
    pct: Math.abs(sumPct - 100) < 0.001 ? 100 : null,
  };
}

/* 试卷结构表 —— 选考试页 和「我的考试」两处共用。
   ⚠️ 列名必须是「占比」而不是「分值」：官方公布的卷面结构给的是百分比，
      而「分值」那列是**折算到本考试满分制**的实际分数。
      四级按 710 制：写作 106.5 / 听力 248.5 / 选词 35.5 / 长篇 71 /
      仔细 142 / 翻译 106.5 —— 和站内判分（scorePerQ）是同一把尺子。
   ⛔ 曾经把百分比填在「分值」列下（15/35/5/10/20/15），是错的。 */
function paperTable(ex, vid) {
  const rows = paperOf(ex, vid);
  if (!rows.length) return '<div class="empty">这个考试没有固定卷面。</div>';
  const t = paperTotals(ex, vid);
  const cell = v => (v || v === 0) && v !== 0 ? String(v) : '<i>—</i>';
  return `<table class="pt">
    <thead><tr><th>题型</th><th class="num">题量</th>
      <th class="num">占比</th><th class="num">分值</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td><b>${esc(r.label)}</b>${
        r.parts ? `<span class="pr">${esc(r.parts)}</span>` : ''}</td>
      <td class="num">${cell(r.count)}</td>
      <td class="num">${r.pct ? esc(r.pct) + '%' : '<i>—</i>'}</td>
      <td class="num">${cell(r.score)}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr>
      <td>合计</td>
      <td class="num">${cell(t.q)}</td>
      <td class="num">${t.pct ? t.pct + '%' : '<i>—</i>'}</td>
      <td class="num">${cell(t.full)}</td>
    </tr></tfoot>
  </table>`;
}

/* 方向选择器 —— 考研英语一/二、雅思 A/G、BEC 初/中/高。
   方向会改变题目构成，所以要让人选一次。note 只挂在 title 上，不上屏。 */
function variantRow(ex, active) {
  if (!(ex.variants || []).length) return '';
  return `<div class="row" style="margin:0;gap:6px;flex-wrap:wrap">
    ${ex.variants.map(v => `<button class="btn ${v.id === active ? '' : 'ghost'} sm"
      data-exv="${ex.id}:${v.id}" title="${esc(v.note || '')}"
      style="font-size:12px;padding:5px 10px">${esc(v.name)}</button>`).join('')}
  </div>`;
}

const EXAMS_BY_ID = {};
EXAMS.forEach(e => { EXAMS_BY_ID[e.id] = e; });
const DEFAULT_EXAM_ID = 'cet4';

function curExam() {
  const sel = LS.get('exam', null);
  if (sel && sel.id && EXAMS_BY_ID[sel.id]) return EXAMS_BY_ID[sel.id];
  return EXAMS_BY_ID[DEFAULT_EXAM_ID];
}

/* 写考试选择。
   patch.id  = 换到哪一场（只改"现在看的是哪一场"，不动别场的东西）
   patch.variant / patch.date = 这一场**自己的**方向 / 日期
   同一场考试的日期和方向互不干扰（踩过：改个日期把方向弄丢）。 */
function setExam(patch) {
  patch = patch || {};
  const id = patch.id || (LS.get('exam', null) || {}).id || DEFAULT_EXAM_ID;
  LS.set('exam', { id });
  const cfg = {};
  if ('variant' in patch) cfg.variant = patch.variant;
  if ('date' in patch) cfg.date = patch.date;
  if (Object.keys(cfg).length) setCfg(id, cfg);
  return Object.assign({ id }, getCfg(id));
}

/* 老版本把方向 / 日期和历史选的考试挤在同一个槽位里；「我的题目」也只有一份、
   所有考试共用。这里一次性搬到"每场考试各一份"的新位置，避免老用户升级后
   日期凭空消失、导入的题目乱串（搬完就把旧字段摘掉，之后只走新键）。 */
function migrateExamCfg() {
  const old = LS.get('exam', null);
  if (old && old.id) {
    if (old.variant || old.date) {
      setCfg(old.id, { variant: old.variant, date: old.date });
      LS.set('exam', { id: old.id });
    }
  }
  /* 「我的题目」原来是一坨 {types:[...]}，现在是"一叠试卷"。
     老数据收成一张叫「我导入的题目」的卷子，别让它凭空消失。 */
  EXAMS.forEach(e => {
    const om = LS.get('mybank:' + e.id, null);
    if (om && Array.isArray(om.types) && om.types.length && !LS.get('papers:' + e.id, null)) {
      LS.set('papers:' + e.id, { v: 2, list: [{
        id: 'pmig', name: '我导入的题目', src: 'mybank-migrated', addedAt: today(),
        types: om.types, marks: {}, audio: [], group: '',
      }] });
      LS.set('mybank:' + e.id, null);
    }
  });
  const my = LS.get('mybank', null);
  if (my && Array.isArray(my.types) && my.types.length) {
    const id = (old && old.id && EXAMS_BY_ID[old.id]) ? old.id : DEFAULT_EXAM_ID;
    if (!LS.get('mybank:' + id, null)) LS.set('mybank:' + id, my);
    LS.set('mybank', null);
  }
  /* 生词本和打卡原来是不分考试的（一份全局的）。
     现在全按考试分了 —— 老数据搬到"当时选的那场考试"名下，别让它凭空消失。 */
  const v = LS.get('vocab', null);
  if (Array.isArray(v) && v.length) {
    const id = (old && old.id && EXAMS_BY_ID[old.id]) ? old.id : DEFAULT_EXAM_ID;
    if (!LS.get('vocab:' + id, null)) LS.set('vocab:' + id, v);
    LS.set('vocab', null);
  }
  const d = LS.get('days', null);
  if (Array.isArray(d) && d.length) {
    const id = (old && old.id && EXAMS_BY_ID[old.id]) ? old.id : DEFAULT_EXAM_ID;
    if (!LS.get('days:' + id, null)) LS.set('days:' + id, d);
    LS.set('days', null);
  }
}

/* 答题记录的键原来少一层：ans:<考试>:<题型>:<第几题>。
   现在多了"哪张卷子"（答案见 ansKey），因为站里自带了 30 套真题之后，
   "第 3 篇仔细阅读"在不同卷子里是**两道不同的题**。
   这里把老键补上卷子 id —— 不然做过的东西全变回"没做过"。
   ⚠️ 认得出是"老键"才动：段数 === 4，且第三段是个已知题型名。 */
function migrateAnsKeys() {
  if (LS.get('anskeys:migrated', false)) return;
  try {
    EXAMS.forEach(ex => {
      const pid = LS.get('paper:' + ex.id, '') || '';
      LS.keys('ans:' + ex.id + ':').concat(LS.keys('draft:' + ex.id + ':'))
        .forEach(full => {
          const raw = full.replace(/^cet4:/, '');
          const seg = raw.split(':');
          if (seg.length !== 4 || !QTYPES[seg[2]]) return;
          const nk = 'cet4:' + seg[0] + ':' + seg[1] + ':' + (pid || 'base')
            + ':' + seg[2] + ':' + seg[3];
          if (localStorage.getItem(nk) != null) return;
          localStorage.setItem(nk, localStorage.getItem(full));
          localStorage.removeItem(full);
        });
    });
  } catch (e) { /* 迁移失败不影响使用，最多是进度显示成 0 */ }
  LS.set('anskeys:migrated', true);
}

/* 当前考试信息。日期：使用者填过就用他填的，否则用考试自带的（可能为空）。
   types / paper / total 都从试卷结构派生，不单独维护。 */
function examInfo() {
  const ex = curExam();
  const cfg = getCfg(ex.id);
  const custom = !!cfg.date;
  const v = curVariant(ex);
  return {
    id: ex.id, name: ex.name, short: ex.short || ex.name,
    date: custom ? cfg.date : (ex.date || ''),
    types: typesOf(ex), paper: paperOf(ex),
    q: qOf(ex), full: fullOf(ex),
    variants: ex.variants || [], variant: v ? v.id : null,
    variantName: v ? v.name : '',
    custom,
  };
}

function examShort() { return examInfo().short || '考试'; }

/* 这个考试里的题型（implTypes / missingTypes 现在都返回全部 / 空，
   留着是为了将来加半成品题型时还能挡住） */
function implTypes(id) {
  const ex = EXAMS_BY_ID[id || examInfo().id] || {};
  return typesOf(ex).filter(t => (QTYPES[t] || {}).impl);
}
function missingTypes(id) {
  const ex = EXAMS_BY_ID[id || examInfo().id] || {};
  return typesOf(ex).filter(t => !(QTYPES[t] || {}).impl);
}

/* 阅读类题型（它们共用"阅读"页里的那排 tab） */
const READ_TYPES = ['careful', 'matching', 'cloze', 'single', 'judge', 'gap'];
function examReadTypes(id) {
  return implTypes(id).filter(t => READ_TYPES.indexOf(t) >= 0);
}
function examHasListen(id) {
  return implTypes(id).indexOf('listen') >= 0;
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

/* 「我的 → 我的考试」：换考试 + 选方向 + 看试卷结构 + 填日期 */
function vExamPick() {
  const cur = examInfo();
  const ex = curExam();
  const dn = daysToExam();
  const groups = [];
  EXAMS.forEach(e => {
    let g = groups.find(x => x.n === e.group);
    if (!g) { g = { n: e.group, items: [] }; groups.push(g); }
    g.items.push(e);
  });
  const tot = paperTotals(ex);
  return `
  <div class="sec">我的考试</div>
  <div class="card tight">
    ${groups.map(g => `
      <div class="meta" style="margin:10px 0 5px;color:var(--fg3)">${esc(g.n)}</div>
      <div class="row" style="margin:0;gap:6px;flex-wrap:wrap">
        ${g.items.map(e => `<button class="btn ${e.id === cur.id ? '' : 'ghost'} sm" data-exam="${e.id}"
          style="font-size:12px;padding:5px 10px">${esc(e.short || e.name)}</button>`).join('')}
      </div>`).join('')}
  </div>

  <div class="sec">当前：${esc(cur.name)}${cur.variantName ? ' · ' + esc(cur.variantName) : ''}</div>

  ${(cur.variants || []).length ? `<div class="card tight">
    ${variantRow(ex, cur.variant)}
  </div>` : ''}

  <div class="card tight">
    <details class="fold">
      <summary>试卷结构${
        tot.q ? ` · ${tot.q} 题` : ''}${tot.full ? ` · ${tot.full} 分` : ''}</summary>
      ${paperTable(ex)}
    </details>
  </div>

  <div class="sec">考试日期</div>
  <div class="card tight">
    <div class="row" style="margin:0">
      <input type="date" id="examdate" value="${cur.date}"
        style="font-size:13px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-family:inherit">
      <button class="btn sm" data-examsave="1">保存</button>
    </div>
    ${dn !== null ? `<div class="meta" style="margin:7px 0 0">还有 <b>${dn}</b> 天</div>` : ''}
  </div>
`;}

const S = { bank: null, dict: null, listen: null, builtin: null };
const LS = {
  get(k, d) { try { const v = localStorage.getItem('cet4:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cet4:' + k, JSON.stringify(v)); } catch (e) {} },
  keys(prefix) {
    try { return Object.keys(localStorage).filter(k => k.indexOf('cet4:' + prefix) === 0); }
    catch (e) { return []; }
  }
};

/* ---------- 「这场考试自己的数据」----------
   ⚠️ 全部必须**按考试分开**，否则换考试就会留下上一场的痕迹。
      用户的要求原话是"这些考试都应该有自己独立的东西，
      不要出现不该混着用的东西"，首页那四块统计（连续打卡 / 累计答题 /
      正确率 / 错题·生词）一个都不能串。
     stats  累计答题 / 正确率
     wrong  错题本
     marks  划线和排除选项
     vocab  生词本（连复习排期一起）
     days   打卡
   ⚠️ 注意：最早我把生词本和打卡当成"跨考试积累的"故意没分开，
      但那样一换考试，首页数字就还是上一场的 —— 用户明确要求全部独立。 */
let stats = { ans: 0, right: 0 };
let wrong = [];
let marks = {};
let vocab = [];
let days = [];
/* 「练到第几篇」的游标也是按卷子分的 —— 换一张卷子不该接着上一张的位置。 */
function progKey() { return 'prog:' + curExam().id + ':' + (activePaperId() || '-'); }
function scopeKeys() {
  const id = curExam().id;
  return { stats: 'stats:' + id, wrong: 'wrong:' + id, marks: 'marks:' + id,
           prog: progKey(), vocab: 'vocab:' + id, days: 'days:' + id };
}
let scopedFor = null;      // 当前内存里这几样是给哪场考试装的
/* ⚠️ 自愈：只要发现当前考试和内存里装的那套不一致，就重新装一遍。
   为什么需要它 —— 换考试有好几条路径（「我的」页点击、方向切换、首次选完），
   任何一条忘了调 loadExamScoped() 都会出现"上一场的数据串过来"。
   挂在 render() 上就不可能漏。 */
function ensureExamScoped() {
  const id = curExam().id;
  if (scopedFor === id) return;
  loadExamScoped();
  rebuildBank();             // 我导入的题目也按考试重筛
  importReport = null;       // 上一场考试的导入报告别跟过来
  /* 下面这几样是**没落盘的内存状态**，换考试时必须一并丢掉：
     ⚠️ draft 尤其危险 —— 它的 key 是「题型:第几题」，不带考试，
        换考试后 key 照样对得上，于是**上一场没写完的答案会原样出现在
        这一场的同一题上**。表现出来就是"我明明没做这题，怎么已经填好了"。
     vQueue 是生词复习队列，拿着的是上一场那批词的引用。
     spk 是口语计时器，不掐掉会一直在后台数秒并试图去画已经不在的时钟。 */
  draft = null;
  vQueue = [];
  li = 0;
  if (spk.t) { clearInterval(spk.t); spk.t = null; spk.phase = null; }
  scopedFor = id;
}

function loadExamScoped() {
  const k = scopeKeys();
  stats = LS.get(k.stats, { ans: 0, right: 0 }) || { ans: 0, right: 0 };
  wrong = LS.get(k.wrong, []) || [];
  marks = LS.get(k.marks, {}) || {};
  prog = LS.get(k.prog, {}) || {};
  vocab = LS.get(k.vocab, []) || [];
  days = LS.get(k.days, []) || [];
}

/* ---------- 我的题目的进度与统分 ----------
   ⚠️ 原来有「整套卷子 / 我的题目」两个口径，现在**只留我的题目**。
      理由：使用者导入的一般就是卷子本身；而且按"整套卷子"算的话，
      只导了几篇时进度条永远停在个位数，看着像坏了。
   现在的算法：
     分母 = 我这份/这些试卷里实际有多少题（**少了题型总分会跟着少**，
            这就是"只导了一部分也仍然算一套卷子"的意思）
     统分 = 答对的小题数 × 该题型每题分值
            每题分值优先用**试卷里标出来的**（"每题 2 分"/"共 10 分"），
            没标就按这场考试的标准（四级仔细阅读 142÷10 = 14.2）。 */

/* 当前范围里"值得列出来"的题型：只列我真有题的 —— 别的点进去只会是空的 */
function activeTypes() {
  return typesOf(curExam()).filter(t => typeCountNow(t) > 0);
}
/* 当前题库里这个题型有多少条（listen 不在 bank.types 里，走 S.listen） */
function typeCountNow(t) {
  if (t === 'listen') return listenCountNow();
  const bt = S.bank && S.bank.types.find(x => x.type === t);
  return bt ? bt.items.length : 0;
}
function listenCountNow() {
  return (S.listen && S.listen.items) ? S.listen.items.length : 0;
}
/* 听写题的作答记录键是 lc:<考试>:<题目id>，不走 ans: —— 别忘了算进进度 */
function listenDoneCount() { return LS.keys('lc:' + curExam().id + ':').length; }
function scopeDoneCount(t) {
  return t === 'listen' ? listenDoneCount() : doneCountOf(t);
}
/* 这个题型里**已经做了几个计分单位**（交了卷的条目按它自己的单位数加）。
   进度条的分子用它 —— 和统分用的是同一把尺子。 */
function scopeDoneUnits(t) {
  let n = 0;
  (t.items || []).forEach((it, i) => {
    if (LS.get(ansKey(t.type, i), null)) n += unitCountOf(t.type, [it]);
  });
  return n;
}

/* 这个题型里"一个计分单位"有几项：
   仔细阅读/听力/判断/单选/数学 → 小题数；匹配 → 句子数；选词/填空 → 空位数 */
function unitCountOf(type, items) {
  let n = 0;
  (items || []).forEach(it => {
    if (type === 'matching') n += (it.statements || []).length;
    else if (type === 'cloze' || type === 'gap') n += Object.keys(it.answers || {}).length;
    else if (OPEN_TYPES.indexOf(type) >= 0) n += 1;
    else n += (it.questions || []).length;
  });
  return n;
}
/* 一整张卷子的计分单位数（题 / 空 / 句）—— 「我的」页卡片上那个「共 N 题」。
   ⚠️ 必须和进度条的分母**用同一把尺子**，否则两个数字会互相打脸。
   踩过：听写（listen）的条目只有 {id,text}，没有 questions，
   unitCountOf 会算成 0 —— 结果专四样卷卡片写着「共 26 题」，
   点进去进度条分母却是 32（把 6 句听写算了进去）。
   进度那边是 scopeProgress() 单独特判 listen 的，这里也得跟上。 */
function paperUnitsOf(p) {
  return (p.types || []).reduce((a, t) => a
    + (t.type === 'listen' ? (t.items || []).length
                           : unitCountOf(t.type, t.items)), 0);
}

/* 某个题型"每题/每空多少分"：试卷里标过就用标的，否则按考试标准 */
function perScoreOf(type) {
  const ov = paperMarkOf(type);
  if (ov) return ov;
  return scorePerQOf(type);
}
/* 试卷里标了分值的题型，按整份试卷算总分 */
function scopeProgress() {
  /* ⚠️ 分母只算**这套卷子** —— 站内自带的那点原创题不混进来。
     使用者要的是"我这份卷子做了多少"，把别的东西算进来就说不清了。 */
  const mine = myBankTypes();
  const types = [];
  let total = 0, done = 0, full = 0, got = 0, right = 0, openFull = 0, scored = false;
  mine.forEach(t => {
    if (t.type === 'listen') return;         // 听写单独算（在 S.listen 里）
    const n = (t.items || []).length;
    if (!n) return;
    types.push(t.type);
    /* ⚠️ 分母用**计分单位**（题 / 空 / 句），不是"几篇"。
       踩过：按"篇"算的时候，一整份四级卷只有 7 篇 —— 进度条走一格
       就是 14%，看着像坏了。按题算才是 57 题、满分 710。 */
    const units = unitCountOf(t.type, t.items);
    total += units;
    done += Math.min(scopeDoneUnits(t), units);
    const r1 = correctCountOf(t);
    right += r1;
    const per = perScoreOf(t.type);
    if (!per) return;
    /* 写作 / 翻译没有客观答案，判不了分 —— 计入分母会变成
       "满分 710 但你最多只能拿 497"，所以单独列出来说明。 */
    if (OPEN_TYPES.indexOf(t.type) >= 0) { openFull += units * per; return; }
    scored = true;
    full += units * per;
    got += r1 * per;
  });
  const ln = myListenCount();
  if (ln) {
    types.push('listen');
    total += ln;
    done += Math.min(listenDoneCount(), ln);
  }
  const pct = total ? Math.round(done / total * 100) : 0;
  return { types: types, total: total, done: done, pct: pct, got: got, full: full,
           right: right, openFull: openFull, scored: scored,
           all: total > 0 && done >= total };
}

/* 某个题型已经做了多少条（提交过的条目才会留下 ans:… 这条记录） */
/* 答题记录的键 = 考试 + 哪张卷子 + 题型 + 第几题。
   ⚠️ **必须带上考试**：题库是所有考试共用的一份，键里不带考试的话，
      在四级做过一篇、切到六级，六级的"累计"也会跟着涨。
      用户要求"每种考试的累计要独立"，所以这里把考试 id 编进键里。
   ⚠️ **还必须带上卷子**：我的题目排在最前、站内自带的那点题跟在后面，
      "第 3 篇仔细阅读"在 A 卷和 B 卷里是**两道不同的题**。
      不区分的话，切一张卷子就会看到上一张的作答原样出现在同一位置。 */
function itemPid(typeId, i) {
  const bt = S.bank && S.bank.types.find(x => x.type === typeId);
  const it = bt && bt.items && bt.items[i];
  return (it && it.pid) || 'base';
}
function ansKey(typeId, i) {
  return 'ans:' + curExam().id + ':' + itemPid(typeId, i) + ':' + typeId + ':' + i;
}
function draftKey(typeId, i) {
  return 'draft:' + curExam().id + ':' + itemPid(typeId, i) + ':' + typeId + ':' + i;
}
/* 键里多了一层卷子 id，所以不能再用前缀数了 —— 取出来按"题型"那一段筛。
   cet4:ans:cet4:<卷子id>:<题型>:<第几题> → split(':') 的倒数第二段是题型 */
function doneCountOf(typeId) {
  return LS.keys('ans:' + curExam().id + ':')
    .filter(k => k.split(':').slice(-2)[0] === typeId).length;
}
let prog = {};                          // type -> 当前第几篇（按考试存，见 loadExamScoped）

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

/* 轻提示。
   ⚠️ 别用 display:none 控制显隐 —— 那样出入场是"啪"地一下，很生硬。
      现在常驻在 DOM 里，靠 opacity + transform 的 transition 淡入淡出，
      出场还带一点点上浮，看着自然得多。 */
function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  clearTimeout(el._t);
  if (el.classList.contains('on')) {
    // 已经在显示中：先退场再进场，让"换了条提示"也能看出来
    el.classList.remove('on');
    el._t = setTimeout(() => el.classList.add('on'), 160);
  } else {
    // 强制重排，保证连续两次调用也能重新播动画
    void el.offsetWidth;
    el.classList.add('on');
  }
  el._t2 = setTimeout(() => el.classList.remove('on'),
                      Math.min(9000, 2200 + String(msg).length * 60));
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
  const head = hit
    ? `<b>${esc(hit.word)}</b> ${hit.p ? '<span style="opacity:.7">/' + esc(hit.p) + '/</span>' : ''}
       <div style="margin-top:4px">${esc(hit.m || '（暂无释义）')}</div>`
    : `<b>${esc(raw)}</b><div style="margin-top:4px">本地词库未收录（可先收藏，稍后补释义）</div>`;
  const addBtn = inVocab
    ? `<button class="sec" disabled>已在生词本</button>`
    : `<button data-add="${esc(key)}|${esc(hit ? (hit.p || '') : '')}|${esc(hit ? (hit.m || '') : '')}">加入生词本</button>`;
  return head + `<div class="add">${addBtn}<button class="sec" data-close="1">关闭</button></div>`;
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-copyopen]')) {
    const ctx0 = curReadItem();
    if (!ctx0) return;
    const txt0 = ((ensureDraft(ctx0.t, ctx0.i).x) || {}).text
      || (((LS.get(ansKey(ctx0.t.type, ctx0.i), null) || {}).x) || {}).text || '';
    if (!txt0.trim()) { toast('还没写东西'); return; }
    copyText(aiPromptFor(ctx0.t, ctx0.it, txt0)).then(okc =>
      toast(okc ? '已复制：题目 + 要求 + 你的作答，粘给 AI 就行'
                : '复制失败，请手动选中复制'));
    return;
  }
  if (e.target.closest('[data-clearul]')) {
    const ctx = curReadItem();
    if (ctx) { clearRangeMarks(ctx.key); render(); toast('已清除划线'); }
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
  LS.set(scopeKeys().vocab, vocab);
}

function markDay() {
  const d = today();
  if (!days.includes(d)) { days.push(d); LS.set(scopeKeys().days, days); }
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
   按"题型:题目id"分开存，重渲染不会丢，也不会串到别的题上。

   划线存的是**字符区间** [{s, e}]（相对短文纯文本的偏移），不是"哪个词" ——
   所以可以自由选一段话划上，而不是只能一个个词点。 */

function curReadItem() {
  if (route.indexOf('type:') !== 0) return null;
  const t = S.bank && S.bank.types.find(x => x.type === readType);
  if (!t) return null;
  const i = prog[readType] || 0;
  const it = t.items[i];
  if (!it) return null;
  return { t, i, it, key: readType + ':' + it.id };
}

function getMarks(key) {
  if (!marks[key]) marks[key] = { r: [], o: [] };
  if (!Array.isArray(marks[key].r)) marks[key].r = [];
  if (!Array.isArray(marks[key].o)) marks[key].o = [];
  return marks[key];
}

/* 哪些区域可以划线：短文、匹配题的段落、题干。
   ⚠️ 原来只认 `.passage`，所以匹配题（.para）和没材料的单选题（题干 .qt）
      根本划不了 —— 用户说"其他题也要可以划线"。
   区间按 {c, s, e} 存：c 是"第几个可划线容器"，s/e 是该容器内的字符偏移。 */
const UL_SEL = '.passage, .para, .qt';
function ulContainers() {
  return Array.prototype.slice.call(document.querySelectorAll('#view ' + UL_SEL));
}
/* 把容器内的字符偏移还原成一个 DOM Range（Highlight API 要用） */
function rangeFromOffsets(root, s, e) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let pos = 0, n, startN = null, startO = 0, endN = null, endO = 0;
  while ((n = walker.nextNode())) {
    const len = n.nodeValue.length;
    if (!startN && pos + len >= s) { startN = n; startO = s - pos; }
    if (pos + len >= e) { endN = n; endO = e - pos; break; }
    pos += len;
  }
  if (!startN || !endN) return null;
  const r = document.createRange();
  r.setStart(startN, Math.max(0, Math.min(startO, startN.nodeValue.length)));
  r.setEnd(endN, Math.max(0, Math.min(endO, endN.nodeValue.length)));
  return r;
}

/* 把一段区间真实地"划"出来 —— 只切文本节点，给覆盖到的每一截套 <span class="ulr">。

   ⚠️⚠️ 为什么非要有这一层（这是"手机上划线消失"的真因）

   下划线原来有两条路，两条都有死角：
     ① CSS Custom Highlight（::highlight(ul)）—— 只有比较新的浏览器有。
        这条 API 在国产手机浏览器 / 老 WebView 上普遍还没有。
     ② 逐词给 `.w` 加 `.ul` —— 而 `.w` 只包**本地词库收录的词**（见 wrap()）。
        于是：普通词不划、中文一个字都划不出来、
        跨词片段只划出其中恰好在词库里的那一两个词。
   实测（把 Highlight API 关掉）：划 "quick brown fox" 15 个字符，
   只有 "fox" 这 3 个显示出来；划一段中文，屏幕上什么都没有。
   ——看起来就是"划线功能坏了"。

   所以这里补第三条路：**按字符区间把文字包起来**，不依赖任何高级 API。
   它和 ①② 不冲突，只把漏掉的部分补齐。

   ⚠️⚠️ 为什么**不能**用 surroundContents / extractContents
   （2026-10-16 修的两处线上毛病，根因是同一个）

   最直觉的写法是 `range.surroundContents(span)`，包不住就退到
   `span.appendChild(range.extractContents())`。这个写法有两处硬伤：

   · `surroundContents()` 只要区间**部分覆盖了任意一个非文本节点**就抛错。
     而划到词元（<span class="w">）中间每次都会命中 —— 所以退路才是常态。
   · `extractContents()` 会把**被部分覆盖的元素克隆一份**放进返回值，
     并且把原节点掏空。于是：
       - 一个区间跨过两个 <p>（短文是多段的时候随手一拖就会跨）→ <p> 成了
         "被部分覆盖的元素" → 克隆出来的 <p> 被塞进行内的 span 里。
         行内元素放块级元素，浏览器只能按两块排版：**整篇的排版当场断成几段**
         （用户看到的"划线之后出现换行"就是它，实测段落数 2 → 4）。
       - 区间开头那个词元被掏空，留下一个宽度为 0、却还点得到的空壳。

   所以改法换成：**完全不动元素，只切文本节点**。
   区间覆盖到的每个文本节点，按左右边界各切一刀，把中间那截塞进 .ulr：

       <span class="w" data-w="is">is</span>   只划中 "i"
         → <span class="w" data-w="is"><span class="ulr">i</span>s</span>

   这样一来：
     · 字符级精确 —— 划一个字就只亮一个字，不会"整词跟着亮"；
     · 不碰块级元素 —— 不可能再断行；
     · 词元结构原封不动 —— 下划线底下那个词照样点得开释义；
     · 没有空壳残留。
   切文本不改变文字内容，所以字符偏移全程依然有效。 */
function wrapRangeUnderline(rg) {
  if (!rg || rg.collapsed) return 0;
  /* 先把"要切哪些文本节点、切哪一截"全部算完，再动手改 DOM ——
     一边切一边遍历会读到已经被切开的新节点，越切越乱。

     ⚠️ 遍历起点要特别小心：区间的 commonAncestorContainer 在"一头一尾落在
        同一个文本节点里"时**就是那个文本节点本身**（划一个字母、划一段中文
        都是这种），而 TreeWalker 不会返回它的根节点 —— 照直用就会一个节点
        都收不到，表现成"划了但什么都没划上"。所以文本节点要退到它的父节点。 */
  let scan = rg.commonAncestorContainer;
  if (scan && scan.nodeType === 3) scan = scan.parentNode;
  if (!scan) return 0;
  const hits = [];
  const walker = document.createTreeWalker(scan, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = walker.nextNode())) {
    if (!rg.intersectsNode(n)) continue;
    const len = n.nodeValue.length;
    let a = 0, b = len;
    if (n === rg.startContainer) a = rg.startOffset;   // 区间左边界落在这里
    if (n === rg.endContainer) b = rg.endOffset;       // 区间右边界落在这里
    a = Math.max(0, Math.min(a, len));
    b = Math.max(0, Math.min(b, len));
    if (b <= a) continue;                              // 这个节点其实没被划到
    hits.push({ node: n, a: a, b: b });
  }
  let done = 0;
  hits.forEach(h => {
    try {
      let seg = h.node;
      if (h.a > 0) seg = seg.splitText(h.a);                    // 左边界切一刀
      if (seg.nodeValue.length > h.b - h.a) seg.splitText(h.b - h.a);  // 右边界切一刀
      const span = document.createElement('span');
      span.className = 'ulr';
      seg.parentNode.insertBefore(span, seg);
      span.appendChild(seg);
      done++;
    } catch (e) { /* 这一截包不上就算了，不影响其它截 */ }
  });
  return done;
}

/* 选一段 → 划上；选到**已经有划线的地方** → 取消那一部分。
   ⚠️ 判断标准是"有没有重叠"，不是"是否一模一样" ——
      拖选很难选到字符级完全相同（通常差一个空格、少一个字），
      按"完全相同才取消"来做，用户会觉得"取消不掉"。
   所以这里用涂改带的做法：
     和已有划线完全不重叠 → 加上
     有任何重叠           → 把重叠部分从已有划线里减掉（可能一分为二）
   区间按字符偏移存，重渲染后靠 applyMarks 逐词回填 .ul。 */
function toggleRangeMark(key, c, s, e) {
  if (e < s) { const t = s; s = e; e = t; }
  const m = getMarks(key);
  let touched = false;
  const out = [];
  m.r.forEach(r => {
    const rc = r.c || 0;
    // 不同容器之间不可能重叠，原样保留
    if (rc !== c || r.e <= s || r.s >= e) { out.push(r); return; }
    touched = true;
    if (r.s < s) out.push({ c: c, s: r.s, e: s });       // 左边没被盖到的部分
    if (r.e > e) out.push({ c: c, s: e, e: r.e });       // 右边没被盖到的部分
  });
  if (!touched) out.push({ c: c, s: s, e: e });          // 全新的一段，划上
  m.r = out.filter(r => r.e - r.s > 0);
  LS.set(scopeKeys().marks, marks);
  return !touched;                                       // true = 这次是"划上"
}
function clearRangeMarks(key) {
  getMarks(key).r = [];
  LS.set(scopeKeys().marks, marks);
}

function toggleOptMark(key, pick) {
  const m = getMarks(key);
  const i = m.o.indexOf(pick);
  if (i >= 0) m.o.splice(i, 1); else m.o.push(pick);
  LS.set(scopeKeys().marks, marks);
  return i < 0;
}

/* 渲染完把标记画回去 */
function applyMarks() {
  const ctx = curReadItem();
  document.querySelectorAll('.w[data-w]').forEach(el => {
    const w = (el.dataset.w || '').toLowerCase();
    if (vocab.some(v => v.word === w)) el.classList.add('saved');
  });
  if (!ctx) return;
  const rs = ((marks[ctx.key] || {}).r) || [];
  const conts = ulContainers();

  /* ⚠️ 这里原来还有一步"逐词给 .w 加 .ul"（判断依据是"区间和这个词有重叠"）。
     2026-10-16 删掉，两个原因：

     ① 它是"划线会默认补全单词"的直接来源。
        "重叠"是个很松的条件 —— 只划中 "is" 里的一个 i，整个 is 也算重叠，
        于是整个词被加上下划线。用户要的是"划到哪就是哪"。
     ② 它本来就是多余的。下面第 ③ 步（.ulr）是**按字符**包的，
        普通词、中文、半截词全能包住，不依赖任何新 API；
        而第 ② 步（Highlight API）在现代浏览器上画得更准。
        留着它只会和 ③ 叠出两条线。

     顺带说明：删掉这一步之后，"画出来"就只剩 ②③ 两条路，
     .ul 这个类名不再由 JS 产生了。 */
  /* 第一条真正管用的路：按字符区间把文字包进 .ulr。
     ★ 另外两条路各有死角（见 wrapRangeUnderline 上面那段说明）：
       Highlight API 只有新浏览器有；逐词 .ul 只认词库收录的整词。
       只有这一条不依赖任何新 API，普通词 / 中文 / 半截词全都包得住。 */
  rs.forEach(r => {
    const root = conts[r.c || 0];
    if (!root) return;
    wrapRangeUnderline(rangeFromOffsets(root, r.s, r.e));
  });

  /* 再补一层：CSS Custom Highlight 能把整条区间连成一条更平滑的下划线。
     ⚠️ 放在包装**之后**建 Range —— 包装会切开文本节点，虽然浏览器会自动
        维护活动 Range 的边界，但直接按最终 DOM 建一次更省心（文字没变，
        字符偏移依然对得上）。 */
  if (window.Highlight && window.CSS && CSS.highlights) {
    try { CSS.highlights.delete('ul'); } catch (e) { /* 没有就算了 */ }
    if (rs.length) {
      const hl = new Highlight();
      rs.forEach(r => {
        const root = conts[r.c || 0];
        if (!root) return;
        const rg = rangeFromOffsets(root, r.s, r.e);
        if (rg) hl.add(rg);
      });
      CSS.highlights.set('ul', hl);
    }
  }

  if (!ctx) return;
  const m = marks[ctx.key];
  if (!m) return;
  document.querySelectorAll('[data-pick]').forEach(el => {
    if (m.o.indexOf(el.dataset.pick) >= 0) el.classList.add('strike');
  });
}

/* ---------- 路由 ---------- */
let route = 'home', readType = 'careful';
let onboarding = false;    // 首次进来：先选考试
let onboardStep = 0;        // 0 = 列考试；1 = 确认页（方向 + 日期 + 试卷结构）
let onboardExam = null;     // 确认页正在看的是哪个考试
let onboardVariant = null;  // 确认页选的方向（还没落盘）

function go(r) {
  route = r;
  if (location.hash !== '#' + r) history.replaceState(null, '', '#' + r);
  window.scrollTo(0, 0);
  render();
}

/* 底部导航 = 首页 + 这个考试的【全部】题型 + 生词 + 我的。
   注意：**包括还没实现的题型** —— 让人一眼看到这个考试完整长什么样，
   点进去都能做题。题型多时导航横向滚动。 */
const NAV_TYPE_ICON = {
  careful: '📄', matching: '🧩', cloze: '✏️', listen: '🎧',
  single: '🔤', listening: '🔊', judge: '⚖️', gap: '⬜',
  write: '✍️', translate: '🈶', speak: '🗣️', quant: '➗',
};

/* 每个题型一句话说清它是什么（点进去还没有题目时靠它解释） */
const TYPE_DESC = {
  careful:  '仔细阅读：一篇短文 + 若干道选择题。',
  matching: '长篇匹配：几段文字，把句子配到对应段落。',
  cloze:    '选词填空：短文挖空，从备选词里挑。',
  listen:   '听力听写：机器朗读一句，你把它打出来。'
          + '⚠️ 这是**英语专业四级（TEM-4）**才考的题型，四六级不考听写。',
  single:   '单项选择：给一段材料或一个句子，从选项里选一个正确答案。',
  listening: '听力理解：先播一段录音，再回答后面的选择题。'
           + '站里用的是浏览器语音合成，不是考场原音。',
  judge:    '判断题：判断每句话和原文是「一致 / 相反 / 没提到」（雅思的 T/F/NG）。',
  gap:      '填空题：短文里挖掉若干个词，自己打字填回去，判分时会忽略大小写和标点。',
  write:    '写作：给一个题目，你写一篇短文。写完后对照参考范文 —— 没有自动评分，自己看差距。',
  translate: '翻译：给一段中文（或英文），你来译。提交后给参考译文对照。',
  speak:    '口语：给题目和要点，自己先说一遍，再对照参考回答。',
  quant:    '数学：GRE 的数量推理（数量比较 / 单选 / 数值填空）。',
  quant:    '数学：GRE 的数量推理部分（数量比较 / 单选 / 数值填空）。'
          + '本站是英语训练台，这块没打算做。',
};

/* 底部导航的短标签。
   ⚠️ 390px 宽的手机上，9 个格子每格只有约 43px，「仔细阅读」四个字放不下，
      会被折成"仔细阅/读"两行，看着像坏了（真机截图里一眼就能看到）。
      所以导航用短名，完整名字放进 title（长按/悬停能看到）；
      「首页 → 这个考试要练什么」那种列表里仍旧用全名，那里有位置。 */
const NAV_SHORT = {
  careful: '阅读', matching: '匹配', cloze: '选词', single: '选择',
  judge: '判断', listening: '听力', listen: '听写', quant: '数学',
  gap: '填空', write: '写作', translate: '翻译', speak: '口语',
};

function navItems() {
  const items = [{ k: 'home', ic: '🏠', n: '首页' }];
  activeTypes().forEach(t => {
    const full = (QTYPES[t] || {}).name || t;
    items.push({ k: 'type:' + t, ic: NAV_TYPE_ICON[t] || '📘',
                 n: NAV_SHORT[t] || full, title: full });
  });
  items.push({ k: 'vocab', ic: '🔖', n: '生词', title: '生词本' });
  items.push({ k: 'me', ic: '📊', n: '我的', title: '我的' });
  return items;
}

function renderNav() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  if (onboarding) { nav.innerHTML = ''; return; }
  const items = navItems();
  if (!items.some(x => x.k === route)) route = 'home';   // 当前页没了就回首页
  nav.innerHTML = items.map(x =>
    `<button data-nav="${x.k}" class="${route === x.k ? 'on' : ''}" title="${esc(x.title || x.n)}">` +
    `<span class="ic">${x.ic}</span>${x.n}</button>`).join('');
  // 等宽由 CSS 的 grid-auto-columns: 1fr 保证，这里不用再切换样式
}

/* 导航是动态重建的，所以用事件委托绑点击 */
document.addEventListener('click', e => {
  const b = e.target.closest('nav button[data-nav]');
  if (b) { go(b.dataset.nav); return; }
});

window.addEventListener('hashchange', () => {
  const h = location.hash.replace('#', '');
  if (h && h !== route) { route = h; render(); }
});

/* ---------- 顶栏 ---------- */
function header() {
  const ei = examInfo();
  let title = ei.short, sub = ei.variantName
    ? ei.variantName + ' · 把今天的量做完就行' : '把今天的量做完就行';
  if (route === 'vocab') { title = '生词本'; sub = ei.short + ' · 点短文里的词就能收藏'; }
  else if (route === 'me') { title = '我的'; sub = ''; }
  else if (route.indexOf('type:') === 0) {
    const id = route.slice(5);
    const q = QTYPES[id] || {};
    title = q.name || id;
    const t = S.bank && S.bank.types.find(x => x.type === id);
    if (id === 'listen') sub = '浏览器朗读，跟读默写';
    else if (!t || !t.items.length) sub = '还没有题目';
    else {
      const perQ = scorePerQOf(id);
      sub = t.items.length + ' ' + ((QTYPES[id] || {}).unit || '篇')
        + (perQ ? ' · 每' + ((QTYPES[id] || {}).unit || '题')
          + ' ' + (+perQ.toFixed(2)) + ' 分' : '');
    }
  }
  $('#hdTitle').textContent = title;
  $('#hdSub').textContent = sub;
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
      if (dn === null) return `<div class="ttl">${esc(cur.name)}</div>`;
      if (examPassed()) {
        return `<div class="ttl">${esc(cur.short)}（${cur.date}）已结束</div>`;
      }
      return `<div class="ttl">距 ${esc(cur.short)} 还有 <span style="color:var(--brand)">${dn}</span> 天</div>
        <div class="meta" style="margin:6px 0 0">${cur.date}${
          cur.variantName ? ' · ' + esc(cur.variantName) : ''}。</div>`;
    })()}
  </div>


  <div class="stat-grid">
    <div class="stat"><div class="k">连续打卡</div><div class="v">${streak()} <small>天</small></div></div>
    <div class="stat"><div class="k">累计答题</div><div class="v">${total} <small>题</small></div></div>
    <div class="stat"><div class="k">正确率</div><div class="v">${acc}<small>%</small></div></div>
    <div class="stat"><div class="k">错题 / 生词</div><div class="v">${wrong.length} <small>/ ${vocab.length}</small></div></div>
  </div>

  <div class="sec">这个考试要练什么</div>
  <div class="entry">
    ${activeTypes().map(t => {
      const q = QTYPES[t] || {};
      const n = typeCountNow(t);
      const d = n ? (n + ' ' + (q.unit || '篇')) : '还没有题目';
      return `<a href="#type:${t}" data-go="type:${t}">
        <div class="n">${NAV_TYPE_ICON[t] || '📘'} ${esc(q.name || t)}</div>
        <div class="d">${d}</div></a>`;
    }).join('')}
    <a href="#vocab" data-go="vocab"><div class="n">🔖 生词本</div><div class="d">${vocab.length} 个词${srsDueCount() ? ' · 待复习 ' + srsDueCount() : ''}</div></a>
    <a href="#me" data-go="me"><div class="n">📊 我的</div><div class="d">错题 ${wrong.length} 条</div></a>
  </div>

  ${(() => {
    const p0 = scopeProgress();
    // 一张卷子都没有时**整节都不显示** —— 不放引导文字，首页保持干净
    if (!p0.total) return '';
    return `<div class="sec">我的题目的进度</div>
  <div class="card tight">
    ${(() => {
      const p = p0;
      /* 统分：答对的小题数 × 每题分值。
         ⚠️ 每题分值优先用**试卷里标的**，没标才按这场考试的标准。
           所以"只导了一部分题型"时，只会总分变小 —— 仍然是一套卷子。 */
      const scoreTxt = p.scored
        ? `已得 <b>${(+p.got.toFixed(1))}</b> 分 / 满分 <b>${(+p.full.toFixed(1))}</b> 分`
        : `答对 <b>${p.right}</b> 题`;
      const who = activePaper() ? '「' + activePaper().name + '」' : '';
      return `${who ? `<div class="meta" style="margin:0 0 8px">正在练：${esc(who)}</div>` : ''}
        <div class="pbar"><i style="width:${p.pct}%"></i></div>
        <div class="meta" style="margin:9px 0 0">
          已做 <b>${p.done}</b> / ${p.total} 项 · <b>${p.pct}%</b>${
            p.all ? '（做完了）' : ''}</div>
        <div class="meta" style="margin-top:4px">${scoreTxt}${
          p.openFull ? `　（写作 + 翻译的 ${(+p.openFull.toFixed(1))} 分不自动判分，交卷后有范文对照）` : ''}</div>`;
    })()}
  </div>`;
  })()}

  <div class="sec">各题型做了多少</div>
  <div class="card tight">
    <div class="vlist">
      ${activeTypes().map(t => {
        const q = QTYPES[t] || {};
        // 累计就是"做了多少"，**不带分母** —— 上限是"这套卷子的进度"那块的事。
        const dn = scopeDoneCount(t);
        return `<div class="v">
          <span>${NAV_TYPE_ICON[t] || '📘'} ${esc(q.name || t)}</span>
          <b${dn ? '' : ' style="color:var(--fg3)"'}>${dn} ${esc(q.unit || '篇')}</b>
        </div>`;
      }).join('')}
    </div>
  </div>`;

}

/* ---------- 阅读 ---------- */
function stateOf(type) { return prog[type] || 0; }
function setState(type, i) { prog[type] = i; LS.set(scopeKeys().prog, prog); }

/* ---------- 题型页 ----------
   路由是 type:<题型id>。已实现的渲染题目；没实现的给一个说明页。 */
function vTypePage(id) {
  if (id === 'listen') return vListen();
  const t = S.bank && S.bank.types.find(x => x.type === id);
  if (!t || !t.items.length) return vTypeEmpty(id);
  const i = Math.min(stateOf(id), t.items.length - 1);
  return vItem(t, i);
}

function vTypeEmpty(id) {
  const q = QTYPES[id] || {};
  return `<div class="card">
    <div class="ttl">${esc(q.name || id)}</div>
    <div class="meta" style="margin-top:6px">${esc(TYPE_DESC[id] || '')}</div>
    <div class="empty">这一类的题还没有。</div>
    <div class="row"><button class="btn" data-go="me">去「我的」看看</button></div>
  </div>`;
}

function originTag(it) {
  if (it.origin === 'mine') return `<span class="tag" style="background:var(--brand-soft);color:var(--brand);border-color:transparent">我的题目</span>`;
  if (it.origin === 'local') return `<span class="tag" style="background:var(--brand-soft);color:var(--brand);border-color:transparent">自备材料</span>`;
  if (it.origin === 'builtin') return `<span class="tag" style="background:var(--brand-soft);color:var(--brand);border-color:transparent">系统自带</span>`;
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
  const submitted = LS.get(ansKey(t.type, i), null);
  const done = !!submitted;
  // 关键：未提交时要用"作答草稿"渲染，否则点了选项界面不会显示选中
  const d = done
    ? { a: submitted.a || {}, p: submitted.p || {}, x: submitted.x || {} }
    : ensureDraft(t, i);
  const per = scorePerQOf(t.type);
  let h = `<div class="card">
    <div class="ttl">${esc(it.title || '（无标题）')}</div>
    <div class="meta">${originTag(it)}第 ${i + 1} / ${t.items.length} ${
      esc((QTYPES[t.type] || {}).unit || '篇')}${
      per ? ' · 每' + ((QTYPES[t.type] || {}).unit || '题')
        + ' ' + (+per.toFixed(2)) + ' 分' : ''}${
      ((marks[readType + ':' + it.id] || {}).r || []).length
        ? ` · <button class="btn ghost sm" data-clearul="1"
             style="padding:1px 8px;font-size:11px">清除划线</button>` : ''}</div>
    ${srcLine(it)}`;

  if (t.type === 'careful' || CHOICE_TYPES.indexOf(t.type) >= 0) {
    /* 播放条**只给听力题**。
       ⚠️ 踩过：这段原来写在"是不是选择题"那一支里，而仔细阅读也走那一支 ——
          于是每篇阅读底下都挂一句"这道听力题没有配音频"，看着像坏了。
          判据要用**题型**，不是"有没有选项"。 */
    if (t.type === 'listening' || t.type === 'listen') {
      if (it.audio || it.script) {
        h += `<div class="audio-card" style="padding:18px 12px 14px">
          <button class="bigbtn" id="playBtn" data-playq="1">▶</button>
          <div class="meta" style="margin:0;text-align:center">${
            it.audio ? '点一下播放录音' : '没有配音频，点一下用浏览器朗读原文'}</div>
        </div>`;
      } else {
        /* 没有录音也没有原文（比如 2022.09 / 2023.03 这两次补考）——
           把原因说清楚，别让人以为是自己没导好。 */
        h += `<div class="meta" style="margin:0 0 6px;color:var(--warn)">${
          esc(it.audioGap || '这道听力题没有配音频，也没有原文 —— 只能自己做（声音和原文都缺）。')}</div>`;
      }
    }
    const paras = [].concat(it.passage || []);
    if (paras.length) {
      h += `<div class="passage">${paras.map(p => '<p>' + wrap(p) + '</p>').join('')}</div>`;
    }
    h += `</div><div class="card">`;
    it.questions.forEach((q, qi) => {
      const a = d.a[qi];
      const opts = q.options || it.options || [];
      h += `<div class="q"><div class="qt">${qi + 1}. ${esc(q.q)}</div>`;
      opts.forEach((o, oi) => {
        let cls = 'opt';
        if (done) { if (oi === q.answer) cls += ' ok'; else if (a === oi) cls += ' bad'; }
        else if (a === oi) cls += ' sel';
        h += `<div class="${cls}" data-pick="${qi}:${oi}"><span class="k">${'ABCD'[oi]}</span><span>${wrap(o)}</span></div>`;
      });
      if (done) h += `<div class="exp">正确答案 <b>${'ABCD'[q.answer]}</b>。${esc(q.explain || '')}</div>`;
      h += `</div>`;
    });
    if (done && it.script) {
      h += `<div class="exp" style="margin-top:12px"><b>听力原文</b><br>${esc(it.script)}</div>`;
    }
    h += resultRow(t, i, it.questions.length, done, d);
  } else if (t.type === 'gap') {
    const placed = d.p || {};
    h += `<div class="passage">${gapBody(it, placed, done)}</div>`;
    if (done) {
      h += `<div class="exp" style="margin-top:12px">`;
      Object.keys(it.answers).forEach(n => {
        const right = it.answers[n], got = placed[n] || '';
        const ok = normAns(got) === normAns(right);
        h += `<div>${n}. ${ok ? '✓' : '✗'} ${esc(got || '未填')}${
          ok ? '' : ' → 应为 <b>' + esc(right) + '</b>'}`;
        if (it.explains && it.explains[n]) {
          h += `<div style="color:var(--fg2);font-size:12.5px">${esc(it.explains[n])}</div>`;
        }
        h += `</div>`;
      });
      h += `</div>`;
    }
    h += resultRow(t, i, Object.keys(it.answers).length, done, d);
  } else if (OPEN_TYPES.indexOf(t.type) >= 0) {
    const myText = (d.x && d.x.text) || '';
    const isTr = t.type === 'translate';
    // ⚠️ 字段名叫 material，不能叫 source —— 构建脚本会给每条题目写一个
    //    版权来源对象 it.source = {license, desc}，用同名会把正文覆盖成 [object Object]
    const material = it.material || it.prompt || '';
    h += `<div class="passage" style="font-size:16px;line-height:1.85">${
      isTr ? esc(material) : '<b>' + esc(material) + '</b>'}</div></div><div class="card">`;
    if (t.type === 'speak' && !done) {
      // 口语不是"写"——给准备 + 说的计时器，不用作文框
      h += `<div class="spkbox">
        <div class="spkclock" id="spkclock">准备好了就点开始</div>
        <div class="row" style="margin:14px 0 0;justify-content:center">
          <button class="btn" data-spkprep="1">开始准备 ${it.prepSeconds || 60} 秒</button>
          <button class="btn ghost" data-spktalk="1">直接开始说 ${it.seconds || 120} 秒</button>
        </div>
      </div>`;
    } else if (!done) {
      h += `<textarea id="openin" class="big" rows="9"
        placeholder="${isTr ? '在这里写你的译文…' : '在这里写你的作文…'}"
        >${esc(myText)}</textarea>
        <div class="meta" style="margin-top:6px" id="wc">${
          isTr ? cc(myText) + ' 字' : wc(myText) + ' 词'}</div>`;
    } else {
      // 口语没有"作答文本"可显示，写/译才有
      if (t.type !== 'speak') {
        h += `<div class="sub"><div class="meta">你的作答</div>
          <div style="white-space:pre-wrap;line-height:1.8">${esc(myText) || '<i>（空）</i>'}</div>
          <div class="meta" style="margin-top:8px">
            <button class="btn ghost sm" data-copyopen="1">复制给 AI 打分</button>
          </div></div>`;
      }
    }
    h += resultRow(t, i, 0, done, d);
    if (done) {
      const refKey = isTr ? 'reference' : 'sample';
      const ref = it[refKey] || '';
      if (it.points && it.points.length) {
        h += `<div class="exp" style="margin-top:12px"><b>对照要点</b>
          <ul style="margin:6px 0 0 18px;padding:0">${
            it.points.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></div>`;
      }
      if (ref) {
        h += `<div class="exp" style="margin-top:12px">
          <b>${isTr ? '参考译文' : '参考范文'}</b>
          ${t.type === 'speak' ? ` <button class="btn ghost sm" data-playsample="1"
            style="margin-left:6px;padding:2px 10px">▶ 听一遍</button>` : ''}
          <div style="white-space:pre-wrap;line-height:1.85;margin-top:6px">${esc(ref)}</div></div>`;
      }
    }
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

/* 一条题目里有多少个"待答的小项"。
   ⚠️ 一定要按题型分别取：cloze / gap 的条目**没有 questions 字段**，
      开放式（写/译/说）也没有 —— 统一在这里兜住，别在别处自己写一遍，
      踩过两次：无条件读 items[i].questions.length 会抛 TypeError，
      而且是"点提交没反应"这种最难查的表现。 */
function itemQCount(t, it) {
  if (!it) return 0;
  if (t.type === 'matching') return (it.statements || []).length;
  if (t.type === 'cloze' || t.type === 'gap') return Object.keys(it.answers || {}).length;
  if (OPEN_TYPES.indexOf(t.type) >= 0) return 0;
  return (it.questions || []).length;
}

/* 填空题：短文挖空，自己打字。给一个"首字母 + 下划线"的提示（按答案长度生成），
   判分忽略大小写、前后空格和末尾标点。 */
function gapBody(it, placed, done) {
  const parts = esc(it.passage).split(/\{\{(\d+)\}\}/);
  let out = '';
  parts.forEach((p, k) => {
    if (k % 2 === 1) {
      const n = p, w = placed[n] || '', ans = it.answers[n] || '';
      if (done) {
        const ok = normAns(w) === normAns(ans);
        out += `<span class="blank ${ok ? 'ok' : 'bad'}" data-blank="${n}">${esc(w || '—')}</span>`;
      } else {
        const hint = ans ? ans[0] + '_'.repeat(Math.max(2, ans.length - 1)) : '____';
        // ⚠️ 这行标签必须写成一整行、不能有换行 ——
        //    下面会统一把文本里的 \n 换成 <br>，标签内部的换行会被一起换掉，
        //    结果 <input> 被拆成 <input ... value="" <br="">，属性全丢。
        out += `<input class="gapin" data-gap="${n}" value="${esc(w)}" placeholder="${esc(hint)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">`;
      }
    } else {
      // 换行处理只作用在**纯文本段**上，不碰上面生成的标签
      out += wrap(p).replace(/\n\n/g, '|PARA|').replace(/\n/g, '<br>');
    }
  });
  return '<p>' + out.split('|PARA|').join('</p><p>') + '</p>';
}

/* 填空判分用的归一化：小写、去首尾空格、压缩空格、去末尾标点 */
function normAns(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/\s+/g, ' ').replace(/[.,;:!?'"]+$/, '');
}
const wc = s => (String(s || '').match(/[A-Za-z][A-Za-z'\-]*/g) || []).length;
const cc = s => String(s || '').replace(/\s/g, '').length;

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
      // 同 gapBody：换行只处理纯文本段，别把标签内部的换行也换掉
      out += wrap(p).replace(/\n\n/g, '|PARA|').replace(/\n/g, '<br>');
    }
  });
  return '<p>' + out.split('|PARA|').join('</p><p>') + '</p>';
}

/* 「上一篇 / 下一篇」——**不用先交卷就能翻**。
   之前只有交卷后的结果行里才有"下一篇"，看着就像"点了没反应"。 */
function pagerRow(t, i) {
  if (t.items.length < 2) return '';
  return `<div class="pager">
    <button class="btn ghost sm" data-prev="1">← 上一篇</button>
    <span class="meta" style="margin:0">第 ${i + 1} / ${t.items.length} ${
      esc((QTYPES[t.type] || {}).unit || '篇')}</span>
    <button class="btn ghost sm" data-next="1">下一篇 →</button>
  </div>`;
}

function resultRow(t, i, total, done, d) {
  const it = t.items[i];
  if (OPEN_TYPES.indexOf(t.type) >= 0) {
    const txt = (d.x && d.x.text) || '';
    const isTr = t.type === 'translate';
    if (!done) {
      return `<div class="result"><button class="btn" data-submit="1">${
        t.type === 'speak' ? '看参考回答' : '提交'}</button>
        <button class="btn ghost sm" data-reset="1">重做</button></div>${pagerRow(t, i)}`;
    }
    return `<div class="result">
      <span class="score">已提交 · ${isTr ? cc(txt) + ' 字' : wc(txt) + ' 词'}</span>
      <button class="btn ghost sm" data-reset="1">重做</button></div>${pagerRow(t, i)}`;
  }
  if (!done) {
    const n = Object.keys(d.a || {}).length + Object.keys(d.p || {}).length;
    return `<div class="result"><button class="btn" data-submit="1">提交（已答 ${n}/${total}）</button>
      <button class="btn ghost sm" data-reset="1">重做</button></div>${pagerRow(t, i)}`;
  }
  let right = 0;
  if (t.type === 'cloze' || t.type === 'gap') {
    Object.keys(it.answers).forEach(n => { if (normAns(d.p[n]) === normAns(it.answers[n])) right++; });
  }
  else if (t.type === 'matching') {
    it.statements.forEach((q, k) => { if (d.a[k] === q.answer) right++; });
  } else {
    it.questions.forEach((q, k) => { if (d.a[k] === q.answer) right++; });
  }
  // 折算分从"这场考试的试卷结构"算（分值 ÷ 题量）；
  // 官方不给分项分值的（雅思、多邻国）就没有折算分，只报对错个数。
  const per = scorePerQOf(t.type);
  const tail = per
    ? ` · 折算 <b>${(right * per).toFixed(1)}</b> 分`
    : (t.type === 'quant' || t.type === 'single' ? '' : '');
  return `<div class="result">
    <span class="score">答对 <b>${right}/${total}</b>${tail}</span>
    <button class="btn ghost sm" data-reset="1">重做</button></div>${pagerRow(t, i)}`;
}

let draft = null;   // 当前作答草稿

function ensureDraft(t, i) {
  // ⚠️ key 里必须带考试：不带的话换考试后「仔细阅读:0」还是一样的 key，
  //    内存里那份草稿会被当成"还是这一题"，上一场的作答就串过来了。
  const key = curExam().id + ':' + t.type + ':' + i;
  if (!draft || draft.key !== key) {
    const saved = LS.get(draftKey(t.type, i), null);
    draft = { key, a: (saved && saved.a) || {}, p: (saved && saved.p) || {},
              x: (saved && saved.x) || {}, chip: null };
  }
  return draft;
}

function vWrong() {
  if (!wrong.length) {
    return `<div class="card"><div class="empty">「${esc(examShort())}」还没有错题。`
      + `答错的内容会自动记到这里。</div></div>`;
  }
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
  // 听力听写的作答也按考试存：换考试不该带着上一场写过的句子
  const st = LS.get('lc:' + curExam().id + ':' + it.id, null);
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
    LS.set(scopeKeys().vocab, vocab);
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
  if (!vocab.length) {
    return `<div class="card"><div class="empty">「${esc(examShort())}」的生词本还是空的。`
      + `去阅读里点任意一个词试试（点一下就收藏）。</div>
      <div class="row"><button class="btn" data-go="read">去阅读</button></div></div>`;
  }

  if (vMode === 'review') return vReviewCard();

  const due = srsDueCount();
  return `<div class="card">
    <div class="ttl">生词本 · ${esc(examShort())}</div>
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
  for (const v of vocab) lines.push([v.word, v.phon || '', v.mean || '', '英语备考训练台'].join('\t'));
  download('\ufeff' + lines.join('\n'), '生词_' + examShort() + '.tsv', 'text/tab-separated-values;charset=utf-8');
}

/* 通用格式：带 BOM 的 CSV，Excel / 欧路词典 / 不背单词等大多能直接导入 */
function exportCSV() {
  const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const lines = ['word,phonetic,meaning'];
  for (const v of vocab) lines.push([q(v.word), q(v.phon), q(v.mean)].join(','));
  download('\ufeff' + lines.join('\r\n'), '生词_' + examShort() + '.csv', 'text/csv;charset=utf-8');
}

/* ---------- 我的题目（使用者自己导入，只存在他自己浏览器里） ----------
   设计意图：这个站是"工具"，不是"内容提供方"。
   官方 / 版权资料由使用者自己放进来，内容责任在那个人自己身上。
   和 Anki 一样：Anki 不带内容，牌组由用户自己导入。

   支持的输入：
     1. 文本格式（见 格式示例，照抄即可）—— 给不太懂技术的人用
     2. JSON 格式（本站"导出我的题目"产出的文件）—— 方便同学之间互传
   ---------------------------------------------------------- */

const MYFORMAT_DEMO = `（格式示例。分节标题决定它归到哪一类，用 === 标题 === 包起来，
一行一个。认得的标题：仔细阅读 / 长篇匹配 / 选词填空 / 单项选择 / 判断题 /
听力理解 / 听力听写 / 数学 / 填空题 / 写作 / 翻译 / 口语）

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

=== 听力理解 ===
TITLE: 我的练习 · 听力理解
SCRIPT:
This is a recorded announcement from the university library. Starting next Monday, the main reading room will stay open until midnight.
Q: How late will the reading room stay open?
A. Until eight in the evening.
B. Until ten in the evening.
C. Until midnight.
D. Until eleven.
ANSWER: C

=== 写作 ===
TITLE: 我的练习 · 写作
MATERIAL: 图书馆应不应该延长开放时间？
POINTS:
- 第一段：一句话亮明立场
- 第二段：理由一 —— 现实需求（白天有课，晚上没地方自习）
SAMPLE:
Should the library stay open longer during the exam period? I believe it should.`;

/* ---------- 给 AI 的提示词（一键复制，让 AI 去干"读文件"这件脏活） ----------
   为什么要这样：使用者手上的材料是 PDF / Word / 拍照，排版千奇百怪，
   在浏览器里硬读（这个站原来就是那么干的）永远读不全 —— 而且读错了
   使用者也不知道错在哪。让 AI 去读、去转，人只需要核对一眼。
   站里只保留"认格式"这一件事，那件事是确定的。

   ⚠️ 这份提示词**必须和解析器严格对齐**：它教 AI 写的每个分节标题，
      都必须是 sectionTypeOf() 真认得的。自测里有一条断言逐条核对
      （PROMPT_TITLES 里的每个名字都要能映射到题型），改了一边忘了另一边会报红。 */
const PROMPT_TITLES = ['仔细阅读', '长篇匹配', '选词填空', '填空题', '单项选择', '判断题',
  '听力理解', '听力听写', '写作', '翻译', '口语', '数学'];

/* 每种题型"该怎么写"的示例。key 就是分节标题本身。
   ⚠️ key 必须和 PROMPT_TITLES 里的名字一字不差 —— promptBlocksFor() 是按名字取的，
      取不到会被挡下来（宁可报错，也不要悄悄少给一段写法，那样 AI 只能瞎猜）。 */
const PROMPT_BLOCKS = {
  '仔细阅读': `=== 仔细阅读 ===          一段文章 + 几道四选一
TITLE: 卷子名 · 仔细阅读
PASSAGE:
文章第一段

文章第二段
Q: 问题原文
A. 选项一
B. 选项二
C. 选项三
D. 选项四
ANSWER: B
EXPLAIN: 解析（没有就不写这一行）`,

  '听力理解': `=== 听力理解 ===          播报稿 + 题目
TITLE: 卷子名 · 听力理解
SCRIPT:
把听力原文（播报稿）整段写在这里，可以有多行
Q: 问题原文
A. 选项一
B. 选项二
C. 选项三
D. 选项四
ANSWER: A`,

  '选词填空': `=== 选词填空 ===
TITLE: 卷子名 · 选词填空
PASSAGE:
把文章里每个空写成 {{1}} {{2}} {{3}}，空按顺序编号
OPTIONS: 备选词一 备选词二 备选词三 备选词四
ANSWERS: 1:答案词 2:答案词 3:答案词`,

  /* 填空题和选词填空共用一套写法，只差 OPTIONS 那一行 ——
     给了备选词就变成"选词填空"，不给就是"填空题"。
     雅思 / PTE / 多邻国 / GRE 都在考它，原来这份提示词里压根没提，
     于是那几个考试导入填空部分时，AI 只能自己编一个格式，多半导不进来。 */
  '填空题': `=== 填空题 ===
TITLE: 卷子名 · 填空题
PASSAGE:
把文章里每个空写成 {{1}} {{2}} {{3}}，空按顺序编号
ANSWERS: 1:答案词 2:答案词 3:答案词
（填空题**不要**写 OPTIONS 那一行 —— 写了就变成"选词填空"了）`,

  '长篇匹配': `=== 长篇匹配 ===
TITLE: 卷子名 · 长篇匹配
PARAGRAPHS:
A. 第一段正文
B. 第二段正文
C. 第三段正文
STATEMENTS:
- 句子原文 | A
- 句子原文 | C
（竖线后面写这句属于哪一段）`,

  '写作': `=== 写作 ===
TITLE: 卷子名 · 写作
MATERIAL: 题目要求（照抄题干）
POINTS:
- 要点一
- 要点二
SAMPLE:
范文正文`,

  '翻译': `=== 翻译 ===
TITLE: 卷子名 · 翻译
MATERIAL: 中文原文
REFERENCE: 参考答案`,

  '判断题': `=== 判断题 ===           写法和仔细阅读一样，选项固定是 True / False / Not Given`,

  '单项选择': `=== 单项选择 ===         只有一道道题、没有文章，用 Q: / A. / ANSWER: 那一套`,

  '听力听写': `=== 听力听写 ===
TITLE: 卷子名 · 听力听写
- 一句一行，一行只写一句英文`,

  '口语': `=== 口语 ===
TITLE: 卷子名 · 口语
MATERIAL: 题目要求
SECONDS: 60`,

  '数学': `=== 数学 ===             GRE 数量推理，写法和单项选择一样  /* 这块下面单独一行非空行 */
`,
};
/* ⚠️ 上面「数学」那块最后多留了一个换行：它是单行说明，不给个空行的话
   和下一段会连成一整块，模型容易误以为那是同一段的内容。 */

/* 这场考试该让 AI 转哪几种题型。

   ⚠️⚠️ 为什么必须按考试过滤（原来不分，是这个功能最大的毛病）
   这一段原来是把 11 种题型**全列一遍**，写在模板里写死的 ——
   于是选四级、选雅思、选 GRE，复制出来的提示词一模一样。后果两个：
     · 模型被无关题型带着跑，容易把一段普通文章硬塞进"长篇匹配"的格式；
     · 这场考试真正要练的题型（雅思/PTE/GRE 的填空题）反而一个字都没交代。
   使用者原话：「AI辅助导入文件的功能没有依据不同考试发生提示词的改变」。

   清单来源是**试卷结构**（typesOf），不是另抄一份 ——
   因为 paper 才是"这场考试考什么"的唯一来源（见 QTYPES 上面那段硬规矩）。
   再按 PROMPT_TITLES 的固定顺序排，让同一场考试每次拿到的提示词完全一致。 */
function promptTitlesFor(ex) {
  ex = ex || curExam();
  const have = typesOf(ex, null);
  const picked = PROMPT_TITLES.filter(t => {
    const id = sectionTypeOf(t);
    return !!id && have.indexOf(id) >= 0;
  });
  /* 兜底：结构里一个能对上的题型都没有（比如新加的考试还没配 paper）时，
     宁可把全部写法都给出去，也不能给一份"什么都没说"的提示词。 */
  return picked.length ? picked : PROMPT_TITLES.slice();
}

function promptBlocksFor(titles) {
  const out = [];
  titles.forEach(t => {
    /* 取不到就跳过，而不是塞个 undefined 进去 —— 那样整段提示词会出现
       一行 "undefined"，模型很可能照着那行瞎编一个分节。 */
    if (PROMPT_BLOCKS[t]) out.push(PROMPT_BLOCKS[t]);
  });
  return out.join('\n\n');
}

function aiPromptText() {
  const ex = curExam();
  const list = paperOf(ex, null).map(r => r.label).join('、');
  const titles = promptTitlesFor(ex);
  return `帮我把下面这份英语试卷，转成「英语备考训练台」能直接导入的纯文本格式。

【先说清楚这场考试】
这是一场「${ex.name}」的试卷，卷面由这几块组成：${list || '不限'}。
所以这份材料里**只应该有下面这 ${titles.length} 种题型**。

【三条硬规矩】
1. 只做转写。不要改题、不要补题、不要翻译、不要替我加解析。
2. 忠实原文。题号、选项、答案、原文一律照抄；选项有几个就写几个，一个都不能漏。
3. 材料里没有的就别编 —— 没有答案就不要写 ANSWER 那一行。

【题型名只能从这份清单里挑，照抄，别自己另起名字】
${titles.join(' / ')}

⚠️ 材料里如果冒出一个不在上面的题型，**宁可丢掉那一块，也不要硬塞进别的题型**。
   （最常犯的错：把一段普通长文写成"长篇匹配"。那两种题的正文结构完全不同。）

【输出要求】
· 一种题型一段，用 === 题型名 === 隔开（前后各两个等号，两端顶格写）。
· 只输出这段文本本身：不要开头寒暄、不要结尾总结、不要用代码块围起来。
· 材料里有什么就转什么，不用凑齐 —— 只转了阅读、没转写作，也是完全可以的。

【每种题型怎么写】

${promptBlocksFor(titles)}

【材料在下面 / 在附件里】`;
}

/* ==========================================================================
   「我的题目」= 一堆**试卷**，一份文件就是一张卷子
   --------------------------------------------------------------------------
   数据（都按考试分开存，在四级导入的东西切到六级不该出现）：
     papers:<考试>  → { v: 2, list: [paper, ...] }
     paper:<考试>   → 当前选中练哪一张（不选 = 全部一起练）
     paper = {
       id, name,             // name 默认取文件名，使用者可以在页面里改（不弹文件管理器）
       src,                  // 原始文件名，改名不动它
       addedAt,
       types: [{ type, items }],
       marks: { 题型: 每题分值 },   // 试卷里标了分值就用标的，没标就按考试标准
       audio: [{ id, name }]       // 配上的音频（内容存在 IndexedDB 里，太大塞不进本地存储）
     }
   ========================================================================== */
function papersKey() { return 'papers:' + curExam().id; }
function activePaperKey() { return 'paper:' + curExam().id; }

/* 系统自带的卷子（data/builtin.json）。
   ⚠️ 只有**本地版**才有这个文件 —— 公开站上没有，于是返回空数组，
      一切照旧（"带内容"与"不带内容"两种情况共用同一套代码）。
   ⚠️ 它是**只读**的：整体一份 JSON，不能就地改。改名 / 移走另存一份覆盖表。 */
function builtinPapers() {
  const b = S.builtin;
  const e = b && b.exams && b.exams[curExam().id];
  return (e && Array.isArray(e.papers)) ? e.papers : [];
}
/* 原创样卷（data/samples.json）。
   ⚠️ 和 builtin.json 分成两个文件的理由只有一条：
      builtin.json 是**真题转录**，发布脚本每次都会把它从公开目录清掉；
      samples.json 是**原创**，可以、也应该跟着公开站走。
      混在一个文件里就得"按条过滤"，总有漏掉一天把真题带出去的风险。
      分成两个文件之后规则是一句话：builtin 不公开，samples 公开。 */
function samplePapers() {
  const s = S.samples;
  const e = s && s.exams && s.exams[curExam().id];
  return (e && Array.isArray(e.papers)) ? e.papers : [];
}
function paperMetaKey() { return 'pmeta:' + curExam().id; }
function paperMeta() { return LS.get(paperMetaKey(), {}) || {}; }

/* 使用者自己导进来的那些（存在本地存储里） */
function userPapers() {
  const d = LS.get(papersKey(), null);
  return (d && Array.isArray(d.list)) ? d.list : [];
}
/* 能选的卷子 = 系统自带（真题 + 原创样卷，改名 / 隐藏按覆盖表生效）+ 自己导入的
   ⚠️ 真题排在样卷前面：有真题的考试（四级）就用真题，样卷是给那些
      本机没有真题素材的考试（六级 / 雅思 / 考研……）兜底的。 */
function myPapers() {
  const meta = paperMeta();
  const out = [];
  builtinPapers().concat(samplePapers()).forEach(bp => {
    const m = meta[bp.id];
    if (m && m.hidden) return;
    out.push(m && m.name ? Object.assign({}, bp, { name: m.name }) : bp);
  });
  return out.concat(userPapers());
}
/* ⚠️ 落盘时**必须把系统自带的那几张滤掉** —— 它们不该被写进本地存储，
   不然下次 boot 读到的是一份"冻结的副本"，改了 builtin.json 也不生效。 */
function savePapers(list) {
  LS.set(papersKey(), { v: 3, list: (list || []).filter(p => !p.builtin) });
}
/* 当前练的是哪一张；'' 表示"全部一起练" */
/* 现在**必须选中一张** —— 使用者要的是"导入后自己选练哪张"，
   不再有"全部一起练"这个口径。没选、或者选的那张被删了，就落到第一张。 */
function activePaperId() {
  const id = LS.get(activePaperKey(), '') || '';
  const all = myPapers();
  if (!all.length) return '';
  if (id && all.some(p => p.id === id)) return id;
  return all[0].id;
}
function activePaper() {
  const id = activePaperId();
  if (!id) return null;
  return myPapers().find(p => p.id === id) || null;
}
function setActivePaper(id) {
  LS.set(activePaperKey(), id || '');
  /* 每张卷子记自己的"练到第几篇"。不分开的话，从一张 10 篇的卷子切到
     另一张，游标还停在 9，一进去就直接落在最后一篇上。 */
  prog = LS.get(progKey(), {}) || {};
  draft = null;
  rebuildBank();
  render();
}

/* 当前要练的那些试卷：选了某一张就只算它，没选就算全部。
   ⚠️ 进度、统分、题库**全都**跟着这个走 —— 这就是"选择我的题目"。 */
function currentPapers() {
  const one = activePaper();
  return one ? [one] : [];
}
/* 把若干张卷子摊平成 [{type, typeName, items}]（listen 单独走 S.listen）
   ⚠️ 每条题都要打上 **pid（属于哪张卷子）** —— 答题记录的键要用它。
      不打的话，内置了 30 套真题之后，"换一张卷子"会把上一张
      同一位置（第 3 篇仔细阅读）的作答原样串到这一张上。 */
function flattenPapers(list) {
  const out = [];
  (list || []).forEach(p => {
    (p.types || []).forEach(t => {
      let slot = out.find(x => x.type === t.type);
      if (!slot) { slot = { type: t.type, typeName: myTypeMeta(t.type).name, items: [] }; out.push(slot); }
      slot.items = slot.items.concat((t.items || []).map(
        it => (it.pid === p.id ? it : Object.assign({}, it, { pid: p.id }))));
    });
  });
  return out;
}
/* 当前试卷的题目 */
function myBankTypes() { return flattenPapers(currentPapers()); }
/* 导出去给别人的那份不要带 pid —— 那是本机卷子 id，换台机器就没意义了 */
function stripPid(types) {
  return (types || []).map(t => ({
    type: t.type, typeName: t.typeName,
    items: (t.items || []).map(it => { const c = Object.assign({}, it); delete c.pid; return c; }),
  }));
}
/* 某题型"每题多少分"：试卷标过就用标的 */
function paperMarkOf(type) {
  const ps = currentPapers();
  for (const p of ps) {
    if (p.marks && p.marks[type]) return p.marks[type];
  }
  return null;
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
/* 当前范围里一共有多少"小题/空" —— 统分的分母用这个 */
function myUnitCount() {
  return myBankTypes().reduce((a, t) => a + unitCountOf(t.type, t.items), 0)
    + (S.listen ? (S.listen.items || []).length : 0);
}

/* --- 文本格式解析 --- */

/* 判断"这一行是不是一个光秃秃的分节标题"，是就返回归一化后的标题名。
   Word 试卷里几乎不会有人写 === 听力理解 ===，多半就是一行
   「听力理解」或者「Part I  Reading Comprehension」。
   ⚠️ 判宽了会把正文句子也当标题（"Reading is important." 就把正文切两半），
      所以下面这几道闸门一个都不能少：
        有冒号/竖线 → 多半是 TITLE: / PASSAGE: / 匹配题的 | A，排除
        有句读（. 。 , ， ? ！ ; ）→ 是句子，排除
        英文字超过 3 个词 → 是句子，排除
        英文词不是标题式大写（Reading is important 有 is）→ 排除
        剩下的还得能被题型表命中 */
function bareSectionName(line) {
  let s = String(line || '').trim();
  if (!s || s.length > 60) return null;
  if (/[:：|]/.test(s)) return null;
  s = s.replace(/^(?:part|section|第)\s*[IVXivx一二三四五六七八九十\d]+\s*[部分节]?\s*[.、]?\s*/i, '');
  s = s.replace(/[（(][^）)]{0,30}[）)]\s*$/, '').trim();
  if (!s || s.length > 26) return null;
  if (/[.。,，?？!！;；]/.test(s)) return null;
  if (/[A-Za-z]/.test(s)) {
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length > 3) return null;
    if (!words.every(w => /^[A-Z0-9]/.test(w))) return null;
  }
  return sectionTypeOf(s) ? s : null;
}

function _splitSections(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n');
  const lines = raw.split('\n');
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    let name = null;
    const m = line.match(/^\s*={2,}\s*(.+?)\s*={2,}\s*$/);
    if (m) name = m[1].trim();
    else name = bareSectionName(line);
    if (name) { cur = { name: name, lines: [] }; blocks.push(cur); continue; }
    if (cur) cur.lines.push(line);
  }
  /* 第一个标题之前如果还有正文，也当一块 —— 交给自动判型，
     不然开头那一段会被静悄悄丢掉。 */
  if (blocks.length) {
    const head = [];
    for (const line of lines) {
      if (/^\s*={2,}\s*(.+?)\s*={2,}\s*$/.test(line) || bareSectionName(line)) break;
      head.push(line);
    }
    if (head.join('').trim().length > 20) blocks.unshift({ name: '', lines: head });
  }
  return blocks;
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

/* 分节标题 → 题型。
   ⚠️ 顺序**就是**优先级，先特殊后一般：「听力听写」必须排在「听力」前面，
      否则 "=== 听力听写 ===" 会被 /听力/ 吃掉，变成听力选择题（踩过）。 */
const SEC_RULES = [
  [/听写|dictation/i, 'listen'],
  [/长篇匹配|信息匹配|段落匹配|匹配|matching/i, 'matching'],
  [/选词填空|banked\s*cloze|cloze/i, 'cloze'],
  [/仔细阅读|传统阅读|阅读理解|阅读|careful|reading/i, 'careful'],
  [/单项选择|单选|single\s*choice/i, 'single'],
  [/判断|正误|true\s*\/?\s*false|judge/i, 'judge'],
  [/听力|listening/i, 'listening'],
  [/数量推理|定量|数学|quant/i, 'quant'],
  [/填空|gap|fill/i, 'gap'],
  [/写作|作文|writing|essay/i, 'write'],
  [/翻译|translation/i, 'translate'],
  [/口语|朗读|speaking|oral/i, 'speak'],
];
function sectionTypeOf(name) {
  const s = String(name || '');
  for (let i = 0; i < SEC_RULES.length; i++) {
    if (SEC_RULES[i][0].test(s)) return SEC_RULES[i][1];
  }
  return null;
}

/* 一个分节标题都没写时，按内容猜这是哪种题。
   ⚠️ 猜完要**告诉用户**"我把它当成了 X" —— 闷声猜错比不猜还糟。 */
function guessImportType(lines) {
  const txt = lines.join('\n');
  const has = re => re.test(txt);
  if (has(/^PARAGRAPHS?\s*[:：]/im) && has(/^STATEMENTS?\s*[:：]/im)) return 'matching';
  if (has(/^OPTIONS?\s*[:：]/im) && has(/^ANSWERS?\s*[:：]/im)) return 'cloze';
  if (has(/^SCRIPT\s*[:：]/im)) return 'listening';
  if (has(/^MATERIAL\s*[:：]/im) || has(/^PROMPT\s*[:：]/im)) {
    return has(/^REFERENCE\s*[:：]/im) ? 'translate' : 'write';
  }
  if (has(/^Q\s*[:：]/im)) return has(/^PASSAGE\s*[:：]/im) ? 'careful' : 'single';
  if (has(/\{\{\d+\}\}/) || has(/_{3,}/)) return 'gap';
  if (has(/^[-*•]\s+[A-Za-z]/m)) return 'listen';
  return null;
}

/* 开放式作答（写 / 译 / 说）：MATERIAL 是题目要求，POINTS 是打分要点，
   SAMPLE / REFERENCE 是参考答案。 */
function _parseOpen(lines) {
  let title = '', material = '', sample = '', reference = '';
  let seconds = 0, mode = '';
  const points = [], buf = [];
  for (const raw of lines) {
    const t = raw.trim();
    let m;
    if (!t) { if (mode === 'm') buf.push(''); continue; }
    if ((m = t.match(/^TITLE\s*[:：]\s*(.*)$/i))) { title = m[1].trim(); continue; }
    if ((m = t.match(/^MATERIAL\s*[:：]\s*(.*)$/i))) { mode = 'm'; if (m[1].trim()) buf.push(m[1].trim()); continue; }
    if ((m = t.match(/^POINTS?\s*[:：]\s*(.*)$/i))) { mode = 'p'; if (m[1].trim()) points.push(m[1].trim()); continue; }
    if ((m = t.match(/^SAMPLE\s*[:：]\s*(.*)$/i))) { mode = 's'; sample = m[1].trim(); continue; }
    if ((m = t.match(/^REFERENCE\s*[:：]\s*(.*)$/i))) { mode = 'r'; reference = m[1].trim(); continue; }
    if ((m = t.match(/^SECONDS?\s*[:：]\s*(\d+)/i))) { seconds = +m[1]; continue; }
    if (mode === 'p') points.push(t.replace(/^[-*•]\s*/, ''));
    else if (mode === 's') sample += (sample ? '\n' : '') + t;
    else if (mode === 'r') reference += (reference ? '\n' : '') + t;
    else buf.push(t);
  }
  material = buf.join('\n').trim();
  if (!material) return null;
  const it = { title: title || '我的题目', material, points };
  if (sample) it.sample = sample;
  if (reference) it.reference = reference;
  if (seconds) it.seconds = seconds;
  return it;
}

/* 通用「材料 + 若干带选项的小题」：仔细阅读 / 单项选择 / 判断 / 听力理解 / 数量推理
   全用这一个解析器，靠**有没有 PASSAGE / SCRIPT** 区分。 */
function _parseChoice(lines) {
  let title = '', script = '';
  const paras = [], questions = [];
  let buf = [], q = null, mode = '';
  const flush = () => { const s = buf.join('\n').trim(); if (s) paras.push(s); buf = []; };
  const closeQ = () => { if (q && q.q) questions.push(q); q = null; };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { if (!q && mode !== 's') flush(); else if (mode === 's') script += '\n'; continue; }
    let m;
    if ((m = t.match(/^TITLE\s*[:：]\s*(.*)$/i))) { title = m[1].trim(); mode = ''; continue; }
    if ((m = t.match(/^(PASSAGE|TEXT)\s*[:：]\s*(.*)$/i))) {
      flush(); mode = ''; if (m[2].trim()) buf.push(m[2].trim()); continue;
    }
    if ((m = t.match(/^SCRIPT\s*[:：]\s*(.*)$/i))) { closeQ(); flush(); mode = 's'; script = m[1].trim(); continue; }
    if ((m = t.match(/^Q\s*[:：]\s*(.*)$/i))) {
      closeQ(); flush(); mode = '';
      q = { q: m[1].trim(), options: [], answer: -1, explain: '' }; continue;
    }
    if ((m = t.match(/^([A-Da-d])\s*[.．、:：]\s*(.*)$/))) {
      if (q) q.options.push(m[2].trim()); continue;
    }
    if ((m = t.match(/^ANSWER\s*[:：]\s*([A-Da-d])/i))) {
      if (q) q.answer = m[1].toUpperCase().charCodeAt(0) - 65;
      continue;
    }
    if ((m = t.match(/^EXPLAIN\s*[:：]\s*(.*)$/i))) { if (q) q.explain = m[1].trim(); continue; }
    if (mode === 's') script += (script ? '\n' : '') + t;
    else if (q) { if (q.explain) q.explain += t; else if (!q.options.length) q.q += ' ' + t; }
    else buf.push(t);
  }
  closeQ(); flush();
  if (!questions.length) return null;
  const it = { title: title || '我的题目', questions };
  if (paras.length) it.passage = paras;
  if (script) it.script = script;
  return it;
}

/* 文本 → 按题型分组。分节标题认不出来时，把整段当一块自动判型。 */
function parseMyBankText(text) {
  const out = {};
  const unknown = [], guessed = [], notes = [];
  let seq = 0;
  // 每次解析换一个时间戳，避免"两次导入各有一篇 mine-careful-1"撞 id
  const stamp = Date.now().toString(36);
  const put = (type, item) => {
    if (!out[type]) out[type] = [];
    seq++;
    item.id = 'mine-' + type + '-' + stamp + '-' + seq;
    item.origin = 'mine';
    out[type].push(item);
  };
  const sections = _splitSections(text);
  if (!sections.length) {
    // 一个 === ... === 都没有：整段自动判型
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const g = guessImportType(lines);
    const b = g ? buildImportItem(g, lines) : null;
    if (b) {
      const nm = (QTYPES[b.type] || {}).name || b.type;
      guessed.push(nm);
      if (b.type === 'listen') b.item.forEach(s => {
        seq++; if (!out.listen) out.listen = [];
        out.listen.push({ id: 'mine-listen-' + stamp + '-' + seq, text: s, origin: 'mine' });
      });
      else put(b.type, b.item);
    }
    return { out, unknown, guessed, notes };
  }
  for (const sec of sections) {
    const nm = sec.name;
    // 标题之前那段正文（name 为空）：没有标题可依，按内容判型
    const type = nm ? sectionTypeOf(nm) : guessImportType(sec.lines);
    if (!type) { if (nm) unknown.push(nm); continue; }
    const b = buildImportItem(type, sec.lines);
    if (!b) { if (nm) unknown.push(nm); continue; }
    if (!nm) guessed.push((QTYPES[b.type] || {}).name || b.type);
    else if (b.type !== type) {
      notes.push('「' + nm + '」里没有选择题，我按「' + ((QTYPES[b.type] || {}).name || b.type)
        + '」处理了');
    }
    if (b.type === 'listen') {
      b.item.forEach(s => {
        seq++; if (!out.listen) out.listen = [];
        out.listen.push({ id: 'mine-listen-' + stamp + '-' + seq, text: s, origin: 'mine' });
      });
      continue;
    }
    put(b.type, b.item);
  }
  return { out, unknown, guessed, notes };
}

/* 按题型把一块文本交给对应的解析器。
   返回 { type, item } —— type 可能和传入的不一样：
   ⚠️「听力」是个有歧义的词，既能是听力选择题，也能是一堆听写句子。
      给了选择题就按选择题收，没给就退成听写句子，并且**告诉用户**。 */
function buildImportItem(type, lines) {
  if (type === 'listen') {
    const a = _parseListen(lines);
    return a ? { type: 'listen', item: a } : null;
  }
  if (type === 'matching') {
    const it = _parseMatching(lines);
    return it ? { type: 'matching', item: it } : null;
  }
  if (type === 'cloze' || type === 'gap') {
    const it = _parseCloze(lines);
    if (!it) return null;
    if (type === 'gap') delete it.options;
    return { type: type, item: it };
  }
  if (['careful', 'single', 'judge', 'listening', 'quant'].indexOf(type) >= 0) {
    const it = _parseChoice(lines);
    if (it) {
      // 判断题的选项是固定的 True/False(/(Not Given))，不写选项也该认得出来
      if (type === 'judge' && !(it.questions || []).some(q => (q.options || []).length >= 2)) {
        it.options = ['True', 'False', 'Not Given'];
      }
      return { type: type, item: it };
    }
    if (type === 'listening') {
      const a = _parseListen(lines);
      if (a) return { type: 'listen', item: a };
    }
    return null;
  }
  if (OPEN_TYPES.indexOf(type) >= 0) {
    const it = _parseOpen(lines);
    return it ? { type: type, item: it } : null;
  }
  return null;
}

/* 「我的题目」里各题型的名字和单位 —— 名字一律取 QTYPES，别再抄一份。
   ⚠️ 这里**不写分值**：分值跟考试绑死（四级仔细阅读 14.2 分、雅思就是 0），
      写在这里就等于把四级的尺子套到别的考试上。分值统一走 scorePerQOf()。 */
/* ==========================================================================
   兜底解析：按"题号 + 选项"抓题
   --------------------------------------------------------------------------
   ⚠️ 为什么必须有它：真实试卷**很少**写成 `Q: / A. / ANSWER:` 那套。
      真题的典型长相是这样的 ——

         Part II  Listening Comprehension (25 minutes)
         Section A
         Directions: In this section, you will hear three news reports...
         Questions 1 to 2 are based on the news report you have just heard.
         1. What is the man going to do?
            A) Buy a ticket.  B) Catch a train.  C) Meet a friend.  D) Leave the city.
         2. Where does the conversation most probably take place?
            A) At a station. B) In a hotel. C) In an office. D) At an airport.

      也就是说：**题号 + 题干 + 四选项挤在一行里**，用的是 `A)` 不是 `A.`，
      前面还有 Directions 和 "Questions 1 to 2 are based on…" 这种引导句。
      上面那套严格格式一个都套不上，所以必须先按"题号"找题、按"选项"切选项。

   规则（都按"真实试卷怎么排"来定，不要求使用者改格式）：
     · 题号：行首的 `1.` `1、` `1．` `1)` —— 而且**序号要大致递增**，
       否则像 `26. ______` 这种正文里的编号会被误当成题。
     · 选项：`A) ` `B. ` `C、` 都认，一行里塞多个也能切开。
     · 题号之前的正文 = 这篇文章的**短文**（passage）。
     · 题型优先看块标题（Part/Section 后面那个名字）；
       没有标题就按"选项个数 + 有没有长短文"猜，再让考试匹配去筛。
   ========================================================================== */

/* 把一行里的 "A) xx  B) yy" 切成 ["xx","yy"]；也认 A. / A、/ A． */
function splitOptionsLine(s) {
  const t = String(s || '');
  const re = /(?:^|(?<=\s))([A-F])\s*[)）、.．:：]\s*/g;
  const parts = t.split(re);            // ['', 'A', 'xx ', 'B', 'yy', ...]
  const out = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const v = parts[i + 1].trim();
    if (v) out.push(v);
  }
  return out;
}
/* 把 "1. 题干 A) xx B) yy" 拆成 { head, options } */
function splitHeadOptions(s) {
  const t = String(s || '');
  const re = /(?:^|(?<=\s))([A-F])\s*[)）、.．:：]\s*/;
  const m = re.exec(t);
  if (!m) return { head: t.trim(), options: [] };
  return { head: t.slice(0, m.index).trim(), options: splitOptionsLine(t.slice(m.index)) };
}

/* 按"题号行"把一段文字拆成 passage + questions */
function looseQuestions(lines) {
  const qre = /^\s*(\d{1,3})\s*[.、．)）]\s*(.*)$/;
  const qs = [];
  const passage = [];
  let cur = null, lastN = 0;
  lines.forEach(line => {
    const m = qre.exec(line);
    /* ⚠️ 判"这一行是不是一道题的题号行"，两个条件缺一不可：
       1) 序号递增（真实试卷里 26. ______ 这种**空位编号**长得一模一样，
          但它属于正文；靠"题目按顺序排"能区分开）
       2) 这一行**像一道题**：题干够长，或者这一行自己就带着选项
       ⚠️ 别写"第一题必须 ≤ 5" —— 阅读部分常常从 46 题开始，
          那样整段阅读会被整段判成"不是题"（踩过）。 */
    const so0 = m ? splitHeadOptions(m[2]) : null;
    const looksQ = !!m && (so0.options.length >= 2
      || (m[2].replace(/[^A-Za-z\u4e00-\u9fff]/g, '').length >= 8 && !/^[_\-.\s]+$/.test(m[2])));
    const inOrder = !!m && (qs.length === 0 || (+m[1] > lastN && +m[1] <= lastN + 8));
    const isQ = looksQ && inOrder;
    if (isQ) {
      const so = splitHeadOptions(m[2]);
      cur = { n: +m[1], q: so.head, options: so.options.slice(), answer: -1 };
      qs.push(cur);
      lastN = +m[1];
      return;
    }
    if (!cur) { if (line.trim()) passage.push(line.trim()); return; }
    const opts = splitOptionsLine(line);
    if (opts.length >= 2) { cur.options = cur.options.concat(opts); return; }
    const one = /^\s*([A-F])\s*[)）、.．:：]\s*(.+?)\s*$/.exec(line);
    if (one && one[2]) { cur.options.push(one[2]); return; }
    if (/^\s*(?:Answer|答案|【答案】|Key)\s*[:：]/.test(line)) {
      const a = /([A-F])/.exec(line.replace(/^\s*(?:Answer|答案|【答案】|Key)\s*[:：]/, ''));
      if (a) cur.answer = 'ABCDEF'.indexOf(a[1]);
      return;
    }
    if (/^\s*(?:Directions?|说明|注意)\s*[:：]/i.test(line)) return;   // 指令行丢掉
    if (!cur.options.length && line.trim()) cur.q += (cur.q ? ' ' : '') + line.trim();
  });
  /* 顺手统计两个"内容特征"，用来判断这一段到底是哪种题 ——
     比标题可靠：Part 里面只有 Section A/B/C，标题上根本没有题型名。 */
  let bankCount = 0, paraCount = 0;
  const blanks = [];
  lines.forEach(line => {
    const t = line.trim();
    /* 词库（选词填空）有两种排法，两种都得认：
       ① 一行塞好几个：A) available B) deteriorating C) earned …
       ② **一个词一行**：A) available / B) deteriorating / …（真题 PDF/Word 常这样）
       判据：这一行只有 A)-O) 中的一个字母 + 一两个短词。 */
    const opts = splitOptionsLine(t);
    if (opts.length >= 6 && opts.every(o => o.split(/\s+/).length <= 2)) bankCount++;
    else if (/^[A-O]\s*[)）、.．]\s*[A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z'\-]+)?\s*$/.test(t)) bankCount++;
    // 长篇匹配的段落：以 A) 开头而且是一整段话
    if (/^[A-O]\s*[)）、.．]\s*\S/.test(t) && t.length >= 60) paraCount++;
    // 空位编号被排成独立一行（就一个 "26"）—— 选词填空的正文常这样
    const bm = /^(\d{1,3})$/.exec(t);
    if (bm) blanks.push(+bm[1]);
    // ⚠️ 空位编号在真题里是连号（26,27,28…）。正文里别的孤立数字不是空位 ——
    //    后面跳号就停，否则会多算空位（"词库里的词不够填这些空"就是这么来的）。
  });
  const bseq = [];
  blanks.forEach(n => {
    if (!bseq.length) bseq.push(n);
    else if (n === bseq[bseq.length - 1] + 1) bseq.push(n);
  });
  return { passage: passage, questions: qs.filter(x => x.q || x.options.length),
           bankCount: bankCount, paraCount: paraCount, blanks: bseq };
}

/* Part 里面还有 Section A/B/C —— 这三个往往就是三种不同的题型
   （选词填空 / 长篇匹配 / 仔细阅读）。不切开的话整块会被判成同一种题。 */
function splitSubSections(lines) {
  const re = /^\s*Section\s+([A-E])\s*$/i;
  const out = [];
  let cur = null;
  lines.forEach(l => {
    const m = re.exec(String(l).trim());
    if (m) { cur = { name: 'Section ' + m[1].toUpperCase(), lines: [] }; out.push(cur); return; }
    if (!cur) { cur = { name: '', lines: [] }; out.push(cur); }
    cur.lines.push(l);
  });
  return out;
}

/* 这一段属于什么题型：先看标题，标题认不出来就按内容猜 */
function looseTypeOf(headerName, block, examTypes, hint) {
  const byName = headerName ? sectionTypeOf(headerName) : null;
  const has = t => examTypes.indexOf(t) >= 0;
  /* ⓪ 父块的名字也认不出来时，用"位置提示"：
     四级/六级的 Part III Reading 固定是 Section A 选词填空 / B 长篇匹配 / C 仔细阅读。 */
  if (hint && has(hint)) return hint;
  /* ⓪′ 父块标题（"Listening Comprehension"）常常比子块的 "Section A" 更有信息 */
  const byParent = hint === undefined && block.parentName
    ? sectionTypeOf(block.parentName) : null;
  if (!byName && byParent && has(byParent)) return byParent;
  /* ① **内容特征优先于标题** —— 真题的 Part 里面只有 "Section A/B/C"，
     标题上看不出题型；但内容一眼能认：
       有词库行（A) word B) word…）+ 编号空位 → 选词填空
       有多个长段落（A) 长文…）+ 编号句子        → 长篇匹配 */
  if (block.bankCount >= 1 && has('cloze')) return 'cloze';
  if (block.blanks.length >= 5 && has('cloze')) return 'cloze';
  if (block.paraCount >= 4 && has('matching')) return 'matching';
  if (byName && has(byName)) return byName;
  const qs = block.questions;
  const nOpt = qs.length ? Math.max.apply(null, qs.map(q => (q.options || []).length)) : 0;
  const longText = block.passage.join(' ').length > 200;
  let order;
  if (nOpt >= 4) order = longText
    ? ['careful', 'single', 'listening', 'reading']
    : ['listening', 'single', 'careful', 'quant'];
  else if (nOpt === 3) order = ['single', 'listening', 'careful', 'quant'];
  else if (nOpt === 2) order = ['judge', 'single', 'listening'];
  else order = ['gap', 'cloze', 'translate'];
  const pick = order.filter(t => examTypes.indexOf(t) >= 0)[0];
  if (pick) return pick;
  return byName || null;
}

/* 兜底入口：把整篇文字按"标题行"分块，每块按题号抓题 */
function parseLooseBank(text) {
  const examTypes = typesOf(curExam());
  const blocks = _splitSections(text);
  const out = {};
  const notes = [];
  /* Part 里带 Section A/B/C 的，先切成子块 —— 它们往往是三种不同题型 */
  const units = [];
  blocks.forEach(sec => {
    const subs = splitSubSections(sec.lines);
    if (subs.length > 1) {
      subs.forEach(sub => units.push({
        name: sub.name || sec.name,
        parent: sec.name,
        lines: sub.lines.concat(sec.name ? [] : []),
      }));
    } else {
      units.push({ name: sec.name, parent: '', lines: sec.lines });
    }
  });
  units.forEach((sec, bi) => {
    const b = looseQuestions(sec.lines);
    if (!b.questions.length && !b.bankCount && !b.blanks.length) return;
    /* 子块自己没有题型名时，先看父块的名字（"Listening Comprehension" →
       听力理解）；阅读那三个 Section 再按固定顺序兜底（A 选词 / B 匹配 / C 仔细）。 */
    let hint;
    const subNo = /^Section\s*([A-E])$/i.exec(sec.name);
    const subType = sectionTypeOf(sec.name);
    if (subNo && !subType) {
      const pType = sectionTypeOf(sec.parent);
      if (pType === 'careful') {                  // 阅读那个大 Part
        hint = { A: 'cloze', B: 'matching', C: 'careful' }[subNo[1].toUpperCase()];
      }
    }
    b.parentName = sec.parent || '';
    const type = looseTypeOf(sec.name, b, examTypes, hint);
    if (!type) return;
    const it = {
      id: 'L' + bi + '-' + Date.now().toString(36),
      title: (sec.name || '').trim() || ('第 ' + (bi + 1) + ' 部分'),
      origin: 'mine',
    };
    if (type === 'cloze' || type === 'gap') {
      /* 选词/填空：正文里是 {{n}} 或 n. ______ 的空位。
         答案多半在"答案解析"那一份里，会由 applyAnswerKey 补上。 */
      /* ⚠️ 真题里空位编号常被 Word 排成**独立一行**（就一个 "26"），
         并回正文里更好读；顺便把段落接起来。 */
      it.passage = [b.passage.join('\n').replace(/\n\s*(\d{1,3})\s*\n/g, ' {{$1}} ')];
      it.answers = {};
      /* 空位编号来自"单独成行的 26 / 27…"，也可能来自 {{n}}；两者都收 */
      b.blanks.forEach(n => { it.answers[n] = ''; });
      b.questions.forEach(q => { it.answers[q.n] = ''; });
      const inline = (it.passage[0].match(/\{\{(\d{1,3})\}\}/g) || []);
      inline.forEach(x => { it.answers[+x.replace(/\D/g, '')] = ''; });
    } else if (type === 'matching') {
      /* ⚠️ 匹配题的字段名是 **paragraphs**（[{letter,text}]），不是 passage。
         之前写错了，页面就报"没有段落正文"。另外 Word 会把一段折成好几行，
         要接回同一段里。 */
      const paras = [];
      b.passage.forEach(line => {
        const t2 = line.trim();
        const m2 = /^([A-O])\s*[)）、.．]\s*(.*)$/.exec(t2);
        if (m2) { paras.push({ letter: m2[1], text: m2[2] }); return; }
        if (paras.length && t2) paras[paras.length - 1].text += ' ' + t2;
      });
      it.paragraphs = paras;
      it.statements = b.questions.map(q => ({ s: q.q, answer: '', n: q.n }));
    } else if (type === 'write' || type === 'translate' || type === 'speak') {
      it.material = (b.passage.join('\n') + '\n' + b.questions.map(q => q.q).join('\n')).trim();
    } else {
      it.passage = b.passage.slice();
      it.questions = b.questions.map(q => ({
        q: q.q || ('第 ' + q.n + ' 题'),
        options: q.options,
        answer: q.answer,
        n: q.n,                       // 原题号：答案串是对着题号来的
      }));
    }
    if (!out[type]) out[type] = [];
    out[type].push(it);
  });
  Object.keys(out).forEach(k => {
    const n = out[k].reduce((a, it) => a + (it.questions || it.statements
      || Object.keys(it.answers || {})).length, 0);
    if (n) notes.push(myTypeMeta(k).name + ' ' + out[k].length + ' 篇 / ' + n + ' 题');
  });
  return { out: out, notes: notes };
}

/* 从试卷文本里读"分值标注"。
   使用者要求：**试卷里标了多少分，就按试卷的算**（没标才按考试标准）。
   认这几种写法（都很常见）：
     每题 2 分 / 每小题 2 分 / 每空 1.5 分 / 每问 2 分 / 每句 1 分
     共 10 分 / 小计 10 分 / 合计 10 分 / 满分 10 分 /（10 分）/ (10 分)
   标"每题"的直接用；标"共/小计"的除以这一类的题量，换算成每题多少分。 */
function parseImportMarks(text, types) {
  const marks = {};
  const raw = {};
  _splitSections(text).forEach(sec => {
    const type = sec.name ? sectionTypeOf(sec.name) : null;
    if (!type || raw[type]) return;
    const body = sec.lines.join('\n');
    const p = /每\s*(?:小)?\s*(?:题|空|问|句|小题)\s*([\d.]+)\s*分/.exec(body);
    if (p) { raw[type] = { per: parseFloat(p[1]) }; return; }
    const tot = /(?:共|小计|合计|满分)\s*([\d.]+)\s*分/.exec(body)
      || /[（(]\s*([\d.]+)\s*分\s*[）)]/.exec(body);
    if (tot) raw[type] = { total: parseFloat(tot[1]) };
  });
  const list = types || [];
  Object.keys(raw).forEach(type => {
    const v = raw[type];
    if (v.per) { if (v.per > 0) marks[type] = v.per; return; }
    const items = ((list.find(x => x.type === type) || {}).items) || [];
    const n = unitCountOf(type, items);
    if (n > 0 && v.total > 0) marks[type] = v.total / n;
  });
  return marks;
}

function myTypeMeta(type) {
  const q = QTYPES[type] || {};
  return { name: q.name || type, unit: q.unit || '篇' };
}

/* ---------- 导入体检 ----------
   把"读不出来的地方"逐条列出来。用户宁可先看到 5 条问题，
   也不想事后发现少了两篇。
   ⚠️ 只体检**单条题目内部**的缺失（选项不全、没标答案、题干空）。
      **绝不**因为"这场考试少了几种题型"报问题 ——
      「这次只导入四级阅读、没导听力」是正常用法，不是错误。 */
function diagnoseTypes(types) {
  const issues = [];
  for (const t of types) {
    const nm = myTypeMeta(t.type).name;
    (t.items || []).forEach((it, k) => {
      const where = nm + ' 第 ' + (k + 1) + ' 篇' + (it.title ? '「' + it.title + '」' : '');
      const bad = [];
      if (['careful', 'single', 'judge', 'listening', 'quant'].indexOf(t.type) >= 0) {
        const qs = it.questions || [];
        if (!qs.length) bad.push('没有任何小题');
        qs.forEach((q, qi) => {
          const os = q.options || it.options || [];
          if (!String(q.q || '').trim()) bad.push('第 ' + (qi + 1) + ' 题没有题干');
          if (os.length < 2) bad.push('第 ' + (qi + 1) + ' 题只有 ' + os.length + ' 个选项');
          else if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= os.length) {
            bad.push('第 ' + (qi + 1) + ' 题没标答案（或标了答案但不在选项里）');
          }
        });
      } else if (t.type === 'matching') {
        if (!(it.paragraphs || []).length) bad.push('没有段落正文');
        if (!(it.statements || []).length) bad.push('没有要匹配的句子');
        (it.statements || []).forEach((s, si) => {
          if (!s.answer) bad.push('第 ' + (si + 1) + ' 句没标它属于哪一段');
        });
      } else if (t.type === 'cloze' || t.type === 'gap') {
        const nBlank = (String(it.passage || '').match(/\{\{\d+\}\}/g) || []).length;
        const nAns = Object.keys(it.answers || {}).length;
        if (!nBlank) bad.push('正文里没有 {{1}} 这样标出来的空位');
        else if (nAns < nBlank) bad.push('正文有 ' + nBlank + ' 个空，却只给了 ' + nAns + ' 个答案');
        if (t.type === 'cloze' && (it.options || []).length < nAns) {
          bad.push('词库里的词不够填这些空');
        }
      } else if (OPEN_TYPES.indexOf(t.type) >= 0) {
        if (!String(it.material || '').trim()) bad.push('没有题目要求／材料');
      }
      if (bad.length) issues.push({ where, bad });
    });
  }
  return issues;
}

/* 导入的内容必须属于**当前这场考试**。
   ⚠️ 只查"多出来的"：这场考试根本不考的题型才拒绝
      （四级里出现「听力听写」）。
      **不查"缺的"** ——「这次只导入四级阅读、没导听力」完全正常，
      绝不能因为少了几种题型就说"这不是四级的题"。（用户特别强调过）
   返回的 exams 是"哪些考试真的考它"，好让用户知道该切到哪去。 */
function checkExamFit(types) {
  const ex = curExam();
  const mine = typesOf(ex);
  return types.filter(t => mine.indexOf(t.type) < 0).map(t => ({
    type: t.type,
    name: myTypeMeta(t.type).name,
    n: (t.items || []).length,
    exams: EXAMS.filter(e => typesOf(e).indexOf(t.type) >= 0).map(e => e.short || e.name),
  }));
}

/* ==========================================================================
   从文件里取出纯文本
   --------------------------------------------------------------------------
   全部在浏览器本地完成：**不联网、不上传**，你的试卷不会离开这台设备。
   .docx / .pptx / .xlsx 本质就是 zip，浏览器原生的 DecompressionStream
   就能解开，不用引任何第三方库。
   ========================================================================== */
const DOC_EXT = /^(docx|pptx|xlsx)$/;
const IMG_EXT = /^(png|jpe?g|webp|bmp|gif|tiff?)$/;

function extOf(name) {
  const s = String(name || '').toLowerCase();
  const i = s.lastIndexOf('.');
  return i < 0 ? '' : s.slice(i + 1);
}

async function inflateWith(bytes, fmt) {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(fmt));
    return await new Response(st).text();
  } catch (e) { return null; }
}

/* 极简 zip：只做"按名字取一个条目"，够解 Office 里的 XML。
   zip 结构 = 本地头(PK\x03\x04) + 数据 … 中央目录(PK\x01\x02) … EOCD(PK\x05\x06)。
   数据要么原样存(0)，要么 deflate(8) —— 后者交给浏览器原生解压。 */
async function unzipEntryText(buf, nameRe) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  const from = Math.max(0, u8.length - 66000);
  for (let i = u8.length - 22; i >= from; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8');
  for (let k = 0; k < n; k++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) return null;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const nm = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    if (nameRe.test(nm) && csize !== 0xffffffff) {
      const lNameLen = dv.getUint16(lho + 26, true);
      const lExtraLen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lNameLen + lExtraLen;
      const data = u8.subarray(start, start + csize);
      if (method === 0) return dec.decode(data);
      return await inflateWith(data, 'deflate-raw');
    }
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return null;
}

/* Office 的 XML → 纯文本：段落/单元格结束处补换行，再剥掉标签。 */
function officeXmlToText(xml) {
  let s = String(xml)
    .replace(/<w:tab\b[^>]*\/>/g, '\t').replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n').replace(/<a:br\b[^>]*\/>/g, '\n')
    .replace(/<\/a:p>/g, '\n').replace(/<\/c>/g, '\t').replace(/<\/row>/g, '\n');
  s = s.replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* 一段文本"像不像正常文字"：乱码/二进制就判 false。
   ⚠️ 别只数 [A-Za-z]！踩过：只数英文字母的话，**中文 PDF / 中文 Word**
      会被判成"没读出文字"，直接丢掉 —— 而中文文档恰恰是最常见的。
      所以这里数的是"真正是文字"的字符：英文、数字、汉字、假名。 */
function looksLikeText(s) {
  const t = String(s || '');
  if (t.trim().length < 20) return false;
  const good = (t.match(/[A-Za-z0-9\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  const bad = (t.match(/[\u0000-\u0008\u000e-\u001f]/g) || []).length;
  return good / t.length > 0.5 && bad / t.length < 0.02;
}

/* 读一个文件 → 文本。返回 { ok, text } 或 { ok:false, msg }。 */
async function readImportFile(file) {
  const ext = extOf(file.name);
  if (DOC_EXT.test(ext)) {
    const buf = await file.arrayBuffer();
    const xml = await unzipEntryText(buf, ext === 'docx'
      ? /^word\/document\.xml$/
      : (ext === 'pptx' ? /^ppt\/slides\/slide\d+\.xml$/ : /^xl\/sharedStrings\.xml$/));
    if (!xml) {
      return { ok: false, msg: '这个 Office 文件我打不开（可能是加密的，或者是改了后缀的老格式）' };
    }
    const txt = officeXmlToText(xml);
    if (!looksLikeText(txt)) return { ok: false, msg: '文件里没读出多少文字，是不是空的？' };
    return { ok: true, text: txt };
  }
  if (ext === 'doc') {
    return { ok: false, msg: '这是 2003 版的老 .doc 格式，浏览器解不开。'
      + '用 Word / WPS 打开后「另存为」.docx 或 .txt 再导。' };
  }
  if (ext === 'pdf') {
    const ab = await file.arrayBuffer();
    const txt = await textFromPdf(ab);
    if (txt) return { ok: true, text: txt };
    /* 读不出文字不代表没救：扫描件 PDF 的整页就是一张 JPEG，
       而且原样存在文件里，可以直接抠出来交给离线识别。 */
    let imgs = pdfEmbeddedJpegs(ab);
    if (!imgs.length) imgs = await pdfFlateImages(pdfLatin1(ab));   // 原始位图那种
    if (imgs.length) return { ok: false, pdfImages: imgs };
    /* ⚠️ PDF 的排版千奇百怪（加密、字体子集、浏览器打印、扫描…），
       读不出来是常态。这时候**最该给的一句话是"转成 docx"** ——
       那是最省事、成功率最高的路；别把办法藏在后面让人自己找。 */
    return { ok: false, msg: 'PDF 读不出来。'
      + '**最省事的办法：用 Word / WPS 打开这个 PDF，另存为 .docx，再传一次**'
      + '（.docx 一定能读，PDF 的排版什么情况都有）。'
      + '实在转不了的备选：① 把每页截图，用图片识别；'
      + '② 用手机相册／微信的「提取文字」把文字提出来粘进来。' };
  }
  if (IMG_EXT.test(ext)) {
    return { ok: false, image: file, msg: '这是一张图片，要走识别。' };
  }
  const txt = await file.text();
  return { ok: true, text: txt };
}

/* PDF：只处理"文字型"（Word / 网页导出的）。扫描件里根本没有文字，
   会明确告诉用户，而不是塞一堆乱码进去。
   不引 pdf.js —— 那是几 MB 的额外体积，为了"贴一道题"不值。
   做法：把每个 stream 解压，抓 (…) Tj 和 [ (…) ] TJ 里的字符串。

   ⚠️ 踩过的坑，改这里之前先读：
     "endstream" 这个词**结尾正好是 "stream"**，所以 /stream\r?\n/g 会在
     "endstream\r\n" 里再匹配一次，把一个流的末尾当成下一个流的开头 ——
     于是只有第一个流被正确定位，后面的全错位，整个 PDF 一个字都读不出来
     （表现就是"PDF 明明有字，却说读不出文字"）。
     所以既要跳过整个 endstream，正则也要排除前面是 end 的情况。 */
async function textFromPdf(buf) {
  const raw = pdfLatin1(new Uint8Array(buf));
  const maps = await pdfFontMaps(raw);   // 字体表：字形编号 → 文字
  let out = '';
  const re = /(?<!end)stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    re.lastIndex = end + 9;            // 跳过整个 endstream，别再匹配到它里面的 stream
    const chunk = raw.slice(start, end);
    let txt = null;
    if (chunk.charCodeAt(0) === 0x78) {
      const bytes = new Uint8Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) bytes[i] = chunk.charCodeAt(i) & 0xff;
      txt = await inflatePdfStream(bytes);
    }
    if (!txt) txt = chunk;
    // 只处理"像内容流"的那些；字体流、图片流里没有画字操作符，跳过免得塞乱码
    if (!/(\bBT\b|\bTj\b|\bTJ\b)/.test(txt)) continue;
    out += pdfContentText(txt, maps);
  }
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return looksLikeText(out) ? out : null;
}

/* PDF 里的 FlateDecode = zlib 包装（2 字节头 + deflate 数据 + adler32）。
   ⚠️ 不能把整段直接丢给 DecompressionStream('deflate')：
      PDF 的流在 endstream 之前一般还跟着个 \r\n，浏览器会直接报
      「Trailing junk found after the end of the compressed stream」，
      整段解压失败 —— 表现就是"PDF 里明明有字，却一个字都读不出来"。
      实测 **deflate-raw 对尾部多余的字节是容忍的**，所以跳过 2 字节 zlib 头
      按 raw deflate 解：既不用算 adler32，也不怕尾部那点垃圾。 */
async function inflatePdfStream(bytes) {
  if (typeof DecompressionStream === 'undefined' || bytes.length < 4) return null;
  const zlib = bytes[0] === 0x78;
  const body = zlib ? bytes.subarray(2) : bytes;
  let t = await inflateWith(body, 'deflate-raw');
  if (t) return t;
  if (zlib) { t = await inflateWith(bytes, 'deflate'); if (t) return t; }
  /* ⚠️ 尾部逐字节回退重试。
     踩过：在 node 里试出来"deflate-raw 能容忍尾部多余的字节"，就以为不用管了；
     结果**浏览器里不容忍** —— PDF 的流在 endstream 前带个 \r\n 就整段解压失败，
     表现还是"PDF 一个字都读不出来"。所以这里老老实实从尾巴上一点点削。
     最多削 16 字节，够覆盖 \r\n、多余的空格和偶发的补位字节。 */
  for (let cut = 1; cut <= 16 && cut < body.length; cut++) {
    t = await inflateWith(body.subarray(0, body.length - cut), 'deflate-raw');
    if (t) return t;
  }
  return null;
}

/* 扫描件 PDF：整页其实就是一张（或几张）JPEG，没有可复制的文字。
   好消息是这些 JPEG **原样存在文件里**（/Filter /DCTDecode），可以直接抠出来
   交给离线识别 —— 不用为此引入整套渲染引擎。
   只认 JPEG；JPX / 传真压缩那两种浏览器解不了，跳过。 */
function pdfEmbeddedJpegs(buf) {
  const u8 = new Uint8Array(buf);
  let raw = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    raw += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  const out = [];
  const re = /\/DCTDecode/g;
  let m;
  while ((m = re.exec(raw)) && out.length < 12) {
    const sIdx = raw.indexOf('stream', m.index);
    if (sIdx < 0) break;
    let p = sIdx + 6;
    if (raw[p] === '\r') p++;
    if (raw[p] === '\n') p++;
    const eIdx = raw.indexOf('endstream', p);
    if (eIdx < 0) break;
    re.lastIndex = eIdx;
    // JPEG 一定 FFD8 开头、FFD9 结尾；按这两个魔数把准确边界抠出来
    let a = p, b2 = eIdx;
    while (a < b2 - 2 && !(u8[a] === 0xff && u8[a + 1] === 0xd8)) a++;
    while (b2 > a + 2 && !(u8[b2 - 2] === 0xff && u8[b2 - 1] === 0xd9)) b2--;
    if (b2 - a < 4096) continue;               // 太小了，多半不是整页图
    out.push(new Blob([u8.subarray(a, b2)], { type: 'image/jpeg' }));
  }
  return out;
}

/* ==========================================================================
   PDF 取字（第三部分）：对象流 + 原始位图
   --------------------------------------------------------------------------
   第三个坑：现代 PDF（Chrome「打印成 PDF」、新版 Word）会把页对象、字体对象
   **打包塞进"对象流"**（/Type /ObjStm），它们在文件正文里根本搜不到
   "12 0 obj" 这种字面 —— 于是拿不到字体的 /ToUnicode 表，
   内容流里的字形编号一个也解不出来，表现就是"有字却一个字都读不到"。

   第四个坑：整页图不一定是 JPEG。Chrome 打印出来的 PDF 常把图重新编码成
   **原始位图 + FlateDecode**（还可能带 PNG 预测器），那就没有 FFD8/FFD9 可抠，
   得自己把像素解出来贴到 canvas 上。
   ========================================================================== */

/* 把对象流里的对象也收进来，和文件正文里的对象合成一份表 */
async function pdfCollectObjects(raw) {
  const objs = pdfObjects(raw);
  const re = /\/Type\s*\/ObjStm/g;
  let m;
  while ((m = re.exec(raw))) {
    const sIdx = raw.indexOf('stream', m.index);
    if (sIdx < 0) break;
    let p = sIdx + 6;
    if (raw[p] === '\r') p++;
    if (raw[p] === '\n') p++;
    const eIdx = raw.indexOf('endstream', p);
    if (eIdx < 0) break;
    re.lastIndex = eIdx;
    const dStart = raw.lastIndexOf('<<', m.index);
    const dict = raw.slice(dStart < 0 ? m.index : dStart, sIdx);
    const n = +((/\/N\s+(\d+)/.exec(dict) || [])[1] || 0);
    const first = +((/\/First\s+(\d+)/.exec(dict) || [])[1] || 0);
    if (!n) continue;
    const bytes = new Uint8Array(eIdx - p);
    for (let i = p; i < eIdx; i++) bytes[i - p] = raw.charCodeAt(i) & 0xff;
    const txt = /\/FlateDecode/.test(dict)
      ? ((await inflatePdfStream(bytes)) || (await inflateWith(bytes, 'deflate')))
      : raw.slice(p, eIdx);
    if (!txt) continue;
    const head = txt.slice(0, first);
    const nums = head.trim().split(/\s+/).map(Number).filter(x => !isNaN(x));
    for (let k = 0; k + 1 < nums.length; k += 2) {
      const num = String(nums[k]);
      const off = nums[k + 1];
      const nextOff = (k + 3 < nums.length) ? nums[k + 3] : (txt.length - first);
      if (nextOff <= off) continue;
      objs[num] = { head: txt.slice(first + off, first + nextOff), inStm: true };
    }
  }
  return objs;
}

/* PNG 预测器（FlateDecode 的图常带 /Predictor 12）→ 把行内差分还原成像素 */
function pngUnpredict(data, colors, bpc, columns) {
  const bpp = Math.max(1, Math.ceil(colors * bpc / 8));
  const rowLen = Math.ceil(colors * bpc * columns / 8);
  const rows = Math.floor(data.length / (rowLen + 1));
  if (!rows || !rowLen) return null;
  const out = new Uint8Array(rowLen * rows);
  let ip = 0, op = 0;
  for (let r = 0; r < rows; r++) {
    const ft = data[ip++];
    for (let i = 0; i < rowLen; i++) {
      const a = i >= bpp ? out[op + i - bpp] : 0;
      const b = r > 0 ? out[op + i - rowLen] : 0;
      const c = (i >= bpp && r > 0) ? out[op + i - rowLen - bpp] : 0;
      let v = data[ip + i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += ((a + b) >> 1);
      else if (ft === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      out[op + i] = v & 0xff;
    }
    ip += rowLen;
    op += rowLen;
  }
  return out;
}

/* 整页的"原始位图"（/Filter /FlateDecode + /Subtype /Image）→ 一张能识别的图。
   只处理最常见的 8 位灰度 / RGB（试卷扫描件基本都是这两种）。 */
async function pdfFlateImages(raw) {
  const out = [];
  const re = /\/Subtype\s*\/Image/g;
  let m;
  while ((m = re.exec(raw)) && out.length < 12) {
    const dStart = raw.lastIndexOf('<<', m.index);
    const sIdx = raw.indexOf('stream', m.index);
    if (sIdx < 0) break;
    const dict = raw.slice(dStart < 0 ? m.index : dStart, sIdx);
    let p = sIdx + 6;
    if (raw[p] === '\r') p++;
    if (raw[p] === '\n') p++;
    const eIdx = raw.indexOf('endstream', p);
    if (eIdx < 0) break;
    re.lastIndex = eIdx;
    if (/\/DCTDecode|\/JPXDecode|\/CCITTFaxDecode/.test(dict)) continue;  // 那几种另说
    if (!/\/FlateDecode/.test(dict)) continue;
    const w = +((/\/Width\s+(\d+)/.exec(dict) || [])[1] || 0);
    const h = +((/\/Height\s+(\d+)/.exec(dict) || [])[1] || 0);
    const bpc = +((/\/BitsPerComponent\s+(\d+)/.exec(dict) || [])[1] || 8);
    if (!w || !h || bpc !== 8 || w * h < 10000) continue;
    const gray = /\/DeviceGray/.test(dict);
    const rgb = /\/DeviceRGB/.test(dict);
    if (!gray && !rgb) continue;
    const colors = gray ? 1 : 3;
    const bytes = new Uint8Array(eIdx - p);
    for (let i = p; i < eIdx; i++) bytes[i - p] = raw.charCodeAt(i) & 0xff;
    let data = await inflatePdfStream(bytes);
    if (!data) data = await inflateWith(bytes, 'deflate');
    if (!data) continue;
    const raw2 = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) raw2[i] = data.charCodeAt(i) & 0xff;
    let px = raw2;
    if (/\/Predictor\s+(1[0-9]|2[0-9]|3[0-9])/.test(dict)) {
      const up = pngUnpredict(raw2, colors, bpc, w);
      if (!up) continue;
      px = up;
    }
    if (px.length < w * h * colors) continue;
    try {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      const img = g.createImageData(w, h);
      for (let i = 0, j = 0; i < w * h; i++) {
        if (gray) {
          const v = px[i];
          img.data[j++] = v; img.data[j++] = v; img.data[j++] = v; img.data[j++] = 255;
        } else {
          img.data[j++] = px[i * 3]; img.data[j++] = px[i * 3 + 1];
          img.data[j++] = px[i * 3 + 2]; img.data[j++] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      if (blob && blob.size > 4096) out.push(blob);
    } catch (e) { /* 这一张算了 */ }
  }
  return out;
}

/* 抓 PDF 内容流里画字的字符串（老路径，留着给"没有字体映射"的简单 PDF 兜底）：
   (...) Tj / (...) ' / [...] TJ */
function pdfRunStrings(s) {
  let out = '';
  const re = /\((?:\\.|[^\\()])*\)/g;
  let m, last = 0, line = '';
  while ((m = re.exec(s))) {
    const gap = s.slice(last, m.index);
    last = re.lastIndex;
    const body = m[0].slice(1, -1)
      .replace(/\\([nrtbf()\\])/g, (x, c) => ({ n: '\n', r: '\n', t: '\t', b: '', f: '' }[c] !== undefined
        ? ({ n: '\n', r: '\n', t: '\t', b: '', f: '' }[c]) : c))
      .replace(/\\([0-7]{1,3})/g, (x, o) => String.fromCharCode(parseInt(o, 8)));
    line += body;
    // TJ/Tj 之后常见的换行标记
    if (/\b(Tj|TJ|'|")\s*$/.test(gap) || /\bT\*|\bTd\b|\bTD\b/.test(gap)) {
      out += line + '\n'; line = '';
    }
  }
  return out + line;
}

/* ==========================================================================
   PDF 取字（第二部分）：查字形编号表
   --------------------------------------------------------------------------
   为什么光抓 (…) 不够 —— 这是"PDF 明明有字却读不出来"的**另一半原因**：
   Word / WPS 导出的 PDF 用**子集字体 + Identity-H 编码**，
   内容流里画的是字形编号：`[<072C>-4<0BC6>] TJ`，不是 ASCII。
   不查字体自带的 /ToUnicode 表，读出来就是一堆乱码（或者干脆一个字都没有）。

   所以这里做三件事：
     1) 把每个 /ToUnicode 流找出来，解成「字形编号 → 文字」的表
     2) 从 /Font << /F1 12 0 R >> 把资源名（F1/F2）对应到字体对象
     3) 扫内容流：Tf 切字体，(…) 和 <…> 都按当前字体的表翻回文字
   全程本地，不引 pdf.js（那要多背 1.8MB）。
   ========================================================================== */
function pdfLatin1(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return s;
}

/* 所有 "N 0 obj … endobj" 的起止位置 */
function pdfObjects(raw) {
  const out = {};
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m;
  while ((m = re.exec(raw))) {
    const s = m.index + m[0].length;
    const e = raw.indexOf('endobj', s);
    out[m[1]] = { head: raw.slice(s, e < 0 ? s + 6000 : e), end: e < 0 ? raw.length : e };
  }
  return out;
}

/* 取某个对象里的流（该解压就解压） */
async function pdfStreamOfObj(raw, objNum) {
  const at = raw.indexOf(objNum + ' 0 obj');
  if (at < 0) return null;
  const sm = /\bstream\r?\n/.exec(raw.slice(at, at + 8000));
  if (!sm) return null;
  const dict = raw.slice(at, at + sm.index);
  let p = at + sm.index + sm[0].length;
  const e = raw.indexOf('endstream', p);
  if (e < 0) return null;
  const chunk = raw.slice(p, e);
  if (!/\/FlateDecode/.test(dict)) return chunk;
  const bytes = new Uint8Array(chunk.length);
  for (let i = 0; i < chunk.length; i++) bytes[i] = chunk.charCodeAt(i) & 0xff;
  return (await inflatePdfStream(bytes)) || chunk;
}

/* 解 /ToUnicode 那张 CMap：beginbfchar + beginbfrange 两种写法 */
function parseToUnicode(cmap) {
  const map = {};
  const dec = hex => {
    let s = '';
    for (let i = 0; i + 3 < hex.length + 1; i += 4) {
      const u = parseInt(hex.substr(i, 4), 16);
      if (!isNaN(u)) s += String.fromCharCode(u);
    }
    return s;
  };
  let m;
  const reC = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((m = reC.exec(cmap))) {
    const re2 = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g;
    let mm;
    while ((mm = re2.exec(m[1]))) map[parseInt(mm[1], 16)] = dec(mm[2]);
  }
  const reR = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = reR.exec(cmap))) {
    const re2 = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g;
    let mm;
    while ((mm = re2.exec(m[1]))) {
      const lo = parseInt(mm[1], 16), hi = parseInt(mm[2], 16);
      if (lo > hi || hi - lo > 65535) continue;
      if (mm[3] !== undefined) {
        const base = parseInt(mm[3], 16);
        for (let c = lo; c <= hi; c++) map[c] = String.fromCharCode(base + (c - lo));
      } else {
        (mm[4].match(/<[0-9A-Fa-f]*>/g) || []).forEach((h, k) => {
          map[lo + k] = dec(h.replace(/[<>]/g, ''));
        });
      }
    }
  }
  return map;
}

/* 资源名（F1/F2…）→「字形编号 → 文字」的表 */
async function pdfFontMaps(raw) {
  const objs = await pdfCollectObjects(raw);   // 含被塞进对象流里的那些
  const byName = {};
  /* ⚠️ 不能只扫文件正文：字体对象常常整段被压进对象流里，
      正文里根本没有 "/Font << /F1 ... >>" 这行字。要把每个对象的正文也扫一遍。 */
  const scan = (text) => {
    const re = /\/Font\s*<<([\s\S]{0,6000}?)>>/g;
    let m;
    while ((m = re.exec(text))) {
      const re2 = /\/([A-Za-z0-9_.+-]+)\s+(\d+)\s+\d+\s+R/g;
      let mm;
      while ((mm = re2.exec(m[1]))) byName[mm[1]] = mm[2];
    }
  };
  scan(raw);
  Object.keys(objs).forEach(k => scan(objs[k].head || ''));
  const maps = {};
  const cache = {};
  for (const nm in byName) {
    const fo = objs[byName[nm]];
    if (!fo) continue;
    const uo = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(fo.head);
    if (!uo) continue;
    const key = uo[1];
    if (!(key in cache)) {
      const cm = await pdfStreamOfObj(raw, key);
      cache[key] = cm ? parseToUnicode(cm) : {};
    }
    maps[nm] = cache[key];
  }
  return maps;
}

/* 一个 (…) 或 <…> 里的东西 → 文字。
   ⚠️ 字形编号是 1 字节还是 2 字节，**不能靠"表里有没有大于 255 的键"来猜** ——
      子集字体的编号可以很小（<0003> 就是第 3 个字形），那样会猜错、整段变空白。
      所以两种宽度都试一遍，取命中率高、且超过六成的那个。 */
function pdfDecodeText(tok, map) {
  if (!tok) return '';
  const hex = tok[0] === '<';
  let codes = [];
  if (hex) {
    const h = tok.replace(/[^0-9A-Fa-f]/g, '');
    for (let i = 0; i + 1 < h.length; i += 2) codes.push(parseInt(h.substr(i, 2), 16));
  } else {
    const body = tok.slice(1, -1)
      .replace(/\\([nrtbf()\\])/g, (x, c) => ({ n: '\n', r: '\n', t: '\t', b: '', f: '' }[c] || c))
      .replace(/\\([0-7]{1,3})/g, (x, o) => String.fromCharCode(parseInt(o, 8)));
    for (let i = 0; i < body.length; i++) codes.push(body.charCodeAt(i) & 0xff);
  }
  if (!codes.length) return '';
  if (!map) {
    /* 没有字体表：十六进制串多半是字形编号，硬读是乱码。
       只有全部落在可见 ASCII 里才当文字用。 */
    if (hex) {
      let s = '';
      for (const c of codes) { if (c < 0x20 || c > 0x7e) return ''; s += String.fromCharCode(c); }
      return s;
    }
    return String.fromCharCode.apply(null, codes);
  }
  // 2 字节一组 / 1 字节一组，各试一遍
  let best = null;
  for (const width of [2, 1]) {
    if (codes.length % width) continue;
    let s = '', hit = 0, n = 0;
    for (let i = 0; i < codes.length; i += width) {
      let c = codes[i];
      if (width === 2) c = (c << 8) | codes[i + 1];
      n++;
      if (map[c] !== undefined) { hit++; s += map[c]; }
    }
    if (n && (!best || hit > best.hit)) best = { s, hit, n };
  }
  if (best && best.hit / best.n >= 0.6) return best.s;
  return hex ? '' : String.fromCharCode.apply(null, codes);
}

/* 扫一条内容流：跟 Tf 切字体，收 Tj / TJ 里的文字。
   ⚠️ 两个都会把结果切碎，必须避开：
      1) 不能"见一个 Td 就断行" —— PDF 里每个词甚至每个字都可能单独定位一次。
         所以盯住**基线 y**：只有 y 真的变了才算换行，同一行直接接起来。
      2) 也不能"见 ET 就断行" —— Word 导出的 PDF 给每一小段文字都套了
         一对 BT…ET（BT … ET Q q … BT … ET），按 ET 断行会变成一字一行。
         换行与否只看 y，ET/BT 只当作"清一下临时数字"。
   ⚠️ 空格只按 TJ 里的字距调整（负数）补，不要按"前后都是字母数字"补 ——
      后者会把 "2024" 拆成 "2 0 2 4"。 */
function pdfContentText(content, maps) {
  if (!/(\bBT\b|\bTj\b|\bTJ\b)/.test(content)) return '';
  const TOK = /\((?:\\[\s\S]|[^\\()])*\)|<[0-9A-Fa-f\s]*>|-?\d+(?:\.\d+)?|\/([A-Za-z0-9_.+\-]+)|Tf|Tj|TJ|T\*|Td|TD|Tm|ET|BT/g;
  let cur = null, out = '', line = '', nums = [], lastY = null;
  let sawStr = false, gap = 0;
  const flush = () => { if (line.trim()) out += line.trim() + '\n'; line = ''; };
  let m;
  while ((m = TOK.exec(content))) {
    const t = m[0];
    if (m[1]) { cur = maps[m[1]] || null; nums = []; continue; }   // /F1 资源名
    if (/^-?\d/.test(t)) { nums.push(parseFloat(t)); continue; }
    if (t === 'Tm' || t === 'Td' || t === 'TD') {
      const y = (t === 'Tm') ? nums[nums.length - 1] : (nums[nums.length - 1] || 0);
      const sameLine = (t === 'Tm')
        ? (lastY !== null && Math.abs(y - lastY) <= 0.8)
        : (Math.abs(y) <= 0.8);
      if (t === 'Tm') lastY = y; else if (lastY !== null) lastY += y;
      if (!sameLine) flush();
      nums = []; sawStr = false;
      continue;
    }
    if (t === 'T*') { flush(); nums = []; lastY = null; continue; }
    if (t === 'ET' || t === 'BT') { nums = []; continue; }         // 只是清临时数字，不断行
    if (t[0] === '(' || t[0] === '<') {
      const s = pdfDecodeText(t, cur);
      if (s) {
        // TJ 数组里的负数 = 往回推到下一格，通常就是词间空格
        if (sawStr && gap < -120) line += ' ';
        line += s;
      }
      sawStr = true; gap = 0;
      continue;
    }
    // Tf / Tj / TJ
    if (nums.length) { gap = nums[nums.length - 1]; }
    nums = [];
  }
  flush();
  return out;
}

/* ==========================================================================
   图片：站内离线文字识别
   --------------------------------------------------------------------------
   引擎是 tesseract.js —— 跑在浏览器里的 WebAssembly 程序。
   **完全本地计算：不联网、不调用任何 AI 服务、不消耗任何额度。**
   引擎文件放在本站的 ocr/ 目录（约 6.8MB），只有你真的要用图片时才去加载，
   平时一点流量都不花 —— 不用图片的人完全不受影响。
   单文件版（双击打开的那个）里没有 ocr/ 目录，会自动退回
   「请你自己把文字提出来再粘贴」，也就是"方案 1"。
   ========================================================================== */
let ocrLibPromise = null;
function loadOcrLib() {
  if (ocrLibPromise) return ocrLibPromise;
  ocrLibPromise = new Promise((res, rej) => {
    if (window.Tesseract && window.Tesseract.createWorker) return res(window.Tesseract);
    const s = document.createElement('script');
    s.src = 'ocr/tesseract.min.js';
    s.onload = () => (window.Tesseract && window.Tesseract.createWorker)
      ? res(window.Tesseract) : rej(new Error('引擎没起来'));
    s.onerror = () => rej(new Error('这个版本没带识别引擎'));
    document.head.appendChild(s);
  });
  ocrLibPromise.catch(() => { ocrLibPromise = null; });   // 失败别记住
  return ocrLibPromise;
}

let ocrWorker = null;
async function ocrImage(file, onProg) {
  const T = await loadOcrLib();
  if (!ocrWorker) {
    ocrWorker = await T.createWorker('eng', 1, {
      workerPath: 'ocr/worker.min.js',
      corePath: 'ocr/tesseract-core-simd-lstm.wasm.js',
      langPath: 'ocr',
      gzip: true,
      cacheMethod: 'none',
      logger: m => { if (onProg && m && m.status) onProg(m); },
    });
  }
  const r = await ocrWorker.recognize(file);
  return (r && r.data) || {};
}

/* 识别质量自检：读出来的英文词太少、或者把握太低，就判"这张图看不清"，
   让用户重拍 —— 而不是把一坨错字塞进题库，让人做题时才发现。 */
function ocrVerdict(data) {
  const text = String((data && data.text) || '');
  const conf = (data && typeof data.confidence === 'number') ? data.confidence : null;
  const words = (text.match(/[A-Za-z]{2,}/g) || []).length;
  if (words < 8) return { ok: false, why: '几乎没读出一个完整的英文词' };
  if (conf !== null && conf > 0 && conf < 55) {
    return { ok: false, why: '把握只有 ' + Math.round(conf) + '%，多半太糊、太斜或者有反光' };
  }
  if (!looksLikeText(text)) return { ok: false, why: '读出来的内容不成句' };
  return { ok: true, text: text };
}

/* 识别引擎起不来时，说清**为什么** —— 大多数人是在单文件版里点图片，
   光说"用不了"帮不上忙。 */
function ocrWhyUnavailable(e) {
  if (window.__INLINE_DATA__ || location.protocol === 'file:') {
    return '单文件版里没有带识别引擎 —— 它有好几兆，塞不进一个 HTML 文件。';
  }
  return '识别引擎没加载起来（' + ((e && e.message) || '未知原因') + '），多半是网络把它拦住了。';
}
/* ---------- 一次把若干文件读成文字 ---------- */
let importReport = null;   // 最近一次导入的结果（成功/失败都留在这儿给用户看）
let myPanelOpen = false;
/* 「在浏览器里直接试读原始文件」那条兜底路径，默认收起来 ——
   它读 PDF / Word / 图片的成功率看排版，只当备用。 */
let myRawOpen = false;
/* 「格式示例」摊开没有。
   ⚠️ 原来这个按钮点下去**什么都不会发生** —— 它要 display 的那个
      #myfmt 压根没渲染出来，MYFORMAT_DEMO 也从没被用过（死代码）。
      现在真的渲染出来，开合状态记在这里，免得被一次 render 又关回去。 */
let myFmtOpen = false;
/* 剪贴板 API 用不了时的最后退路：把提示词本尊摊在页面上让人手动选。 */
let aiPromptShown = false;

const AUDIO_EXT = /^(mp3|m4a|wav|ogg|oga|aac|flac|opus|weba|mp4)$/;
/* 文件的"组"：文件夹导入时用它在的目录，普通选择文件时为空。
   音频就是靠这个配到对应卷子上的（同一个文件夹里的音频 ↔ 同一个文件夹里的卷子）。 */
function groupOf(f) {
  const rel = f.webkitRelativePath || f._rel || '';
  if (!rel) return '';
  const i = rel.lastIndexOf('/');
  return i < 0 ? '' : rel.slice(0, i);
}
/* 文件名主干（去掉扩展名），用来在"没按文件夹导"时按名字配音频 */
function baseNameOf(s) {
  return String(s || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
    .replace(/[\s_\-]*(听力|音频|录音|audio|listening|reading)$/i, '').trim();
}

/* 读一个文件 → 文字。读不出来的地方都记进 problems / notes。 */
async function readOneImport(f, tag, problems, notes) {
  let r;
  try {
    r = await readImportFile(f);
  } catch (e) {
    const m = String((e && e.message) || '');
    problems.push(/could not be found|NotFound/i.test(m)
      ? f.name + '：这看起来是**文件夹**，不是文件。把整个文件夹拖进来，'
        + '或者点「选文件夹」把文件夹选进来（里面放试卷、答案解析、听力三样）。'
      : f.name + '：读不了 —— ' + m);
    return null;
  }
  if (r.ok) return r.text;
  /* 扫描件 PDF：整页是图，逐页离线识别。
     ⚠️ 站内识别只装了英文模型（使用者是要练英语的，装中文要多背十几兆）。
        中文扫描件识别不出来，要如实说明，别让人以为是坏了。 */
  if (r.pdfImages) {
    try { await loadOcrLib(); } catch (e) {
      problems.push(f.name + '：这是扫描件（整页是图），要靠文字识别才能读，但 '
        + ocrWhyUnavailable(e) + ' 两个办法：把每页截图后用手机相册／微信的'
        + '「提取文字」，或者改用浏览器里的在线版再传这个 PDF。');
      return null;
    }
    const pages = r.pdfImages.slice(0, 10);
    const got = [];
    for (let k = 0; k < pages.length; k++) {
      try {
        const d = await ocrImage(pages[k], m => importNote(tag + ' 识别第 ' + (k + 1)
          + '/' + pages.length + ' 页：' + m.status
          + (m.progress ? ' ' + Math.round(m.progress * 100) + '%' : '')));
        const v = ocrVerdict(d);
        if (v.ok) got.push(v.text);
        else problems.push(f.name + ' 第 ' + (k + 1) + ' 页：' + v.why + '，这一页跳过了。');
      } catch (e) {
        problems.push(f.name + '：第 ' + (k + 1) + ' 页识别失败（' + e.message + '）。');
        break;
      }
    }
    if (!got.length) {
      problems.push(f.name + '：这是扫描件，站内识别只装了英文模型，里面没读出可用的英文。'
        + '**建议用 Word / WPS 打开这个 PDF 另存为 .docx** 再传一次；'
        + '中文扫描件可以用手机相册／微信的「提取文字」把文字提出来粘进来。');
      return null;
    }
    notes.push(f.name + '：这是扫描件，按图片识别了 ' + got.length + '/' + pages.length
      + ' 页 —— 识别难免有错字，做一遍题就能看出来。');
    return got.join('\n\n');
  }
  if (r.image) {
    try {
      const d = await ocrImage(f, m => importNote(tag + ' 识别中：' + m.status
        + (m.progress ? ' ' + Math.round(m.progress * 100) + '%' : '')));
      const v = ocrVerdict(d);
      if (v.ok) return v.text;
      problems.push(f.name + '：这张图我读不清 —— ' + v.why
        + '。请重拍（正对、光线足、一页一张），或者用手机相册／微信的「提取文字」'
        + '把文字弄出来粘到下面。');
    } catch (e) {
      problems.push(f.name + '：' + ocrWhyUnavailable(e)
        + ' 请用手机相册／微信的「提取文字」把文字取出来，粘到下面；'
        + '或者改用浏览器里的在线版（那里带了识别引擎）再传这张图。');
    }
    return null;
  }
  problems.push(f.name + '：' + r.msg);
  return null;
}

/* 系统/Office 生成的杂物文件，不是使用者的素材，直接跳过。
   ⚠️ 踩过：Word 会在同目录放一个隐藏的锁定文件 `~$答案解析.docx`（162 字节）。
      拖文件夹时会把它一起带进来，读它必然失败，于是报
      "这个 Office 文件我打不开（可能是加密的…）" —— 看着像功能坏了。 */
function isJunkFile(name) {
  const n = String(name || '');
  const base = n.replace(/^.*[\\/]/, '');
  return /^~\$/.test(base)                 // Office 锁定文件 ~$xxx.docx
    || /^\._/.test(base)                   // macOS 资源叉 ._xxx
    || /^\./.test(base)                    // 隐藏文件
    || /(^|[\\/])(Thumbs\.db|desktop\.ini|\.DS_Store)$/i.test(n)
    || /\.(tmp|temp|bak|crdownload|part)$/i.test(base);
}

/* 文件名看着像"答案 / 解析"吗 */
function isAnswerFile(name) {
  return /答案|解析|answer|ans\b|key|solution|参考/i.test(String(name || ''));
}

/* 把"答案 / 解析"那一份合到题目上。
   一张卷子常常是三份东西放一个文件夹：听力音频 + 试卷本体 + 答案解析。
   这里负责把第三份并进第二份。
   两种写法都认：
     ① 和试卷同格式（Q / ANSWER / EXPLAIN）→ 按同题型、同顺序对齐
     ② 纯答案串（1-5 ABCDA / 1. A 2. B / 1:A）→ 按顺序填
   ⚠️ 只在题目**原本没标答案**时填，别把已经对的覆盖掉。 */
function applyAnswerKey(types, text) {
  let filled = 0;
  /* ① 同格式：直接解析一遍，按同题型同顺序对齐 */
  try {
    const p = parseMyBankText(text);
    Object.keys(p.out).forEach(k => {
      const ans = p.out[k];
      const t = types.find(x => x.type === k);
      if (!t || !ans) return;
      t.items.forEach((it, i) => {
        const a = ans[i];
        if (!a) return;
        if (it.questions && a.questions) {
          it.questions.forEach((q, k2) => {
            const aq = a.questions[k2];
            if (!aq) return;
            if ((typeof q.answer !== 'number' || q.answer < 0)
              && typeof aq.answer === 'number' && aq.answer >= 0) { q.answer = aq.answer; filled++; }
            if (!q.explain && aq.explain) q.explain = aq.explain;
          });
        }
        if (it.answers && a.answers) {
          Object.keys(a.answers).forEach(n => {
            if (!it.answers[n]) { it.answers[n] = a.answers[n]; filled++; }
          });
        }
        if (it.statements && a.statements) {
          it.statements.forEach((st, k2) => {
            if (!st.answer && a.statements[k2] && a.statements[k2].answer) {
              st.answer = a.statements[k2].answer; filled++;
            }
          });
        }
      });
    });
  } catch (e) { /* 解析不了就当纯答案串处理 */ }
  /* ② 按**题号**贴（解析文档那种 —— 【答案】 离题号很远，只能按号找） */
  const byNum = parseNumberedAnswers(text);
  if (Object.keys(byNum).length) {
    types.forEach(t => (t.items || []).forEach(it => {
      (it.questions || []).forEach(q => {
        if (typeof q.answer === 'number' && q.answer >= 0) return;
        if (q.n == null) return;
        const L = byNum[q.n];
        if (!L) return;
        const idx = 'ABCDEFGHIJKLMNO'.indexOf(L);
        if (idx < 0) return;
        if ((q.options || []).length && idx >= q.options.length) return;
        q.answer = idx; filled++;
      });
      (it.statements || []).forEach(s2 => {
        if (s2.answer) return;
        const L = byNum[s2.n];
        if (!L) return;
        s2.answer = L; filled++;
      });
    }));
  }
  /* ③ 纯答案串：把选择题按顺序填。
     ⚠️ 只有在②（按题号）**一条都没取到**时才走这里 ——
        两套混着用会互相污染（②填 C、③又按顺序覆盖成 A）。 */
  const seq = filled ? [] : parseAnswerSequence(text);
  if (seq.length) {
    const flat = [];
    types.forEach(t => (t.items || []).forEach(it => {
      (it.questions || []).forEach((q, qi) => flat.push({ it: it, q: q, key: t.type + ':' + qi }));
    }));
    flat.forEach((x, k) => {
      /* ⚠️ 答案串是**对着题号**的（阅读从 46 开始），不能一律按顺序对 ——
         否则 46/47 的答案会错位贴到第 1、2 题上。有题号就用题号。 */
      const L = (x.q.n != null && seq[x.q.n]) ? seq[x.q.n] : seq[k];
      if (!L) return;
      const idx = 'ABCD'.indexOf(L);
      if (idx < 0) return;
      const os = x.q.options || [];
      if (typeof x.q.answer === 'number' && x.q.answer >= 0) return;   // 已有答案不动
      if (os.length && idx >= os.length) return;
      x.q.answer = idx; filled++;
    });
  }
  return filled;
}

/* 从"答案解析"那种文档里按**题号**取答案。
   ⚠️ 真题的解析文档长这样（懒笔记那种）：
        1. A) 他的儿子曾用他的手机…   B) …   C) …   D) …
        【答案】 C （细节题） His son had ordered food…
        【定位】 …
      也就是 **【答案】 离题号很远**，中间隔着一堆选项和解析文字。
      按"同题型同顺序"去对齐根本对不上（踩过：只对上了第 1 题）。
      所以这里往回找最近的题号，做成「题号 → 答案」的表，再按题号贴回去。 */
function parseNumberedAnswers(text) {
  const out = {};
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const qn = /^\s*(\d{1,3})\s*[.、．)）]\s*\S/;
  const an = /【答案】\s*([A-O])/;
  let lastN = 0;
  lines.forEach(line => {
    const m = qn.exec(line);
    /* ⚠️ 题号**允许回绕**，不要加"必须递增"的守卫。
       真题解析的排法是：先把**全部英文题**列一遍（1…25），
       再从头把**每个题的中文翻译 + 【答案】**列一遍（又是 1…25）。
       加递增守卫的话，第二遍的 1…24 全被挡掉，答案会错误地堆到第 25 题上（踩过）。 */
    if (m) lastN = +m[1];
    const am = an.exec(line);
    if (am && lastN) out[lastN] = am[1].toUpperCase();
  });
  return out;
}

/* 从纯答案文本里抽答案序号：认 "1-5 ABCDA" 和 "1. A / 1、A / 1:A" 两种 */
function parseAnswerSequence(text) {
  const s = String(text || '').replace(/\r/g, '');
  const out = [];
  let m;
  const re1 = /(\d{1,3})\s*[-–~至]\s*(\d{1,3})\s*[:：.、]?\s*([A-Da-d]{2,})/g;
  while ((m = re1.exec(s))) {
    const a = +m[1], letters = m[3].toUpperCase();
    if (+m[2] - a + 1 === letters.length) {
      letters.split('').forEach((L, k) => { out[a + k] = L; });
    }
  }
  if (out.length) return out;
  /* ⚠️ 必须排除 `1. A) 选项文字` 这种**选项行** ——
     它的形状和"纯答案串 1. A"一模一样，不排除就会把每道题的
     第一个选项当成答案（踩过：听力 1~24 全被填成 A）。 */
  const re2 = /(?:^|[\s,，、;；])(\d{1,3})\s*[.、:：]\s*([A-Da-d])(?![A-Za-z)）])/g;
  while ((m = re2.exec(s))) out[+m[1]] = m[2].toUpperCase();
  return out;
}

/* 这一组文件（= 一张试卷）叫什么名字 */
function paperNameOf(bucket, mains) {
  if (bucket.group) {
    const seg = bucket.group.split('/').filter(Boolean).pop();
    if (seg) return seg;
  }
  const f = (mains[0] || {}).f || (bucket.files[0] || {});
  return String(f.name || '未命名试卷').replace(/\.[^.]+$/, '');
}

async function handleImportFiles(files) {
  const list = Array.prototype.slice.call(files || []).filter(Boolean);
  if (!list.length) return;
  const problems = [], notes = [];

  /* ⚠️ 分组规则（使用者定的）：**一个文件夹 = 一张试卷**。
     一个文件夹里通常放三样东西：听力音频 + 试卷本体 + 答案解析。
     没放在文件夹里的散文件，就一个文件算一张试卷。 */
  const buckets = [];
  list.forEach(f => {
    if (isJunkFile(f.name)) return;          // Word 锁定文件之类的杂物，直接跳过
    const g = groupOf(f);
    const key = g || ('\u0001' + f.name);
    let b = buckets.find(x => x.key === key);
    if (!b) { b = { key: key, group: g, files: [] }; buckets.push(b); }
    b.files.push(f);
  });

  let made = 0, lastPaperId = '';
  for (let bi = 0; bi < buckets.length; bi++) {
    const b = buckets[bi];
    const tag = buckets.length > 1 ? '（' + (bi + 1) + '/' + buckets.length + '）' : '';
    const audios = b.files.filter(f => AUDIO_EXT.test(extOf(f.name)));
    const docs = b.files.filter(f => !AUDIO_EXT.test(extOf(f.name)));
    try {
      /* 读这一组里的所有文档 */
      const read = [];
      for (const f of docs) {
        importNote(tag + ' 正在读 ' + f.name + '…');
        const t = await readOneImport(f, tag, problems, notes);
        if (t) read.push({ f: f, text: t });
      }
      if (!read.length && !audios.length) continue;
      if (!read.length) {
        /* 只有音频、没有试卷本体 —— 音频先存着，但要明说少了什么 */
        problems.push('「' + paperNameOf(b, []) + '」这个文件夹里只找到音频，'
          + '**没有试卷本体**（题目文件）—— 所以这一份没有导入。'
          + '把试卷（Word / PDF / 文本）和音频放进同一个文件夹再拖一次即可。');
        await attachAudioFiles(audios, [], problems, notes, null);
        continue;
      }
      const onlyAns = read.every(x => isAnswerFile(x.f.name));
      if (onlyAns) {
        problems.push('「' + paperNameOf(b, read) + '」这个文件夹里只有答案/解析，'
          + '没有试卷本体 —— 没有题目可导。把试卷本体也放进来再拖一次。');
        continue;
      }
      /* 分"试卷本体"和"答案解析" */
      let mains = read.filter(x => !isAnswerFile(x.f.name));
      if (!mains.length) mains = read;
      const ansFiles = read.filter(x => isAnswerFile(x.f.name) && mains.indexOf(x) < 0);

      const mainText = mains.map(x => x.text).join('\n\n');
      const name = paperNameOf(b, mains);
      /* ⚠️ 这里**不能**走 importMyBank —— 它会按"文件名"先存一张卷子，
         下面紧接着又会按"文件夹"存同一张，于是一份卷子变成两张。
         文件夹导入统一走"解析 → 按文件夹键存"。 */
      const res = parseMyBankInput(mainText);
      if (!res.ok) {
        if (res.mismatch) {
          problems.push(name + '：' + res.mismatch.map(m2 => m2.name + '（' + examShort()
            + '不考它，考它的是 ' + m2.exams.join('、') + '）').join('；')
            + ' —— 这一份没有导入。');
        } else {
          problems.push(name + '：' + (res.msg || '没解析出题目。')
            + (res.unknown && res.unknown.length
              ? ' 有分节没认出来：' + res.unknown.join('、') : ''));
        }
        continue;
      }

      /* 答案解析并进题目 */
      if (ansFiles.length) {
        let filled = 0;
        ansFiles.forEach(x => { filled += applyAnswerKey(res.types, x.text); });
        if (filled) {
          notes.push('「' + name + '」的答案/解析已合并（补上 ' + filled + ' 处答案）。');
        } else {
          problems.push('「' + name + '」里那份答案/解析没能合并进去（写法对不上）——'
            + '题目照常可以用，答案要自己做题时看。');
        }
      }

      const paper = savePaper(b.key, name, res.types, {   // eslint-disable-line
        marks: parseImportMarks(mainText, res.types),
        audio: [],
      });
      paper.group = b.group;
      if (res.guessed && res.guessed.length) {
        notes.push('「' + name + '」没写分节标题，按内容判成了 ' + res.guessed.join('、') + '。');
      }
      (res.notes || []).forEach(x => notes.push('「' + name + '」' + x));
      const issues = diagnoseTypes(res.types);
      issues.forEach(it => problems.push('「' + name + '」' + it.where + '：' + it.bad.join('；')));
      const allP = myPapers();
      const p = allP.find(x => x.id === paper.id);
      p.group = b.group;
      p.hasAnswers = ansFiles.length > 0;
      p.sources = read.map(x => x.f.name);
      /* 一个文件夹里放了多套卷子本体（共用同一份听力）时，题目是**合起来**的 ——
         听力题自然保留在里面，音频也是这一张卷子共用的。告诉使用者一声。 */
      if (mains.length > 1) {
        notes.push('「' + name + '」这个文件夹里有 ' + mains.length
          + ' 份试卷文档，合成了一张卷子（听力音频共用）。');
      }
      if (!ansFiles.length) {
        problems.push('「' + name + '」没有找到答案 / 解析 —— 做题时看不到正确答案。'
          + '把答案解析也放进同一个文件夹再拖一次就能补上。');
      }

      lastPaperId = paper.id;
      savePapers(allP);                       // 名字/来源这些先落盘
      /* 音频配到这张卷子上（改的是同一份 allP） */
      if (audios.length) await attachAudioFiles(audios, [p], problems, notes, allP);

      /* 有听力题、却一段音频都没有 —— 专门提醒（题目照收） */
      if (papersMissingAudio(p)) {
        const donor = audioDonor(paper.id);
        problems.push('「' + name + '」有听力题，但这个文件夹里没找到音频 ——'
          + '题目已经导进来了，补上音频就能听。'
          + (donor ? '（也可以用「' + donor.name + '」那一份：多套卷子常常共用一个听力音频）' : ''));
      }
      made++;
    } catch (e) {
      problems.push((b.group || b.key) + '：处理这一组时出错 —— ' + e.message);
    }
  }
  importNote('');
  savePapers(myPapers());
  /* 导完就把"正在练"切到刚导进来的那张 —— 不然导完还停在旧卷子上，
     使用者会以为没导进来。 */
  if (lastPaperId) LS.set(activePaperKey(), lastPaperId);
  rebuildBank();

  importReport = {
    ok: made > 0, made: made, paperCount: myPapers().length,
    types: made ? '导入了 ' + made + ' 张卷子' : '',
    issues: [], problems: problems, notes: notes,
    unknown: [], guessed: [],
    msg: made ? '' : (problems.length ? '这些文件都没能读出题目。' : '没有可读的内容。'),
  };
  render();
  toast(made ? ('导入了 ' + made + ' 张卷子') : ('没能导入：' + (problems[0] || '').slice(0, 40)));
}

/* 音频：先存进 IndexedDB，再按"同组 / 名字对得上"挂到卷子上。
   挂不上的进待配池（在「我的题目」里能手动挑一张卷子配上去）。 */
async function attachAudioFiles(files, madePapers, problems, notes, allList) {
  /* ⚠️ 必须让调用方把"当前这一份列表"传进来。
     踩过：这里自己 myPapers() 重新读一份，改的是**副本**，
     最后写回存储时又被旧数据覆盖 —— 表现是"音频明明配上了却没挂上"。 */
  const all = allList || myPapers();
  const pool = pendingAudio();
  for (const f of files) {
    const g = groupOf(f);
    const base = baseNameOf(f.name);
    let target = null;
    if (g) target = madePapers.find(p => p.group === g)
      || all.find(p => p.group && p.group === g);
    if (!target && base) {
      target = all.find(p => p.name && (p.name === base
        || p.name.indexOf(base) === 0 || base.indexOf(p.name) === 0));
    }
    if (!target && madePapers.length === 1 && !g) target = madePapers[0];
    const a = {
      id: 'a' + Date.now().toString(36) + '-' + Math.round(Math.random() * 1e4),
      name: f.name, size: f.size,
    };
    try { await idbPut(a.id, f); a.stored = true; }
    catch (e) {
      a.stored = false;
      problems.push(f.name + '：这段音频没能存进浏览器（' + (e && e.message) + '）——'
        + '刷新页面后就没了。放到能联网的地址（GitHub Pages 那种）上再用会正常。');
    }
    if (target) {
      target.audio = (target.audio || []).concat([a]);
      notes.push('音频「' + f.name + '」配到了「' + target.name + '」上。');
      /* 把音频挂到这份卷子的听力题上，播放按钮就能用它 */
      (target.types || []).forEach(t => {
        if (t.type !== 'listening') return;
        const ids = (target.audio || []).map(x => x.id);
        (t.items || []).forEach((it, k) => { it.audio = ids[Math.min(k, ids.length - 1)]; });
      });
    } else {
      pool.push({ exam: curExam().id, name: f.name, id: a.id, size: f.size });
      problems.push('音频「' + f.name + '」没找到对应的卷子 —— 已经存下来，'
        + '在「我的题目」里可以手动挑一张卷子配上去。'
        + '（把音频和卷子放进同一个文件夹里一起拖进来，就能自动对上。）');
    }
  }
  savePapers(all);
  LS.set(pendAudioKey(), pool);
}

function pendAudioKey() { return 'audiopool:' + curExam().id; }
function pendingAudio() { return LS.get(pendAudioKey(), []) || []; }

/* ==========================================================================
   音频放在 IndexedDB 里
   --------------------------------------------------------------------------
   为什么不用 localStorage：它一共才 5MB，而且只能存字符串。
   一段听力录音就几兆，塞不进去。IndexedDB 是浏览器自带的本地数据库，
   能直接存 Blob，容量按站点配额走（通常几百兆）。
   ⚠️ 单文件版 / file:// 下 IndexedDB 可能不可用 → 降级为"这次能听，刷新就没了"，
      并把这件事明确告诉使用者，别让人以为存住了。
   ========================================================================== */
function idbOpen() {
  return new Promise((res, rej) => {
    /* ⚠️ 一定要有超时。
       踩过：在某些环境（file:// 下的浏览器、隐私模式）indexedDB.open
       既不触发 onsuccess 也不触发 onerror —— 直接卡住。而我们是 await 它的，
       结果**整个导入流程卡死**，界面停在"正在读…"再也不动。
       宁可超时报"存不住"，也不能让界面卡住。 */
    let done = false;
    const finish = (fn, v) => { if (!done) { done = true; clearTimeout(tm); fn(v); } };
    const tm = setTimeout(() => finish(rej, new Error('本地数据库没响应（超时）')), 4000);
    try {
      if (typeof indexedDB === 'undefined') { finish(rej, new Error('这个环境没有 IndexedDB')); return; }
      const rq = indexedDB.open('cet4lab', 1);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
      };
      rq.onsuccess = () => finish(res, rq.result);
      rq.onerror = () => finish(rej, rq.error || new Error('打不开本地数据库'));
      rq.onblocked = () => finish(rej, new Error('本地数据库被别的窗口占着'));
    } catch (e) { finish(rej, e); }
  });
}
async function idbPut(key, blob) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    let done = false;
    const finish = (fn, v) => { if (!done) { done = true; clearTimeout(tm); fn(v); } };
    const tm = setTimeout(() => finish(rej, new Error('写本地数据库超时')), 8000);
    try {
      const tx = db.transaction('audio', 'readwrite');
      tx.objectStore('audio').put(blob, key);
      tx.oncomplete = () => finish(res, true);
      tx.onerror = () => finish(rej, tx.error);
      tx.onabort = () => finish(rej, tx.error || new Error('写入被中止（多半是空间不够）'));
    } catch (e) { finish(rej, e); }
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('audio', 'readonly');
    const rq = tx.objectStore('audio').get(key);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}

/* 播放一段配好的音频。对象 URL 缓存起来，别每点一次就新建一个。
   ⚠️ 音频有两种来路，键的写法不一样：
      1) 自己导进来的 → 内容是 Blob，存在 IndexedDB 里，键就是个随机 id
      2) 系统自带的真题 → 文件在 data/audio/ 下，键写成 'url:data/audio/x.mp3'
   两种都从这里走，这样界面上（`if (it.audio)`）不用分情况。 */
const audioUrls = {};
let curAudioEl = null;
async function playPaperAudio(aid) {
  try {
    const key = String(aid || '');
    if (!key) { toast('这条没有配音频'); return; }
    if (!audioUrls[key]) {
      if (key.indexOf('url:') === 0) {
        audioUrls[key] = key.slice(4);
      } else {
        const blob = await idbGet(key);
        if (!blob) { toast('这段音频没存住（换用在线地址再导一次就好）'); return; }
        audioUrls[key] = URL.createObjectURL(blob);
      }
    }
    if (curAudioEl) { curAudioEl.pause(); curAudioEl = null; }
    const el = new Audio(audioUrls[key]);
    curAudioEl = el;
    el.play().catch(() => toast('浏览器挡住了自动播放，再点一下播放键'));
  } catch (e) {
    toast('放不出来：' + (e && e.message));
  }
}

/* 顶部的一行状态（读取/识别进度）。没状态时就藏起来。 */
function importNote(msg) {
  let el = document.getElementById('mynote');
  if (!el) {
    const p = document.getElementById('mypanel');
    if (!p) return;
    el = document.createElement('div');
    el.id = 'mynote';
    el.className = 'meta';
    el.style.cssText = 'margin:6px 0;color:var(--brand)';
    p.insertBefore(el, p.firstChild);
  }
  el.textContent = msg;
  el.style.display = msg ? '' : 'none';
}

/* 导入结果面板：成功说什么、失败说为什么，都摆在这儿，不用去猜。 */
function importReportHtml() {
  if (!importReport) return '';
  const r = importReport;
  const det = [];
  (r.problems || []).forEach(x => det.push('· ' + x));
  if (!det.length) (r.notes || []).forEach(x => det.push('· ' + x));
  if (r.unknown && r.unknown.length) det.push('· 有分节没认出来：' + r.unknown.join('、'));
  const tip = esc(det.join('\n')).replace(/"/g, '&quot;');
  let text, color = 'var(--ok)';
  if (r.ok) {
    text = '已导入 ' + (r.made || r.papers || 1) + ' 张卷子';
    if ((r.problems || []).length) { color='var(--warn)'; text += ' · ⚠ ' + r.problems.length + ' 处小问题'; }
    else if ((r.notes || []).length) text += ' · ' + r.notes.length + ' 条说明';
  } else { color='var(--bad)'; text = r.msg || '没能导入'; }
  return `<div class="card tight" style="margin-top:10px">
    <div style="color:${color};cursor:help" title="${tip || '没有别的问题'}">${esc(text)}${
      det.length ? '<span style="color:var(--fg3);font-weight:400"> （鼠标放上来）</span>' : ''}</div>
  </div>`;
}

function parseMyBankInput(text) {
  const s = String(text || '').trim();
  if (!s) return { ok: false, msg: '内容是空的' };
  // JSON：本站导出的格式
  if (s[0] === '{' || s[0] === '[') {
    let obj;
    try { obj = JSON.parse(s); } catch (e) { return { ok: false, msg: 'JSON 格式有错：' + e.message }; }
    if (Array.isArray(obj)) return { ok: false, msg: '这像是一个数组，请用本站导出的完整文件（含 types 字段）' };
    if (!obj || !Array.isArray(obj.types)) return { ok: false, msg: 'JSON 里没有 types 字段，不是本站导出的格式' };
    const clean = t => ({
      type: t.type, typeName: (QTYPES[t.type] || {}).name || t.typeName || t.type,
      items: (t.items || []).map(i => Object.assign({}, i, { origin: 'mine' })),
    }).items.length ? {
      type: t.type, typeName: (QTYPES[t.type] || {}).name || t.typeName || t.type,
      items: (t.items || []).map(i => Object.assign({}, i, { origin: 'mine' })),
    } : null;
    /* 新格式：一叠试卷，原样恢复（名字、分值都留着） */
    if (Array.isArray(obj.papers)) {
      const list = [];
      obj.papers.forEach(pp => {
        const ts = (pp.types || []).map(clean).filter(Boolean);
        if (!ts.length) return;
        list.push({ key: pp.key || pp.src || ('导出-' + (pp.name || '试卷')),
                    name: pp.name || '导出的试卷', marks: pp.marks || {}, types: ts });
      });
      if (!list.length) return { ok: false, msg: '导出的文件里没有题目' };
      const badP = [];
      list.forEach(pp => checkExamFit(pp.types).forEach(x => badP.push(x)));
      if (badP.length) return { ok: false, mismatch: badP };
      return { ok: true, papers: list, types: [], unknown: [], guessed: [],
               notes: [], issues: [] };
    }
    /* 老格式：只有一坨 types —— 当成一张卷子 */
    const types = (obj.types || []).map(clean).filter(Boolean);
    if (!types.length) return { ok: false, msg: 'JSON 里没有任何题目' };
    const badJ = checkExamFit(types);
    if (badJ.length) return { ok: false, mismatch: badJ };
    return { ok: true, types, unknown: [], guessed: [], issues: diagnoseTypes(types) };
  }
  // 文本格式
  const toTypes = o => Object.keys(o).map(k =>
    ({ type: k, typeName: myTypeMeta(k).name, items: o[k] }));
  let parsed = parseMyBankText(s);
  let usedLoose = false;
  let types = toTypes(parsed.out);
  /* ⚠️ 两件事都要兜住：
     1) 严格格式一套都没套上（真实试卷根本不写 Q: / A. / ANSWER: 那套）
     2) 严格格式**误判**了题型 —— 比如把 "Listening Comprehension" 认成「听写」，
        那一查"这场考试不考它"就直接拒绝了，兜底解析连机会都没有（踩过）。
     所以：严格版没出来、或者出来的题型这场考试不认，就再走一遍"按题号抓题"。 */
  let bad = types.length ? checkExamFit(types) : [];
  if (!types.length || bad.length) {
    const loose = parseLooseBank(s);
    const lt = toTypes(loose.out);
    if (lt.length && !checkExamFit(lt).length) {
      parsed = { out: loose.out, unknown: [], guessed: loose.notes, notes: [] };
      types = lt;
      bad = [];
      usedLoose = true;
    }
  }
  if (!types.length) {
    return {
      ok: false,
      msg: '没解析出题目。这份文件里没有找到带题号的选择题或填空题',
      unknown: parsed.unknown,
    };
  }
  /* ⚠️ 只挡"这场考试不考的题型" —— **不**因为少了哪些题型就报错。
     用户明确说过：只导入一部分（比如这次只加阅读、没加听力）是正常用法。 */
  /* ⚠️ 原来这里会把"这场考试不考的题型"整份退回。用户要求去掉这个限制 ——
     照样收下，只在说明里提一句该切到哪场考试。 */
  const badNote = bad.length
    ? '其中 ' + bad.map(x => x.name + '（' + examShort() + '不考它）').join('、')
      + ' 也收下了 —— 要练它请切到对应的考试。'
    : '';
  const notes = (parsed.notes || []).slice();
  if (badNote) notes.unshift(badNote);
  if (usedLoose) {
    notes.unshift('这份文件没有 === 分节标题 ===，我按"题号 + 选项"抓的题：'
      + (parsed.guessed || []).join('、') + '。');
  }
  return { ok: true, types, unknown: parsed.unknown,
           guessed: usedLoose ? [] : parsed.guessed,
           notes: notes, issues: diagnoseTypes(types) };
}

/* 把「自备材料」和「我的题目」并进当前题库。
   ⚠️ 用**重建**而不是追加，避免重复调用时越叠越多。
   ⚠️ 只放**当前选中的那几张试卷** —— 进度、统分、题库全跟着走，
      这就是"选择我的题目"这个功能的意义。
   ⚠️ **我这套卷子覆盖了的题型，就只留这套卷子的题**，不再和站内那点原创
      示例题拼在一起。理由很简单：一套卷子就该是一套卷子。
      拼起来的话，一份四级卷的「仔细阅读」会显示成 6 篇（我的 2 篇 + 示例 4 篇），
      点进去还能一路翻到示例题，可进度条只算这套卷子的 —— 看着就像坏了。
      站内示例题仍然在的，只是留给"这场考试还没有卷子"的时候用（雅思/GRE 那些）。 */
function rebuildBank() {
  if (!S.base) return;
  const clone = JSON.parse(JSON.stringify(S.base));
  const mineListen = [], localListen = [];
  const add = (types, listenBox) => {
    for (const t of (types || [])) {
      // 听力是独立的一份数据（S.listen），不在 bank.types 里
      if (t.type === 'listen') { listenBox.push.apply(listenBox, t.items || []); continue; }
      const bt = clone.types.find(x => x.type === t.type);
      if (bt) bt.items = t.items.concat(bt.items);
      else clone.types.push(t);
    }
  };
  /* 覆盖：同题型直接换成我这套卷子的题 */
  const cover = (types, listenBox) => {
    for (const t of (types || [])) {
      if (t.type === 'listen') { listenBox.push.apply(listenBox, t.items || []); continue; }
      const bt = clone.types.find(x => x.type === t.type);
      if (bt) bt.items = (t.items || []).slice();
      else clone.types.push({ type: t.type, typeName: t.typeName, items: (t.items || []).slice() });
    }
  };
  add(S.localTypes, localListen);        // 站里带的「自备材料」
  cover(myBankTypes(), mineListen);      // 我的题目（当前选中的试卷）—— 覆盖同题型
  S.bank = clone;
  S.bank.hasLocal = S.localCount || 0;
  S.bank.hasMine = myBankCount();
  S.myListenCount = mineListen.length;
  if (S.baseListen) {
    S.listen = { note: S.baseListen.note,
                 items: mineListen.concat(localListen, S.baseListen.items || []) };
  }
}

/* 把一份解析结果收成一张试卷。
   ⚠️ 同一份文件（src 相同）再导一次 = **更新那张试卷**，不是又加一张；
      使用者改过的名字要保留，别被文件名覆盖回去。 */
/* 收成一张试卷。
   key  = 去重键（文件夹路径，或散文件的文件名）—— 同一个 key 再导一次就是**更新**那张卷子
   name = 显示名，默认取文件夹名/文件名，使用者之后可以在页面里改
   ⚠️ 使用者改过的名字要留住，别被文件名覆盖回去。 */
/* 一份题库的内容指纹：判断"同名文件是不是同一份内容" */
function bankFingerprint(types) {
  const t = JSON.stringify(types || []).replace(/"id":"[^"]*",?/g, '');
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function savePaper(key, name, types, extra) {
  const list = myPapers();
  const ex = extra || {};
  const fp = bankFingerprint(types);
  let p = list.find(x => x.src === key);
  /* ⚠️ **同名但内容不同 → 另存一张，绝不覆盖**。
     踩过：两次导入的文件都叫「试卷.docx」，第二份把第一份直接盖掉了 ——
     表现出来就是"后导入的把前面导入的覆盖了"。 */
  if (p && p.fp && p.fp !== fp) {
    const base = String(name || '未命名试卷');
    let nm = base;
    for (let k = 2; list.some(x => x.name === nm); k++) nm = base + '（' + k + '）';
    name = nm;
    key = key + '#' + fp;
    p = null;
  }
  if (p) {
    p.types = types;
    p.marks = ex.marks || {};
  } else {
    p = {
      id: 'p' + Date.now().toString(36) + '-' + (list.length + 1),
      name: String(name || '未命名试卷').slice(0, 60),
      src: key, addedAt: today(), fp: fp,
      types: types, marks: ex.marks || {}, audio: [],
    };
    list.push(p);
  }
  p.audio = (p.audio || []).concat(ex.audio || []);
  savePapers(list);
  return p;
}
/* ⚠️ 系统自带的卷子是**只读**的（整体一份 JSON，改不了原地），
   所以改名 / 移走都记在那张覆盖表里，不动原始数据。
   「系统自带」包括两部分：真题（builtin.json）和原创样卷（samples.json）。 */
function isBuiltinPaper(id) {
  return builtinPapers().some(p => p.id === id)
    || samplePapers().some(p => p.id === id);
}
function renamePaper(id, name) {
  const t = String(name || '').trim();
  if (!t) return;
  if (isBuiltinPaper(id)) {
    const m = paperMeta();
    if (m[id] && m[id].hidden) return;
    m[id] = Object.assign({}, m[id], { name: t.slice(0, 60) });
    LS.set(paperMetaKey(), m);
    return;
  }
  const list = userPapers();
  const p = list.find(x => x.id === id);
  if (!p) return;
  p.name = t.slice(0, 60);
  savePapers(list);
}
function removePaper(id) {
  if (isBuiltinPaper(id)) {
    const m = paperMeta();
    m[id] = Object.assign({}, m[id], { hidden: true });
    LS.set(paperMetaKey(), m);
  } else {
    savePapers(userPapers().filter(p => p.id !== id));
  }
  if (activePaperId() === id) LS.set(activePaperKey(), '');
}

/* 导出成能再导入回来的 JSON。
   ⚠️ 一定要带 paperKey：不然导出再导入会**又多出一张一模一样的卷子**。 */
function myBankExportJson() {
  /* ⚠️ 只导出**自己导入的** —— 系统自带的那 30 套是站里就有的，
     导出再导入只会白多出 30 张卷子。 */
  const ps = userPapers();
  /* ⚠️ 一定要**按试卷分别导出**，不要把几份合并成一大坨 ——
     合并导出再导入会越导越多（每导一次就把别人的题也算进自己这张卷子里）。 */
  return JSON.stringify({
    version: today(), exportedAt: new Date().toISOString(), exam: curExam().id,
    note: '英语备考训练台 · 我的题目（' + examShort()
      + '）。在「我的 → 导入试卷」里粘贴或选这个文件即可。',
    papers: ps.map(x => ({
      key: x.src || x.id, name: x.name, marks: x.marks || {}, types: x.types,
    })),
    types: stripPid(flattenPapers(userPapers())),   // 兼容老版本（只认 types 的那种）
  }, null, 1);
}

/* 粘贴导入没有文件名，用它内容的指纹当去重键：
   同一段文本再粘一次 = 更新那张卷子；不同文本 = 新的一张。
   （固定键的话，第二次粘贴会把第一次的卷子整张覆盖掉。） */
function textKey(s) {
  let h = 5381;
  const t = String(s || '');
  for (let i = 0; i < t.length; i++) h = (((h * 33) >>> 0) ^ t.charCodeAt(i)) >>> 0;
  return 'paste:' + h.toString(36);
}

/* 手动粘贴导入：把这一份文本收成一张试卷（名字之后可以改） */
function importMyBank(text, srcName, extra) {
  const r = parseMyBankInput(text);
  if (!r.ok) return r;
  const ex0 = extra || {};
  /* 一叠试卷（导入别人导出的文件）→ 原样恢复每一张 */
  if (r.papers) {
    r.papers.forEach(pp => savePaper(pp.key, pp.name, pp.types, { marks: pp.marks }));
    rebuildBank();
    if (!ex0.__silent) render();
    return { ok: true, n: r.papers.reduce((a, pp) => a + pp.types.reduce((x, t) => x + t.items.length, 0), 0),
             types: '恢复了 ' + r.papers.length + ' 张卷子', unknown: [], issues: [],
             guessed: [], notes: [], papers: r.papers.length,
             paperCount: myPapers().length };
  }
  const parts = r.types.map(t => {
    const meta = myTypeMeta(t.type);
    return meta.name + ' ' + t.items.length + meta.unit;
  });
  const total = r.types.reduce((a, t) => a + t.items.length, 0);
  const ex = extra || {};
  let key = srcName;
  if (!key) {
    const t0 = String(text || '').trim();
    if (t0[0] === '{') {
      try { const o = JSON.parse(t0); if (o && o.paperKey) key = o.paperKey; } catch (e) { /* 忽略 */ }
    }
  }
  if (!key) key = textKey(text);
  const p = savePaper(key, String(key).replace(/\.[^.]+$/, ''), r.types,
    { marks: ex.marks || parseImportMarks(text, r.types), audio: ex.audio });
  LS.set(activePaperKey(), p.id);      // 导完就切到刚导的这张
  rebuildBank();
  if (!ex.__silent) render();
  return { ok: true, n: total,
           types: parts.join('、'), unknown: r.unknown || [],
           issues: r.issues || [], guessed: r.guessed || [], notes: r.notes || [],
           paper: p, paperCount: myPapers().length };
}

/* 统分单位：选词/填空按"空"，听写按"句"，其余按"题" */
function scoreUnit(type) {
  if (type === 'cloze' || type === 'gap') return '空';
  if (type === 'listen') return '句';
  return '题';
}
/* 这张卷子的分值说明：**卷子上标了就按标的**，没标才用考试标准。
   使用者要的就是"比如这一个空多少分"能看见。 */
function paperScoreHtml(p) {
  const out = [];
  (p.types || []).forEach(t => {
    if (OPEN_TYPES.indexOf(t.type) >= 0) return;
    const own = p.marks && p.marks[t.type];
    const per = own || scorePerQOf(t.type);
    if (!per) return;
    out.push(esc(myTypeMeta(t.type).name) + ' 每' + scoreUnit(t.type)
      + ' <b>' + (+per.toFixed(2)) + '</b> 分'
      + (own ? '<span style="color:var(--brand)">（卷子上标的）</span>'
             : '（按' + esc(examShort()) + '标准）'));
  });
  return out.length ? `<div class="meta" style="margin-top:2px">${out.join('　')}</div>` : '';
}
/* 有听力题却一份音频都没配 —— 题目照收，但要说一声 */
/* 本考试里有没有别的卷子带着音频 —— 多套卷子常常共用一个听力音频，
   所以缺音频时可以直接借那一份 */
function audioDonor(exceptId) {
  return myPapers().find(x => x.id !== exceptId && (x.audio || []).length) || null;
}
function papersMissingAudio(p) {
  const hasListen = (p.types || []).some(t => t.type === 'listening');
  return hasListen && !(p.audio || []).length;
}

function papersListHtml() {
  const list = myPapers();
  const nS = samplePapers().length;
  const nB = builtinPapers().length + nS;
  if (!list.length) {
    return `<div class="meta">这场考试还没有题库。在下面「加新卷子」里可以把材料交给 AI 转进来。</div>`;
  }
  const cur = activePaperId();
  const nU = userPapers().length;
  let h = `<div class="meta" style="margin-bottom:8px">
    「${esc(examShort())}」共 <b>${list.length}</b> 张卷子 · <b>点一张就练它</b>${
      nB ? `　（系统自带 ${nB} 张${nU ? '，自己导入 ' + nU + ' 张' : ''}）` : ''}</div>`;
  list.forEach(p => {
    const on = cur === p.id;
    const stat = (p.types || []).map(t => {
      const m = myTypeMeta(t.type);
      return m.name + ' ' + (t.items || []).length + m.unit;
    }).join(' · ');
    const units = paperUnitsOf(p);
    const hasListen = (p.types || []).some(t => t.type === 'listening');
    const donor = (!p.builtin && papersMissingAudio(p)) ? audioDonor(p.id) : null;
    /* ⚠️ 「没配音频」有两种情况，别混成一句：
       ① 连原文都没有（真题里 2022-09 / 2023-03 那两次补考）→ 真的什么都听不到，
          要把原因写在卡片上；
       ② 有原文、只是没配录音文件（原创样卷就是这样）→ 点播放能用浏览器朗读，
          这时候写「听不到声音」是错的，会让人以为这份卷子坏了。 */
    const scripts = (p.types || [])
      .filter(t => t.type === 'listening')
      .reduce((a, t) => a.concat((t.items || []).filter(it => it && it.script)), []);
    const gap = (p.types || []).map(t => (t.items || [])[0]).find(it => it && it.audioGap);
    const hasScript = scripts.length > 0;
    /* 整张卡就是"选它"的按钮 —— 左边一个单选圆点，选中的整卡高亮。
       之前只在卡里放了个不显眼的「练这一张」，谁也不知道能选（用户反馈"没法自己选"）。 */
    h += `<div class="paper${on ? ' on' : ''}" data-paperuse="${p.id}"
      style="cursor:pointer;${on ? 'border-color:var(--brand);'
        + 'background:var(--brand-soft);box-shadow:0 0 0 1px var(--brand) inset' : ''}">
      <div class="row" style="margin:0;gap:8px;align-items:center">
        <span style="font-size:20px;line-height:1;color:${on ? 'var(--brand)' : 'var(--fg3)'}"
          >${on ? '●' : '○'}</span>
        <input class="papername" data-paperrename="${p.id}" value="${esc(p.name)}"
          maxlength="60" title="点这里可以改卷子名"
          style="flex:1;min-width:0">
        ${on ? '<span class="tag" style="background:var(--brand);color:#fff;'
          + 'border-color:transparent">正在练</span>' : ''}
      </div>
      <div class="meta" style="margin:6px 0 0">${
        p.sample ? '<span style="color:var(--brand)">原创样卷 · </span>'
          : p.builtin ? '<span style="color:var(--brand)">系统自带 · </span>' : ''}${
        esc(stat) || '（没有题目）'} · 共 ${units} ${scoreUnit('careful')}</div>
      ${(p.sources || []).length > 1 ? `<div class="meta" style="margin-top:2px">
        由 ${p.sources.length} 份文档合成：${esc(p.sources.join('、'))}</div>` : ''}
      ${hasListen ? ((p.audio || []).length
        ? `<div class="meta" style="margin-top:2px">听力录音：${esc(p.audio.map(a => a.name).join('、'))}</div>`
        : (hasScript
          ? `<div class="meta" style="margin-top:2px">听力：<b>有原文、没配录音</b>
              —— 点播放键用浏览器朗读</div>`
          : `<div class="meta" style="margin-top:4px;color:var(--warn)">
              ⚠ ${esc(gap && gap.audioGap
                ? '这一套的官方录音没有收录 —— 听力题还在，只是听不到声音。'
                : '有听力题，但没配上音频 —— 题目能照常练，只是听不到声音。')}</div>`)) : ''}
      ${p.hasAnswers
        ? `<div class="meta" style="margin-top:2px">答案 / 解析：${p.builtin ? '齐全' : '已合并'}</div>`
        : `<div class="meta" style="margin-top:4px;color:var(--warn)">
            ⚠ 没有答案 / 解析 —— 做题时看不到正确答案。</div>`}
      <div class="row" style="margin:8px 0 0;gap:6px">
        <button class="btn ghost sm" data-paperdel="${p.id}">${p.builtin ? '移走' : '删掉'}</button>
        ${donor ? `<button class="btn ghost sm" data-paperborrow="${p.id}">用「${
          esc(donor.name)}」的音频</button>` : ''}
      </div>
    </div>`;
  });
  return h;
}

/* 复制给 AI 的提示词。留三条路，保证"点了就有东西可拿"：
     ① navigator.clipboard —— 要 https 或 localhost，file:// 下没有
     ② execCommand('copy') —— 老办法，http 下还能用
     ③ 都不行就把提示词摊在页面上并自动选中，让人手动复制
   不这么写的话，用单文件版（file:// 打开）点复制会静悄悄没反应。 */
function copyAIPrompt() {
  const txt = aiPromptText();
  const done = () => toast('提示词已复制，粘给 AI 一起发过去就行');
  const manual = () => {
    aiPromptShown = true;
    myPanelOpen = true;
    render();
    const el = document.getElementById('myprompt');
    if (el) { try { el.focus(); el.select(); } catch (e) { /* 选不中也无妨 */ } }
    toast('复制没成功 —— 下面已经摊开了，手动全选复制一下');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done, () => {
      if (!legacyCopy(txt)) manual(); else done();
    });
    return;
  }
  if (legacyCopy(txt)) done(); else manual();
}

function legacyCopy(txt) {
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) { return false; }
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


  ${vExamPick()}

  <div class="sec">错题本 · ${esc(examShort())}</div>
  ${vWrong()}

  <div class="sec">我的题目</div>
  <div class="card tight">
    ${papersListHtml()}
    <div class="row" style="margin-top:10px">
      <button class="btn ghost sm" data-mytoggle="1">${
        myPanelOpen ? '收起' : '加新卷子（用 AI 转格式）'}</button>
      ${userPapers().length ? `<button class="btn ghost sm" data-myexport="1">导出（可以传给别人）</button>
      <button class="btn ghost sm" data-myclear="1">清空导入的</button>` : ''}
    </div>
    <div id="mypanel"${myPanelOpen ? ' style="display:block"' : ' style="display:none"'}>

      <div class="meta" style="margin:12px 0 0">
        手上是 PDF、Word、还是手机拍的照，都行。<b>不用自己去转格式</b> ——
        把材料丢给 AI，让它按站里认得的样式交回来，再粘进来。
      </div>

      <div class="step">
        <span class="n">1</span>
        <div style="flex:1">
          <b>复制下面这段话</b>
          <div class="meta" style="margin:2px 0 8px">
            它已经把站里认得的格式全写给 AI 了，你一个字都不用改。
          </div>
          <div class="row" style="margin:0">
            <button class="btn" data-mycopy="1">复制给 AI 的提示词</button>
            <button class="btn ghost sm" data-myfmt="1">看看它要求的样子</button>
          </div>
          <pre id="myfmt" class="fmt"${myFmtOpen ? ' style="display:block"' : ''}>${esc(MYFORMAT_DEMO)}</pre>
          ${aiPromptShown ? `<div class="meta" style="margin:8px 0 0">
            复制没成功，那就手动全选下面这段（已经帮你选中了）：</div>
          <textarea id="myprompt" readonly rows="12"
            style="width:100%;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;font-size:11.5px;padding:8px;border:1px solid var(--brand);border-radius:8px">${esc(aiPromptText())}</textarea>` : ''}
        </div>
      </div>

      <div class="step">
        <span class="n">2</span>
        <div style="flex:1">
          <b>连你的试卷一起发给 AI</b>
          <div class="meta" style="margin:2px 0 0">
            豆包 / DeepSeek / Kimi / ChatGPT 都行。把 PDF 或照片当附件传上去，
            再把刚复制的那段话粘在下面一起发。<br>
            它给你<b>一段文字</b>或者<b>一个 .json 文件</b>都可以 —— 两种都收。
          </div>
        </div>
      </div>

      <div class="step">
        <span class="n">3</span>
        <div style="flex:1">
          <b>把 AI 交回来的东西放进这里</b>
          <div class="meta" style="margin:2px 0 8px">
            是文字就直接粘下面。是个文件的话，拖到这一页任何地方都行。
          </div>
          <textarea id="mytext" rows="8" placeholder="把 AI 给你的那段文字粘在这里…"
            style="width:100%;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;font-size:12px;padding:8px;border:1px solid var(--line);border-radius:8px">${importReport && importReport.fileText ? esc(importReport.fileText) : ''}</textarea>
          <div class="row" style="margin:8px 0 0">
            <button class="btn" data-myimport="1">导入</button>
            <label class="btn ghost sm" style="cursor:pointer;margin:0">
              选 AI 给的文件
              <input type="file" id="myjson" multiple accept=".json,.txt,.md,.csv,.tsv" style="display:none">
            </label>
          </div>
        </div>
      </div>

      ${importReportHtml()}

      <div class="row" style="margin-top:14px">
        <button class="btn ghost sm" data-myraw="1">${
          myRawOpen ? '收起' : 'AI 用不了？也可以让它在本机直接试读原始文件'}</button>
      </div>
      <div id="myraw"${myRawOpen ? ' style="display:block"' : ' style="display:none"'}>

      <div id="mydrop" class="drop" style="cursor:pointer" title="点一下选文件夹">
        <div style="font-size:16px"><b>点这里选文件夹</b></div>
        <div style="font-weight:400;font-size:13px;color:var(--fg2);margin-top:2px">
          也可以把整个文件夹直接拖进来<br>
          <span style="color:var(--fg3)">Word（.docx）最稳；PDF 排版复杂，读不出时请转成 .docx</span>
        </div>
        <input type="file" id="mydir" webkitdirectory directory multiple style="display:none">
        <label class="meta" style="display:inline-block;margin-top:10px;cursor:pointer;
          text-decoration:underline">
          只想选几个文件？点这里
          <input type="file" id="myfile" multiple
            accept=".txt,.md,.csv,.tsv,.json,.docx,.pptx,.xlsx,.pdf,image/*"
            style="display:none">
        </label>
        <div class="meta" style="margin-top:6px">
          文档 / 表格 / 图片都行，一次可以选好几个。全部在本机读，
          <b>不上传、不联网</b>。
        </div>
      </div>

      </div>
    </div>
  </div>

  <div class="card tight">
    <div class="row" style="margin:0">
      <button class="btn ghost sm" data-resetall="1">清空全部本地数据</button>
    </div>
  </div>`;
}

/* ---------- 渲染 ---------- */
/* 选考试（第一步）：只放「阶段分类 + 考试名」，别的什么都不加。
   点一个考试就进第二步（方向 + 卷面 + 日期）。

   ⚠️ 这一页**没有"跳过"**：既然这一页存在的意义就是让你选，就不该有溜走的口子。
      唯一的例外是"从「我的」回来换考试"——那是误点进来的，得给条退路，
      否则人就卡在这一页出不去了。所以出口按钮只在 picked 时才渲染。 */
function vOnboard() {
  const picked = !!LS.get('onboarded', false);
  const ex = onboardExam && EXAMS_BY_ID[onboardExam];
  if (onboardStep === 1 && ex) return vOnboardConfirm(ex);
  const groups = [];
  EXAMS.forEach(e => {
    let g = groups.find(x => x.n === e.group);
    if (!g) { g = { n: e.group, items: [] }; groups.push(g); }
    g.items.push(e);
  });
  return `
  ${groups.map(g => `
    <div class="sec">${esc(g.n)}</div>
    <div class="card tight">
      <div class="row" style="margin:0;gap:7px;flex-wrap:wrap">
        ${g.items.map(e => `<button class="btn ghost sm" data-exam="${e.id}"
          style="font-size:13px;padding:9px 13px">${esc(e.short || e.name)}</button>`).join('')}
      </div>
    </div>`).join('')}
`;
}

/* 第二步：确认这个考试。有方向的先选方向，再看它能考什么、几道题、多少分，
   最后填一个自己的考试日期。 */
function vOnboardConfirm(ex) {
  const hasV = (ex.variants || []).length > 0;
  const dfltDate = getCfg(ex.id).date || ex.date || '';
  return `
  <div class="card">
    <div class="ttl">${esc(ex.name)}</div>
  </div>

  ${hasV ? `<div class="sec">方向</div>
  <div class="card tight">
    ${variantRow(ex, onboardVariant)}
  </div>` : ''}

  <div class="sec">试卷结构</div>
  <div class="card tight">
    ${paperTable(ex, onboardVariant)}
  </div>

  <div class="sec">考试日期</div>
  <div class="card tight">
    <div class="row" style="margin:0">
      <input type="date" id="obdate" value="${dfltDate}"
        style="font-size:13px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-family:inherit">
    </div>
  </div>

  <div class="card tight">
    <div class="row" style="margin:0;gap:8px;flex-wrap:wrap">
      <button class="btn" data-obbegin="1">就这个，进去</button>
      <button class="btn ghost" data-obback="1">← 换一个考试</button>
    </div>
  </div>`;
}

function render() {
  ensureExamScoped();          // 先保证"这场考试"的记录已就位（见上）
  if (onboarding) {
    const picking = onboardStep === 0 || !EXAMS_BY_ID[onboardExam];
    $('#hdTitle').textContent = APP_NAME;
    $('#hdSub').textContent = picking ? '选你要考的考试' : '确认方向、日期和卷面';
    $('#hdCount').textContent = '';
    $('#hdClock').textContent = '';
    renderNav();
    $('#view').innerHTML = vOnboard();
    window.scrollTo(0, 0);
    return;
  }
  // ⚠️ 顺序很重要：renderNav() 在发现"当前题型不在这个考试的导航里"时
  //    会把 route 重置成 home（比如换考试之后）。必须先让它改完，再判 isType ——
  //    否则会出现"页面主体渲染 A 题型、route 却是 home"的不一致状态，
  //    表现出来就是打字/提交被静默丢掉（输入事件里第一行就是判 route）。
  renderNav();
  const isType = route.indexOf('type:') === 0;
  if (isType) readType = route.slice(5);      // 题型页：当前题型跟着路由走
  header();
  if (route !== 'vocab') vMode = 'list';      // 离开生词页就退出复习态
  const body = route === 'vocab' ? vVocab()
    : route === 'me' ? vMe()
    : isType ? vTypePage(readType)
    : vHome();
  $('#view').innerHTML = body;
  applyMarks();                        // 把划线/排除线画回去
  if (isType && readType === 'listen') bindListen();
}

/* ---------- 事件 ---------- */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
});

/* 题型页：选项 / 提交 / 下一题 / 重做 */
document.addEventListener('click', e => {
  if (route.indexOf('type:') !== 0) return;
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

  /* ⚠️ 这一组（翻页 / 重做 / 听一听）必须放在下面"已提交，只读"那行**前面**。
     它们是"只看不改"的操作，交过卷的题目上照样得能用。
     踩过：守卫写在前面，凡是已经交过卷的题目，点「下一篇」完全没反应 ——
     表现就是用户说的"两篇的要能点下一篇有反应"，看着像按钮坏了。
     只有"改答案"的操作（选选项、填空、提交）才该被只读挡掉。 */
  if (e.target.closest('[data-next]')) {
    setState(readType, (i + 1) % t.items.length); draft = null; render(); return;
  }
  if (e.target.closest('[data-prev]')) {
    setState(readType, (i - 1 + t.items.length) % t.items.length);
    draft = null; render(); return;
  }
  if (e.target.closest('[data-reset]')) {
    LS.set(ansKey(readType, i), null); LS.set(draftKey(readType, i), null);
    draft = null; render(); return;
  }
  // 口语：把参考回答读出来（这个按钮只在交卷后才出现）
  if (e.target.closest('[data-playsample]')) {
    const it3 = t.items[i];
    if (it3.sample) speak(it3.sample); else toast('这条没有参考回答');
    return;
  }
  // 听力理解的播放按钮（读这条题目的 script）
  if (e.target.closest('[data-playq]')) {
    const it2 = t.items[i];
    if (it2.audio) { playPaperAudio(it2.audio); return; }   // 优先放试卷自带的录音
    if (it2.script) speak(it2.script); else toast('这条题目没有配音频，也没有原文');
    return;
  }

  if (LS.get(ansKey(readType, i), null)) return;   // 已提交，只读（改答案的操作到此为止）

  // 口语的计时器（必须放在题型页的监听器里 —— 这里才有 t 和 i）
  if (e.target.closest('[data-spkprep]')) {
    spkStart('prep', t.items[i].prepSeconds || 60); return;
  }
  if (e.target.closest('[data-spktalk]')) {
    spkStart('talk', t.items[i].seconds || 120); return;
  }
  const pk = e.target.closest('[data-pick]');
  if (pk) {
    const [qi, oi] = pk.dataset.pick.split(':').map(Number);
    const d = ensureDraft(t, i); d.a[qi] = oi;
    LS.set(draftKey(t.type, i), d); render(); return;
  }
  const ch = e.target.closest('[data-chip]');
  if (ch) {
    const d = ensureDraft(t, i);
    d.chip = (d.chip === ch.dataset.chip) ? null : ch.dataset.chip;
    LS.set(draftKey(t.type, i), d); render(); return;
  }
  const bl = e.target.closest('[data-blank]');
  if (bl) {
    const d = ensureDraft(t, i);
    const n = bl.dataset.blank;
    if (d.p[n]) { delete d.p[n]; }
    else if (d.chip) { d.p[n] = d.chip; d.chip = null; }
    LS.set(draftKey(t.type, i), d); render(); return;
  }
  const sub = e.target.closest('[data-submit]');
  if (sub) {
    if (OPEN_TYPES.indexOf(t.type) >= 0) {
      const d0 = ensureDraft(t, i);
      // 口语不是写，没有文本可检查
      if (t.type !== 'speak' && !((d0.x || {}).text || '').trim()) {
        toast('先写点东西再提交'); return;
      }
      submitOpen(t, i, d0); return;
    }
    const d = ensureDraft(t, i);
    const nQ = itemQCount(t, t.items[i]);
    if (nQ && Object.keys(d.a).length < nQ) {
      if (!confirm('还有没答的题，确定提交？')) return;
    }
    submitRead(t, i, d); return;
  }
});

/* 打字：填空题的每个空、开放式的文本框。
   ⚠️ 这里**不能调 render()** —— 会丢焦点，用户打一个字就跳出去。
   只把草稿存起来，顺带更新一下"已答 n/N"和字数。 */
document.addEventListener('input', e => {
  if (route.indexOf('type:') !== 0) return;
  const t = S.bank && S.bank.types.find(x => x.type === readType);
  if (!t) return;
  const i = Math.min(stateOf(readType), t.items.length - 1);
  if (LS.get(ansKey(readType, i), null)) return;
  const d = ensureDraft(t, i);

  const gi = e.target.closest('[data-gap]');
  if (gi) {
    const n = gi.dataset.gap;
    if (gi.value) d.p[n] = gi.value; else delete d.p[n];
    LS.set(draftKey(readType, i), d);
    const btn = document.querySelector('[data-submit]');
    const need = Object.keys(t.items[i].answers || {}).length;
    if (btn) btn.textContent = '提交（已答 ' + Object.keys(d.p).length + '/' + need + '）';
    return;
  }
  if (e.target.id === 'openin') {
    d.x = { text: e.target.value };
    LS.set(draftKey(readType, i), d);
    const w = document.getElementById('wc');
    if (w) w.textContent = t.type === 'translate'
      ? cc(e.target.value) + ' 字' : wc(e.target.value) + ' 词';
  }
});

document.addEventListener('change', e => {
  const sel = e.target.closest('[data-sel]');
  if (!sel || route.indexOf('type:') !== 0) return;
  const t = S.bank.types.find(x => x.type === readType);
  const i = Math.min(stateOf(readType), t.items.length - 1);
  if (LS.get(ansKey(readType, i), null)) return;
  const d = ensureDraft(t, i);
  const si = +sel.dataset.sel;
  if (sel.value) d.a[si] = sel.value; else delete d.a[si];
  LS.set(draftKey(readType, i), d);
});

/* 选文件 / 把文件拖进来 —— 走同一条路：先读成文字，再交给解析器。
   全程在本机完成，不上传。
   拖到页面**任何地方**都收：浏览器默认会把拖进来的文件直接打开（离开本站），
   与其那样不如接住 —— 顺手把「我的题目」面板打开，让人看见东西去哪了。 */
/* 整个虚线框就是那个"选文件夹"的按钮 ——
   原来按钮藏在框里，谁也不觉得那能点。现在点框内任何地方都算点它。 */
document.addEventListener('click', e => {
  const dz = e.target.closest && e.target.closest('#mydrop');
  if (!dz) return;
  if (e.target.closest('label') || e.target.closest('input')) return;
  // 手机上的 Chrome 不支持"选文件夹"，那就退回选文件
  const folderOK = 'webkitdirectory' in document.createElement('input');
  const inp = document.getElementById(folderOK ? 'mydir' : 'myfile');
  if (inp) inp.click();
});

/* 改卷子名：输入框就在列表里，失焦或回车就存 —— 不弹文件管理器、也不弹输入框 */
document.addEventListener('change', e => {
  const el = e.target && e.target.closest && e.target.closest('[data-paperrename]');
  if (el) {
    renamePaper(el.dataset.paperrename, el.value);
    render();
    toast('已改名为「' + el.value.trim() + '」');
  }
});

document.addEventListener('change', e => {
  const id = e.target && e.target.id;
  if (id !== 'myfile' && id !== 'mydir') return;
  const fs = e.target.files;
  if (fs && fs.length) {
    importReport = null;
    handleImportFiles(fs);        // 选文件夹时每个文件自带 webkitRelativePath
    try { e.target.value = ''; } catch (e2) { /* 允许再选同一个文件夹 */ }
  }
});

/* AI 交回来的文件。
   ⚠️ 走的是和「粘贴」**同一条**路（importMyBank），不是文件夹那条 ——
      文件夹那条会按"这一组里有没有答案文件"来判，而 AI 转出来的
      文字里答案就写在每道题下面，走那边会平白报一句"没找到答案/解析"。
      另外这条路天然满足"一次提交 = 一张卷子"。 */
document.addEventListener('change', async e => {
  if (!e.target || e.target.id !== 'myjson') return;
  const fs = Array.prototype.slice.call(e.target.files || []);
  try { e.target.value = ''; } catch (e2) { /* 允许再选同一个文件 */ }
  if (!fs.length) return;
  const f = fs[0];
  const problems = [], notes = [];
  if (fs.length > 1) {
    notes.push('一次只吃一个文件，我先用了「' + f.name + '」，剩下的请再选一次。');
  }
  importNote('正在读 ' + f.name + '…');
  let text = null;
  try { text = await readOneImport(f, '', problems, notes); }
  catch (e2) { problems.push(f.name + '：读不了 —— ' + (e2 && e2.message)); }
  importNote('');
  if (!text || !String(text).trim()) {
    importReport = { ok: false, msg: '这个文件里没读出内容',
                     problems: problems.length ? problems : ['读不了：' + f.name] };
    render();
    toast('这个文件读不出内容');
    return;
  }
  const r = importMyBank(text, f.name.replace(/\.[^.]+$/, ''));
  importReport = Object.assign({}, r, {
    problems: (r.problems || problems).concat(problems),
    notes: (r.notes || []).concat(notes),
  });
  render();
  if (r.ok) toast('已导入：' + r.types);
  else toast('导入失败：' + (r.msg || '内容对不上'));
});
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => {
  if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') < 0) return;
  e.preventDefault();                       // 不加这行浏览器会直接打开文件
  const d = e.target.closest && e.target.closest('#mydrop');
  if (d) d.classList.add('over');
}));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
  if (!e.dataTransfer) return;
  const d = e.target.closest && e.target.closest('#mydrop');
  if (d) d.classList.remove('over');
  if (ev === 'dragleave') return;
  e.preventDefault();
  /* ⚠️ webkitGetAsEntry() 必须在**事件处理里同步调用** ——
     等一拍再调，DataTransferItem 就失效了，什么都拿不到。 */
  const entries = e.dataTransfer.items
    ? Array.prototype.slice.call(e.dataTransfer.items)
      .map(it => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
    : [];
  const fallback = Array.prototype.slice.call(e.dataTransfer.files || []);
  if (!entries.some(Boolean) && !fallback.length) return;
  importReport = null;
  const run = async () => {
    const files = await filesFromDataTransfer(entries, fallback);
    if (files.length) handleImportFiles(files);
  };
  if (d) { run(); return; }
  // 拖在面板外面：先把「我的题目」面板打开，再导
  myPanelOpen = true;
  if (route !== 'me' && !onboarding) { route = 'me'; render(); }
  setTimeout(run, 60);
}));

/* 拖进来的可能是**文件夹**（使用者的素材就是一个文件夹三样东西）。
   ⚠️ 浏览器给文件夹的只是一个"占位 File"，直接读它会报
      "A requested file or directory could not be found at the time an
       operation was processed" —— 之前就是这样，整组处理直接崩掉。
   必须用 webkitGetAsEntry() 递归把里面的真文件取出来，并带上相对路径
   （相对路径是用来判断"哪些文件属于同一张卷子"的）。 */
async function filesFromDataTransfer(entries, fallback) {
  if (!entries || !entries.some(Boolean)) return fallback || [];
  const out = [];
  const walk = async (entry, parent) => {
    if (!entry) return;
    if (entry.isFile) {
      try {
        const f = await new Promise((res, rej) => entry.file(res, rej));
        try { Object.defineProperty(f, 'webkitRelativePath', { value: parent + f.name }); }
        catch (e2) { /* 有的环境不让改，那就没有相对路径，按散文件处理 */ }
        out.push(f);
      } catch (e2) { /* 这个文件取不到，跳过 */ }
      return;
    }
    if (!entry.isDirectory) return;
    const rd = entry.createReader();
    for (let guard = 0; guard < 200; guard++) {
      const batch = await new Promise(res => {
        try { rd.readEntries(res, () => res([])); } catch (e2) { res([]); }
      });
      if (!batch.length) break;
      for (const e2 of batch) await walk(e2, parent + entry.name + '/');
    }
  };
  for (const en of entries) await walk(en, '');
  return out.length ? out : (fallback || []);
}

function submitRead(t, i, d) {
  const it = t.items[i];
  const key = readType + ':' + i;
  const st = { a: d.a, p: d.p };
  LS.set(ansKey(t.type, i), st);
  let right = 0, total = 0;
  const push = (q, got, ans) => {
    wrong.push({ type: t.type, typeName: t.typeName, title: it.title, q, got: String(got), right: String(ans), t: today() });
  };
  if (t.type === 'cloze' || t.type === 'gap') {
    Object.keys(it.answers).forEach(n => {
      const got = d.p[n], ans = it.answers[n];
      total++;
      if (normAns(got) === normAns(ans)) right++;
      else push('第 ' + n + ' 空', got || '未填', ans);
    });
  } else if (t.type === 'careful' || CHOICE_TYPES.indexOf(t.type) >= 0) {
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
  LS.set(scopeKeys().stats, stats); LS.set(scopeKeys().wrong, wrong);
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
    LS.set('lc:' + curExam().id + ':' + it.id, { typed });
    const norm = s => s.toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
    const ok = norm(typed) === norm(it.text);
    stats.ans++; if (ok) stats.right++;
    LS.set(scopeKeys().stats, stats); markDay();
    render(); return;
  }
  if (e.target.closest('[data-lskip]')) { li = (li + 1) % S.listen.items.length; render(); return; }
  if (e.target.closest('[data-lnext]')) { li = (li + 1) % S.listen.items.length; render(); return; }
});

/* 口语的计时器：准备 → 说。只改时钟那一个元素的文字，
   不 render()（一 render 就把计时重置了）。 */
let spk = { phase: null, left: 0, t: null };
function spkPaint() {
  const el = document.getElementById('spkclock');
  if (!el) return;
  if (!spk.phase) { el.textContent = '准备好了就点开始'; return; }
  const m = Math.floor(spk.left / 60), sec = spk.left % 60;
  el.textContent = (spk.phase === 'prep' ? '准备中 ' : '说 ') + m + ':'
    + (sec < 10 ? '0' : '') + sec;
}
function spkStart(phase, secs) {
  if (spk.t) clearInterval(spk.t);
  spk.phase = phase;
  spk.left = secs;
  spkPaint();
  spk.t = setInterval(() => {
    spk.left--;
    if (spk.left <= 0) {
      clearInterval(spk.t);
      spk.t = null;
      spk.phase = null;
      const el = document.getElementById('spkclock');
      if (el) el.textContent = phase === 'prep' ? '准备时间到，可以开始说了' : '时间到';
      return;
    }
    spkPaint();
  }, 1000);
}

/* 某个题型**答对了几小题** —— 从已交卷的记录里现算。
   ⚠️ 不另存一份"答对数"：存了就会和 ans: 记录对不上（改答案、重做都会不同步）。
      ans: 才是唯一来源。 */
function correctCountOf(t) {
  let right = 0;
  (t.items || []).forEach((it, i) => {
    const a = LS.get(ansKey(t.type, i), null);
    if (!a) return;
    if (t.type === 'cloze' || t.type === 'gap') {
      Object.keys(it.answers || {}).forEach(n => {
        if (normAns((a.p || {})[n]) === normAns(it.answers[n])) right++;
      });
    } else if (t.type === 'matching') {
      (it.statements || []).forEach((q, k) => { if ((a.a || {})[k] === q.answer) right++; });
    } else if (OPEN_TYPES.indexOf(t.type) < 0) {
      (it.questions || []).forEach((q, k) => { if ((a.a || {})[k] === q.answer) right++; });
    }
  });
  return right;
}

/* 拼一份可以直接粘给 AI 的提问。
   ⚠️ 只复制作文本身是不够的 —— AI 不知道这是哪场考试、按什么标准评。
      所以把"考试名 + 题目要求 + 这题在卷面里的权重 + 你的作答 + 要它怎么评"
      一起打包。 */
function aiPromptFor(t, it, myText) {
  const ei = examInfo();
  const isTr = t.type === 'translate';
  const row = paperRowOf(t.type);
  const L = [];
  L.push(isTr
    ? '请按' + ei.name + '的翻译评分标准，评价我下面这段译文。'
    : '请按' + ei.name + '的写作评分标准，评价我下面这篇作文。');
  L.push('');
  L.push((isTr ? '【原文】' : '【题目要求】') + (it.material || ''));
  if (row && row.pct) {
    L.push('【这项在卷面里】占 ' + row.pct + '%'
      + (row.score ? '（满卷 ' + fullOf() + ' 分制里约 ' + row.score + ' 分）' : ''));
  }
  L.push('');
  L.push(isTr ? '【我的译文】' : '【我的作文】');
  L.push(myText);
  L.push('');
  L.push('请给出：① 一个分数或等级；② 分内容、结构、语言三方面说主要问题；'
    + '③ 具体的改进建议，并把明显的语法/用词错误逐条列出来。'
    + '评价请用中文，例子保留英文。');
  return L.join('\n');
}

/* 复制文本：优先用 clipboard API，不行就退回 textarea + execCommand
   （file:// 下 clipboard API 常常不可用） */
function copyText(txt) {
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).then(() => true, fallback);
    }
  } catch (e) { /* 落到 fallback */ }
  return Promise.resolve(fallback());
}

/* 开放式作答（写 / 译 / 说）：不判分、不进正确率，只记打卡。
   参考范文放在题目的 sample / reference 里，提交后自己对照。 */
function submitOpen(t, i, d) {
  LS.set(ansKey(t.type, i), { x: d.x || {} });
  markDay();
  render();
}

/* 选中一段就划上（再选同一段取消）。
   ------- 为什么不用"点单词"那套：点词只能划一个词，划不了半句、跨词都不行，
   而做题时想标的是"这句话在讲什么"，是一个片段。 */
function selOffset(root, node, offset) {
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(node, offset);
  return pre.toString().length;
}
/* 从当前选区算出「划的是第几个可划线容器、哪一段」。
   返回 null = 这个选区不该划线（不在任何容器里，或者选的全是空白）。 */
function selectionTarget() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  const conts = ulContainers();
  for (let k = 0; k < conts.length; k++) {
    const el = conts[k];
    if (el.contains(r.startContainer) && el.contains(r.endContainer)) {
      const txt = r.toString();
      if (!txt.trim()) return null;
      const s = selOffset(el, r.startContainer, r.startOffset);
      return { c: k, s: s, e: s + txt.length, text: txt };
    }
  }
  return null;
}

/* 这一段是不是已经整段都划上了 —— 决定浮层按钮上写「划线」还是「取消划线」。 */
function rangeFullyMarked(key, c, s, e) {
  const m = marks[key];
  if (!m || !Array.isArray(m.r) || !m.r.length || e <= s) return false;
  const cov = new Array(e - s).fill(false);
  m.r.forEach(r => {
    if ((r.c || 0) !== c) return;
    for (let i = Math.max(r.s, s); i < Math.min(r.e, e); i++) cov[i - s] = true;
  });
  return cov.every(Boolean);
}

/* ---------- 浮层那个「划线」按钮 ----------
   ⚠️⚠️ 为什么必须有它（"手机上只能一个个词划线"的真因）

   手机上的选区是这么来的：**长按先选中一个词**，然后浏览器把两个把手摆出来，
   用户拖把手才能把范围扩大 —— 整个过程里 touchend 会响好几次。

   原来的做法是"一发现选区就立刻划上、并且把选区清掉"。于是：
   长按 → 词选中 → touchend → 立刻划上 + 选区被清 → 把手消失。
   用户根本来不及拖，看到的就是"一次只能划一个词"，
   而拖选大范围这件事在手机上**永远做不到**。

   所以触摸设备改成先浮一个按钮出来，等用户把把手拖好、自己点一下才算数。
   鼠标设备不用这么绕（拖选一次就到位），保持"松手即划"。
   ---------------------------------------------------------------- */

/* 待确认的区间。必须在这里存下来 ——
   手指点在按钮上那一刻浏览器多半已经把选区收掉了，
   点的时候再读一次 getSelection() 会读到空。 */
let ulPending = null;
let ulBtn = null;

function hideUlBtn() {
  ulPending = null;
  if (ulBtn) { ulBtn.remove(); ulBtn = null; }
}

function paintUlBtn(t, key) {
  if (!ulBtn) {
    ulBtn = document.createElement('button');
    ulBtn.type = 'button';
    ulBtn.id = 'ul-apply';
    document.body.appendChild(ulBtn);
  }
  ulPending = { key: key, c: t.c, s: t.s, e: t.e };

  const already = rangeFullyMarked(key, t.c, t.s, t.e);
  ulBtn.dataset.add = already ? '0' : '1';
  ulBtn.textContent = already ? '取消划线' : '划线';

  /* 贴着选区放，够不着拇指就白搭。上面放不下就翻到下面。 */
  let rect = null;
  try {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) rect = sel.getRangeAt(0).getBoundingClientRect();
  } catch (e) { /* 拿不到就退回左上角 */ }
  const W = 104, H = 40;
  let x = 12, y = 12;
  if (rect && (rect.width || rect.height)) {
    x = rect.left + rect.width / 2 - W / 2;
    y = rect.top - H - 10;
    if (y < 8) y = rect.bottom + 10;
  }
  x = Math.max(8, Math.min(x, window.innerWidth - W - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - H - 8));
  ulBtn.style.left = Math.round(x) + 'px';
  ulBtn.style.top = Math.round(y) + 'px';
}

function offerUnderline() {
  const ctx = curReadItem();
  if (!ctx) { hideUlBtn(); return; }
  const t = selectionTarget();
  if (!t) { hideUlBtn(); return; }
  paintUlBtn(t, ctx.key);
}

/* 触摸设备 —— 判断放在外面：它不会变，没必要每次绑定都算一遍 */
const IS_TOUCH = (typeof window !== 'undefined') &&
  (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);

function bindSelectUnderline() {
  if (IS_TOUCH) {
    /* 等用户把把手拖好：选区每变一次就重新计时，停下来 420ms 才浮出按钮。
       拖的过程中不浮 —— 不然按钮会跟着手指抖。 */
    let timer = null;
    document.addEventListener('selectionchange', () => {
      if (route.indexOf('type:') !== 0) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (route.indexOf('type:') === 0) offerUnderline();
      }, 420);
    });
    /* 手指按到别处 / 页面滚了，就把按钮收掉 */
    document.addEventListener('touchstart', e => {
      if (!e.target.closest || !e.target.closest('#ul-apply')) hideUlBtn();
    }, true);
    document.addEventListener('scroll', hideUlBtn, true);
    return;
  }

  /* 鼠标：拖选一次就到位，松手即划，不用多按一下 */
  document.addEventListener('mouseup', () => {
    if (route.indexOf('type:') !== 0) return;
    const ctx = curReadItem();
    if (!ctx) return;
    setTimeout(() => {                       // 等浏览器把选区定下来
      const t = selectionTarget();
      if (!t) return;
      const sel = window.getSelection();
      const added = toggleRangeMark(ctx.key, t.c, t.s, t.e);
      if (sel) sel.removeAllRanges();
      // 重渲染（而不是只 applyMarks）：让头部的「清除划线」立刻出现。
      // 这里已经清掉选区了，重渲染不会丢焦点。
      render();
      toast(added ? '已划线（选到划线的地方可以取消）' : '已取消这一段划线');
    }, 10);
  });
}

/* 浮层那个按钮被点中。
   ⚠️ 用 ulPending 里记下的区间，而不是现读一次选区 ——
      手指落在按钮上的时候，浏览器多半已经把选区收掉了，
      再读 getSelection() 会读到空，表现成"点了没反应"。 */
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#ul-apply')) return;
  const p = ulPending;
  if (!p) { hideUlBtn(); return; }
  const added = toggleRangeMark(p.key, p.c, p.s, p.e);
  const sel = window.getSelection();
  if (sel) sel.removeAllRanges();
  hideUlBtn();
  render();
  toast(added ? '已划线' : '已取消这一段划线');
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
    myPanelOpen = !myPanelOpen;
    render();
    return;
  }
  if (e.target.closest('[data-myfmt]')) {
    /* ⚠️ 开合状态要记在变量里再 render —— 原来直接改 el.style，
       任何一次 render 都会把它关回去（而且那个元素本来就没渲染出来）。 */
    myFmtOpen = !myFmtOpen;
    render();
    return;
  }
  if (e.target.closest('[data-myraw]')) {
    myRawOpen = !myRawOpen;
    render();
    return;
  }
  if (e.target.closest('[data-mycopy]')) { copyAIPrompt(); return; }
  if (e.target.closest('[data-myimport]')) {
    const ta = $('#mytext');
    const r = importMyBank(ta ? ta.value : '', '粘贴导入的题目');
    importReport = r;                    // 详情在面板里显示，toast 只说一句话
    render();
    if (r.mismatch) {
      toast('这些不是「' + examShort() + '」的题型：' + r.mismatch.map(m => m.name).join('、'));
    } else if (r.ok) {
      toast('已导入到「' + examShort() + '」：' + r.types);
    } else {
      toast('导入失败：' + (r.msg || '内容对不上'));
    }
    return;
  }
  if (e.target.closest('[data-myexport]')) {
    download(myBankExportJson(), '我的题目_' + examShort() + '.json', 'application/json');
    return;
  }
  if (e.target.closest('[data-myclear]')) {
    if (confirm('清空「' + examShort() + '」下自己导入的卷子？（其它考试和其它数据不受影响）')) {
      savePapers([]);
      LS.set(activePaperKey(), '');
      rebuildBank(); render();
      toast('已清空这场考试的卷子');
    }
    return;
  }
  /* 只练这一张 / 改回全部一起练 */
  if (e.target.closest('[data-paperuse]')
    && !e.target.closest('input') && !e.target.closest('[data-paperdel]')
    && !e.target.closest('[data-paperborrow]')) {
    const id = e.target.closest('[data-paperuse]').dataset.paperuse;
    setActivePaper(id);
    const p = activePaper();
    toast(p ? '现在练「' + p.name + '」' : '');
    return;
  }
  /* 借音频：多套卷子常常共用同一段听力录音 —— 直接引用同一份，不复制内容 */
  if (e.target.closest('[data-paperborrow]')) {
    const id = e.target.closest('[data-paperborrow]').dataset.paperborrow;
    const list = myPapers();
    const p = list.find(x => x.id === id);
    const d = audioDonor(id);
    if (p && d) {
      p.audio = (p.audio || []).concat(d.audio.map(a => ({
        id: a.id, name: a.name, size: a.size, from: d.name,
      })));
      const ids = p.audio.map(a => a.id);
      (p.types || []).forEach(t => {
        if (t.type !== 'listening') return;
        (t.items || []).forEach((it, k) => { it.audio = ids[Math.min(k, ids.length - 1)]; });
      });
      savePapers(list); rebuildBank(); render();
      toast('已用「' + d.name + '」的音频');
    }
    return;
  }
  if (e.target.closest('[data-paperdel]')) {
    const id = e.target.closest('[data-paperdel]').dataset.paperdel;
    const p = myPapers().find(x => x.id === id);
    if (p && confirm('删掉「' + p.name + '」这张卷子？（其它卷子不受影响）')) {
      removePaper(id);
      rebuildBank(); render();
      toast('已删掉这张卷子');
    }
    return;
  }
  /* 选方向。两种场合共用一个入口：
     选考试流程里 = 只记在内存，等"进去"再落盘；
     「我的考试」里 = 直接落盘。 */
  if (e.target.closest('[data-exv]')) {
    const parts = e.target.closest('[data-exv]').dataset.exv.split(':');
    const exId = parts[0], vid = parts[1] || null;
    if (onboarding) {
      onboardVariant = vid;
    } else {
      setExam({ id: exId, variant: vid });
      toast('已选方向：' + ((EXAMS_BY_ID[exId].variants || []).find(v => v.id === vid) || {}).name);
    }
    render();
    return;
  }
  /* 确认页：退回第一步 */
  if (e.target.closest('[data-obback]')) {
    onboardStep = 0;
    onboardExam = null;
    onboardVariant = null;
    window.scrollTo(0, 0);
    render();
    return;
  }
  /* 确认页：确认并进去 */
  if (e.target.closest('[data-obbegin]')) {
    const ex = EXAMS_BY_ID[onboardExam];
    if (!ex) return;
    // 兜底：正常情况下进确认页就默认选了第一个方向
    if ((ex.variants || []).length && !onboardVariant) {
      onboardVariant = ex.variants[0].id;
    }
    const wasPicked = !!LS.get('onboarded', false);
    const dateEl = $('#obdate');
    const date = (dateEl && dateEl.value) || '';
    const rec = setExam({ id: ex.id, variant: onboardVariant || null });
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) setExam({ id: ex.id, date });
    LS.set('onboarded', true);
    onboarding = false;
    onboardStep = 0;
    onboardExam = null;
    onboardVariant = null;
    route = 'home';
    if (location.hash !== '#' + route) history.replaceState(null, '', '#' + route);
    render();
    toast('已选：' + (ex.short || ex.name)
      + (rec.variant ? ' · ' + (((ex.variants || []).find(v => v.id === rec.variant) || {}).name || '') : ''));
    return;
  }
  /* 第一步：点一个考试 → 进确认页（首次进来）／ 直接换（「我的」里） */
  if (e.target.closest('[data-exam]')) {
    const id = e.target.closest('[data-exam]').dataset.exam;
    if (!EXAMS_BY_ID[id]) return;
    if (onboarding) {
      onboardExam = id;
      onboardStep = 1;
      // 默认选中第一个方向 —— 否则表格没有基准，
      // 点"第一个方向"看着像没反应（本来显示的就是它的基础卷面）
      const e2 = EXAMS_BY_ID[id];
      onboardVariant = (e2.variants || []).length ? e2.variants[0].id : null;
      window.scrollTo(0, 0);
      render();
      return;
    }
    setExam({ id });                 // 只换"看哪一场"，这场自己的方向和日期都留着
    render();
    toast('已选择：' + (EXAMS_BY_ID[id].short || EXAMS_BY_ID[id].name));
    return;
  }
  if (e.target.closest('[data-examsave]')) {
    const dtEl = $('#examdate');
    const dt = (dtEl && dtEl.value) || '';
    // 输入框空着点保存 = 把日期清掉（这样就不用再多一个「清除」按钮）
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
      setExam({ date: null });
      render();
      toast('已清除考试日期');
      return;
    }
    setExam({ id: examInfo().id, date: dt });    render();
    toast('已把考试日期设为 ' + dt);
    return;
  }
  if (e.target.closest('[data-clearvocab]')) {
    if (confirm('清空「' + examShort() + '」的生词本？（其它考试和其它数据不受影响）')) {
      vocab = []; LS.set(scopeKeys().vocab, vocab); render();
    } return;
  }
  if (e.target.closest('[data-clearwrong]')) {
    if (confirm('清空错题本？')) {
      wrong = []; LS.set(scopeKeys().wrong, wrong); render();
    } return;
  }
  if (e.target.closest('[data-resetall]')) {
    if (confirm('清空全部本地数据？答题记录、错题、生词、打卡、'
      + '你自己导入的题目、以及选的考试，都会没。')) {
      Object.keys(localStorage).filter(k => k.startsWith('cet4:')).forEach(k => localStorage.removeItem(k));
      /* ⚠️ 光清 localStorage 不够 —— 内存里的 marks（划线）、prog、
         我导入的题目、错题都还原样挂着，页面上看着像"没清干净"。
         scopedFor 置空 → 下一次 render 会把这一整套重新装载一遍。 */
      scopedFor = null;
      draft = null;
      vQueue = [];
      // 连"选了哪场考试"都没了，那就回到选考试那一屏，别把人留在空页面上
      onboarding = true;
      onboardStep = 0;
      onboardExam = null;
      onboardVariant = null;
      route = 'home';
      render();
      toast('已清空，重新选一个考试吧');
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
    migrateExamCfg();           // 老数据迁移：方向/日期搬到"每场考试各一份"
    migrateAnsKeys();           // 老数据迁移：答题记录的键补上"哪张卷子"这一层
    const IN = window.__INLINE_DATA__;
    let bank, listen, builtin = null, samples = null;
    if (IN) {
      bank = IN.bank;
      listen = IN.listen || null;
      builtin = IN.builtin || null;
      samples = IN.samples || null;
    } else {
      [bank, listen, builtin, samples] = await Promise.all([
        fetch('data/bank.json').then(r => r.json()),
        fetch('data/listening.json').then(r => r.json()).catch(() => null),
        /* 系统自带的真题卷。⚠️ 只有**本地版**才有这个文件：
           公开站上取不到 → S.builtin 为空 → 一张都不显示，别的照旧。
           （真题转录有版权，不能跟着公开站走。） */
        fetch('data/builtin.json').then(r => r.json()).catch(() => null),
        /* 原创样卷。**这个公开站也有** —— 它是自己写的，没有版权问题，
           正好用来给那些本机没有真题素材的考试（六级 / 雅思 / 考研…）兜底。 */
        fetch('data/samples.json').then(r => r.json()).catch(() => null)
      ]);
    }
    S.base = bank; S.baseListen = listen; S.listen = listen;
    S.builtin = builtin; S.samples = samples;

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

    bindSelectUnderline();      // 选中一段即划线

    // 第一次进来：先让用户选考试，选完再进训练台
    onboarding = !LS.get('onboarded', false);
    onboardStep = 0;
    onboardExam = null;
    onboardVariant = null;

    const h = location.hash.replace('#', '');
    if (['home', 'vocab', 'me'].includes(h) || h.indexOf('type:') === 0) route = h;

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
