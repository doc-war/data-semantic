/**
 * data-semantic 运行时核心
 * 实现 data-semantic 声明式数据绑定协议
 */
import {
  DEFAULT_ALLOWED_ATTRS,
  getValueByPath,
  deepMerge,
  collectLeafPaths,
  getTextAttrs,
  isDataAttr
} from './utility.js';

const PROTOCOL_VERSION = '1.0';

export class DataSemanticRuntime {
  constructor(options = {}) {
    this.dict = {};
    this.index = new Map();
    this.root = options.root ?? (typeof document !== 'undefined' ? document : null);
    this.allowedAttrs = new Set(
      (options.allowedAttrs ?? DEFAULT_ALLOWED_ATTRS).map((a) => a.toLowerCase())
    );
    this.warnOnMissing =
      options.warnOnMissing ??
      (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production');
    this.isMounted = false;
    this.observer = null;

    // 自动注入语义声明（仅浏览器环境）
    this.injectSemanticMeta();
  }

  /**
   * 渲染数据（细粒度增量）
   * - 首次调用：自动建立槽位索引（缓存全部 data-semantic 绑定）+ 挂载 MutationObserver
   * - 后续调用：纯增量深合并，只渲染本次传入数据实际涉及的槽位
   * - 结构变化：MutationObserver 自动检测，增量重建索引
   * - 删除字段：显式传 undefined（如 { user: { age: undefined } } 清空对应槽位）
   */
  render(data) {
    if (data === null || typeof data !== 'object') {
      this.warn('render 需要传入对象');
      return;
    }

    // 1. 首次调用时自动挂载（建立索引 + 观察 DOM 结构）
    if (!this.isMounted) {
      if (!this.root) {
        this.warn('未提供 root，渲染被忽略');
        return;
      }
      this.mount();
    }

    // 2. 同步消费挂起的 DOM 变更，确保索引新鲜（无需全量扫描 DOM）
    if (this.observer) {
      const records = this.observer.takeRecords();
      if (records.length) this.processMutations(records);
    }

    // 3. 收集本次数据涉及的叶子路径
    const keys = collectLeafPaths(data);

    // 4. 纯增量深合并数据源
    this.dict = deepMerge(this.dict, data);

    // 5. 细粒度渲染：只更新本次涉及的槽位
    this.applyKeys(keys);
  }

  /** 销毁实例，释放内存（用于 SPA 或组件卸载） */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.index.clear();
    this.root = null;
    this.dict = {};
    this.isMounted = false;
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /** 挂载：建立 DOM 索引（缓存全部槽位）+ 挂载 MutationObserver 观察结构变化 */
  mount() {
    if (!this.root) return;
    this.buildIndex();
    this.isMounted = true;

    // 从 root 所属 window 获取构造函数（不依赖全局，适配多 window / jsdom 环境）
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

  /**
   * 处理 DOM 变更：仅当与 data-semantic 槽位结构相关时重建索引。
   * 渲染自身的 textContent / 普通属性变化会被过滤，避免无谓重建。
   */
  processMutations(mutations) {
    if (!this.isMounted) return;
    const relevant = mutations.some((m) => {
      if (m.type === 'attributes') {
        return m.attributeName === 'data-semantic' || m.attributeName.startsWith('data-semantic-');
      }
      if (m.type === 'childList') {
        return [...m.addedNodes, ...m.removedNodes].some(
          (n) => n.nodeType === 1 && getTextAttrs(n).length > 0
        );
      }
      return false;
    });
    if (relevant) this.buildIndex();
  }

  /** 扫描 DOM，构建 key → 元素映射 */
  buildIndex() {
    if (!this.root) return;
    this.index.clear();

    // CSS 无法用属性名前缀匹配 data-semantic-*，因此扫描全部元素后过滤
    const candidates = this.root.querySelectorAll('*');
    for (const el of candidates) {
      const textAttrs = getTextAttrs(el);
      if (textAttrs.length === 0) continue;

      // --- data-semantic（Node.textContent 绑定）---
      const textKey = el.getAttribute('data-semantic');
      if (textKey) {
        this.getOrCreateEntry(textKey).textEls.push(el);
      }

      // --- data-semantic-{attr}（Element.setAttribute 绑定）---
      for (const name of textAttrs) {
        if (name === 'data-semantic') continue;
        const targetAttr = name.slice('data-semantic-'.length);

        // 允许 data-* 透传，其他需在白名单内
        if (!isDataAttr(targetAttr) && !this.allowedAttrs.has(targetAttr.toLowerCase())) {
          this.warn(`属性 "${targetAttr}" 不在白名单中，已忽略绑定 "${name}"`);
          continue;
        }

        const key = el.getAttribute(name);
        if (key) {
          this.getOrCreateEntry(key).attrBindings.push({ el, attr: targetAttr });
        }
      }
    }
  }

  /** 获取或创建索引条目 */
  getOrCreateEntry(key) {
    let entry = this.index.get(key);
    if (!entry) {
      entry = { textEls: [], attrBindings: [] };
      this.index.set(key, entry);
    }
    return entry;
  }

  /** 只渲染指定的 key 列表（细粒度增量渲染） */
  applyKeys(keys) {
    for (const key of keys) {
      this.applyKey(key);
    }
  }

  /** 渲染单个 key 对应的所有 DOM 节点 */
  applyKey(key) {
    const entry = this.index.get(key);
    if (!entry) return;

    const value = getValueByPath(this.dict, key);

    // 如果 value 为 undefined，清空对应的 DOM（适合删除场景）
    if (value === undefined) {
      for (const el of entry.textEls) {
        el.textContent = '';
      }
      for (const { el, attr } of entry.attrBindings) {
        el.removeAttribute(attr);
      }
      if (this.warnOnMissing) {
        this.warn(`key "${key}" 未提供，已清空对应 DOM`);
      }
      return;
    }

    const strVal = String(value);
    // 文本节点
    for (const el of entry.textEls) {
      el.textContent = strVal;
    }
    // 属性节点
    for (const { el, attr } of entry.attrBindings) {
      el.setAttribute(attr, strVal);
    }
  }

  /** 注入 data-semantic 协议声明 */
  injectSemanticMeta() {
    if (typeof document === 'undefined' || !document.head) return;

    if (!document.querySelector('meta[name="data-semantic"]')) {
      const meta = document.createElement('meta');
      meta.name = 'data-semantic';
      meta.content = PROTOCOL_VERSION;
      document.head.appendChild(meta);
    }

    if (!document.querySelector('meta[name="semantic-ui"]')) {
      const meta = document.createElement('meta');
      meta.name = 'semantic-ui';
      meta.content = `protocol=data-semantic; version=${PROTOCOL_VERSION}; runtime=data-semantic`;
      document.head.appendChild(meta);
    }
  }

  /** 控制台警告（受 warnOnMissing 控制） */
  warn(msg) {
    if (this.warnOnMissing) {
      console.warn(`[data-semantic] ${msg}`);
    }
  }
}
