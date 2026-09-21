# 投研工作区 · 项目总入口

> 本项目分**两侧**：**页面展示**（React 行情页 + 命令行工具，代码在 `src/` `public/` `scripts/`）与**文档研究**（A 股个股 / 行业研究生产线，全部在 `doc/`）。
> 两侧共用同一套底座：`api/`（数据获取）与 `tools/`（纯计算）。
> 本文件只做**两侧导航**，各自细节一律下沉到被指向的入口文件。

## 一、页面展示

**入口**：`src/index.jsx`（React 挂载点）、`public/index.html`（HTML 模板）。

| 位置 | 内容 |
| --- | --- |
| `src/pages/KlinePage.jsx` | K 线行情页主界面（周期 / 复权 / 均线（默认仅 20 日线）/ 预设标的；副图仅成交量） |
| `src/components/KlineChart.jsx` | ECharts 图表组件（深色主题：轴 / 网格 / tooltip / 滑块按深底配色） |
| `src/utils/` | `format.js` 数据格式化、`indicator.js` 技术指标（MA / MACD / RSI） |
| `src/styles.css` | 页面深色主题色板（`color-scheme: dark`，变量集中在 `:root`） |
| `public/` | `index.html` 模板（内联深色背景 + `theme-color`，避免首屏白闪）、`favicon.svg`（深色图标） |
| `api/kline.js` | K 线数据接口（腾讯行情：日 / 周 / 月线、分钟线、实时快照），浏览器可直连 |
| `scripts/stockScreener.js` | 命令行选股器（市值 + 营收同比筛选，导出 CSV），`node scripts/stockScreener.js --help` |
| `webpack.config.js` | 构建配置（devServer 端口 5180，输出 `dist/`） |

**命令**

```
npm run dev       # 开发服务器，http://127.0.0.1:5180
npm run build     # 生产构建到 dist/
npm run preview   # 生产模式预览，端口 5181
```

**图表手势（macOS 触控板）**

| 手势 | 行为 |
| --- | --- |
| 双指滑动 | 平移 K 线（速度由 `KlineChart.jsx` 的 `PAN_GAIN` 单一常量控制） |
| 双指捏合 | 缩放（浏览器把捏合伪装成 `ctrlKey` 的 wheel；ECharts `zoomOnMouseWheel: 'ctrl'`） |
| 按住拖动 | 平移 |
| 底部滑块 | 任意区间选择 |

> 注意：wheel 监听必须挂**捕获阶段**——zrender 对任何 wheel 都会 `stopPropagation`，冒泡阶段收不到事件。

> 页面展示侧不承载研究结论；研究结论一律落在文档研究侧（`doc/`）。

## 二、文档研究

**入口**：`doc/README.md` —— 项目地图、四层结构、任务路由（写主报告 / 财报跟踪 / 行业报告 / 更新知识库 / 算估值 / 成稿验证）与各流程步骤。

```
doc/README.md                 ← 文档研究总入口：四层结构 + 任务路由 + 流程 A—E
doc/研报/研报模板/             ← 方法层（合同）：主报告规范 / 财报跟踪规范 / 行业研究框架 / 成稿自检清单
doc/估值理论/                  ← 估值方法（统一模型 + 保险 / 银行两条例外）
doc/知识库/                    ← 领域知识（宏观 / 社会 / 行业）+ 公司事实卡·口径卡·来源索引
doc/研报/公司/                 ← 输出层：主报告 + 财报跟踪 + 定期报告原文件
doc/研报/README.md             ← 申万分类索引 + 覆盖地图
```

要点（细则见 `doc/README.md` 与 `AGENTS.md`）：

- 四层结构：L1 方法层 → L2 领域知识 → L3 公司事实 → L4 输出层；引用方向单一，知识库永不引用报告。
- 路径约定：跨目录引用一律写**项目根相对路径**（如 `doc/知识库/宏观/`），禁止 `../../../` 相对链。
- 行业归属唯一数据源：`doc/研报/industry-map.json`，索引与校验由 `node tools/swIndustry.js` 生成。

## 三、共享底座（两侧通用）

| 目录 | 职责 | 说明 |
| --- | --- | --- |
| `api/` | 数据获取（外部数据源） | 东方财富 datacenter、腾讯行情等封装；报告取数、页面行情同源 |
| `tools/` | 纯计算 / 工具函数 | `valuation.js` 估值 CLI、`pdf2text.js` PDF 提取、`swIndustry.js` 分类校验 |

边界：`api/` = 取外部数据，`tools/` = 纯计算；估值计算不写进 `api/`。项目约定全文见 `AGENTS.md`。
