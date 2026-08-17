/**
 * data-semantic 运行时核心
 * 实现 data-semantic 声明式数据绑定协议
 *
 * v1.1 新增：
 * - data-semantic-list（列表语义）
 * - 相对寻址（.key）
 * - 序号寻址（[n] 括号语法）
 * - 绝对 key 始终从数据根寻址（list 内也可用）
 */
import {
  DEFAULT_ALLOWED_ATTRS,
  getValueByPath,
  deepMerge,
  collectLeafPaths,
  collectShrunkLeaves,
  getTextAttrs,
  isDataAttr
} from './utility.js';
import { resolveRawKey } from './resolveKey.js';
import {
  discoverLists,
  cacheTemplate,
  isInsideList,
  renderList,
  indexListBindings
} from './list.js';

const PROTOCOL_VERSION = '1.0';

export class DataSemanticRuntime {
  constructor(options = {}) {
    this.dict = {};
    this.index = new Map();
    this.lists = new Map();        // el → { el, key, template, trackedKeys }
    this.root = options.root ?? (typeof document !== 'undefined' ? document : null);
    this.allowedAttrs = new Set(
      (options.allowedAttrs ?? DEFAULT_ALLOWED_ATTRS).map((a) => a.toLowerCase())
    );
    this.warnOnMissing =
      options.warnOnMissing ??
      (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production');
    this.isMounted = false;
    this.observer = null;
    this._rendering = false;        // flag to suppress observer during list render

    this.injectSemanticMeta();
  }

  render(data) {
    if (data === null || typeof data !== 'object') {
      this.warn('render 需要传入对象');
      return;
    }

    if (!this.isMounted) {
      if (!this.root) {
        this.warn('未提供 root，渲染被忽略');
        return;
      }
      this.mount();
    }

    // Consume pending DOM mutations
    if (this.observer) {
      const records = this.observer.takeRecords();
      if (records.length) this.processMutations(records);
    }

    const keys = collectLeafPaths(data);
    const prev = this.dict;
    this.dict = deepMerge(this.dict, data);
    collectShrunkLeaves(data, prev, '', keys);

    // Apply to non-list elements (incremental)
    this.applyKeys(keys);

    // Re-render all lists (full rebuild per list)
    this._rendering = true;
    try {
      for (const [el, listEntry] of this.lists) {
        this.renderOneList(listEntry);
      }
    } finally {
      this._rendering = false;
    }

    // Apply data to newly indexed list items
    this.applyExistingData();
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.index.clear();
    this.lists.clear();
    this.root = null;
    this.dict = {};
    this.isMounted = false;
  }

  // ============================================================
  // 内部方法
  // ============================================================

  mount() {
    if (!this.root) return;
    this.buildIndex();
    this.isMounted = true;

    const doc = this.root.nodeType === 9 ? this.root : this.root.ownerDocument;
    const observerCtor = doc?.defaultView?.MutationObserver;
    if (observerCtor) {
      const target = this.root.nodeType === 9 ? this.root.documentElement : this.root;
      if (target) {
        this.observer = new observerCtor((mutations) => this.processMutations(mutations));
        this.observer.observe(target, { childList: true, subtree: true, attributes: true });
      }
    }
  }

  processMutations(mutations) {
    if (!this.isMounted || this._rendering) return;
    const relevant = mutations.some((m) => {
      if (m.type === 'attributes') {
        return m.attributeName === 'data-semantic' ||
          m.attributeName === 'data-semantic-list' ||
          m.attributeName.startsWith('data-semantic-');
      }
      if (m.type === 'childList') {
        return [...m.addedNodes, ...m.removedNodes].some(
          (n) => n.nodeType === 1 && this.hasBindingInSubtree(n)
        );
      }
      return false;
    });
    if (relevant) {
      this.buildIndex();
      this.applyExistingData();
      // Re-render lists after index rebuild
      this._rendering = true;
      try {
        for (const [, listEntry] of this.lists) {
          this.renderOneList(listEntry);
        }
      } finally {
        this._rendering = false;
      }
    }
  }

  hasBindingInSubtree(el) {
    if (getTextAttrs(el).length > 0) return true;
    if (el.getAttribute && el.getAttribute('data-semantic-list')) return true;
    const descendants = el.querySelectorAll('*');
    for (const d of descendants) {
      if (getTextAttrs(d).length > 0 || d.getAttribute('data-semantic-list')) return true;
    }
    return false;
  }

  applyExistingData() {
    for (const key of this.index.keys()) {
      if (getValueByPath(this.dict, key) !== undefined) this.applyKey(key);
    }
  }

  /**
   * 扫描 DOM，构建 key → 元素映射。
   * 跳过 data-semantic-list 容器的子元素（它们由 list 渲染处理）。
   * 同时发现并缓存所有 list 容器。
   */
  buildIndex() {
    if (!this.root) return;
    this.index.clear();
    this.lists.clear();

    // 1. Discover all list containers
    const listEntries = discoverLists(this.root);
    for (const entry of listEntries) {
      cacheTemplate(entry);
      entry.trackedKeys = new Set();
      this.lists.set(entry.el, entry);
    }

    // 2. Index non-list elements
    const candidates = this.root.querySelectorAll('*');
    for (const el of candidates) {
      // Skip elements inside list containers (they're templates)
      if (isInsideList(el, this.lists)) continue;

      // Skip list container elements themselves
      if (this.lists.has(el)) continue;

      this.indexElement(el);
    }

    // 3. Render all lists (adds entries to index for list items)
    for (const [, listEntry] of this.lists) {
      this.renderOneList(listEntry);
    }
  }

  /**
   * Index a single element's bindings (text, display, attr) into this.index.
   * Keys are resolved against a context (null = root).
   */
  indexElement(el, context = null) {
    // data-semantic (text binding)
    const textKey = el.getAttribute('data-semantic');
    if (textKey) {
      const resolved = resolveRawKey(textKey, context);
      this.getOrCreateEntry(resolved).textEls.push(el);
    }

    // data-semantic-display
    const displayKey = el.getAttribute('data-semantic-display');
    if (displayKey) {
      const resolved = resolveRawKey(displayKey, context);
      this.getOrCreateEntry(resolved).displayEls.push(el);
    }

    // data-semantic-{attr}
    for (const name of getTextAttrs(el)) {
      if (name === 'data-semantic' || name === 'data-semantic-display' || name === 'data-semantic-list') continue;
      const targetAttr = name.slice('data-semantic-'.length);

      if (!isDataAttr(targetAttr) && !this.allowedAttrs.has(targetAttr.toLowerCase())) {
        this.warn(`属性 "${targetAttr}" 不在白名单中，已忽略绑定 "${name}"`);
        continue;
      }

      const key = el.getAttribute(name);
      if (key) {
        const resolved = resolveRawKey(key, context);
        this.getOrCreateEntry(resolved).attrBindings.push({ el, attr: targetAttr });
      }
    }
  }

  getOrCreateEntry(key) {
    let entry = this.index.get(key);
    if (!entry) {
      entry = { textEls: [], attrBindings: [], displayEls: [] };
      this.index.set(key, entry);
    }
    return entry;
  }

  /** Remove previously tracked keys for a list entry from the index */
  clearListKeys(listEntry) {
    for (const key of listEntry.trackedKeys) {
      this.index.delete(key);
    }
    listEntry.trackedKeys.clear();
  }

  /** Render a single list container */
  renderOneList(listEntry) {
    const { el, key } = listEntry;

    // Resolve the list source
    const source = getValueByPath(this.dict, key);

    if (source === undefined) {
      if (this.warnOnMissing) this.warn(`list key "${key}" 未提供，保留原始模板`);
      return;
    }

    if (source === null) {
      this.clearListKeys(listEntry);
      if (this.warnOnMissing) this.warn(`list key "${key}" 为 null，已清空容器`);
      el.innerHTML = '';
      return;
    }

    if (!Array.isArray(source)) {
      this.warn(`list key "${key}" 指向非数组值（${typeof source}），协议违规，跳过渲染`);
      return;
    }

    if (source.length === 0) {
      this.clearListKeys(listEntry);
      el.innerHTML = '';
      return;
    }

    // Clear old tracked keys
    this.clearListKeys(listEntry);

    // Clear container and render items
    el.innerHTML = '';
    const template = listEntry.template;
    const doc = el.ownerDocument || document;

    for (let i = 0; i < source.length; i++) {
      const itemContext = `${key}.${i}`;
      const fragment = doc.createElement('template');
      fragment.innerHTML = template;
      const clone = fragment.content;

      // Index bindings for this item
      const itemKeys = [];
      this.indexListFragment(clone, itemContext, itemKeys);
      for (const k of itemKeys) {
        listEntry.trackedKeys.add(k);
      }

      el.appendChild(clone);

      // Discover and render nested lists in this cloned item
      this.discoverAndRenderNestedLists(el, itemContext, listEntry.trackedKeys);
    }
  }

  /**
   * Discover nested data-semantic-list containers inside a just-appended clone,
   * register them, cache templates, and render them recursively.
   */
  discoverAndRenderNestedLists(parentEl, context, trackedKeys) {
    const nestedCandidates = parentEl.querySelectorAll('[data-semantic-list]');
    for (const nestedEl of nestedCandidates) {
      // Skip if already registered (e.g. from a previous render)
      if (this.lists.has(nestedEl)) continue;

      const rawKey = nestedEl.getAttribute('data-semantic-list');
      const resolvedKey = resolveRawKey(rawKey, context);

      const nestedEntry = {
        el: nestedEl,
        key: resolvedKey,
        template: nestedEl.innerHTML,
        trackedKeys: new Set()
      };
      this.lists.set(nestedEl, nestedEntry);

      // Render the nested list
      this.renderOneList(nestedEntry);
      // Collect tracked keys for parent cleanup
      for (const k of nestedEntry.trackedKeys) {
        trackedKeys.add(k);
      }
    }
  }

  /**
   * Index all bindings inside a cloned template fragment.
   */
  indexListFragment(fragment, context, trackedKeys) {
    const candidates = fragment.querySelectorAll('*');
    for (const el of candidates) {
      // data-semantic (text)
      const textKey = el.getAttribute('data-semantic');
      if (textKey) {
        const resolved = resolveRawKey(textKey, context);
        this.getOrCreateEntry(resolved).textEls.push(el);
        trackedKeys.push(resolved);
      }

      // data-semantic-display
      const displayKey = el.getAttribute('data-semantic-display');
      if (displayKey) {
        const resolved = resolveRawKey(displayKey, context);
        this.getOrCreateEntry(resolved).displayEls.push(el);
        trackedKeys.push(resolved);
      }

      // data-semantic-{attr}
      for (const name of getTextAttrs(el)) {
        if (name === 'data-semantic' || name === 'data-semantic-display' || name === 'data-semantic-list') continue;
        const targetAttr = name.slice('data-semantic-'.length);
        const val = el.getAttribute(name);
        if (val) {
          const resolved = resolveRawKey(val, context);
          this.getOrCreateEntry(resolved).attrBindings.push({ el, attr: targetAttr });
          trackedKeys.push(resolved);
        }
      }

      // Don't recurse into nested list containers
      if (el.getAttribute('data-semantic-list')) continue;
    }
  }

  applyKeys(keys) {
    for (const key of keys) {
      this.applyKey(key);
    }
  }

  applyKey(key) {
    const entry = this.index.get(key);
    if (!entry) return;

    const value = getValueByPath(this.dict, key);

    // display 绑定：独立处理，不走提前返回
    for (const el of entry.displayEls) {
      if (value === undefined || value === null || value === false || value === '') {
        el.style.display = 'none';
      } else if (value === true) {
        el.style.display = '';
      } else {
        el.style.display = String(value);
      }
    }

    // text 绑定和 attr 绑定：缺失数据时清空
    if (value === undefined || value === null) {
      for (const el of entry.textEls) el.textContent = '';
      for (const { el, attr } of entry.attrBindings) el.removeAttribute(attr);
      if (this.warnOnMissing) {
        this.warn(`key "${key}" 未提供（undefined/null），已清空对应 DOM`);
      }
      return;
    }

    if (typeof value === 'object') {
      this.warn(`key "${key}" 绑定到非标量值（对象/数组），已跳过渲染`);
      return;
    }

    const strVal = String(value);

    for (const el of entry.textEls) el.textContent = strVal;
    for (const { el, attr } of entry.attrBindings) el.setAttribute(attr, strVal);
  }

  injectSemanticMeta() {
    if (typeof document === 'undefined' || !document.head) return;
    if (!document.querySelector('meta[name="data-semantic"]')) {
      const meta = document.createElement('meta');
      meta.name = 'data-semantic';
      meta.content = PROTOCOL_VERSION;
      document.head.appendChild(meta);
    }
  }

  warn(msg) {
    if (this.warnOnMissing) {
      console.warn(`[data-semantic] ${msg}`);
    }
  }
}
