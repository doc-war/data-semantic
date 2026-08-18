# Data-Semantic 协议规范 v1.0

本规范是 data-semantic 的权威协议规范。运行时（Runtime）和编译器（Compiler）在处理相同的 HTML + 数据时，必须产生完全一致的渲染结果。一致性由本规范及一致性测试（Conformance tests）保证。

## 一、基本概念

data-semantic的核心是基于html原生的`data-*`规范实现数据语义和槽位声明。对照示例来解释基础概念。

#### 声明

```html
<h1 data-semantic="page.title"></h1>
<div data-semantic-list="page.chapters">
    <div>
        <p data-semantic=".name"></p>
        <a data-semantic-href=".url"></a>        
    </div>
</div>
```

#### 属性

此示例中的`data-semantic`、`data-semantic-list`、`data-semantic-href`，都是合法的html自定义属性，代表不同的声明语义，即决定了要渲染到哪里，怎么渲染。

#### Key

此示例中的属性值`page.title`、`page.chapters`、`.url`、`.name`，决定要渲染什么内容，什么语义，怎么寻址：

* 其值本身，代表一个语义槽位
* 对于UI侧，代表一个需要渲染的数据槽位，要从数据侧去取，除了list语义外，其余都是标量值
* 对于数据侧，代表一个索引槽位，对应于json中的`key路径`，用于定位到要渲染的数据值。

#### 数据

需要渲染的数据，要求以json形式从外部传入。数据Schema需要和Key保持对应，才能被正确渲染或编译。

```json
{
    page:{
        title:"Data-Semantic 协议规范 v1.0"
        chapters:[
        	{
				name:"基本概念",
        		url:"https://x.com"
            },
    		{
				name:"协议原文",
    			url:"https://y.com"
            }
        ]
    }
}
```

#### 翻译

运行时（Runtime）和编译器（Compiler）负责进行dom翻译。

```html
<h1 data-semantic="page.title">Data-Semantic 协议规范 v1.0</h1>
<div data-semantic-list="page.chapters">
    <div>
        <p data-semantic=".name">基本概念</p>
        <a data-semantic-href=".url">https://x.com</a>        
    </div>
        <div>
        <p data-semantic=".name">协议原文</p>
        <a data-semantic-href=".url">https://y.com</a>        
    </div>
</div>
```

实际的翻译范围，取决于传入的数据及寻址命中量，列表容器节点和普通叶子节点的规则有所不同。



## 二、Key命名和解析

Key代表了一个索引槽位，有一套命名和解析边界。

### 解析语义

解析规范，即涉及寻址语法语义，还涉及了上下文规则。

#### 寻址方式

UI侧声明的key，在数据侧采用标准的 JavaScript 对象/数组寻址方式：

1. **点表示法**：`page.chapters` 和 `.name`
   用于访问对象中已知的、合法的属性名。
2. **方括号表示法**：`[0]`
   用于访问数组中指定索引的元素（方括号内部必须是数值）

#### 绝对寻址

```yaml
data-semantic="page.title"
data-semantic="page.chapters[0].name"
```

从数据根节点开始解析，`page.title`实际上相当于`dataRoot.page.title`

#### 相对寻址

```yaml
data-semantic=".name"
data-semantic="[0].name"
data-semantic="."
```

严格规定：

* 相对寻址必须以 `.` 或 `[` 开头
* 其相对的上下文必须是某个数组，即由上层`data-semantic-list`提供，比如`data-semantic-list="page.chapters"`，则`.name`相当于`page.chapters[i].name`，而`[0].name`相当于指定`page.chapters[0].name`
* 对于["a","b"]这样的标量数组，直接使用纯点号声明
* 为了避免了上下文栈管理过深，不利于AI识别的语义准确度指标，协议明确规定，只有`data-semantic-list`可以提供相对上下文语义，嵌套对象禁止使用相对寻址。

| **位置**             | **上下文语义**          |
| -------------------- | ----------------------- |
| 根层级（无列表祖先） | 数据根节点（Data root） |
| 列表项内部           | `{listKey}[i]`          |
| 嵌套列表项内部       | 最内层的 `{listKey}[i]` |

#### 翻译边界

在实际开发中，如果js对象链条中**任何一个环节**是 `undefined` 或 `null`，按照js语法就会直接报错（例如 `TypeError: Cannot read properties of undefined`）。但协议规定翻译过程是增量方式，可多次翻译，这意味着允许只传入部分数据，这涉及了容错规则。

比如完整的数据是这样

```json
{
    page:{
        title:"Data-Semantic 协议规范 v1.0"
        chapters:[
        	{
				name:"基本概念",
        		url:"https://x.com"
            },
    		{
				name:"协议原文",
    			url:"https://y.com"
            }
        ]
    }
}
```

但流式翻译时可能会这样。

先传入

```json
{
    page:{
        title:"Data-Semantic 协议规范 v1.0"
}
```

再传入

```json
{
    page:{
        chapters:[
        	{
				name:"基本概念",
        		url:"https://x.com"
            },
    		{
				name:"协议原文",
    			url:"https://y.com"
            }
        ]
}
```

很显然，第一次传入触发渲染或编译时，page.chapters是寻址不到数据的，不应该报错。

因此，runtime和compiler需要进行可选链操作符的容错处理：

* 每一级寻址都默认自带`?.`效果，只有非`undefined` 和`null`，才执行翻译，否则保持现状
* 比如UI声明侧的key为`page.chapters.[0].name`，在解析数据时，实际使用的是`page?.chapters?.[0]?.name`
* 如果属性存在但类型不匹配，可选链 `?.` 也无能为力，依然会正常报错。

### 命名规范

解析语义反向约束数据建模时的字段命名规范。

#### 寻址key命名

UI侧声明的寻址key，最终只允许base64URL字符集+`.`、`[`、`]`三个符号的组合。如果一个Key不符合此规则，翻译时做忽略、警告处理。

#### 字段Key命名

json数据侧的字段key，要求只能采用base64URL字符集，避免特殊符号，严格禁止`.`、`[`、`]`、`?`四个符号，以避免解析冲突。

示例

```json
{
    "a—a_b":"这是正确的字段命名方式✅",
    "aa.b[":"这是错误的字段命令方式❌，包含了三个特殊符号",
    "aa.$":"这是应该避免的字段命令方式❌，美元符号虽然不影响寻址解析，但应该避免",
    "aa.?":"这是错误的字段命令方式❌，会跟默认自带的可选链带来可能的冲突边界"
}
```

## 三、声明和翻译规则

### 通用原则

#### 正交组合

目前支持四大类的语义声明方式（`内容绑定`、`属性绑定`、`可见性绑定`、`列表容器`），这四种方式属于正交设计，可以通过组合来实现结构和节点级的翻译能力。

| 声明                        | 对应操作                                 |
| --------------------------- | ---------------------------------------- |
| data-semantic={key}         | Node.textContent                         |
| data-semantic-{attr}={key}  | Element.setAttribute()                   |
| data-semantic-display={key} | Element.style.display                    |
| data-semantic-list={key}    | 列表容器（innerHTML 为模板，n 次实例化） |

单个元素可以包含多个相互独立的声明：

```html
<a
  data-semantic="linkText"
  data-semantic-href="linkUrl"
  data-semantic-title="linkTooltip"
  data-semantic-display="showLink"
>
</a>
```

#### 属性透传规则

任何非 `data-semantic` 或非 `data-semantic-*` 的属性，都将按原样透传至渲染输出中，这与语义协议相互独立，不参与键解析。

示例

```html
<span data-semantic-data-role="user.role"></span>
<span data-semantic-role="user.role"></span>
<span semantic-role="user.role"></span>
```

`data-semantic-data-role`满足协议规范，在白名单以内，需要执行语义翻译。但`data-semantic-role`、`semantic-role`均是协议未定义的声明方式，透传不做任何处置。

#### 翻译模式

实际的翻译范围，取决于传入的数据及寻址命中量，列表容器节点和普通叶子节点的规则有所不同：

* 对于叶子节点，采用增量翻译，只变动当次传入数据命中的范围，未命中部分保持不变
* 对于list容器节点，采用全量翻译，如果列表此前有2项，下一次渲染时只传入了1项，那么整个list节点会进行重新渲染，只剩下一项。

示例

对于这样一个模板

```html
<div data-semantic-list="answer">
  <p data-semantic="."></p>
</div>
```

第一次渲染

```json

let data={
    answer:["不要回答！","不要回答！","不要回答！"]
}
DataSemantic.render(data)
```

渲染结果

```html
<div data-semantic-list="answer">
  <p data-semantic=".">不要回答！</p>
  <p data-semantic=".">不要回答！</p>
  <p data-semantic=".">不要回答！</p>
</div>
```

第二次渲染

```json
let data={
    answer:["不要回答啊！"]
}
DataSemantic.render(data)
```

渲染结果

```html
<div data-semantic-list="answer">
  <p data-semantic=".">不要回答啊！</p>
</div>
```





### 1、内容绑定

#### 语义声明

```html
<h1 data-semantic="page.title"></h1>
```

最基础的声明能力，语义是要求将解析出的值渲染到元素的 `textContent` 。

#### UI翻译

范例

```html
<h1 data-semantic="page.title">这是标题</h1>
```

#### 数据解析

`{key}` 解析后的值必须是一个数值、字符串或布尔类型

| 场景        | 渲染行为                                         |
| ----------- | ------------------------------------------------ |
| 有效值      | 将 `textContent` 设置为该值（执行 `toString`）。 |
| `undefined` | 清空元素内容。在开发模式下发出警告。             |
| `null`      | 清空元素内容。                                   |

### 2、属性绑定

#### 语义声明

```html
<img data-semantic-src="user.avatar" data-semantic-alt="user.name">
<span data-semantic-data-role="user.role"></span>
```

每个 `data-semantic-{attr}` 都会绑定到对应的 HTML 属性。

#### 属性白名单

翻译阶段，仅允许翻译以下白名单属性：

- 标准属性：`placeholder`, `title`, `alt`, `value`, `href`, `src`, `aria-label`, `aria-description`, `content`
- 自定义属性：`data-*`

其余属性视为协议无关，不做处理。

#### UI翻译

范例

```html
<img data-semantic-src="user.avatar" 
     data-semantic-alt="user.name"
     src="https://xx.com/1.png" alt="示例图"
     >
<span data-semantic-data-role="user.role" data-role="admin"></span>
```

#### 数据解析

渲染行为取决于实际解析到的值

| 解析值      | 渲染行为                              |
| ----------- | ------------------------------------- |
| `undefined` | 移除该属性。在开发模式下发出警告。    |
| `null`      | 移除该属性。                          |
| 有效值      | 将属性设置为该值（执行 `toString`）。 |

### 3、可见性绑定

#### 语义声明

```html
<div data-semantic-display="showLogin"></div>
```

`data-semantic-display` 是协议中唯一的样式相关绑定，用于控制 `style.display`。

#### UI翻译

范例

```html
<div data-semantic-display="showLogin" style="display:none"></div>
```

#### 数据解析

渲染行为取决于实际解析到的值

| 解析结果                                              | style.display 结果         |
| ----------------------------------------------------- | -------------------------- |
| 布尔值`true`                                          | `''`（显示）               |
| 布尔值`false`                                         | `'none'`（默认值，不显示） |
| 逻辑假值（`""`, `0`, `null`, `undefined`，`"false"`） | `'none'`                   |
| 逻辑真值字符串（以上5种之外的）                       | `''`（显示）               |

注意：

* 字符串形式的"false"，归入逻辑假值。
* 在浏览器 DOM 标准中，**`element.style.display = ''`** 行为的语义是移除该元素的内联 display声明，因此不会影响class层叠规则。

### 4、列表容器

#### 语义声明

```html
<div data-semantic-list="{key}">
  <!-- 列表项模板 (innerHTML) -->
</div>
```

`data-semantic-list` 用于声明列表容器：

- `{key}` 对应解析为数据中的一个数组。
- 容器元素本身不会被克隆，其 `innerHTML` 即为列表项模板（List Item Template）。
- 在渲染时，容器的子节点会被替换为模板的第`i`个克隆实例（每个数组元素对应一个）。

#### UI翻译

范例，list有两个值，则会渲染两次

```html
<div data-semantic-list="{key}">
  <!-- 列表项模板 (innerHTML) -->
  <!-- 列表项模板 (innerHTML) -->
</div>
```

#### 数据解析

`{key}` 解析后的值应该是一个数组（Array）。

| 数据值                   | 渲染行为                                                     |
| ------------------------ | ------------------------------------------------------------ |
| 数组                     | 渲染模板的`i`个克隆实例                                      |
| 空数组 `[]`              | 清空容器子节点，不报错                                       |
| `undefined`（键缺失）    | 保持原始模板 DOM 不变，发出警告                              |
| `null`                   | 清空容器子节点，发出警告                                     |
| 非数组（字符串、对象等） | **违反协议** — 编译器 `check` 报错，运行时发出警告并跳过渲染 |

#### 相对上下文

每个克隆出的列表项都会建立一个新的语义上下文：

- 克隆项内部的相对键相对于 `{listKey}[i]` 进行解析。
- 嵌套列表会创建嵌套上下文（以最内层为基准）。
- 绝对键可以绕过上下文。

范例

```html
<div data-semantic-list="page.chapters">
  <h2 data-semantic=".name"></h2>         <!-- page.chapters[i].name -->
  <div data-semantic-list=".items">       
    <span data-semantic=".title"></span>  <!-- page.chapters[i].items[j].title -->
    <span data-semantic="page.title"></span> <!-- 绝对键，跳出上下文 -->
  </div>
</div>
```

## 四、语义化要求

data-semantic除了是一个UI利器，同时承载了`开放语义网络`的目标，任何使用data-semantic协议实现的站点，即表示同意免费向任何三方开放页面的语义分析许可。

#### 框架层要求

##### 自动注入协议头

runtime在初次渲染时，comptime在编译时，都应该自动向页面 `<head>` 注入开放语义协议信息，向三方开放声明本页面遵循data-semantic协议规定的开放语义化声明：

```html
<meta name="data-semantic" content="1.0" />
```

##### 保留语义声明

编译后的UI，应该继续保持`data-semantic属性`

✅正确的渲染

```html
<p data-semantic="content">这是内容，建议编译时将相对路径的key进行绝对展开</p>
```

❌错误的渲染

```HTML
<p>这是标题</p>
```

#### 开发层建议

开发者对UI槽位（key）的命名，应该遵循语义化表示。

✅语义化声明

```html
<p data-semantic="shop.order.id"></p>
<div data-semantic="biology.animal.bear"></div>
```

❌避免纯id式的声明

```html
<p data-semantic="abcd123"></p>
<div data-semantic="ccabdd3c-f196-4c1f-935b-c32bc53fa162"></div>
```

❌避免字符集边界

```html
<p data-semantic="电商.订单.订单号"></p>
<div data-semantic="生物.动物.熊"></div>
```

既然规范强调‘开放语义网络’，那么用中文不是更语义化吗？是有解决方案的。如果该需求很重要，可以利用白名单透传机制：将中文语义放在协议不解析的**自定义属性**中，既保留了语义供 AI 分析，又让 `data-semantic` 保持了base64URL字符集。

```html
<!-- data-semantic 走协议翻译，data-semantic-label供三方 AI 分析 -->
<div data-semantic="biology.animal.bear" data-semantic-alias="生物.动物.熊"></div>
```

#### 三方分析

遵循开放语义协议的定位，可以自由按需分析实现页面的`语义`，但该权利并不意味着破坏站点自身对`信息`本身的版权和权利主张。



## 五、运行时&编译器要求

协议的实现框架建议实现几个要点

#### 数据约束

```js
render(dataRoot)
```

传入的数据要遵循两个原则：

* 翻译结果值只能是标量，列表或进行模板展开，自身节点不会有渲染行为，最终片段叶子要渲染的属性、内容、样式的值都必须是可以标量。
* 只能翻译纯json对象。严禁传入JS对象，如此，`data-semantic="window.size"` 之类的寻址绝对安全，没有任何可能去取到宿主对象、函数变量等。

#### 禁止模式

以下行为涉及语义污染，不应该被额外支持，建议 `check` 检查时明确拒绝：

- **事件处理函数**：`data-semantic-onclick` 等
- **样式注入**：`data-semantic-style`（白名单中的 `data-semantic-display` 除外）
- **JS对象**：协议规定“`dataRoot` 必须是纯 JSON 对象（Plain Object），且不能是根数组形式，前者是为了避免任何解析到 `window.*` 或 `document.*` 的键的可能性。后者是为了保证寻址规则的简单。
- **iframe 注入**：在 `<iframe>` 元素上使用 `data-semantic-src` 时，`check` 必须校验解析后的值。仅允许 `https:`、`http:` 或协议相对 `//` 开头的合法 URL，**严禁** `javascript:`、`data:`、`vbscript:` 等危险协议。若校验不通过，视为 **Error**。

#### 审查输出 

`inspect(template)` 返回一个由语义节点组成的扁平数组：

```json
[
  {
    "tag": "h1",
    "key": "page.title",
    "type": "text",
    "selector": "body > h1",
    "line": 5
  },
  {
    "tag": "img",
    "key": "user.avatar",
    "attr": "src",
    "type": "attr",
    "selector": "body > img",
    "line": 8
  }
]
```

#### 检查输出

原则：

- **错误（Error）** = 违反协议（使用了禁止模式、非法属性、错误的数据源类型）。
- **警告（Warning）** = 数据层面问题（键缺失、`undefined` 值、不推荐使用的方括号语法）。

`check(template, data)` 返回如下结构的报告：

```json
{
  "valid": false,
  "errors": [
    { "type": "violation", "message": "...", "selector": "...", "line": 5 }
  ],
  "warnings": [
    { "type": "missing-data", "message": "...", "selector": "...", "line": 8 }
  ]
}
```

### 一致性测试

运行时（Runtime）与编译器（Compiler）之间的一致性通过“一致性测试”进行验证。

每个测试用例均为一个独立目录，包含以下文件：

- `template.html` — HTML 模板
- `data.json` — 输入数据
- `expected.html` — 预期的渲染输出

**测试分类**：

1. 绝对键绑定
2. 相对键绑定
3. 数字键绑定（方括号语法）
4. 列表渲染（基础）
5. 空列表
6. 带相对键的嵌套列表
7. 带绝对键的列表（跳出上下文）
8. 属性绑定
9. 数据缺失（`undefined` 与 `null` 的区别）
10. 多重绑定
11. 非数组列表数据源（反向用例）
12. 禁止模式（反向用例）

运行时执行器（Runtime runner）与编译器执行器（Compiler runner）都会运行所有测试用例，并将输出结果与 `expected.html` 进行比对。







