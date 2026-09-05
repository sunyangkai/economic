/**
 * Markdown → 单文件 HTML 转换工具（研报离线预览用）
 *
 * 依赖 marked（GFM 解析）与 katex（数学公式服务端渲染），项目已安装。
 * 背景：ZCode / 纯 GFM 渲染器不支持 LaTeX 公式，本工具把 md 转成
 * 自包含 HTML——KaTeX 样式与字体 base64 内嵌，离线双击浏览器即可打开。
 *
 * ── CLI 用法 ────────────────────────────────────────────────────────
 *   node tools/md2html.js <md路径>                    # 输出到 doc/网页研报/（按源目录结构镜像）
 *   node tools/md2html.js <md路径> --out <html路径>    # 指定输出路径
 *   node tools/md2html.js <md路径> --title <标题>      # 覆盖页面标题（默认取一级标题）
 *
 * ── 输出约定 ────────────────────────────────────────────────────────
 * 网页研报统一放 doc/网页研报/，按源目录结构镜像存放
 * （doc/研报/<子路径>.md → doc/网页研报/<子路径>.html），避免不同公司的
 * 同名财报跟踪（如 2026中报.md）互相覆盖；doc/ 外的源文件就近输出同名 .html。
 *
 * ── 语法支持 ────────────────────────────────────────────────────────
 * GFM 全量（表格 / 任务列表 / 删除线 / 围栏代码块）+ 数学公式：
 *   块级公式独占段落用 $$...$$，行内公式用 $...$；
 *   正文若需字面美元符号，请勿与公式混写（如 "$100 和 $200" 会被误认为公式）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';
import katex from 'katex';

const here = dirname(fileURLToPath(import.meta.url));
const KATEX_DIST = join(here, '..', 'node_modules', 'katex', 'dist');

/** KaTeX 渲染选项：公式错误就地显示（throwOnError:false），中文/Unicode 符号不告警 */
const KATEX_OPTIONS = { throwOnError: false, strict: false };

// KaTeX 数学公式扩展（块级 $$..$$ / 行内 $..$）。公式整体在 GFM 规则之前拦截，
// 避免公式里的下划线、星号等被解析成强调语法；围栏代码块内的 $ 不受影响。
const mathExtensions = [
  {
    name: 'blockMath',
    level: 'block',
    start(src) {
      return src.indexOf('$$');
    },
    tokenizer(src) {
      const m = /^\$\$([\s\S]+?)\$\$/.exec(src);
      if (m) return { type: 'blockMath', raw: m[0], text: m[1].trim() };
    },
    renderer(token) {
      return `<div class="math-block">${katex.renderToString(token.text, { ...KATEX_OPTIONS, displayMode: true })}</div>\n`;
    },
  },
  {
    name: 'inlineMath',
    level: 'inline',
    start(src) {
      return src.indexOf('$');
    },
    tokenizer(src) {
      const m = /^\$\$([^$\n]+?)\$\$/.exec(src) || /^\$([^$\n]+?)\$/.exec(src);
      if (m) {
        return { type: 'inlineMath', raw: m[0], text: m[1].trim(), display: m[0].startsWith('$$') };
      }
    },
    renderer(token) {
      return katex.renderToString(token.text, { ...KATEX_OPTIONS, displayMode: token.display });
    },
  },
];

marked.use({ gfm: true, breaks: false, extensions: mathExtensions });

/** KaTeX 样式 + woff2 字体 base64 内嵌（去掉 woff/ttf 回退源），使 HTML 离线自包含 */
function inlineKatexCss() {
  let css = readFileSync(join(KATEX_DIST, 'katex.min.css'), 'utf-8');
  css = css.replace(/url\(["']?(fonts\/[^)"']+\.woff2)["']?\)/g, (_, p) => {
    const b64 = readFileSync(join(KATEX_DIST, p)).toString('base64');
    return `url(data:font/woff2;base64,${b64})`;
  });
  css = css.replace(/,?url\(["']?[^)"']*\.(?:woff|ttf)["']?\)\s*format\(["'][^"']+["']\)/g, '');
  return css;
}

const PAGE_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 2.5rem 1.5rem 4rem; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.75; color: #1f2328; background: #fff; }
article { max-width: 860px; margin: 0 auto; }
h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin-top: 1.5em; margin-bottom: .6em; font-weight: 600; }
h1, h2 { border-bottom: 1px solid #d1d9e0; padding-bottom: .3em; }
p { margin: .8em 0; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
table { border-collapse: collapse; margin: 1em 0; display: block; width: max-content; max-width: 100%; overflow: auto; }
th, td { border: 1px solid #d0d7de; padding: 6px 13px; }
th { background: #f6f8fa; font-weight: 600; }
tr:nth-child(2n) { background: #f6f8fa; }
code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 85%; background: #f6f8fa; border-radius: 6px; padding: .2em .4em; }
pre { background: #f6f8fa; border-radius: 6px; padding: 16px; overflow-x: auto; }
pre code { background: none; padding: 0; font-size: 100%; }
blockquote { margin: 1em 0; padding: 0 1em; color: #59636e; border-left: .25em solid #d0d7de; }
hr { border: 0; border-top: 3px solid #d1d9e0; margin: 2em 0; }
img { max-width: 100%; }
ul, ol { padding-left: 1.5em; }
.math-block { overflow-x: auto; }
@media print { body { padding: 0; } article { max-width: none; } }
`;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Markdown 转自包含 HTML
 * @param {string} markdown Markdown 全文
 * @param {object} [options]
 * @param {string}   [options.title] 页面标题，默认取第一个一级标题
 * @param {boolean}  [options.embedKatexCss=true] 有公式时是否内嵌 KaTeX 样式与字体（false 则输出体积小，但需联网加载样式）
 * @returns {string} HTML 全文
 */
export function mdToHtml(markdown, options = {}) {
  const { title, embedKatexCss = true } = options;
  const body = marked.parse(markdown);
  const hasMath = body.includes('katex');
  const pageTitle = (title || markdown.match(/^#\s+(.+)$/m)?.[1] || basename('文档')).trim();
  const katexCss = hasMath && embedKatexCss ? inlineKatexCss() : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pageTitle)}</title>
<!-- 由 tools/md2html.js 生成 -->
${katexCss ? `<style>\n${katexCss}\n</style>\n` : ''}<style>${PAGE_CSS}
</style>
</head>
<body>
<article>
${body}
</article>
</body>
</html>`;
}

/**
 * 默认输出路径：doc/ 下源文件镜像到 doc/网页研报/ 同结构位置
 * （doc/研报/<子路径>.md → doc/网页研报/<子路径>.html，doc/ 其余子目录同理），
 * 避免不同公司的同名财报跟踪（如 2026中报.md）互相覆盖；doc/ 外就近输出同名 .html。
 */
function defaultOutPath(mdPath) {
  const abs = resolve(mdPath);
  const root = join(here, '..');
  const relFromRoot = relative(root, abs);
  if (!relFromRoot || relFromRoot.startsWith('..') || isAbsolute(relFromRoot)) {
    return abs.replace(/\.md$/i, '') + '.html';
  }
  const parts = relFromRoot.split(sep);
  parts[parts.length - 1] = parts[parts.length - 1].replace(/\.md$/i, '') + '.html';
  if (parts[0] === 'doc' && parts[1] === '研报') {
    return join(root, 'doc', '网页研报', ...parts.slice(2));
  }
  if (parts[0] === 'doc') {
    return join(root, 'doc', '网页研报', ...parts.slice(1));
  }
  return join(root, 'doc', '网页研报', parts[parts.length - 1]);
}

const USAGE = `用法:
  node tools/md2html.js <md路径>                    # 输出到 doc/网页研报/（按源目录结构镜像）
  node tools/md2html.js <md路径> --out <html路径>   # 指定输出路径
  node tools/md2html.js <md路径> --title <标题>     # 覆盖页面标题

支持 GFM 全量语法 + LaTeX 公式（块级 $$..$$、行内 $..$）；输出为离线自包含单文件 HTML，
网页研报统一存放于 doc/网页研报/。`;

// CLI 入口：直接执行本文件时运行（import 时不执行）
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(USAGE);
    process.exit(args.length === 0 ? 1 : 0);
  }
  const mdPath = args[0];
  if (!existsSync(mdPath)) {
    console.error(`文件不存在: ${mdPath}`);
    process.exit(1);
  }
  const opt = { out: undefined, title: undefined };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--out') opt.out = args[++i];
    else if (args[i] === '--title') opt.title = args[++i];
  }
  const markdown = readFileSync(mdPath, 'utf-8');
  const outPath = opt.out || defaultOutPath(mdPath);
  mkdirSync(dirname(outPath), { recursive: true });
  const html = mdToHtml(markdown, { title: opt.title });
  writeFileSync(outPath, html, 'utf-8');
  const kb = Math.round(html.length / 1024);
  const mathNote = html.includes('katex') ? '，公式已渲染（KaTeX 内嵌）' : '';
  console.log(`已转换 → ${outPath}（${kb} KB${mathNote}）`);
}
