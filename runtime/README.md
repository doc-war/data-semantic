# data-semantic

> **data-semantic · HTML 原生的语义插座协议**

主张数据建模驱动、通过语义化的数据声明，让 UI 设计的数据结构与数据获取逻辑彻底解耦。纯 HTML、零 JS 侵入，为 AI 生成代码而生。

AI 原生的 HTML 语义插座协议运行时。

纯 HTML 声明式绑定、零 JS 侵入，让 UI 结构与数据获取逻辑彻底解耦。

## 模板 + 数据 = 翻译结果

**模板** — 在 HTML 中声明语义槽位：

```html
<h1 data-semantic="page.title"></h1>
<ul data-semantic-list="page.chapters">
  <li>
    <span data-semantic=".name"></span>
    <a data-semantic-href=".url">链接</a>
  </li>
</ul>
```

**数据** — 用相同的 key 提供数据：

```json
{
  "page": {
    "title": "Hello World",
    "chapters": [
      { "name": "第一章", "url": "/ch1" },
      { "name": "第二章", "url": "/ch2" }
    ]
  }
}
```

**翻译结果** — runtime 自动渲染：

```html
<h1 data-semantic="page.title">Hello World</h1>
<ul data-semantic-list="page.chapters">
  <li>
    <span data-semantic=".name">第一章</span>
    <a data-semantic-href=".url" href="/ch1">链接</a>
  </li>
  <li>
    <span data-semantic=".name">第二章</span>
    <a data-semantic-href=".url" href="/ch2">链接</a>
  </li>
</ul>
```

## 快速上手

### CDN

```html
<script src="https://unpkg.com/data-semantic/dist/runtime.umd.js"></script>
<script>
  DataSemantic.render({ page: { title: 'Hello World' } });
</script>
```

### npm

```bash
npm install data-semantic
```

```js
import DataSemantic from 'data-semantic';

DataSemantic.render(data);
```

## API

### `DataSemantic.render(data)`

细粒度增量渲染：

- 首次调用：自动建立槽位索引并渲染
- 后续调用：纯增量深合并，只渲染本次传入数据涉及的槽位
- 删除字段：显式传 `undefined` 或 `null` 清空对应槽位
- 结构变化：MutationObserver 自动检测并重建索引

### `DataSemantic.destroy()`

销毁实例，释放索引与数据（用于 SPA 卸载 / 组件销毁）。

### `new DataSemanticRuntime(options)`

创建局部作用域实例：

```js
import { DataSemanticRuntime } from 'data-semantic';

const runtime = new DataSemanticRuntime({
  root: document.getElementById('app'),  // 渲染作用域
});
runtime.render(data);
```

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| root | HTMLElement \| Document | `document` | 索引与渲染作用域 |
| allowedAttrs | string[] | 协议白名单 | 允许注入的属性 |
| warnOnMissing | boolean | 仅开发环境 | 缺失 key 是否告警 |

## License MIT
