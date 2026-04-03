# Typist 插件构建文档（MVP）

> 更新日期：2026-04-01
> 适用版本：Typist v0.1.x（当前仓库实现）

本文档用于说明：如何为 Typist 构建一个可运行的前端插件产物，并在当前 MVP 架构下完成注册与调试。

## 1. 当前插件运行模型

Typist 当前插件系统分为两层：

1. 后端生命周期管理（Rust）
- 能力：注册、激活、禁用、销毁、事件记录、权限字段检查。
- 相关命令：`register_plugin_cmd`、`register_plugin_from_manifest_path_cmd`、`activate_plugin_cmd`、`disable_plugin_cmd`、`destroy_plugin_cmd`、`emit_plugin_event_cmd`。

2. 前端运行时注入（React）
- 前端会向 `window` 注入全局 `TypistAPI`。
- 外部插件以脚本方式加载后，通过 `TypistAPI` 访问编辑器、UI 插槽、命令注册、后端能力。

## 2. 已实现能力与限制

### 已实现

- 支持插件 manifest 注册与生命周期状态维护。
- 支持插件 UI 插槽挂载（状态栏、工具栏、侧栏）。
- 支持插件注册命令并接入快捷键系统。
- 支持插件通过 `TypistAPI.backend` 调用事件上报与图片粘贴接口。

### 当前限制（请务必关注）

- 外部插件禁用/卸载时会触发 cleanup 协议；若插件未注册 cleanup，DOM 之外副作用（如全局事件监听）仍可能残留。
- 外部插件不会在应用重启后自动重新注入脚本（需要重新走加载流程）。

建议第三方插件在入口处做幂等保护，避免重复注入导致重复事件监听。

## 3. 插件目录与产物约定

建议每个插件按如下结构组织：

```text
my-plugin/
├─ manifest.json
├─ package.json
├─ src/
│  └─ index.ts
└─ dist/
   └─ typist-plugin.iife.js
```

约定：

- `manifest.json` 放插件元信息。
- `dist/typist-plugin.iife.js` 为最终加载脚本。
- `manifest.entry` 指向可被 WebView 直接访问的入口 URL 或文件路径。

## 4. manifest 格式

`manifest.json` 示例：

```json
{
  "id": "dev.typist.plugin.hello",
  "name": "Hello Typist",
  "version": "0.1.1",
  "entry": "file:///E:/plugins/hello/dist/typist-plugin.iife.js",
  "permissions": ["events.emit", "images.paste"],
  "description": "一个用于演示 TypistAPI 的示例插件"
}
```

字段说明：

- `id`：全局唯一插件 ID，推荐反向域名风格。
- `name`：展示名称。
- `version`：插件版本。
- `entry`：脚本入口（当前通过 `<script src="...">` 加载，支持 `http(s)://`、`file://`、相对 manifest 路径）。
- `permissions`：权限声明（后端会基于此做权限校验）。
- `description`：可选描述。

## 5. 最小插件示例

`src/index.ts`：

```ts
(() => {
  const globalKey = '__typist_plugin_hello_loaded__';
  if ((window as any)[globalKey]) return;

  const api = (window as any).TypistAPI;
  if (!api) {
    console.error('[hello-plugin] TypistAPI not found.');
    return;
  }

  (window as any)[globalKey] = true;

  const pluginId = 'dev.typist.plugin.hello';
  const slotId = 'hello-status';

  const HelloBadge = () => api.React.createElement(
    'span',
    { style: { fontSize: '11px', opacity: 0.9 } },
    'Hello Plugin'
  );

  api.ui.registerSlot('status_bar_right', pluginId, slotId, HelloBadge);

  api.commands.registerCommand(
    pluginId,
    'insert-hello',
    '插入 Hello 标记',
    '示例插件',
    () => api.editor.insertTextAtCursor('\n[hello-from-plugin]\n')
  );

  const onResize = () => {
    // sample side-effect
  };
  window.addEventListener('resize', onResize);

  api.lifecycle.registerCleanup(pluginId, () => {
    window.removeEventListener('resize', onResize);
  });

  console.log('[hello-plugin] loaded');
})();
```

关键点：

- 入口文件建议自执行（IIFE），并做“只加载一次”保护。
- 使用 `api.React.createElement`，避免依赖宿主外部 React 打包策略。
- 若存在事件监听，请通过 `api.lifecycle.registerCleanup` 注册清理回调，宿主在禁用/卸载时会触发。

## 6. 使用 Vite 构建插件

### package.json

```json
{
  "name": "typist-plugin-hello",
  "version": "0.1.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vite": "^8.0.1"
  }
}
```

### vite.config.ts

```ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['iife'],
      name: 'TypistPluginHello',
      fileName: () => 'typist-plugin.iife.js'
    },
    target: 'es2020',
    sourcemap: true,
    minify: false
  }
});
```

执行构建：

```bash
npm install
npm run build
```

## 7. 在 Typist 中注册与调试（当前 MVP）

当前仓库已经支持“选择 manifest 文件 -> 自动注册 -> 激活 -> 注入脚本”的面板流程。

建议调试流程：

1. 启动 Typist 开发环境（`npm run tauri:dev`）。
2. 打开设置中的 Plugins 面板，点击 Load Plugin 并选择 `manifest.json`。
3. 插件会自动完成注册与激活，并注入 `manifest.entry` 对应脚本。
4. 若要验证状态，检查 External Plugins 卡片是否出现并显示为启用。

如需通过代码手动注册（调试场景）：

```ts
import { api } from '../api';
import manifest from './manifest.json';

await api.registerPlugin({
  manifest,
  installed_path: 'E:/plugins/hello'
});
```

## 8. TypistAPI（MVP）速查

- `TypistAPI.getActiveFile()`：获取当前文件路径与内容。
- `TypistAPI.editor.getContent()`：获取编辑器内容。
- `TypistAPI.editor.setContent(content)`：设置编辑器内容。
- `TypistAPI.editor.insertTextAtCursor(text)`：在光标插入文本。
- `TypistAPI.ui.registerSlot(position, pluginId, id, component)`：注册 UI 插槽组件。
- `TypistAPI.ui.unregisterSlot(position, pluginId, id)`：注销 UI 插槽组件。
- `TypistAPI.commands.registerCommand(pluginId, commandKey, label, category, handler)`：注册命令。
- `TypistAPI.commands.unregisterCommands(pluginId)`：注销插件命令。
- `TypistAPI.lifecycle.registerCleanup(pluginId, cleanup)`：注册插件清理回调。
- `TypistAPI.lifecycle.runCleanup(pluginId)`：手动触发指定插件清理。
- `TypistAPI.backend.emitEvent(pluginId, event, payload)`：上报插件事件。
- `TypistAPI.backend.pasteImage(base64Data, mimeType)`：调用宿主图片落盘能力。

## 9. 后续演进建议

- 推动第三方插件接入 cleanup 协议并补齐自动化回归测试。
- 增加插件签名和来源校验，降低加载风险。
- 提供官方插件脚手架命令，统一 manifest 与构建模板。
