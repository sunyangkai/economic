import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';
import path from 'path';

// Fetch and parse NBS EasyQuery API for macro indicators.
// Functions are no-arg and directly callable.

const BASE_URL = 'https://data.stats.gov.cn/easyquery.htm';

// Build headers to look like a real browser request
const buildHeaders = () => ({
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  Referer: 'https://data.stats.gov.cn/',
  Connection: 'keep-alive',
  'Sec-Fetch-Site': 'same-origin',
  'X-Requested-With': 'XMLHttpRequest',
});

// Build URLSearchParams with dynamic k1 timestamp to avoid caching/blocking
const buildParams = ({ zbCode }) => {
  const params = new URLSearchParams({
    m: 'QueryData',
    dbcode: 'hgyd',
    rowcode: 'zb',
    colcode: 'sj',
    wds: '[]',
    dfwds: JSON.stringify([{ wdcode: 'zb', valuecode: zbCode }]),
    k1: String(Date.now()),
    h: '1',
  });
  return params;
};

// Generic fetcher for an indicator code (raw structured result)
const fetchIndicatorRaw = async (zbCode) => {
  const url = `${BASE_URL}?${buildParams({ zbCode }).toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${zbCode} - ${text?.slice(0, 200)}`);
  }

  const json = await res.json();
  return parseEasyQueryResponse(json);
};

// Parse EasyQuery response into a tidy structure
const parseEasyQueryResponse = (payload) => {
  // Expected top-level shape: { returncode, returndata: { datanodes: [...], wdnodes: [...] } }
  const dataRoot = payload?.returndata || payload?.data || payload;
  if (!dataRoot) {
    return { meta: { raw: payload }, series: [], fields: {}, note: 'Unexpected response structure' };
  }

  const datanodes = dataRoot.datanodes || [];
  const wdnodes = dataRoot.wdnodes || [];

  // Build lookup maps from wdnodes. Typically contains defs for zb (指标) and sj (时间)
  const fields = {};
  for (const wd of wdnodes) {
    const code = wd?.wdcode;
    const nodes = Array.isArray(wd?.nodes) ? wd.nodes : [];
    fields[code] = nodes.map((n) => ({
      code: n?.code,
      name: n?.cname ?? n?.name ?? n?.code,
      memo: n?.memo || undefined,
      unit: n?.unit || undefined,
    }));
  }

  // Quick helpers to resolve code->name
  const nameBy = (wdcode, code) => fields?.[wdcode]?.find((n) => n.code === code)?.name || code;

  // Datanode shape often: { wds: [{ wdcode: 'zb', valuecode: 'A010801' }, { wdcode: 'sj', valuecode: '202407' }], data: { data: 101.2, strdata: '101.2' } }
  const series = [];
  const seriesByIndicator = {};
  const groupedByIndicator = {};
  const timeSet = new Set();
  for (const dn of datanodes) {
    const wds = dn?.wds || [];
    const dataVal = dn?.data?.data ?? (dn?.data?.strdata != null ? Number(dn.data.strdata) : null);
    const zb = wds.find((w) => w.wdcode === 'zb')?.valuecode;
    const sj = wds.find((w) => w.wdcode === 'sj')?.valuecode;

    // Normalize time: NBS usually returns YYYYMM or YYYY
    let time = sj;
    if (sj && /^\d{6}$/.test(sj)) {
      time = `${sj.slice(0, 4)}-${sj.slice(4, 6)}`; // YYYY-MM
    }

    const point = {
      indicatorCode: zb,
      indicatorName: nameBy('zb', zb),
      timeCode: sj,
      time,
      value: dataVal,
    };

    series.push(point);

    if (zb) {
      if (!seriesByIndicator[zb]) seriesByIndicator[zb] = [];
      seriesByIndicator[zb].push({ time, timeCode: sj, value: dataVal, indicatorName: nameBy('zb', zb) });

      // Prepare groupedByIndicator with complete data under each indicator
      if (!groupedByIndicator[zb]) {
        groupedByIndicator[zb] = {
          code: zb,
          name: nameBy('zb', zb),
          unit: (fields?.zb || []).find((n) => n.code === zb)?.unit,
          points: [], // concise points
          rows: [],   // full rows from `series`
        };
      }
      groupedByIndicator[zb].points.push({ time, timeCode: sj, value: dataVal });
      groupedByIndicator[zb].rows.push(point);
    }
    if (time) timeSet.add(time);
  }

  // Extract indicator meta (single zb for our use cases)
  const indicatorMeta = fields?.zb?.[0] || null;

  // Also expose all indicators listed in fields.zb (for names/units)
  const indicators = Array.isArray(fields?.zb) ? fields.zb : [];

  return {
    indicator: indicatorMeta
      ? { code: indicatorMeta.code, name: indicatorMeta.name, unit: indicatorMeta.unit }
      : undefined,
    indicators,
    fields, // full dimension metadata
    times: Array.from(timeSet).sort(),
    series, // tidy rows: one row per time point
    seriesByIndicator, // grouped series per indicator code (concise points)
    groupedByIndicator, // grouped with meta and full rows
  };
};

// Convert parsed result into an object array grouped by indicator
const toGroupedArray = (parsed) => {
  const groups = parsed?.groupedByIndicator || {};
  return Object.values(groups).map((g) => ({
    key: g.code,
    name: g.name,
    unit: g.unit,
    points: g.points,
    rows: g.rows,
  }));
};

// 1. PPI 数据 (A010801) — return object array
export const fetchPPI = async () => {
  const parsed = await fetchIndicatorRaw('A010801');
  return toGroupedArray(parsed);
};

// 2. CPI 数据 (A01030G) — return object array
export const fetchCPI = async () => {
  const parsed = await fetchIndicatorRaw('A01030G');
  return toGroupedArray(parsed);
};

// Optional raw exports if needed elsewhere
export const fetchPPIRaw = async () => fetchIndicatorRaw('A010801');
export const fetchCPIRaw = async () => fetchIndicatorRaw('A01030G');

// Generate data object and write to server/macro-data.js as a JSON object in JS module form
const generateAndWriteMacroData = async () => {
  const [ppi, cpi] = await Promise.all([fetchPPI(), fetchCPI()]);
  const data = {
    fetchedAt: new Date().toISOString(),
    PPI: ppi,
    CPI: cpi,
  };

  const filePath = path.join(path.dirname(new URL(import.meta.url).pathname), 'macro-data.js');
  const header = `// Auto-generated file. Do not edit manually.\n`;
  const body = `export default ${JSON.stringify(data, null, 2)};\n`;
  await writeFile(filePath, header + body, 'utf8');
  console.log(`Wrote macro data to ${filePath}`);
};

// If executed directly (node server/macro.js) run main
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAndWriteMacroData().catch((err) => {
    console.error('Failed to run macro fetch:', err?.message || err);
    process.exitCode = 1;
  });
}
