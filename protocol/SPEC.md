# Data-Semantic Protocol Specification v1.0

> This is the authoritative protocol specification for data-semantic.
> Runtime and Compiler **must** produce identical results for the same HTML + Data.
> Consistency is guaranteed by this spec + conformance tests, not by shared code.

---

## 1. Key Resolution

A key is the value of `data-semantic` or `data-semantic-list`. Keys are resolved against a **semantic context**.

### 1.1 Absolute Key

Standard Dot Notation. Resolves from the data root.

```
data-semantic="page.title"
data-semantic="user.addresses.0.city"
```

Resolution: `dataRoot.page.title`

**Note:** Array subscript in absolute keys (e.g. `pages.list.0.name`) is supported by the resolver but is a legacy pattern. Tools (`inspect` / `check`) should emit a warning recommending relative key or bracket syntax instead.

### 1.2 Relative Key

Must start with `.`. Resolves from the current **semantic context**.

```
data-semantic=".title"
data-semantic=".author.name"
```

After stripping the leading `.`, the remainder is resolved as Dot Notation against the current context.

### 1.3 Numbered Key (Bracket Syntax)

Uses `[]` bracket syntax. Resolves from the current **semantic context**.

```
data-semantic="[0].title"
data-semantic=".list[0].title"
```

The bracket segment resolves to the array element at the given index, then Dot Notation continues from there.

**Protocol retains this syntax, but tools should emit a recommendation to prefer relative key (`.key`) where possible.** Bracket syntax is fragile under data reordering.

### 1.4 Key Resolution Priority

1. If the key starts with `.` → **relative key** (resolve from context)
2. If the key starts with `[` or contains `[n]` → **numbered key** (resolve from context)
3. Otherwise → **absolute key** (resolve from data root)

### 1.5 List Context

When inside a `data-semantic-list` container:

- The semantic context for each cloned item becomes `{listKey}[i]`.
- Relative keys inside the item template resolve against this context.
- **Absolute keys always resolve from the data root**, regardless of list nesting. This allows items to reference data outside the list context.

---

## 2. Semantic Context

The semantic context determines the resolution base for relative and numbered keys.

### 2.1 Context Rules

| Location | Default Context |
|---|---|
| Root level (no list ancestor) | Data root |
| Inside a list item | `{listKey}[i]` |
| Inside nested list items | Innermost `{listKey}[i]` |

### 2.2 Context is Nestable

Relative keys always resolve against the **nearest** list context, regardless of nesting depth.

```html
<div data-semantic-list="categories">
  <h2 data-semantic=".name"></h2>        <!-- categories[i].name -->
  <div data-semantic-list=".items">      <!-- relative list source -->
    <span data-semantic=".title"></span>  <!-- categories[i].items[j].title -->
  </div>
</div>
```

### 2.3 Absolute Key Inside List

Absolute keys are **not affected** by list context. They always resolve from the data root.

```html
<div data-semantic-list="categories">
  <span data-semantic=".name"></span>           <!-- categories[i].name (relative) -->
  <span data-semantic="siteTitle"></span>        <!-- siteTitle (absolute, escapes context) -->
</div>
```

This is intentional: items in a list may need to reference global data (e.g. site title, current user).

---

## 3. List Semantic

### 3.1 Declaration

```html
<div data-semantic-list="{key}">
  <!-- List Item Template (innerHTML) -->
</div>
```

- `data-semantic-list` declares a **list container**.
- `{key}` resolves to an array in the data.
- The container element itself is **not cloned**. Its innerHTML is the **List Item Template**.
- On render, the container's children are replaced with `n` clones of the template (one per array element).

### 3.2 List Source

The resolved value of `{key}` **must** be an Array.

| Source Value | Behavior |
|---|---|
| Array (≥0 items) | Render `n` clones |
| Empty array `[]` | Clear container children, no error |
| `undefined` (key missing) | Keep original template DOM untouched, emit warning |
| `null` | Clear container children, emit warning |
| Non-array (string, object, etc.) | **Protocol violation** — Compiler `check` reports **error**, Runtime emits warning and skips rendering |

### 3.3 Relative Key on List Source

`data-semantic-list` itself can use a relative key:

```html
<div data-semantic-list="categories">
  <div data-semantic-list=".items">
    <!-- template for categories[i].items -->
  </div>
</div>
```

Here `.items` resolves to `categories[i].items` (must be an array).

### 3.4 Empty List

When the array is empty (`[]`):
- Container children are removed (container becomes empty).
- No error or warning is emitted.

### 3.5 List Context Propagation

Each cloned item establishes a new semantic context:
- Relative keys inside the clone resolve against `{listKey}[i]`.
- Nested lists create nested contexts (innermost wins).
- Absolute keys bypass context entirely (always resolve from root).

---

## 4. Content Binding

### 4.1 Text Content

```html
<h1 data-semantic="page.title"></h1>
```

The element's `textContent` is replaced with the resolved value.

### 4.2 Missing Data — Content

| Scenario | Behavior |
|---|---|
| Key resolves to `undefined` | **Clear** element content. Emit warning in dev mode. |
| Key resolves to `null` | **Clear** element content. |
| Key resolves to a value | Set `textContent` to the value (toString). |

---

## 5. Attribute Binding

### 5.1 Declaration

```html
<img data-semantic-src="user.avatar" data-semantic-alt="user.name">
```

Each `data-semantic-{attr}` binds to a specific HTML attribute.

### 5.2 Attribute Whitelist

Only the following attributes may be set via `data-semantic-{attr}`:

`placeholder`, `title`, `alt`, `value`, `href`, `src`, `aria-label`, `aria-description`, `content`

Attempting to bind a non-whitelisted attribute is a **protocol violation** — `check` reports **error**.

### 5.3 Missing Data — Attribute

| Scenario | Behavior |
|---|---|
| Key resolves to `undefined` | **Remove** the attribute. Emit warning in dev mode. |
| Key resolves to `null` | **Remove** the attribute. |
| Key resolves to a value | Set the attribute to the value (toString). |

---

## 6. Display Binding (Orthogonal)

### 6.1 Declaration

```html
<div data-semantic-display="showLogin"></div>
```

`data-semantic-display` is the **only** style-related binding in the protocol. It controls `style.display`.

### 6.2 Rules

| Resolved Value | `style.display` |
|---|---|
| `true` | `''` (default, visible) |
| `false` | `'none'` |
| truthy string (non-empty) | `''` (visible) |
| falsy (`""`, `0`, `null`, `undefined`) | `'none'` |

---

## 7. Multiple Bindings

A single element can carry multiple independent bindings:

```html
<a
  data-semantic="linkText"
  data-semantic-href="linkUrl"
  data-semantic-title="linkTooltip"
  data-semantic-display="showLink"
>
</a>
```

Each binding is resolved and applied independently. Content binding and attribute binding do not interfere with each other.

---

## 8. data-* Passthrough

Any `data-*` attribute that is **not** `data-semantic` or `data-semantic-*` is passed through as-is to the rendered output. This is orthogonal to the semantic protocol and does not participate in key resolution.

---

## 9. Forbidden Patterns

The following are **protocol violations** and must be rejected by `check`:

- **Event handlers**: `data-semantic-onclick`, etc.
- **Style injection**: `data-semantic-style` (except the whitelisted `data-semantic-display`)
- **Global identifiers**: keys that resolve to `window.*` or `document.*`
- **iframe injection**: `data-semantic-src` on `<iframe>` elements

---

## 10. Version Declaration

```html
<meta name="data-semantic" content="1.0">
```

- This tag declares the protocol version used by the page.
- Absence of this tag implies v1.0 (default).
- Future protocol versions will increment this number.

---

## 11. Compiler-Specific Rules

### 11.1 Static Unfolding

The compiler performs static unfolding: `compile(template, data)` produces final HTML with all bindings resolved. The output HTML contains **no** `data-semantic` attributes.

### 11.2 List Unfolding

For list containers, the compiler replaces the container's children with `n` cloned and resolved template instances. The container element is preserved but its `data-semantic-list` attribute is removed.

### 11.3 Inspect Output

`inspect(template)` returns a flat array of **semantic nodes**:

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

### 11.4 Check Output

`check(template, data)` returns:

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

**Error** = protocol violation (forbidden pattern, invalid attribute, wrong source type).
**Warning** = data issue (missing key, undefined value, non-recommended bracket syntax).

---

## 12. Conformance Testing

Consistency between Runtime and Compiler is verified by conformance tests.

Each test case is a directory containing:
- `template.html` — the HTML template
- `data.json` — the input data
- `expected.html` — the expected rendered output

Test categories:
1. Absolute key binding
2. Relative key binding
3. Numbered key binding (bracket syntax)
4. List rendering (basic)
5. Empty list
6. Nested list with relative keys
7. List with absolute key (escaping context)
8. Attribute binding
9. Missing data (undefined vs null)
10. Multiple bindings
11. Non-array list source (negative case)
12. Forbidden patterns (negative case)

Both Runtime runner and Compiler runner execute all cases and compare output against `expected.html`.
