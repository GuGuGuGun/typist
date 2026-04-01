# Typist

一个基于 Tauri + React + Rust 的本地 Markdown 编辑器，目标是提供 Typora 级 WYSIWYG 写作体验，同时保留 Obsidian 风格的插件扩展能力。

> 当前定位：Windows 平台 MVP，后续规划 macOS / Linux。

## 项目亮点

- 低资源占用：Tauri + Rust 后端，面向轻量桌面应用。
- WYSIWYG + 源码双模式：支持在富文本编辑与纯文本源码间快捷切换（Ctrl+/）。
- 常用 Markdown 增强：GFM、代码高亮、Mermaid、KaTeX。
- 本地优先：文件打开/保存、最近文件、多标签、工作区文件树。
- 中英双语界面：设置中可切换中文 / English。
- 系统文件直开：打包版支持关联 md/markdown/txt，双击即可用 Typist 打开。
- 可扩展架构：插件生命周期、事件总线、UI 插槽机制。

## 当前功能概览

- 编辑能力
  - WYSIWYG 编辑（Milkdown / ProseMirror）
  - 源码模式切换（纯文本编辑）
  - 查找替换（支持正则）
  - 多标签页与脏标记
- 内容渲染
  - GFM（表格、任务列表、删除线）
  - Prism 代码高亮
  - Mermaid 图表
  - KaTeX 数学公式
- 文件与系统能力
  - 打开 / 保存 / 另存为
  - 外部文件变更检测（保留当前版本 / 重新加载磁盘内容）
  - 最近文件
  - 工作区文件树与全局搜索
  - 支持从启动参数自动打开文件
  - 单实例文件转发（已运行时再次双击文件，会发送到现有窗口打开）
  - 打包版文件关联（md / markdown / txt）
  - 导出 HTML / PDF
  - 崩溃恢复与更新检查
- 可定制能力
  - 中文 / English 语言切换
  - 亮色 / 暗色主题
  - 焦点模式 / 打字机模式
  - 插件管理与基础 SDK

## 技术栈

- 桌面框架：Tauri 2
- 前端：React 19 + TypeScript + Vite
- 编辑器：Milkdown + ProseMirror
- 后端：Rust（独立 backend crate + Tauri 集成）
- 状态管理：Zustand

## 目录结构

```text
.
├─ frontend/            # React 前端
├─ backend/             # Rust 业务后端（文件、搜索、导出、插件等）
├─ src-tauri/           # Tauri 容器与打包配置
└─ docs/                # PRD 与开发文档
```

## 快速开始

### 1) 环境要求

- Node.js 20+
- Rust 1.77+
- Windows 开发环境（已在当前阶段优先验证）
- Tauri 2 依赖环境（WebView2、MSVC Build Tools 等）

### 2) 安装依赖

```bash
npm install
npm --prefix frontend install
```

### 3) 启动开发模式

```bash
npm run tauri:dev
```

命令会自动启动前端 Vite 服务并拉起桌面应用。

### 4) 前端构建检查

```bash
npm --prefix frontend run build
```

## 编译与打包教程（安装包）

以下步骤用于从源码构建可分发的 Windows 安装包。

### 1) 先决条件

- 已完成上面的环境安装与依赖安装步骤。
- 建议先执行一次开发模式，确认本机 Tauri 环境可正常运行：

```bash
npm run tauri:dev
```

### 2) 一键打包（默认配置）

```bash
npm run tauri:build
```

说明：当前 `src-tauri/tauri.conf.json` 中 `bundle.targets` 为 `all`，会按本机环境生成可用的安装包类型。

### 3) 指定安装包类型（可选）

只打 NSIS（`.exe` 安装程序）：

```bash
npm run tauri -- build --bundles nsis
```

只打 MSI（`.msi` 安装包）：

```bash
npm run tauri -- build --bundles msi
```

### 4) 产物位置

- 安装包输出目录：`src-tauri/target/release/bundle/`
- 常见子目录：
  - `src-tauri/target/release/bundle/nsis/`
  - `src-tauri/target/release/bundle/msi/`

### 5) 常见问题

- 问题：开发模式正常，但打包失败。
  - 处理：先执行 `npm --prefix frontend run build`，确认前端可单独构建成功，再执行 `npm run tauri:build`。
- 问题：希望验证文件关联是否生效。
  - 处理：必须安装打包后的应用后再验证；`npm run tauri:dev` 不会写入系统文件关联。

## 文件关联说明（Windows）

- 在开发模式（`npm run tauri:dev`）下，不会写入系统文件关联。
- 需要在打包安装后生效（`src-tauri/tauri.conf.json` 已配置 `md`、`markdown`、`txt`）。
- 生效后可直接通过系统双击打开文档，Typist 会自动载入文件。

## 常用快捷键（节选）

- Ctrl+O：打开文件
- Ctrl+Shift+N：新建窗口
- Ctrl+S：保存
- Ctrl+Shift+S：另存为
- Ctrl+W：关闭标签
- Ctrl+F / Ctrl+H：查找 / 替换
- Ctrl+/：切换源码模式

## 开发状态

详见 [docs/PRD.md](docs/PRD.md)。
插件构建说明见 [docs/PLUGIN_BUILD.md](docs/PLUGIN_BUILD.md)。

当前里程碑聚焦：
- 完善跨平台体验与稳定性验证。
- 持续完善第三方插件权限强校验与安全治理。

## 贡献指南

欢迎通过 Issue / PR 参与共建。

建议流程：
1. Fork 仓库并创建特性分支。
2. 提交清晰的 commit 信息。
3. 在 PR 中附上变更说明与验证结果。
4. 涉及 UI 变更时附截图或录屏。

## Roadmap（短期）

- 性能基准与自动化验收（启动、内存、加载、滚动）
- 插件权限强校验与来源签名
- 跨平台适配（macOS / Linux）

## License

MIT License，详见 [LICENSE](LICENSE)。
