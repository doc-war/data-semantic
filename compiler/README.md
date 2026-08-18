# data-semantic-compiler

> **data-semantic · HTML 原生的语义插座协议**

主张数据建模驱动、通过语义化的数据声明，让 UI 设计的数据结构与数据获取逻辑彻底解耦。纯 HTML、零 JS 侵入，为 AI 生成代码而生。

data-semantic 模板的静态编译器、校验器与检视器。

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

**翻译结果** — 编译器静态展开：

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

```bash
npm install data-semantic-compiler
```

### CLI

```bash
# 编译：模板 + 数据 → 最终 HTML
data-semantic build -t template.html -d data.json -o out.html

# 校验：检查协议合规性 + 数据完整性
data-semantic check -t template.html -d data.json

# 检视：输出语义结构 JSON（供 AI / 工具使用）
data-semantic inspect -t template.html
```

### 编程 API

```js
import { compile, check, inspect } from 'data-semantic-compiler';

const html = compile(template, data);       // 静态展开，返回 HTML 字符串
const report = check(template, data);        // { valid, errors, warnings }
const nodes = inspect(template);             // [{ tag, key, type, selector }]
```

## License MIT
