# Data-Semantic 协议规范 v1.0

本规范是 data-semantic 的权威协议规范。运行时（Runtime）和编译器（Compiler）在处理相同的 HTML + 数据时，必须产生完全一致的结果。一致性由本规范及一致性测试（Conformance tests）保证。

## 一、基本概念

```html
<div data-semantic="page.title"></div>
<div data-semantic-list="page.chapters">
    <div data-semantic=".name"></div>
</div>
```

data-semantic的核心是基于html原生的`data-*`规范实现数据语义和槽位声明。对照以上示例解释基础概念。

#### 属性

此示例中的`data-semantic`、`data-semantic-title`，都是合法的html自定义属性，代表不同的声明语义，即决定了要渲染到哪里，怎么渲染。

#### Key

此示例中的属性值`page.title`决定的是数据值：

* 对于UI侧，代表一个需要渲染的数据槽位
* 对于数据侧，代表一个索引槽位，对应于json中的`key路径`，用于定位到要渲染的数据值。
* 而其值本身，代表一个语义槽位。

#### 数据

需要渲染的数据，需要以json形式从外部传入。数据Schema需要和Key保持对应，才能被正确渲染或编译。

```json
{
    page:{
        title:"Data-Semantic 协议规范 v1.0"
        chapters:[
        	{
				name:"基本概念"
            }
        ]
    }
}
```



## 二、Key命名和解析

Key是相对于语义上下文（Semantic context）进行解析的，类似JSON Path，但有所不同。

### 命名规范

json数据侧的字段key，要求采用base64URL字符集，严格避免特殊符号，尤其是禁止`.`、`[`、`]`三个符号，以避免解析冲突。UI侧声明的key，只允许base64URL字符集+`.`、`[`、`]`三个符号的组合。

### 解析语法

解析规范，即涉及寻址语法语义，还涉及了上下文规则。

#### 寻址方式

UI侧声明的key，在数据侧采用标准的 JavaScript 对象/数组寻址方式。结合两种基础的访问语法：

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
```

严格规定：

* 相对寻址必须以 `.` 或 `[` 开头
* 其相对的上下文必须是某个数组，即由上层`data-semantic-list`提供，比如`data-semantic-list="page.chapters"`，则`[0].name`相当于`page.chapters[0].name`

#### 列表上下文

当相对寻址处于 `data-semantic-list` 容器内部时：

- 每个克隆元素的语义上下文变为 `{listKey}[i]`。
- 元素模板内部的相对键将相对于该上下文进行解析。

上下文可嵌套：

* 无论列表嵌套多深，绝对键始终从数据根节点解析，

- 相对键始终相对于最近的列表上下文进行解析。

范例

```html
<div data-semantic-list="categories">
  <h2 data-semantic=".name"></h2>         <!-- categories[i].name -->
  <div data-semantic-list=".items">       <!-- 相对列表数据源 -->
    <span data-semantic=".title"></span>  <!-- categories[i].items[j].title -->
    <span data-semantic="siteTitle"></span> <!-- siteTitle（绝对键，跳出上下文） -->
  </div>
</div>
```

#### 相对语义上下文

语义上下文决定了相对解析时的基准点。为了避免了上下文栈管理过深，增强AI的语义准确度，协议规定，只有`data-semantic-list`可以提供相对上下文语义，嵌套对象禁止使用相对寻址。

| **位置**             | **上下文语义**          |
| -------------------- | ----------------------- |
| 根层级（无列表祖先） | 数据根节点（Data root） |
| 列表项内部           | `{listKey}[i]`          |
| 嵌套列表项内部       | 最内层的 `{listKey}[i]` |

#### 解析边界

在实际开发中，如果数据链条中**任何一个环节**是 `undefined` 或 `null`，就会直接报错（例如 `TypeError: Cannot read properties of undefined`）。runtime和编译器需要进行可选链操作符的容错处理：

* 每一级寻址都默认自带`?.`
* 比如UI声明侧的key为`page.chapters.[0].name`，在解析数据时，实际使用的是`page?.chapters?.[0]?.name`
* 如果属性存在但类型不匹配，可选链 `?.` 也无能为力，依然会正常报错



## 三、声明和渲染规则

目前支持四大类属性，分别承载不同的语义。单个元素可以包含多个相互独立的绑定：

```html
<a
  data-semantic="linkText"
  data-semantic-href="linkUrl"
  data-semantic-title="linkTooltip"
  data-semantic-display="showLink"
>
</a>
```

### 列表容器

#### 声明

```html
<div data-semantic-list="{key}">
  <!-- 列表项模板 (innerHTML) -->
</div>
```

`data-semantic-list` 用于声明列表容器：

- `{key}` 对应解析为数据中的一个数组。
- 容器元素本身不会被克隆，其 `innerHTML` 即为列表项模板（List Item Template）。
- 在渲染时，容器的子节点会被替换为模板的`i`个克隆实例（每个数组元素对应一个）。

#### 数据解析

`{key}` 解析后的值必须是一个数组（Array）。

| 数据值                   | 渲染行为                                                     |
| ------------------------ | ------------------------------------------------------------ |
| 数组                     | 渲染模板的`i`个克隆实例                                      |
| 空数组 `[]`              | 清空容器子节点，不报错                                       |
| `undefined`（键缺失）    | 保持原始模板 DOM 不变，发出警告                              |
| `null`                   | 清空容器子节点，发出警告                                     |
| 非数组（字符串、对象等） | **违反协议** — 编译器 `check` 报错，运行时发出警告并跳过渲染 |

#### 相对寻址

内层`data-semantic-list` 本身可以使用相对键，但顶层不可以：

```html
<div data-semantic-list="categories">
  <div data-semantic-list=".items">
    <!-- categories[i].items 的模板 -->
  </div>
</div>
```

每个克隆出的列表项都会建立一个新的语义上下文：

- 克隆项内部的相对键相对于 `{listKey}[i]` 进行解析。
- 嵌套列表会创建嵌套上下文（以最内层为准）。
- 绝对键完全绕过上下文（始终从根节点解析）。



### 内容绑定

#### 声明

```html
<h1 data-semantic="page.title"></h1>
```

最基础的声明能力，语义是要求将解析出的值渲染到元素的 `textContent` 。

#### 正常渲染

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

### 属性绑定

#### 声明

```html
<img data-semantic-src="user.avatar" data-semantic-alt="user.name">
```

每个 `data-semantic-{attr}` 都会绑定到指定的 HTML 属性。

#### 属性白名单

仅允许通过 `data-semantic-{attr}` 设置以下白名单属性：

- 标准属性：`placeholder`, `title`, `alt`, `value`, `href`, `src`, `aria-label`, `aria-description`, `content`
- 自定义属性：`data-*`

尝试绑定非白名单属性属于**违反协议** — `check` 检查时将报错。

#### 正常渲染

范例

```html
<img data-semantic-src="user.avatar" data-semantic-alt="user.name"
     src="https://xx.com/1.png" alt="示例图"
     >
```

#### 数据解析

| 场景        | 渲染行为                              |
| ----------- | ------------------------------------- |
| `undefined` | 移除该属性。在开发模式下发出警告。    |
| `null`      | 移除该属性。                          |
| 有效值      | 将属性设置为该值（执行 `toString`）。 |

#### 自定义属性

自定义属性也支持语义声明，参与自动渲染

#### 声明

```html
<span data-semantic-data-role="user.role"></span>
```

#### 正常渲染

范例

```html
<span data-semantic-data-role="user.role" data-role="admin"></span>
```

#### 属性透传规则

任何非 `data-semantic` 或非 `data-semantic-*` 的属性，都将按原样透传至渲染输出中。这与语义协议相互独立，不参与键解析。

#### 声明

```html
<span data-semantic-data-role="user.role"></span>
<span data-semantic-role="user.role"></span>
<span semantic-role="user.role"></span>
```

#### 正常渲染

范例

```html
<span data-semantic-data-role="user.role" data-role="admin"></span>
<span data-semantic-role="user.role"></span>
<span semantic-role="user.role"></span>
```

`data-semantic-data-role`是协议规范，执行渲染。但`data-semantic-role`、`semantic-role`均是协议未定义的声明方式，透传不做任何处置。

### 可见性绑定

#### 声明

```html
<div data-semantic-display="showLogin"></div>
```

`data-semantic-display` 是协议中唯一的样式相关绑定，用于控制 `style.display`。

#### 数据解析

| 解析值                                      | style.display 结果   |
| ------------------------------------------- | -------------------- |
| `true`                                      | `''`（默认值，显示） |
| `false`                                     | `'none'`             |
| 真值字符串（非空，包括字符串形式的"false"） | `''`（显示）         |
| 假值（`""`, `0`, `null`, `undefined`）      | `'none'`             |

每个绑定都将独立解析并应用。内容绑定与属性绑定之间互不干扰。

## 四、语义化要求

data-semantic除了是一个UI渲染利器，同时承载了`开放语义网络`的目标，任何使用data-semantic协议实现的站点，即表示同意免费向任何三方开放页面的语义分析许可。

#### 框架层要求

runtime在加载时，comptime在编译时，都应该自动向页面 `<head>` 注入开放语义协议信息，向三方开放声明本页面遵循data-semantic协议规定的语义化声明：

```html
<meta name="data-semantic" content="1.0" />
```

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

开发者对UI槽位（key）的命名，应该遵循语义化表示，尽可能避免纯id式的声明

```html
<p data-semantic="abcd123"></p>
<div data-semantic="ccabdd3c-f196-4c1f-935b-c32bc53fa162"></div>
```

#### 三方分析

遵循开放语义协议的定位，可以自由按需分析实现页面的`语义`，但该权利并不意味着破坏站点自身对`信息`本身的版权和权利主张。



## 五、编译器建议

#### 禁止模式

以下行为不应该被支持，建议被 `check` 检查拒绝：

- **事件处理函数**：`data-semantic-onclick` 等
- **样式注入**：`data-semantic-style`（白名单中的 `data-semantic-display` 除外）
- **全局标识符**：解析为 `window.*` 或 `document.*` 的键
- **iframe 注入**：在 `<iframe>` 元素上使用 `data-semantic-src`

### 审查输出 

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

### 检查输出

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







