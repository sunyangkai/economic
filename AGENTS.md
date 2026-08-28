# 项目约定

## 数据接口工具

- 本项目的 `api/` 目录是自建的数据获取工具集（如 `api/request.js`、`api/mainFinanceData.js`、`api/incomeStatement.js` 等），统一封装了外部数据源（东方财富 datacenter 等）的调用。
- 为本项目工作时，可以直接使用 `api/` 目录下的工具获取数据，无需再向用户确认或申请许可。
- 使用前先查看 `api/` 内对应模块的导出和用法，遵循现有的封装方式（请求头、参数、错误处理），不要绕过封装自行拼接外部请求。

## 工具函数目录

- `tools/` 目录专门放**纯计算/工具类函数**（不取外部数据），命名一律用**英文**（如 `tools/valuation.js`）。
- **估值计算统一用 `tools/valuation.js`**（三段式模型的可执行实现，含 CLI 情景生成器）：
  - `node tools/valuation.js --help` 看用法；
  - `node tools/valuation.js <spec.json>` 直接输出可粘贴进研报的 markdown 情景表（θ 情景表 / 增速情景表）；
  - 模型定义见 `doc/估值理论/估值模型.md`，写研报估值章节时两者配合使用。
- 边界：`api/` = 数据获取（外部数据源），`tools/` = 计算与工具函数，不要把估值计算写进 `api/`。

## 文件浏览约定

- **浏览项目布局用 `git ls-files`**（只含已跟踪文件，自动排除 node_modules / 构建产物等噪音），如 `git ls-files 'doc/研报/**'`。
- **用 glob 搜索时，必须带 `path` 参数或目录前缀锚定搜索根**，禁止裸用 `**/*` 或 `*`（无 `/` 的 pattern 会按 basename 全树匹配，含 node_modules，返回视图会被依赖目录噪音淹没）。例：
  - `glob(pattern="**/*.md", path="doc/研报/公司")`
  - `glob(pattern="doc/研报/**/*.md")`
- **找具体文件用 basename 模式**（如 `glob(pattern="海康威视.md")`），结果少且精准。
- 上述约定同样适用于 bash 里的 find/ls 类操作：用 `git ls-files` 或锚定子目录，不要全树遍历。
