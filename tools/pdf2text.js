/**
 * PDF → 纯文本提取工具（用于官方财报等报告原文）
 *
 * 依赖 pdfjs-dist（项目已安装）；扫描版 PDF（无文本层）需先 OCR，本工具不支持。
 * 用途：官方年报 / 中报 / 季报 PDF → 纯文本，供研报引用"管理层讨论与分析"、
 *      分部明细、经营计划、风险提示、分红方案等叙述性原文——官方 PDF 优先于网络搜索。
 *
 * ── CLI 用法 ────────────────────────────────────────────────────────
 *   node tools/pdf2text.js <pdf路径>                     # 全文输出到 stdout
 *   node tools/pdf2text.js <pdf路径> --out <txt路径>      # 输出到文件
 *   node tools/pdf2text.js <pdf路径> --pages 1-30        # 只提取指定页（含分页标记）
 *   node tools/pdf2text.js <pdf路径> --out <txt> --pages 1-30
 *
 * ── 文件约定 ────────────────────────────────────────────────────────
 * 官方报告 PDF 存 doc/研报/公司/定期报告原文件/<公司>/<报告期>.pdf；
 * 提取结果建议存 temp/（临时，用完即删）或随研报使用。
 *
 * 输出含分页标记 "===== 第 N 页 ====="，便于定位章节。
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// pdfjs 加载 PDF 文档参数：传入 cMap（中日韩字体映射）与标准字体数据，
// 否则嵌入中文字体的官方报告（子集字体 + 自定义编码）会丢失中文。
function getDocumentParams(pdfPath) {
  const here = dirname(fileURLToPath(import.meta.url));
  const pdfjsDir = join(here, '..', 'node_modules', 'pdfjs-dist');
  return {
    url: pdfPath,
    cMapUrl: join(pdfjsDir, 'cmaps') + '/',
    cMapPacked: true,
    standardFontDataUrl: join(pdfjsDir, 'standard_fonts') + '/',
  };
}

/**
 * 提取 PDF 文本
 * @param {string} pdfPath PDF 文件路径
 * @param {object} [options]
 * @param {string}   [options.pages] 页范围，如 "1-30"；不传则全文
 * @param {boolean}  [options.pageMarkers=true] 是否输出分页标记
 * @returns {Promise<{ text: string, numPages: number }>}
 */
export async function extractPdfText(pdfPath, options = {}) {
  const { pages, pageMarkers = true } = options;
  const pdf = await pdfjsLib.getDocument(getDocumentParams(pdfPath)).promise;
  const numPages = pdf.numPages;

  let start = 1;
  let end = numPages;
  if (pages) {
    const m = String(pages).match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`页范围格式错误: ${pages}（应为 "1-30"）`);
    start = Math.max(1, Number(m[1]));
    end = Math.min(numPages, m[2] ? Number(m[2]) : start);
  }

  let text = '';
  for (let i = start; i <= end; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // 按 item.hasEOL 还原行结构（中文文本用无分隔拼接更干净）
    let line = '';
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) {
        text += line + '\n';
        line = '';
      }
    }
    if (line) text += line + '\n';
    if (pageMarkers) text += `\n===== 第 ${i} 页 =====\n`;
  }
  return { text, numPages };
}

const USAGE = `用法:
  node tools/pdf2text.js <pdf路径>                   # 全文输出到 stdout
  node tools/pdf2text.js <pdf路径> --out <txt路径>    # 输出到文件
  node tools/pdf2text.js <pdf路径> --pages 1-30      # 只提取指定页

官方报告 PDF 存 doc/研报/公司/定期报告原文件/<公司>/；扫描版 PDF 需先 OCR。`;

// CLI 入口：直接执行本文件时运行（import 时不执行）
import { pathToFileURL } from 'node:url';

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(USAGE);
    process.exit(args.length === 0 ? 1 : 0);
  }
  const pdfPath = args[0];
  const opt = { pages: undefined, out: undefined };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--out') opt.out = args[++i];
    else if (args[i] === '--pages') opt.pages = args[++i];
  }
  const { text, numPages } = await extractPdfText(pdfPath, { pages: opt.pages });
  if (opt.out) {
    writeFileSync(opt.out, text, 'utf-8');
    console.log(`已提取 ${numPages} 页 → ${opt.out}（${text.length} 字）`);
  } else {
    console.log(text);
  }
}
