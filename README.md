# Typist

一个基于 Tauri + React + Rust 的本地 Markdown 编辑器，目标是提供 Typora 级 WYSIWYG 写作体验，同时保留 Obsidian 风格的插件扩展能力。

> 当前定位：Windows 平台 MVP，后续规划 macOS / Linux。

## 项目亮点

- 低资源占用：Tauri + Rust 后端，面向轻量桌面应用。
- WYSIWYG + 源码双模式：支持在富文本编辑与纯文本源码间快捷切换（Ctrl+/）。
- 常用 Markdown 增强：GFM、代码高亮、Mermaid、KaTeX。
- 本地优先：文件打开/保存、最近文件、多标签、工作区文件树。
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
  - 最近文件
  - 工作区文件树与全局搜索
  - 导出 HTML / PDF
  - 崩溃恢复与更新检查
- 可定制能力
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

## 常用快捷键（节选）

- Ctrl+O：打开文件
- Ctrl+S：保存
- Ctrl+Shift+S：另存为
- Ctrl+W：关闭标签
- Ctrl+F / Ctrl+H：查找 / 替换
- Ctrl+/：切换源码模式

## 开发状态

详见 [docs/PRD.md](docs/PRD.md)。

当前里程碑聚焦：
- 完成 MVP 交互闭环与体验打磨。
- 持续完善插件开发文档与第三方扩展生态。

## 贡献指南

欢迎通过 Issue / PR 参与共建。

建议流程：
1. Fork 仓库并创建特性分支。
2. 提交清晰的 commit 信息。
3. 在 PR 中附上变更说明与验证结果。
4. 涉及 UI 变更时附截图或录屏。

## Roadmap（短期）

- 自动保存调度策略完善
- 插件开发文档补齐
- 多窗口与跨平台适配

## License

MIT License，详见 [LICENSE](LICENSE)。
