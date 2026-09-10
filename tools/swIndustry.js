/**
 * 申万行业分类 · 目录一致性校验与索引生成（纯计算，不取外部数据）
 *
 * 数据源：doc/研报/industry-map.json（公司 → 申万一级/二级 + 代码/市场）。
 * 结构约定：三棵树同构，路径均为
 *   doc/研报/公司/<一级>/<二级>/<公司>/              （报告：<公司>.md + 财报跟踪/ + 定期报告原文件/）
 *   doc/知识库/公司/<一级>/<二级>/<公司>/            （事实卡 / 口径卡 / 来源索引，稀疏：碰到哪家建哪家）
 *
 * ── CLI 用法 ────────────────────────────────────────────────────────
 *   node tools/swIndustry.js --check              # 校验 map ↔ 目录 ↔ 申万名单 ↔ 全库路径（不一致则 exit 1）
 *   node tools/swIndustry.js --index              # 由 map 生成 doc/研报/README.md 分类索引
 *   node tools/swIndustry.js --index --dry        # 只打印，不写盘
 *   node tools/swIndustry.js --new <公司>          # 打印新公司该建的三处路径
 *   node tools/swIndustry.js --new <公司> --l1 <一级> --l2 <二级>   # 未入 map 时先试算
 *   node tools/swIndustry.js --list               # 打印分类总表（终端速查）
 *
 * --check 校验项：
 *   ① map ↔ 报告树 一一对应（无幽灵目录、无漏建目录），且目录层级与 map 的 一级/二级 一致
 *   ② 报告目录内容 = <公司>.md + 财报跟踪/ + 定期报告原文件/，不出现第四项
 *   ③ 知识库卡目录必须落在 map 内的同一行业路径上（允许稀疏，不要求每家有卡）
 *   ④ 同一二级行业名不得挂在两个不同一级行业下（抓错名/错位）
 *   ⑤ 一级/二级名相对已核实清单是否有新增（新增只告警，提示核对申万口径）
 *   ⑥ 全库文本文件（md / js / json）里的 doc/ 路径文本是否真实存在（治"公司变多导致链接腐烂"）
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MAP_PATH = 'doc/研报/industry-map.json';
const INDEX_PATH = 'doc/研报/README.md';
const REPORT_ROOT = 'doc/研报/公司';
const KNOWLEDGE_ROOT = 'doc/知识库/公司';

/** 2026-09-10 已逐家核实（同花顺 F10）的行业名；出现新值只告警，提示回核申万口径 */
const VERIFIED_L1 = [
  '传媒', '电力设备', '电子', '非银金融', '计算机', '交通运输',
  '家用电器', '机械设备', '汽车', '商贸零售', '食品饮料', '医药生物',
];
const VERIFIED_L2 = [
  '白酒Ⅱ', '保险Ⅱ', '电池', '电网设备', '工程机械', '航运港口', '化学制药',
  '计算机设备', '旅游零售Ⅱ', '生物制品', '数字媒体', '消费电子', '医疗器械',
  '医疗服务', '饮料乳品', '证券Ⅱ', '自动化设备', '乘用车', '白色家电',
];

/** 有意不存在、不应报错的路径（已废弃 / 已迁移位置的历史追述） */
const ALLOW_MISSING = [
  'doc/网页研报', // 2026-09-10 废弃，注记中保留说明
  'doc/宏观', 'doc/社会', 'doc/行业', // 2026-09 迁入 doc/知识库/，注记中作为历史位置追述
];

export function loadMap(root = '.') {
  return JSON.parse(readFileSync(`${root}/${MAP_PATH}`, 'utf8'));
}

/** 由 map 条目算出三处目录路径 */
export function pathsOf(c) {
  const report = `${REPORT_ROOT}/${c.sw_l1}/${c.sw_l2}/${c.name}`;
  return {
    report,
    originals: `${report}/定期报告原文件`,
    knowledge: `${KNOWLEDGE_ROOT}/${c.sw_l1}/${c.sw_l2}/${c.name}`,
  };
}

/** 扫描行业树，返回 [{l1, l2, name, dir}] */
function walkIndustryTree(root) {
  const out = [];
  if (!existsSync(root)) return out;
  for (const l1 of readdirSync(root)) {
    if (!statSync(`${root}/${l1}`).isDirectory()) continue;
    for (const l2 of readdirSync(`${root}/${l1}`)) {
      if (!statSync(`${root}/${l1}/${l2}`).isDirectory()) continue;
      for (const name of readdirSync(`${root}/${l1}/${l2}`)) {
        if (!statSync(`${root}/${l1}/${l2}/${name}`).isDirectory()) continue;
        out.push({ l1, l2, name, dir: `${root}/${l1}/${l2}/${name}` });
      }
    }
  }
  return out;
}

/** 契约：报告目录内只允许 <公司>.md / 财报跟踪 / 定期报告原文件 */
function checkReportDirContents(company, dir, errors) {
  const allowed = new Set([`${company}.md`, '财报跟踪', '定期报告原文件']);
  for (const item of readdirSync(dir)) {
    if (item.startsWith('.')) continue; // .DS_Store 等系统噪音，已 gitignore
    if (!allowed.has(item)) errors.push(`报告目录出现契约外的第 4 项：${dir}/${item}`);
  }
  if (!existsSync(`${dir}/${company}.md`)) errors.push(`缺主报告文件：${dir}/${company}.md`);
}

/** ⑥ 全库文本文件（md / js / json）中的 doc/ 路径文本存在性 */
function checkDocPaths(root, errors, warnings) {
  const files = execSync('git ls-files -z "*.md" "*.js" "*.json"', { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const RE = /doc\/[^\s`"'()（）｜|、，。；：\[\]<>*]+/g;
  let checked = 0;
  for (const f of files) {
    const text = readFileSync(`${root}/${f}`, 'utf8');
    for (const raw of text.match(RE) || []) {
      const p = raw.replace(/[.,;:]+$/, '').replace(/\/$/, '');
      if (p.includes('…')) continue; // 省略号式的示意路径，不是真引用
      if (ALLOW_MISSING.some((a) => p === a || p.startsWith(a))) continue;
      checked++;
      if (!existsSync(`${root}/${p}`)) errors.push(`路径不存在：${f} → ${p}`);
    }
  }
  return checked;
}

/** 主校验。返回 { errors, warnings } */
export function check(root = '.') {
  const errors = [];
  const warnings = [];
  const map = loadMap(root);
  const companies = map.companies;
  const byName = new Map(companies.map((c) => [c.name, c]));

  // ① map ↔ 报告树
  const reportDirs = walkIndustryTree(`${root}/${REPORT_ROOT}`);
  const seen = new Set();
  for (const d of reportDirs) {
    const c = byName.get(d.name);
    if (!c) { errors.push(`报告树里有 map 未登记的公司目录（幽灵目录）：${d.dir}`); continue; }
    seen.add(d.name);
    if (c.sw_l1 !== d.l1 || c.sw_l2 !== d.l2) {
      errors.push(`目录层级与 map 不一致：${d.dir} ← map 为 ${c.sw_l1}/${c.sw_l2}/${c.name}`);
    }
    checkReportDirContents(d.name, `${root}/${d.dir}`, errors);
  }
  for (const c of companies) {
    if (!seen.has(c.name)) errors.push(`map 已登记但报告树缺目录：${pathsOf(c).report}`);
  }

  // ③ 知识库树（允许稀疏）
  for (const d of walkIndustryTree(`${root}/${KNOWLEDGE_ROOT}`)) {
    const c = byName.get(d.name);
    if (!c) { errors.push(`知识库树里有 map 未登记的公司目录：${d.dir}`); continue; }
    if (c.sw_l1 !== d.l1 || c.sw_l2 !== d.l2) {
      errors.push(`知识库卡行业路径与 map 不一致：${d.dir} ← map 为 ${c.sw_l1}/${c.sw_l2}`);
    }
  }

  // ④ 同一二级名不得挂两个一级
  const l2Owner = new Map();
  for (const c of companies) {
    if (l2Owner.has(c.sw_l2) && l2Owner.get(c.sw_l2) !== c.sw_l1) {
      errors.push(`二级行业「${c.sw_l2}」同时挂在 ${l2Owner.get(c.sw_l2)} 与 ${c.sw_l1} 下`);
    }
    l2Owner.set(c.sw_l2, c.sw_l1);
  }
  // ⑤ 已核实清单
  for (const c of companies) {
    if (!VERIFIED_L1.includes(c.sw_l1)) warnings.push(`新增申万一级「${c.sw_l1}」（${c.name}）——请回核申万口径后补入 VERIFIED_L1`);
    if (!VERIFIED_L2.includes(c.sw_l2)) warnings.push(`新增申万二级「${c.sw_l2}」（${c.name}）——请回核申万口径后补入 VERIFIED_L2`);
  }

  // ⑥ 路径存在性
  const checkedPaths = checkDocPaths(root, errors, warnings);

  const stats = {
    l1: new Set(companies.map((c) => c.sw_l1)).size,
    l2: new Set(companies.map((c) => c.sw_l2)).size,
    companies: companies.length,
    withKnowledge: companies.filter((c) => existsSync(`${root}/${pathsOf(c).knowledge}`)).length,
    withOriginals: companies.filter((c) => existsSync(`${root}/${pathsOf(c).originals}`)).length,
    checkedPaths,
  };
  return { errors, warnings, stats, map };
}

/** 生成 doc/研报/README.md 全文 */
export function renderIndex(root = '.') {
  const map = loadMap(root);
  const cs = map.companies;
  const today = new Date().toISOString().slice(0, 10);
  const L = [];

  const l1s = [...new Set(cs.map((c) => c.sw_l1))];
  const l2s = [...new Set(cs.map((c) => c.sw_l2))];
  const noCard = cs.filter((c) => !existsSync(`${root}/${pathsOf(c).knowledge}`));
  const noOrig = cs.filter((c) => !existsSync(`${root}/${pathsOf(c).originals}`));

  L.push('# 研报输出层 · 申万行业分类索引');
  L.push('');
  L.push('> **本文件由 `node tools/swIndustry.js --index` 生成，请勿手工编辑**——分类数据源是 `doc/研报/industry-map.json`，改完 map 重跑生成即可。');
  L.push('>');
  L.push(`> 分类口径：**申万行业分类（2021 版）**，目录只到**二级**（一级太粗、三级调整频繁）；行业归属取自同花顺 F10「所属申万行业」逐家核对（核对日 2026-09-10），**不是**东方财富行业分类口径。`);
  L.push(`> 生成时间：${today} ｜ 覆盖 **${l1s.length} 个申万一级 / ${l2s.length} 个二级 / ${cs.length} 家公司**。`);
  L.push('');
  L.push('## 一、分类总表');
  L.push('');
  L.push('| 申万一级 | 申万二级 | 公司 | 代码 | 市场 | 主报告 | 财报跟踪 | 知识库卡 | 原件 |');
  L.push('| --- | --- | --- | --- | --- | :---: | :---: | :---: | :---: |');
  const sorted = [...cs].sort((a, b) =>
    a.sw_l1.localeCompare(b.sw_l1, 'zh') || a.sw_l2.localeCompare(b.sw_l2, 'zh') || a.name.localeCompare(b.name, 'zh'));
  for (const c of sorted) {
    const p = pathsOf(c);
    const hasReport = existsSync(`${root}/${p.report}/${c.name}.md`);
    const trackDir = `${root}/${p.report}/财报跟踪`;
    const tracks = existsSync(trackDir) ? readdirSync(trackDir).filter((f) => f.endsWith('.md')) : [];
    const hasCard = existsSync(`${root}/${p.knowledge}`);
    const hasOrig = existsSync(`${root}/${p.originals}`);
    const link = `\`${p.report}/\``;
    L.push(`| ${c.sw_l1} | ${c.sw_l2} | **${c.name}**${c.note ? ' ⚠' : ''} | \`${c.code}\` | ${c.market} | ${hasReport ? link : '❌ 缺'} | ${tracks.length ? `${tracks.length} 期` : '—'} | ${hasCard ? '✓' : '—'} | ${hasOrig ? '✓' : '—'} |`);
  }
  L.push('');
  L.push('**这张表告诉我们**：主报告路径按项目根相对路径写（不依赖渲染器跳转）；`知识库卡` 与 `原件` 允许缺（前者"碰到哪家建哪家"，后者视是否抓到官方 PDF），**主报告一栏不允许出现"缺"**。带 ⚠ 的公司见下方备注。');
  L.push('');

  const noted = cs.filter((c) => c.note);
  if (noted.length) {
    L.push('### 分类备注');
    L.push('');
    for (const c of noted) L.push(`- **${c.name}**（${c.sw_l1} — ${c.sw_l2}）：${c.note}`);
    L.push('');
  }

  L.push('## 二、覆盖地图');
  L.push('');
  L.push('### 2.1 已覆盖的一级行业');
  L.push('');
  L.push('| 申万一级 | 公司数 | 二级行业 |');
  L.push('| --- | ---: | --- |');
  const byL1 = new Map();
  for (const c of cs) {
    if (!byL1.has(c.sw_l1)) byL1.set(c.sw_l1, []);
    byL1.get(c.sw_l1).push(c);
  }
  for (const [l1, list] of [...byL1.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const seg = [...new Set(list.map((c) => c.sw_l2))].join('、');
    L.push(`| ${l1} | ${list.length} | ${seg} |`);
  }
  L.push('');
  L.push('### 2.2 待补清单');
  L.push('');
  if (noCard.length) {
    L.push(`- **无知识库卡（${noCard.length} 家）**：${noCard.map((c) => c.name).join('、')}`);
    L.push('  - 按"碰到哪家建哪家"纪律，写报告 / 财报跟踪时顺手补 `事实卡.md`、`口径卡.md`、`来源索引.md`。');
  }
  if (noOrig.length) {
    L.push(`- **无官方 PDF 原件（${noOrig.length} 家）**：${noOrig.map((c) => c.name).join('、')}`);
    L.push('  - 官方叙述性内容优先于网络搜索，补报告前先抓原始 PDF 入 `定期报告原文件/`。');
  }
  if (!noCard.length && !noOrig.length) L.push('- 无缺口。');
  L.push('');
  L.push('行业层面的知识（行业框架 / 景气跟踪）不在本目录，见 `doc/知识库/行业/`。');
  L.push('');

  L.push('## 三、目录约定');
  L.push('');
  L.push('```');
  L.push('doc/研报/公司/<申万一级>/<申万二级>/<公司>/');
  L.push('├── <公司>.md              # 主报告（框架层，不随季度改写）');
  L.push('├── 财报跟踪/              # 实例层，每报告期一个文件');
  L.push('└── 定期报告原文件/         # 官方 PDF 原件 + pdf2text 提取的 .txt');
  L.push('');
  L.push('doc/知识库/公司/<申万一级>/<申万二级>/<公司>/');
  L.push('└── 事实卡.md / 口径卡.md / 来源索引.md（稀疏，碰到哪家建哪家）');
  L.push('```');
  L.push('');
  L.push('**一公司一目录**：原件随公司走、不单独成树——两棵树分离时已经出现过"有原件无报告"的漂移（原 `定期报告原文件/晶泰控股/`），合一后结构上不会再发生。');
  L.push('');

  L.push('## 四、维护规则');
  L.push('');
  L.push('1. **新增公司**：先定申万一级 / 二级 → 改 `doc/研报/industry-map.json` → 建三处目录 → 跑 `--check` 对齐 → `--index` 重生成本文件。');
  L.push('');
  L.push('2. **申万调整分类 / 公司主业漂移**：**只改 map**，再跑 `--check`；目录搬迁按 map 机械执行，不在正文里手工找路径。');
  L.push('');
  L.push('3. **引用一律写项目根相对路径**（形如 `doc/研报/公司/<一级>/<二级>/<公司>/<公司>.md`），不要把行业层省掉。');
  L.push('');
  L.push('4. **定期巡检**：`node tools/swIndustry.js --check`——它同时扫描全库 markdown 的 `doc/` 路径文本是否存在，是链接腐烂的报警器。');
  L.push('');
  return L.join('\n');
}

const USAGE = `用法:
  node tools/swIndustry.js --check                              # 校验 map ↔ 目录 ↔ 申万名单 ↔ 全库路径
  node tools/swIndustry.js --index [--dry]                      # 生成 doc/研报/README.md 分类索引
  node tools/swIndustry.js --new <公司> [--l1 <一级> --l2 <二级>]  # 打印新公司该建的三处路径
  node tools/swIndustry.js --list                               # 终端打印分类总表

分类数据源：doc/研报/industry-map.json（唯一，勿在正文里手工判断行业）`;

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
  } else if (argv.includes('--check')) {
    const { errors, warnings, stats } = check('.');
    warnings.forEach((w) => console.log(`⚠  ${w}`));
    errors.forEach((e) => console.log(`❌ ${e}`));
    const ok = errors.length === 0;
    console.log(`\n${ok ? '✅' : '❌'} 校验${ok ? '通过' : '未通过'}：` +
      `${stats.l1} 个一级 / ${stats.l2} 个二级 / ${stats.companies} 家公司；` +
      `知识库卡 ${stats.withKnowledge} 家、原件 ${stats.withOriginals} 家；` +
      `扫描全库路径文本 ${stats.checkedPaths} 处，缺失 ${errors.filter((e) => e.startsWith('路径不存在')).length} 处。`);
    process.exit(ok ? 0 : 1);
  } else if (argv.includes('--index')) {
    const text = renderIndex('.');
    if (argv.includes('--dry')) console.log(text);
    else { writeFileSync(INDEX_PATH, text); console.log(`已生成 ${INDEX_PATH}（${text.split('\n').length} 行）`); }
  } else if (argv.includes('--new')) {
    const name = flag('--new');
    const l1 = flag('--l1'); const l2 = flag('--l2');
    const map = loadMap('.');
    const c = map.companies.find((x) => x.name === name);
    if (c) {
      const p = pathsOf(c);
      console.log(`${c.name}（${c.sw_l1} — ${c.sw_l2}）三处目录：\n  ${p.report}\n  ${p.originals}\n  ${p.knowledge}`);
    } else if (l1 && l2) {
      const p = pathsOf({ name, sw_l1: l1, sw_l2: l2 });
      console.log(`${name}（${l1} — ${l2}）三处目录：\n  ${p.report}\n  ${p.originals}\n  ${p.knowledge}`);
      console.log(`\n先写入 ${MAP_PATH}：\n  { "name": "${name}", "sw_l1": "${l1}", "sw_l2": "${l2}", "code": "<代码>", "market": "<板块>" }`);
    } else {
      console.log(`${name} 未登记在 ${MAP_PATH}。请先核实申万一级/二级，再执行：\n  node tools/swIndustry.js --new ${name} --l1 <一级> --l2 <二级>`);
      process.exit(1);
    }
  } else if (argv.includes('--list')) {
    for (const c of loadMap('.').companies) {
      console.log(`${c.sw_l1}\t${c.sw_l2}\t${c.name}\t${c.code}`);
    }
  } else {
    console.log(USAGE);
    process.exit(1);
  }
}
