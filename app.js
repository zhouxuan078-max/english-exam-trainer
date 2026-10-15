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

/* 有方向的考试：拿到"当前生效的方向"。
   ⚠️ vid 参数很关键 —— 确认页上方向还没落盘（存在 onboardVariant 里），
      只看 localStorage 的话，页面上选什么都读不到，表格永远显示基础卷面。
      踩过：考研英语一/二点了没区别，就是因为这里只认 localStorage。 */
function variantFor(ex, vid) {
  ex = ex || curExam();
  if (vid) return (ex.variants || []).find(v => v.id === vid) || null;
  const sel = LS.get('exam', null) || {};
  if (sel.id !== ex.id || !sel.variant) return null;
  return (ex.variants || []).find(v => v.id === sel.variant) || null;
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

/* 写考试选择 —— 一律在现有选择上**合并**，避免"改个日期把方向弄丢"这类 bug。
   要整体换考试就用 LS.set('exam', {id}) 直接覆盖。 */
function setExam(patch) {
  const old = LS.get('exam', null) || {};
  const switching = patch.id && old.id && patch.id !== old.id;
  // 换考试：日期作废，但同一个 patch 里带的方向要留下
  const rec = switching ? { id: patch.id, variant: patch.variant }
                        : Object.assign({}, old, patch);
  Object.keys(rec).forEach(k => {
    if (rec[k] === null || rec[k] === undefined || rec[k] === '') delete rec[k];
  });
  LS.set('exam', rec);
  return rec;
}

/* 当前考试信息。日期：使用者填过就用他填的，否则用考试自带的（可能为空）。
   types / paper / total 都从试卷结构派生，不单独维护。 */
function examInfo() {
  const ex = curExam();
  const sel = LS.get('exam', null) || {};
  const custom = !!(sel.id === ex.id && sel.date);
  const v = curVariant(ex);
  return {
    id: ex.id, name: ex.name, short: ex.short || ex.name,
    date: custom ? sel.date : (ex.date || ''),
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

  <div class="card tight">
    <div class="row" style="margin:0">
      <button class="btn ghost sm" data-repick="1">回到选考试页</button>
    </div>
  </div>`;
}
const S = { bank: null, dict: null, listen: null };
const LS = {
  get(k, d) { try { const v = localStorage.getItem('cet4:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cet4:' + k, JSON.stringify(v)); } catch (e) {} },
  keys(prefix) {
    try { return Object.keys(localStorage).filter(k => k.indexOf('cet4:' + prefix) === 0); }
    catch (e) { return []; }
  }
};

/* 某个题型已经做了多少条（提交过的条目才会留下 ans:<题型>:<序号>） */
function doneCountOf(typeId) { return LS.keys('ans:' + typeId + ':').length; }
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
    const txt0 = ctx0 ? (((ensureDraft(ctx0.t, ctx0.i).x) || {}).text
      || (((LS.get('ans:' + ctx0.key, null) || {}).x) || {}).text) : '';
    if (!txt0) { toast('还没写东西'); return; }
    copyText(txt0).then(okc => toast(okc ? '已复制，粘贴给 AI 就能打分' : '复制失败，请手动选中复制'));
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
   按"题型:题目id"分开存，重渲染不会丢，也不会串到别的题上。

   划线存的是**字符区间** [{s, e}]（相对短文纯文本的偏移），不是"哪个词" ——
   所以可以自由选一段话划上，而不是只能一个个词点。 */
let marks = LS.get('marks', {});    // { 'careful:xxx': { r:[{s,e}], o:['0:2'] } }

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

/* 选一段 → 划上；选到**已经有划线的地方** → 取消那一部分。
   ⚠️ 判断标准是"有没有重叠"，不是"是否一模一样" ——
      拖选很难选到字符级完全相同（通常差一个空格、少一个字），
      按"完全相同才取消"来做，用户会觉得"取消不掉"。
   所以这里用涂改带的做法：
     和已有划线完全不重叠 → 加上
     有任何重叠           → 把重叠部分从已有划线里减掉（可能一分为二）
   区间按字符偏移存，重渲染后靠 applyMarks 逐词回填 .ul。 */
function toggleRangeMark(key, s, e) {
  if (e < s) { const t = s; s = e; e = t; }
  const m = getMarks(key);
  let touched = false;
  const out = [];
  m.r.forEach(r => {
    if (r.e <= s || r.s >= e) { out.push(r); return; }   // 不重叠，原样保留
    touched = true;
    if (r.s < s) out.push({ s: r.s, e: s });             // 左边没被盖到的部分
    if (r.e > e) out.push({ s: e, e: r.e });             // 右边没被盖到的部分
  });
  if (!touched) out.push({ s: s, e: e });                // 全新的一段，划上
  m.r = out.filter(r => r.e - r.s > 0);
  LS.set('marks', marks);
  return !touched;                                       // true = 这次是"划上"
}
function clearRangeMarks(key) {
  getMarks(key).r = [];
  LS.set('marks', marks);
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
  });
  // 划线：把存的字符区间换算成"哪些可点词落在区间里"，逐词加 .ul
  if (ctx) {
    const rs = ((marks[ctx.key] || {}).r) || [];
    if (rs.length) {
      document.querySelectorAll('.passage').forEach(el => {
        let pos = 0;
        const walk = node => {
          if (node.nodeType === 3) { pos += node.nodeValue.length; return; }
          if (node.nodeType !== 1) return;
          if (node.classList.contains('w')) {
            const len = node.textContent.length;
            if (rs.some(r => r.s < pos + len && r.e > pos)) node.classList.add('ul');
            pos += len;
            return;
          }
          Array.prototype.forEach.call(node.childNodes, walk);
        };
        Array.prototype.forEach.call(el.childNodes, walk);
      });
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
let onboardReturn = 'home'; // 从哪一页点进"选考试"的，返回时退回去
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

function navItems() {
  const items = [{ k: 'home', ic: '🏠', n: '首页' }];
  examInfo().types.forEach(t => {
    items.push({ k: 'type:' + t, ic: NAV_TYPE_ICON[t] || '📘',
                 n: (QTYPES[t] || {}).name || t });
  });
  items.push({ k: 'vocab', ic: '🔖', n: '生词' });
  items.push({ k: 'me', ic: '📊', n: '我的' });
  return items;
}

function renderNav() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  if (onboarding) { nav.innerHTML = ''; return; }
  const items = navItems();
  if (!items.some(x => x.k === route)) route = 'home';   // 当前页没了就回首页
  nav.innerHTML = items.map(x =>
    `<button data-nav="${x.k}" class="${route === x.k ? 'on' : ''}">` +
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
  if (route === 'vocab') { title = '生词本'; sub = '点短文里的词就能收藏'; }
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

  <div class="card tight">
    <div class="row" style="margin:0">
      <button class="btn ghost sm" data-go="me">导入我的题目</button>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat"><div class="k">连续打卡</div><div class="v">${streak()} <small>天</small></div></div>
    <div class="stat"><div class="k">累计答题</div><div class="v">${total} <small>题</small></div></div>
    <div class="stat"><div class="k">正确率</div><div class="v">${acc}<small>%</small></div></div>
    <div class="stat"><div class="k">生词 / 错题</div><div class="v">${vocab.length} <small>/ ${wrong.length}</small></div></div>
  </div>

  <div class="sec">这个考试要练什么</div>
  <div class="entry">
    ${examInfo().types.map(t => {
      const q = QTYPES[t] || {};
      const bt = S.bank && S.bank.types.find(x => x.type === t);
      const n = bt ? bt.items.length
        : (t === 'listen' && S.listen ? S.listen.items.length : 0);
      const d = n ? (n + ' ' + (q.unit || '篇')) : '还没有题目';
      return `<a href="#type:${t}" data-go="type:${t}">
        <div class="n">${NAV_TYPE_ICON[t] || '📘'} ${esc(q.name || t)}</div>
        <div class="d">${d}</div></a>`;
    }).join('')}
    <a href="#vocab" data-go="vocab"><div class="n">🔖 生词本</div><div class="d">${vocab.length} 个词${srsDueCount() ? ' · 待复习 ' + srsDueCount() : ''}</div></a>
    <a href="#me" data-go="me"><div class="n">📊 我的</div><div class="d">错题 ${wrong.length} 条</div></a>
  </div>

  <div class="sec">各题型做了多少</div>
  <div class="card tight">
    <div class="vlist">
      ${examInfo().types.map(t => {
        const q = QTYPES[t] || {};
        const bt = S.bank && S.bank.types.find(x => x.type === t);
        const total = bt ? bt.items.length
          : (t === 'listen' && S.listen ? S.listen.items.length : 0);
        const dn = doneCountOf(t);
        return `<div class="v">
          <span>${NAV_TYPE_ICON[t] || '📘'} ${esc(q.name || t)}</span>
          <b${dn ? '' : ' style="color:var(--fg3)"'}>${dn} / ${total} ${esc(q.unit || '篇')}</b>
        </div>`;
      }).join('')}
    </div>
  </div>`;

}

/* ---------- 阅读 ---------- */
function stateOf(type) { return prog[type] || 0; }
function setState(type, i) { prog[type] = i; LS.set('prog', prog); }

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
    <div class="empty">这个题型还没有题目。</div>
    <div class="row"><button class="btn" data-go="me">去「我的题目」导入</button></div>
  </div>`;
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
    // 听力：先播放，答完才给原文
    if (it.script) {
      h += `<div class="audio-card" style="padding:18px 12px 14px">
        <button class="bigbtn" id="playBtn" data-playq="1">▶</button>
        <div class="meta" style="margin:0;text-align:center">点一下播放录音</div>
      </div>`;
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
    if (!done) {
      h += `<textarea id="openin" class="big" rows="9"
        placeholder="${isTr ? '在这里写你的译文…' : (t.type === 'speak' ? '把自己说的写下来（方便对照）…' : '在这里写你的作文…')}"
        >${esc(myText)}</textarea>
        <div class="meta" style="margin-top:6px" id="wc">${
          isTr ? cc(myText) + ' 字' : wc(myText) + ' 词'}</div>`;
    } else {
      h += `<div class="sub"><div class="meta">你的作答</div>
        <div style="white-space:pre-wrap;line-height:1.8">${esc(myText) || '<i>（空）</i>'}</div>
        <div class="meta" style="margin-top:8px">
          <button class="btn ghost sm" data-copyopen="1">复制我的作答</button>
          <span style="margin-left:6px">发给 AI，可以让它按这场考试的标准打分</span>
        </div></div>`;
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
      return `<div class="result"><button class="btn" data-submit="1">提交</button>
        <button class="btn ghost sm" data-reset="1">重做</button></div>${pagerRow(t, i)}`;
    }
    return `<div class="result">
      <span class="score">已提交 · ${isTr ? cc(txt) + ' 字' : wc(txt) + ' 词'}</span>
      <button class="btn ghost sm" data-next="1">下一篇 →</button>
      <button class="btn ghost sm" data-reset="1">重做</button></div>`;
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
    <button class="btn ghost sm" data-next="1">下一篇 →</button>
    <button class="btn ghost sm" data-reset="1">重做</button></div>`;
}

let draft = null;   // 当前作答草稿

function ensureDraft(t, i) {
  const key = t.type + ':' + i;
  if (!draft || draft.key !== key) {
    const saved = LS.get('draft:' + key, null);
    draft = { key, a: (saved && saved.a) || {}, p: (saved && saved.p) || {},
              x: (saved && saved.x) || {}, chip: null };
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
  for (const v of vocab) lines.push([v.word, v.phon || '', v.mean || '', '英语备考训练台'].join('\t'));
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

  <div class="sec">错题本</div>
  ${vWrong()}

  <div class="sec">我的题目</div>
  <div class="card tight">
    ${(myBankCount() || myListenCount())
      ? `<div class="meta">已导入 <b>${myBankCount()}</b> 篇${
          myListenCount() ? ' · <b>' + myListenCount() + '</b> 句听力' : ''}，排在每类最前面。</div>`
      : ''}
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
      <div class="meta" style="margin-top:2px">
        导入目前只认上面这四类分节标题。其余题型本站自带题库，
        想换成自己的材料，照着 <code>D:\Anki学习\阅读题库\</code> 里的格式改文件即可。
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
  ${picked ? `<div class="row" style="margin:16px 0 0">
      <button class="btn ghost sm" data-obout="1">← 返回</button>
    </div>` : ''}`;
}

/* 第二步：确认这个考试。有方向的先选方向，再看它能考什么、几道题、多少分，
   最后填一个自己的考试日期。 */
function vOnboardConfirm(ex) {
  const hasV = (ex.variants || []).length > 0;
  const today = LS.get('exam', null) || {};
  const dfltDate = (today.id === ex.id && today.date) ? today.date : (ex.date || '');
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

  if (LS.get('ans:' + key, null)) return;   // 已提交，只读

  // 口语：把参考回答读出来
  if (e.target.closest('[data-playsample]')) {
    const it3 = t.items[i];
    if (it3.sample) speak(it3.sample); else toast('这条没有参考回答');
    return;
  }
  // 听力理解的播放按钮（读这条题目的 script）
  if (e.target.closest('[data-playq]')) {
    const it2 = t.items[i];
    if (it2.script) speak(it2.script); else toast('这条题目没有听力材料');
    return;
  }
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
    if (OPEN_TYPES.indexOf(t.type) >= 0) {
      const d0 = ensureDraft(t, i);
      if (!((d0.x || {}).text || '').trim()) { toast('先写点东西再提交'); return; }
      submitOpen(t, i, d0); return;
    }
    const d = ensureDraft(t, i);
    const nQ = itemQCount(t, t.items[i]);
    if (nQ && Object.keys(d.a).length < nQ) {
      if (!confirm('还有没答的题，确定提交？')) return;
    }
    submitRead(t, i, d); return;
  }
  const nx = e.target.closest('[data-next]');
  if (nx) { setState(readType, (i + 1) % t.items.length); draft = null; render(); return; }
  const pv = e.target.closest('[data-prev]');
  if (pv) {
    setState(readType, (i - 1 + t.items.length) % t.items.length);
    draft = null; render(); return;
  }
  const rs = e.target.closest('[data-reset]');
  if (rs) { LS.set('ans:' + key, null); LS.set('draft:' + key, null); draft = null; render(); return; }
});

/* 打字：填空题的每个空、开放式的文本框。
   ⚠️ 这里**不能调 render()** —— 会丢焦点，用户打一个字就跳出去。
   只把草稿存起来，顺带更新一下"已答 n/N"和字数。 */
document.addEventListener('input', e => {
  if (route.indexOf('type:') !== 0) return;
  const t = S.bank && S.bank.types.find(x => x.type === readType);
  if (!t) return;
  const i = Math.min(stateOf(readType), t.items.length - 1);
  if (LS.get('ans:' + readType + ':' + i, null)) return;
  const d = ensureDraft(t, i);

  const gi = e.target.closest('[data-gap]');
  if (gi) {
    const n = gi.dataset.gap;
    if (gi.value) d.p[n] = gi.value; else delete d.p[n];
    LS.set('draft:' + readType + ':' + i, d);
    const btn = document.querySelector('[data-submit]');
    const need = Object.keys(t.items[i].answers || {}).length;
    if (btn) btn.textContent = '提交（已答 ' + Object.keys(d.p).length + '/' + need + '）';
    return;
  }
  if (e.target.id === 'openin') {
    d.x = { text: e.target.value };
    LS.set('draft:' + readType + ':' + i, d);
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
  LS.set('ans:' + readType + ':' + i, { x: d.x || {} });
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
function bindSelectUnderline() {
  ['mouseup', 'touchend'].forEach(ev => document.addEventListener(ev, e => {
    if (route.indexOf('type:') !== 0) return;
    const ctx = curReadItem();
    if (!ctx) return;
    const pEl = e.target.closest && e.target.closest('.passage');
    if (!pEl) return;
    setTimeout(() => {                       // 等浏览器把选区定下来
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) return;
      const r = sel.getRangeAt(0);
      if (!pEl.contains(r.startContainer) || !pEl.contains(r.endContainer)) return;
      const txt = r.toString();
      if (!txt.trim()) return;
      const s = selOffset(pEl, r.startContainer, r.startOffset);
      const added = toggleRangeMark(ctx.key, s, s + txt.length);
      sel.removeAllRanges();
      // 重渲染（而不是只 applyMarks）：让头部的「清除划线」立刻出现。
      // 这里已经清掉选区了，重渲染不会丢焦点。
      render();
      toast(added ? '已划线（选到划线的地方可以取消）' : '已取消这一段划线');
    }, 10);
  }));
}

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
      note: '英语备考训练台 · 我的题目。在「我的 → 导入我的题目」里粘贴或选这个文件即可。',
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
  /* 选考试页的出路：首次进来 = 先用四级；从「我的」回来 = 退回原来那一页 */
  /* 选考试页的唯一出口：只在"从「我的」回来换考试"时才有这个按钮，
     点了就退回进来之前那一页。首次进来没有出口 —— 必须选一个。
     下面的 first 分支只是兜底（万一状态不一致，点了也别把人卡住）。 */
  if (e.target.closest('[data-obout]')) {
    const first = !LS.get('onboarded', false);
    if (first) {
      LS.set('exam', { id: DEFAULT_EXAM_ID });
      LS.set('onboarded', true);
    }
    onboarding = false;
    onboardStep = 0;
    onboardExam = null;
    route = first ? 'home' : (onboardReturn || 'home');
    if (location.hash !== '#' + route) history.replaceState(null, '', '#' + route);
    render();
    return;
  }
  /* 从「我的」回到选考试页（记住从哪来的，返回时退回去） */
  if (e.target.closest('[data-repick]')) {
    onboardReturn = route;
    onboarding = true;
    onboardStep = 0;
    onboardExam = null;
    window.scrollTo(0, 0);
    render();
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
    const rec = { id: ex.id };
    if (onboardVariant) rec.variant = onboardVariant;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) rec.date = date;
    LS.set('exam', rec);
    LS.set('onboarded', true);
    onboarding = false;
    onboardStep = 0;
    onboardExam = null;
    onboardVariant = null;
    route = wasPicked ? (onboardReturn || 'home') : 'home';
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
    LS.set('exam', { id });          // 换考试不带旧日期、旧方向
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
    setExam({ id: examInfo().id, date: dt });
    render();
    toast('已把考试日期设为 ' + dt);
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
