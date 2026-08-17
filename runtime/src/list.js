/**
 * data-semantic list rendering
 * Handles data-semantic-list containers: template caching, cloning, and context-aware rendering.
 */
import { resolveRawKey } from './resolveKey.js';
import { getValueByPath } from './utility.js';

/**
 * Discover all data-semantic-list containers in the DOM tree.
 * Returns an array of list entry descriptors.
 * @param {HTMLElement|Document} root
 * @returns {Array<{el: HTMLElement, key: string, template: string|null}>}
 */
export function discoverLists(root) {
  const lists = [];
  const candidates = root.querySelectorAll('*');
  for (const el of candidates) {
    const listKey = el.getAttribute('data-semantic-list');
    if (listKey) {
      lists.push({ el, key: listKey, template: null });
    }
  }
  return lists;
}

/**
 * Cache the original innerHTML of a list container as its template.
 * Must be called before first render clears the container.
 * @param {object} listEntry - { el, key, template }
 */
export function cacheTemplate(listEntry) {
  if (listEntry.template === null) {
    listEntry.template = listEntry.el.innerHTML;
  }
}

/**
 * Check if an element is a descendant of any list container in the given list map.
 * @param {HTMLElement} el
 * @param {Map<HTMLElement, object>} listMap - Map of list container elements to their entries
 * @returns {boolean}
 */
export function isInsideList(el, listMap) {
  let parent = el.parentElement;
  while (parent) {
    if (listMap.has(parent)) return true;
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Render a list container: clear, clone template for each array item, index bindings, apply data.
 *
 * @param {object} params
 * @param {object} params.listEntry - { el, key, template }
 * @param {object} params.dict - The merged data dictionary
 * @param {Map} params.index - The main binding index
 * @param {Function} params.warn - Warning function
 * @param {boolean} params.warnOnMissing - Whether to emit warnings
 * @returns {Array} Array of resolved paths that were rendered (for fine-grained tracking)
 */
export function renderList({ listEntry, dict, index, warn, warnOnMissing }) {
  const { el, key, template } = listEntry;

  // Resolve the list source
  const source = getValueByPath(dict, key);

  // Handle missing/non-array sources
  if (source === undefined) {
    // Keep original template DOM, warn
    if (warnOnMissing) warn(`list key "${key}" 未提供，保留原始模板`);
    return [];
  }

  if (source === null) {
    // Clear container
    el.innerHTML = '';
    return [];
  }

  if (!Array.isArray(source)) {
    // Protocol violation — error level
    warn(`list key "${key}" 指向非数组值（${typeof source}），协议违规，跳过渲染`);
    return [];
  }

  // Empty array — clear, no warning
  if (source.length === 0) {
    el.innerHTML = '';
    return [];
  }

  // Clear container and render items
  el.innerHTML = '';
  const renderedPaths = [];

  for (let i = 0; i < source.length; i++) {
    const itemContext = `${key}.${i}`;
    const fragment = document.createElement('template');
    fragment.innerHTML = template;
    const clone = fragment.content;

    // Index and apply bindings for this item
    indexListBindings(clone, itemContext, index);
    renderedPaths.push(itemContext);
  }

  return renderedPaths;
}

/**
 * Scan a cloned template fragment and index all data-semantic bindings
 * with resolved paths based on the item context.
 *
 * @param {DocumentFragment} fragment - The cloned template
 * @param {string} context - The resolved context (e.g. "categories.2")
 * @param {Map} index - The main binding index
 */
export function indexListBindings(fragment, context, index) {
  const candidates = fragment.querySelectorAll('*');
  for (const el of candidates) {
    // data-semantic (text binding)
    const textKey = el.getAttribute('data-semantic');
    if (textKey) {
      const resolved = resolveRawKey(textKey, context);
      getOrCreateEntry(index, resolved).textEls.push(el);
    }

    // data-semantic-display
    const displayKey = el.getAttribute('data-semantic-display');
    if (displayKey) {
      const resolved = resolveRawKey(displayKey, context);
      getOrCreateEntry(index, resolved).displayEls.push(el);
    }

    // data-semantic-{attr}
    const attrs = Array.from(el.attributes).filter(
      (a) => a.name.startsWith('data-semantic-') &&
        a.name !== 'data-semantic' &&
        a.name !== 'data-semantic-display' &&
        a.name !== 'data-semantic-list'
    );
    for (const attr of attrs) {
      const targetAttr = attr.name.slice('data-semantic-'.length);
      const key = attr.value;
      if (key) {
        const resolved = resolveRawKey(key, context);
        getOrCreateEntry(index, resolved).attrBindings.push({ el, attr: targetAttr });
      }
    }

    // Recurse into nested list containers (their own children are templates)
    const nestedListKey = el.getAttribute('data-semantic-list');
    if (nestedListKey) {
      // Don't index the nested list's children here — they'll be rendered separately
      // But we do need to index the nested list container's own bindings
      continue;
    }
  }
}

/**
 * Get or create an entry in the index map.
 * @param {Map} index
 * @param {string} key
 * @returns {{ textEls: Array, attrBindings: Array, displayEls: Array }}
 */
function getOrCreateEntry(index, key) {
  let entry = index.get(key);
  if (!entry) {
    entry = { textEls: [], attrBindings: [], displayEls: [] };
    index.set(key, entry);
  }
  return entry;
}
