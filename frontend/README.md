# Typist Frontend

Typist 前端应用，基于 React + TypeScript + Vite，负责编辑器 UI、状态管理、插件宿主桥接与 Tauri 前端调用。

## 技术栈

- React 19
- TypeScript
- Vite
- Zustand（状态管理）
- Milkdown / ProseMirror（WYSIWYG 编辑能力）

## 常用命令

在当前目录执行：

```bash
npm install
npm run dev
npm run build
npm run lint
```

在仓库根目录执行等价命令：

```bash
npm --prefix frontend install
npm --prefix frontend run dev
npm --prefix frontend run build
```

## 目录说明

- `src/components`: 主要界面组件（编辑器、侧边栏、设置、插件、导出等）
- `src/store`: Zustand 全局状态（切片化）
- `src/api`: Tauri invoke API 封装
- `src/sdk`: 插件 SDK 与沙箱桥接
- `src/workers`: Web Worker（插件沙箱）
- `src/i18n`: 国际化文案

## 与后端协作

- 前端通过 `src/api/index.ts` 调用 Tauri 命令。
- Rust 侧命令注册位于 `src-tauri/src/lib.rs`，业务实现位于 `backend/src`。
- 若新增前端调用，请同步更新：
  - 前端 API 类型与 invoke 封装
  - 后端命令暴露与注册

## 注意事项

- 导出中除 HTML 外的格式依赖 Pandoc（由后端调用）。
- 插件外部代码通过 Worker 沙箱运行，不应回退为主线程脚本注入。
- 大文档场景下，编辑器会自动走更稳态的源码路径以降低性能压力。
