/**
 * data-semantic compiler — core module
 * Static template analysis, validation, and compilation.
 *
 * Uses node-html-parser for parsing. compile() uses string-based rendering
 * since node-html-parser doesn't support cloneNode.
 */
import { parse } from 'node-html-parser';

// ── Key Resolution (same logic as runtime/resolveKey.js) ─────────

function expandBrackets(path) {
  return path.replace(/\[(\d+)\]/g, '.$1');
}

function classifyKey(raw) {
  if (raw.startsWith('.')) return 'relative';
  if (raw.startsWith('[') || /\[\d+\]/.test(raw)) return 'numbered';
  return 'absolute';
}

function resolveRawKey(raw, context) {
  const type = classifyKey(raw);
  if (type === 'absolute') return expandBrackets(raw);
  const base = context || '';
  if (type === 'relative') {
    const rest = expandBrackets(raw.slice(1));
    return base ? `${base}.${rest}` : rest;
  }
  const expanded = expandBrackets(raw);
  return base ? `${base}.${expanded}` : expanded;
}

// ── Value Resolution ─────────────────────────────────────────────

function getValueByPath(obj, path) {
  if (!obj || typeof obj !== 'object') return undefined;
  const expanded = path.replace(/\[(\d+)\]/g, '.$1');
  return expanded.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, obj);
}

// ── Allowed Attributes ───────────────────────────────────────────

const DEFAULT_ALLOWED_ATTRS = new Set([
  'placeholder', 'title', 'alt', 'value',
  'href', 'src', 'aria-label', 'aria-description', 'content'
]);

// ── parseSemanticStructure ───────────────────────────────────────

/**
 * Parse an HTML template and return the semantic structure tree.
 */
export function parseSemanticStructure(template) {
  const root = parse(template, { script: true, style: true });
  const nodes = [];

  function walk(el, context) {
    if (!el.tagName) return;

    const tag = el.tagName.toLowerCase();
    const textKey = el.getAttribute('data-semantic');
    const displayKey = el.getAttribute('data-semantic-display');
    const listKey = el.getAttribute('data-semantic-list');
    const selector = buildSelector(el);

    if (textKey) {
      nodes.push({ tag, key: textKey, resolved: resolveRawKey(textKey, context), type: 'text', selector, context });
    }
    if (displayKey) {
      nodes.push({ tag, key: displayKey, resolved: resolveRawKey(displayKey, context), type: 'display', selector, context });
    }

    // Attribute bindings — node-html-parser attributes is an object
    const attrs = el.attributes || {};
    for (const [attrName, attrVal] of Object.entries(attrs)) {
      if (attrName.startsWith('data-semantic-') &&
        attrName !== 'data-semantic' &&
        attrName !== 'data-semantic-display' &&
        attrName !== 'data-semantic-list') {
        const targetAttr = attrName.slice('data-semantic-'.length);
        if (attrVal) {
          const resolved = resolveRawKey(attrVal, context);
          nodes.push({ tag, key: attrVal, resolved, type: 'attr', attr: targetAttr, selector, context });
        }
      }
    }

    if (listKey) {
      const listResolved = resolveRawKey(listKey, context);
      const itemContext = `${listResolved}.0`;
      for (const child of el.childNodes) {
        if (child.tagName) walk(child, itemContext);
      }
      return;
    }

    for (const child of el.childNodes) {
      if (child.tagName) walk(child, context);
    }
  }

  for (const child of root.childNodes) {
    if (child.tagName) walk(child, null);
  }

  return { nodes, root };
}

function buildSelector(el) {
  let path = [];
  let current = el;
  while (current && current.tagName) {
    path.unshift(current.tagName.toLowerCase());
    current = current.parentElement;
  }
  return path.join(' > ');
}

// ── inspect ──────────────────────────────────────────────────────

export function inspect(template) {
  const { nodes } = parseSemanticStructure(template);
  return nodes.map((n) => ({
    tag: n.tag,
    key: n.key,
    resolved: n.resolved,
    type: n.type,
    ...(n.attr ? { attr: n.attr } : {}),
    selector: n.selector,
    context: n.context || 'root'
  }));
}

// ── check ────────────────────────────────────────────────────────

export function check(template, data = null) {
  const { nodes } = parseSemanticStructure(template);
  const errors = [];
  const warnings = [];

  for (const node of nodes) {
    if (node.type === 'attr' && !node.attr.startsWith('data-')) {
      if (!DEFAULT_ALLOWED_ATTRS.has(node.attr.toLowerCase())) {
        errors.push({ type: 'violation', message: `属性 "${node.attr}" 不在白名单中`, selector: node.selector, key: node.key });
      }
    }
    if (classifyKey(node.key) === 'numbered') {
      warnings.push({ type: 'non-recommended', message: `使用了序号寻址 "${node.key}"，建议优先使用 . 前缀相对寻址`, selector: node.selector, key: node.key });
    }
    if (node.tag === 'iframe' && node.attr === 'src' && data) {
      const value = getValueByPath(data, node.resolved);
      if (typeof value === 'string' && !/^(https?:|\/\/)/.test(value)) {
        errors.push({ type: 'violation', message: `iframe src "${value}" 使用了禁止的协议，仅允许 https:、http: 或 //`, selector: node.selector, key: node.resolved });
      }
    }
    if (data) {
      const value = getValueByPath(data, node.resolved);
      if (value === undefined) {
        warnings.push({ type: 'missing-data', message: `key "${node.resolved}" 在数据中不存在`, selector: node.selector, key: node.resolved });
      } else if (typeof value === 'object' && value !== null) {
        errors.push({ type: 'violation', message: `key "${node.resolved}" 绑定到非标量值（对象/数组）`, selector: node.selector, key: node.resolved });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── compile ──────────────────────────────────────────────────────

/**
 * String-based recursive compile. Walks the node-html-parser tree
 * and builds output HTML string, handling list expansion inline.
 */
export function compile(template, data, options = {}) {
  const { removeDataAttrs = false } = options;
  const root = parse(template, { script: true, style: true });

  function renderNode(el, context) {
    if (!el.tagName) {
      // Text node — return as-is
      return el.toString();
    }

    const tag = el.tagName.toLowerCase();
    const listKey = el.getAttribute('data-semantic-list');
    const textKey = el.getAttribute('data-semantic');
    const displayKey = el.getAttribute('data-semantic-display');

    // Collect attribute bindings from the original element
    const attrBindings = [];
    const attrs = el.attributes || {};
    for (const [attrName, attrVal] of Object.entries(attrs)) {
      if (attrName.startsWith('data-semantic-') &&
        attrName !== 'data-semantic' &&
        attrName !== 'data-semantic-display' &&
        attrName !== 'data-semantic-list') {
        attrBindings.push({ name: attrName.slice('data-semantic-'.length), key: attrVal });
      }
    }

    // Build the output attributes (non-semantic ones preserved, semantic ones preserved by default)
    let outAttrs = '';
    for (const [attrName, attrVal] of Object.entries(attrs)) {
      if (removeDataAttrs && attrName.startsWith('data-semantic')) continue;
      outAttrs += ` ${attrName}="${escapeHtml(attrVal)}"`;
    }

    // Apply text binding
    let textContent = '';
    if (textKey) {
      const resolved = resolveRawKey(textKey, context);
      const value = getValueByPath(data, resolved);
      textContent = (value !== undefined && value !== null && typeof value !== 'object') ? String(value) : '';
    }

    // Apply display binding
    let displayStyle = '';
    if (displayKey) {
      const resolved = resolveRawKey(displayKey, context);
      const value = getValueByPath(data, resolved);
      if (value === false || value === 0 || value === '' ||
          value === null || value === undefined || value === 'false') {
        displayStyle = ' display: none;';
      } else {
        displayStyle = '';
      }
    }

    // Apply attribute bindings
    let extraAttrs = '';
    for (const { name, key } of attrBindings) {
      const resolved = resolveRawKey(key, context);
      const value = getValueByPath(data, resolved);
      if (value !== undefined && value !== null && typeof value !== 'object') {
        extraAttrs += ` ${name}="${escapeHtml(String(value))}"`;
      }
    }

    // Combine style from existing + display
    const existingStyle = attrs.style || '';
    const combinedStyle = (existingStyle + displayStyle).trim();

    // Handle list container
    if (listKey) {
      const resolved = resolveRawKey(listKey, context);
      const source = getValueByPath(data, resolved);
      let innerHtml = '';

      if (Array.isArray(source) && source.length > 0) {
        // Get template children (non-list-attr child elements)
        const templateChildren = el.childNodes.filter((c) => c.tagName);
        for (let i = 0; i < source.length; i++) {
          const itemContext = `${resolved}.${i}`;
          for (const tmpl of templateChildren) {
            innerHtml += renderNode(tmpl, itemContext);
          }
        }
      }
      // Empty or missing: innerHtml stays ''

      const styleAttr = combinedStyle ? ` style="${escapeHtml(combinedStyle)}"` : '';
      return `<${tag}${outAttrs}${extraAttrs}${styleAttr}>${innerHtml}</${tag}>`;
    }

    // Render children
    let childrenHtml = '';
    if (!textKey) {
      // No text binding — render original children
      for (const child of el.childNodes) {
        childrenHtml += renderNode(child, context);
      }
    }
    // If textKey is set, textContent replaces children

    const styleAttr = combinedStyle ? ` style="${escapeHtml(combinedStyle)}"` : '';
    return `<${tag}${outAttrs}${extraAttrs}${styleAttr}>${textContent}${childrenHtml}</${tag}>`;
  }

  let output = '';
  for (const child of root.childNodes) {
    output += renderNode(child, null);
  }
  return output;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
