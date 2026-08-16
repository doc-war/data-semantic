# data-semantic

为 AI 时代设计的 **UI 文本渲染协议 & 实现框架** —— 纯 HTML 声明式绑定、零 JS 侵入，将 UI 结构与页面数据的获取/处理逻辑解耦。

```html
<div data-semantic="hello"></div>
```

```js
DataSemantic.render({ hello: '你好，世界' });
```

```html
<div data-semantic="hello">你好，世界</div>
```

## 特性

- **纯声明式**：基于 HTML 原生 `data-*` 机制，无需任何 JS 胶水代码
- **事件驱动响应式**：`DataSemantic.render(data)` 即数据变更事件——数据一变、UI 即同步；无需状态管理、无生命周期、零样板
- **零侵入**：渲染后 `data-semantic` 属性依然保留，页面同时保留数据语义
- **批量渲染**：`render()` 自动批量更新所有绑定节点
- **细粒度增量**：`render()` 只渲染本次传入数据涉及的槽位，未涉及的槽位不受影响
- **AI 流式友好**：支持小块数据高频注入（如流式输出），无需每次传全量数据
- **结构自愈**：MutationObserver 自动监听结构变化（增删绑定节点），增量重建索引
- **语义声明**：加载时自动注入 `data-semantic` 协议 meta，向三方平台声明语义
- **环境自适应**：浏览器 / jsdom / Node 均可运行，支持全局单例与多实例

## 响应式模型：render 即数据变更事件

主流框架的响应式本质都是「数据变更 → 视图更新」，区别只在于**数据变更事件**的入口：

| 框架 | 数据变更事件 | 响应式原理 |
| --- | --- | --- |
| React | `setState(data)` | 虚拟 DOM diff |
| Vue | 修改 `reactive()` 数据（Proxy set） | 依赖追踪 + 渲染器 |
| **data-semantic** | **`DataSemantic.render(data)`** | **槽位索引 + 细粒度增量** |

data-semantic 以**显式 render 事件**表达数据变更：无论数据来自 AI 输出、API 响应还是用户操作，唯一的动作就是传入新数据。配合声明式绑定，无需状态管理、生命周期或依赖追踪——这是对 AI 生成代码最友好的响应式模型。

## 安装

```bash
npm install data-semantic
```

### 浏览器 `<script>` 引入（UMD / CDN）

```html
<script src="https://unpkg.com/data-semantic/dist/runtime.umd.js"></script>
<script>
  DataSemantic.render({ hello: '你好，世界' });
</script>
```

引入后全局同时暴露两个符号：

- `DataSemantic`：开箱即用的全局单例（绑定 `document`）
- `DataSemanticRuntime`：运行时类，可用于创建作用域实例（如 `new DataSemanticRuntime({ root: ... })`）

### ES Module

```js
import DataSemantic, { DataSemanticRuntime } from 'data-semantic';

DataSemantic.render(data); // 全局单例（绑定 document）

const scoped = new DataSemanticRuntime({ root: document.getElementById('app') });
scoped.render(data);   // 局部实例
```

## API

### `DataSemantic.render(data)`

细粒度增量渲染：

- 首次调用：自动建立槽位索引（缓存全部 data-semantic 绑定）并渲染
- 后续调用：纯增量深合并数据源，只渲染本次传入数据涉及的槽位
- 删除字段：显式传 `undefined`（如 `{ user: { age: undefined } }`）清空对应槽位并告警
- 结构变化：MutationObserver 自动检测并重建索引

### `DataSemantic.destroy()`

销毁实例，释放索引与数据（用于 SPA 卸载 / 组件销毁）。

### `new DataSemanticRuntime(options)`

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `root` | `HTMLElement \| Document` | `document` | 索引与渲染作用域 |
| `allowedAttrs` | `string[]` | 协议白名单 | `data-semantic-{attr}` 允许注入的属性 |
| `warnOnMissing` | `boolean` | 仅开发环境 | 缺失 key / 非法属性是否告警 |

## data-semantic 协议

### 两种声明机制

| 声明 | 对应操作 | 示例 |
| --- | --- | --- |
| `data-semantic={key}` | `Node.textContent` | `<h1 data-semantic="page.title">` |
| `data-semantic-{attr}={key}` | `Element.setAttribute()` | `<input data-semantic-placeholder="form.placeholder">` |

### key 路径

遵循标准 JSON 寻址（Dot Notation），支持嵌套与数组索引：

```html
<p data-semantic="page.title"></p>
<p data-semantic="user.addresses.0.city"></p>
```

### 属性白名单

`data-semantic-{attr}` 中 `{attr}` 必须落在白名单内，否则视为无效绑定并告警。

- **表单与交互**：`placeholder`、`value`、`title`
- **媒体与资源**：`alt`、`src`、`href`
- **无障碍访问**：`aria-label`、`aria-description`
- **SEO 与元数据**：`content`（用于 `<meta>`）
- **自定义桥接**：`data-*`（允许 `data-semantic-data-{name}` 透传到 `data-{name}`）

协议禁止渲染事件处理器、`style`、全局标识符、iframe 等内联脚本相关属性。

## 语义声明（自动注入）

加载时自动向 `<head>` 注入：

```html
<meta name="data-semantic" content="1.0" />
<meta name="semantic-ui" content="protocol=data-semantic; version=1.0; runtime=data-semantic" />
```

## 工程结构

```text
data-semantic/
├── src/
│   ├── index.js         # 入口：导出单例与类，浏览器挂载全局 DataSemantic
│   ├── runtime.js       # 运行时能力：索引构建、细粒度渲染、协议实现
│   ├── utility.js       # 通用逻辑：路径解析、深合并、叶子路径收集
│   └── umd.js           # UMD 构建专用入口
├── test/
│   └── runtime.test.mjs # jsdom 单元测试
├── demo.html            # 核心协议演示（含国际化场景）
├── index.d.ts           # TypeScript 类型声明
├── vite.config.js       # ES 构建配置
├── vite.umd.config.js   # UMD 构建配置
├── package.json
└── 设计.md              # 架构设计文档
```

## 开发命令

```bash
npm run build        # 构建 ES + UMD 产物（dist/runtime.es.js / runtime.umd.js）
npm test             # 运行 jsdom 单元测试
npm run typecheck    # TypeScript 类型检查（tsc --noEmit）
npm run dev          # 启动 Vite 开发服务器
```

### 查看演示（demo.html）

`demo.html` 引用构建产物 `./dist/runtime.umd.js`，**无需静态服务**：

1. 首次使用先执行一次 `npm run build` 生成 `dist/`
2. 直接双击打开 `demo.html` 即可查看（含国际化切换与 AI 流式输出演示）

若未构建 `dist/`，页面会显示提示而非报错。

## 后续规划

- `src/compiler.js`：编译时能力（扫描 HTML 提取 key 清单、校验数据源完整性）

## License

MIT
