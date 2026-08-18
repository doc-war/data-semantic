# data-semantic

data-semantic首先是一个html语义插座协议，其次才是runtime和compiler实现。
—— AI原生设计，语义优先
—— 纯 HTML 声明式绑定、零 JS 侵入。

## 极简开发体验

data-semantic的核心技术原理，是基于html原生`data-*`机制，预声明语义化的数据槽位，通过runtime或compiler翻译，从而实现UI结构与页面数据的获取/处理逻辑彻底解耦

#### 1、声明数据

声明一个key为hello的数据要求、以Node.textContent方式绑定。

```html
<div data-semantic="hello"></div>
```

#### 2、渲染数据

渲染数据时，页面须先引入运行时。

```html
<script src="https://unpkg.com/data-semantic/dist/runtime.umd.js"></script> 
```

现在，我们在业务逻辑中，调用渲染方法来实现数据渲染。

```html
<script>
    const data = {
        hello:"你好，世界"   //在结构化数据中，用相同的key提供数据
    }
    DataSemantic.render(data)  //框架会自动将数据渲染到每一个key的对应位置
</script> 
```

#### 3、渲染结果

```html
<div data-semantic="hello">你好，世界</div>
```

## 范式特性

#### 声明式体验

基于 HTML 原生 `data-*` 机制，有几个关键优势：

- ✅ HTML中**声明式**绑定，一看就知道哪些地方需要数据。由于是html标准，不依赖任何运行环境，就可以直接双击模板html文件，肉眼测试UI的结构和样式
- ✅ runtime**自动渲染**，无需任何 JS 胶水代码
- ✅ 数据和视图**解耦**，UI结构由AI或设计师维护，数据由开发者或CMS提供

#### 语义优先

由于data-semantic属性在渲染后依然存在，实际上同时为页面自动保留了语义，这一点在AI时代将成为一个核心优势，你可以使用诸如：

* `data-semantic="page.title"`、
* `data-semantic="project.name"`、
* `data-semantic="project.create_time"`、
* `data-semantic-alt="流程图"`

之类的形式来清晰声明数据的语义。这为SEO、GEO分析提供了一种更理想的自动化模型，为三方平台提供侧载语义分析服务提供了可能。

#### 生成式模型

主流前端框架的响应式本质都是「数据变更 → 视图更新」，区别只在于**数据变更事件**的入口：

| 框架              | 数据变更事件                        | 响应式原理            |
| ----------------- | ----------------------------------- | --------------------- |
| React             | `setState(data)`                    | 虚拟 DOM diff         |
| Vue               | 修改 `reactive()` 数据（Proxy set） | 依赖追踪 + 渲染器     |
| **data-semantic** | **`DataSemantic.render(data)`**     | 槽位索引 + 细粒度增量 |

data-semantic 以**显式 render 事件**表达数据变更：

AI无需关心任何复杂的语法，基于schema语义构造UI、数据、渲染逻辑——这是对 AI 生成代码最友好的生成式模型。

#### AI流式友好

data-semantic框架本身不存在全量更新和局部更新的说法，因为要更新的范围完全由开发者决定，`render()` 内部会自动缓存所有槽位，自动计算渲染范围，从而实现细粒度的增量更新。

这种特性，天然契合LLM的流式输出，可以支持将未完的json切成小块数据的高频注入。

## data-semantic框架

#### 使用方式

支持umd和esm两种方式

##### `<script>` 加载

```html
<script src="https://unpkg.com/data-semantic/dist/runtime.umd.js"></script>
<script>
  DataSemantic.render({ hello: '你好，世界' });
</script>
```

##### ES导入

安装依赖

```bash
npm install data-semantic            # 运行时
npm install data-semantic-compiler   # 编译器（可选）
```

导入后全局同时暴露两个符号：

- `DataSemantic`：开箱即用的全局单例（绑定 `document`）
- `DataSemanticRuntime`：运行时类，可用于创建作用域实例（如 `new DataSemanticRuntime({ root: ... })`）

```js
import DataSemantic, { DataSemanticRuntime } from 'data-semantic';

DataSemantic.render(data); // 全局单例（绑定 document）

const scoped = new DataSemanticRuntime({ root: document.getElementById('app') });
scoped.render(data);   // 局部实例
```

#### API

##### `DataSemantic.render(data)`

细粒度增量渲染：

- 首次调用：自动建立槽位索引（缓存全部 data-semantic 绑定）并渲染
- 后续调用：纯增量深合并数据源，只渲染本次传入数据涉及的槽位
- 删除字段 / 置空：显式传 `undefined` 或 `null`（如 `{ user: { age: undefined } }`）清空对应槽位并告警
- 结构变化：MutationObserver 自动检测并重建索引，已存在的数据自动补渲染到新插入的绑定节点

##### `DataSemantic.destroy()`

销毁实例，释放索引与数据（用于 SPA 卸载 / 组件销毁）。

#### 编译器

`data-semantic-compiler` 提供静态模板分析和编译能力：

```bash
# 编译：HTML + Data → 最终 HTML
data-semantic build -t template.html -d data.json -o out.html

# 校验：检查协议合规性 + 数据完整性
data-semantic check -t template.html -d data.json

# 检视：输出语义结构 JSON（供 AI / 工具使用）
data-semantic inspect -t template.html
```

编程接口：

```js
import { compile, check, inspect } from 'data-semantic-compiler';

const html = compile(template, data);         // 静态展开
const report = check(template, data);          // { valid, errors, warnings }
const nodes = inspect(template);               // [{ tag, key, type, selector }]
```

##### 编译器保留语义属性

编译输出**默认保留**所有 `data-semantic` 相关属性（`data-semantic`、`data-semantic-list`、`data-semantic-display`、`data-semantic-{attr}`）。编译是数据求值，不是语义擦除。

如需移除，使用 `--remove-data-attrs` 标志：

```bash
data-semantic build -t template.html -d data.json -o out.html --remove-data-attrs
```

##### check() 校验规则

`check()` 执行以下校验：

- 属性白名单检查（`data-semantic-{attr}` 中 `{attr}` 必须在白名单内）
- 非标量值绑定检查（绑定到对象/数组的键报 violation）
- **iframe src URL 校验**：仅允许 `https:`、`http:`、`//` 协议，禁止 `javascript:`/`data:`/`vbscript:`
- **相对键上下文检查**：`data-semantic=".xxx"` 只能在 `data-semantic-list` 容器内使用

##### `new DataSemanticRuntime(options)`

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| root | HTMLElement \| Document | `document` | 索引与渲染作用域 |
| allowedAttrs | string[] | 协议白名单 | `data-semantic-{attr}` 允许注入的属性 |
| warnOnMissing | boolean | 仅开发环境 | 缺失 key / 非法属性是否告警 |

## data-semantic 协议要点

#### 声明方式

当前支持三种基础的正交语义声明需求：填什么内容、填到哪里、要不要显示。

| 声明 | 对应操作 | 示例 |
| --- | --- | --- |
| data-semantic={key} | Node.textContent | `<h1 data-semantic="page.title">` |
| data-semantic-{attr}={key} | Element.setAttribute() | `<input data-semantic-placeholder="form.placeholder">` |
| data-semantic-display={key} | Element.style.display | `<h1 data-semantic-display="user.isVip">` |

#### 渲染规范

协议禁止渲染事件处理器、`style`（唯一例外：`data-semantic-display` 仅允许控制 `Element.style.display`）、全局标识符、iframe 等内联脚本相关属性。`data-semantic-{attr}` 中 `{attr}` 必须落在白名单内，否则视为无效绑定并告警。

##### 1. `data-semantic`（基础文本内容）

绑定 `Node.textContent`，用于普通文本展示。

```html
<h1 data-semantic="user.name">默认姓名</h1>
<p data-semantic="user.title">默认职位</p>

<script src="https://unpkg.com/data-semantic/dist/runtime.umd.js"></script>
<script>
    const data = { user: { name: "张三", title: "高级前端工程师" } };
    DataSemantic.render(data);
    // 渲染后：
    // <h1 data-semantic="user.name">张三</h1>
</script>
```

##### 2. `data-semantic-placeholder`（输入框占位符）

绑定 `placeholder` 属性，适用于 `<input>`、`<textarea>`。

```html
<input data-semantic-placeholder="user.placeholder" placeholder="默认占位文本" />

<script>
  const data = { user: { placeholder: "请输入搜索关键词" } };
  DataSemantic.render(data);
  // 渲染后：
  // <input data-semantic-placeholder="user.placeholder" placeholder="请输入搜索关键词" />
</script>
```

##### 3. `data-semantic-value`（表单默认值）

绑定 `value` 属性，用于单向设置表单控件的初始值（**注意**：不参与双向绑定，仅用于初始渲染）。

```html
<input type="text" data-semantic-value="user.defaultValue" value="旧值" />

<script>
  const data = { user: { defaultValue: "初始值" } };
  DataSemantic.render(data);
  // 渲染后：
  // <input type="text" data-semantic-value="user.defaultValue" value="初始值" />
</script>
```

##### 4. `data-semantic-title`（鼠标悬停提示）

绑定 `title` 属性，为任意元素添加原生悬浮提示。

```html
<button data-semantic-title="user.bio" title="默认提示">悬停查看</button>

<script>
  const data = { user: { bio: "专注AI与UI融合" } };
  DataSemantic.render(data);
  // 渲染后：
  // <button data-semantic-title="user.bio" title="专注AI与UI融合">悬停查看</button>
</script>
```

##### 5. `data-semantic-alt`（图片无障碍替代文本）

绑定 `alt` 属性，用于 `<img>` 等媒体元素，提升 SEO 和无障碍访问。

html

```html
<img data-semantic-alt="user.name" alt="默认头像" src="https://i.pravatar.cc/150?img=11" />

<script>
  const data = { user: { name: "张三" } };
  DataSemantic.render(data);
  // 渲染后：
  // <img data-semantic-alt="user.name" alt="张三" src="https://i.pravatar.cc/150?img=11" />
</script>
```

##### 6. `data-semantic-src`（动态资源链接）

绑定 `src` 属性，用于 `<img>`、`<video>`、`<audio>`、`<iframe>` 等。

```html
<img data-semantic-src="user.avatar" src="default.jpg" />

<script>
  const data = { user: { avatar: "https://i.pravatar.cc/150?img=11" } };
  DataSemantic.render(data);
  // 渲染后：
  // <img data-semantic-src="user.avatar" src="https://i.pravatar.cc/150?img=11" />
</script>
```

##### 7. `data-semantic-href`（动态链接地址）

绑定 `href` 属性，用于 `<a>` 标签动态生成跳转链接。

```html
<a data-semantic-href="user.profileLink" href="#">查看个人主页</a>

<script>
  const data = { user: { profileLink: "/profile/zhangsan" } };
  DataSemantic.render(data);
  // 渲染后：
  // <a data-semantic-href="user.profileLink" href="/profile/zhangsan">查看个人主页</a>
</script>
```

##### 8. `data-semantic-aria-label`（无障碍标签）

绑定 `aria-label` 属性，为无文本交互元素提供屏幕阅读器标签。

```html
<button data-semantic-aria-label="user.name" aria-label="默认用户">
  <svg><!-- 纯图标按钮 --></svg>
</button>

<script>
  const data = { user: { name: "张三" } };
  DataSemantic.render(data);
  // 渲染后：
  // <button data-semantic-aria-label="user.name" aria-label="张三">...</button>
</script>
```

##### 9. `data-semantic-aria-description`（无障碍详细描述）

绑定 `aria-description` 属性，为复杂组件提供额外描述。

```html
<div role="tooltip" data-semantic-aria-description="user.bio" aria-description="默认描述">
  悬停查看详情
</div>

<script>
  const data = { user: { bio: "专注AI与UI融合" } };
  DataSemantic.render(data);
  // 渲染后：
  // <div role="tooltip" data-semantic-aria-description="user.bio" aria-description="专注AI与UI融合">悬停查看详情</div>
</script>
```

##### 10. `data-semantic-content`（元数据动态内容）

绑定 `content` 属性，专用于 `<meta>` 标签，动态设置页面描述或关键词。

```html
<meta name="description" data-semantic-content="user.metaDesc" content="默认描述" />

<script>
  const data = { user: { metaDesc: "Data-Semantic 完整属性范例页面，展示所有白名单属性" } };
  DataSemantic.render(data);
  // 渲染后：
  // <meta name="description" data-semantic-content="user.metaDesc" content="Data-Semantic 完整属性范例页面，展示所有白名单属性" />
</script>
```

##### 11. `data-semantic-data-*`（自定义 data 属性透传）

允许通过 `data-semantic-data-*` 将数据渲染到任意 `data-*` 自定义属性，格式为 `data-semantic-data-<自定义名>`。

```html
<div data-semantic-data-user-id="user.id" data-user-id="默认ID">用户卡片</div>

<script>
  const data = { user: { id: "12345" } };
  DataSemantic.render(data);
  // 渲染后：
  // <div data-semantic-data-user-id="user.id" data-user-id="12345">用户卡片</div>
</script>
```

##### 12. `data-semantic-display`（是否可见）

绑定 `Element.style.display`，用于根据数据状态控制元素的可见性。

```html
<p data-semantic-display="user.isVip">VIP 专属内容</p>

<script>
    const data = {
        user: { isVip: false }
    };
    DataSemantic.render(data);
    // 渲染后：
    // <p data-semantic-display="user.isVip" style="display:none">VIP 专属内容</p>
</script>
```

渲染规则

| **数据值** | 语义 | **行为** |
| :--- | :--- | :--- |
| 布尔值 `true` | 显示 | `style.display = ''` |
| 布尔值 `false` | 隐藏 | `style.display = 'none'` |
| 逻辑假值（`""`、`0`、`null`、`undefined`、`"false"`） | 隐藏 | `style.display = 'none'` |
| 其他真值字符串（如 `"flex"`、`"grid"`） | 显示 | `style.display = ''` |

##### 13. `data-semantic-list`（列表容器）

声明列表容器，其 innerHTML 为列表项模板。渲染时对数组做 n 次实例化，替换容器内容。容器内的相对 key（以 `.` 开头）自动解析为 `{listKey}[i].xxx`。

```html
<div data-semantic-list="posts">
  <article>
    <h2 data-semantic=".title"></h2>
    <span data-semantic=".author"></span>
  </article>
</div>

<script>
  const data = {
    posts: [
      { title: "AI 入门", author: "Alice" },
      { title: "Vue 进阶", author: "Bob" }
    ]
  };
  DataSemantic.render(data);
  // 渲染后容器内有两个 <article>
</script>
```

###### 标量数组

当列表项为标量（字符串、数字）时，使用纯点号 `.` 引用当前元素：

```html
<div data-semantic-list="tags">
  <span data-semantic="."></span>
</div>

<script>
  const data = { tags: ["AI", "Web", "Design"] };
  DataSemantic.render(data);
  // 渲染后容器内有三个 <span>：AI、Web、Design
</script>
```

###### 翻译模式

列表容器采用**全量翻译**：每次渲染都基于当前数组完整重建列表内容。如果此前有 2 项，下次只传入 1 项，整个 list 会重新渲染为 1 项。

叶子节点采用**增量翻译**：只变动当次传入数据命中的范围，未命中部分保持不变。

#### key 路径

UI侧声明的槽位值，对应的是数据侧的key路径。

##### 语义化命名

为了面向开放语义分析，槽位命名应该尽可能遵循语义化表示，尽可能避免纯id式的申明

```html
<p data-semantic="abcd123"></p>
<div data-semantic="ccabdd3c-f196-4c1f-935b-c32bc53fa162"></div>
```

##### json寻址

槽位命名应该遵循标准 JSON 寻址规范（Dot Notation），支持嵌套与数组索引：

```html
<p data-semantic="page.title"></p>
```

##### 相对寻址

以 `.` 开头，在 list 容器内相对当前列表项寻址：

```html
<div data-semantic-list="posts">
  <h2 data-semantic=".title"></h2>     <!-- posts[i].title -->
  <span data-semantic=".author"></span> <!-- posts[i].author -->
</div>
```

相对键**只能在** `data-semantic-list` 容器内使用。非 list 上下文中使用 `.` 开头的键是协议违规，运行时会忽略并告警。

##### 方括号寻址

方括号内**必须是数值**，仅用于数组索引：

```html
<p data-semantic="pages.list[0].name"></p>
```

等价于点号写法 `pages.list.0.name`。方括号内不支持字符串 key 或表达式。

相应的，也会引入数据规范约束：数据侧的key不应该包含 `.`，因为会与路径分隔符冲突，造成寻址问题。

#### 数据边界

数组场景遵循以下明确边界，避免对框架行为的误解：

##### 1、 render() 必须传入纯 JSON 对象

`render(data)` 的 `data` 必须是纯 JSON 对象（Plain Object），不能是数组、Date 或其他 JS 对象。根数组被明确禁止。

##### 2、 数组必须整体传入

对于数组，`deepMerge`不会递归合并 ，而是直接整体替换，因此每次传入数组都必须是完整数组：

比如数组有两个值，你需要更新第二个。

* ✅ 正确方式

```js
render({ pages: { list: ['a', 'b'] } });
```

* ❌ 错误方式

```js
render({ pages: { list: [undefined, 'x'] } });
```

##### 3、key必须是标量

* ✅ 正确方式

```html
<div data-semantic="pages.list.0.name"></div>
```

* ❌ 错误方式

```html
<div data-semantic="pages.list"></div>
```

绑定到对象/数组的槽位会被跳过（不渲染、开发环境告警）。

#### 语义声明

加载时运行时会自动向页面 `<head>` 注入语义协议信息，向三方开放声明本页面遵循data-semantic协议规定的语义化声明：

```html
<meta name="data-semantic" content="1.0" />
```

## 查看演示（demo.html）

直接双击`demo.html` ，可以查看渲染示例和演示范例

## License

MIT
