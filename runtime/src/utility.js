/**
 * data-semantic 通用工具函数
 * 与 DOM 无关的纯逻辑，可独立在 Node.js 环境测试
 */

/** 默认属性白名单（遵循 data-semantic 协议） */
export const DEFAULT_ALLOWED_ATTRS = [
  'placeholder', 'title', 'alt', 'value',
  'href', 'src', 'aria-label', 'aria-description', 'content'
];

/** 判断属性名是否为 data-*（透传自定义数据属性） */
export function isDataAttr(name) {
  return name.startsWith('data-');
}

/**
 * 解析嵌套路径，支持数组索引和括号语法。
 * 例如 "user.addresses.0.city"、"list[0].title"、"a[0].b[1].c"
 * @param {object} obj
 * @param {string} path - Dot-notation path, may contain [n] brackets
 * @returns {*} Resolved value or undefined
 */
export function getValueByPath(obj, path) {
  if (!obj || typeof obj !== 'object') return undefined;
  // Expand bracket syntax: "list[0].title" → "list.0.title"
  const expanded = path.replace(/\[(\d+)\]/g, '.$1');
  return expanded.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, obj);
}

/** 深度合并对象（数组直接覆盖） */
export function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return source;
  if (Array.isArray(source)) return source; // 数组不递归合并

  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
      result[key] = deepMerge(result[key] || {}, srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * 递归收集数据对象中的所有叶子路径（标量 / undefined / null / 数组索引）。
 * 例如 { user: { name: 'a', tags: ['x'] } } → ["user.name", "user.tags.0"]
 * 用于细粒度渲染：只更新本次传入数据实际涉及的槽位。
 */
export function collectLeafPaths(value, prefix = '', out = []) {
  if (value === null || typeof value !== 'object') {
    out.push(prefix);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectLeafPaths(item, prefix ? `${prefix}.${index}` : `${index}`, out);
    });
    return out;
  }
  for (const key of Object.keys(value)) {
    collectLeafPaths(value[key], prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

/** 获取元素上所有 data-semantic 相关绑定的属性名（data-semantic、data-semantic-*） */
export function getTextAttrs(el) {
  return Array.from(el.attributes)
    .map((a) => a.name)
    .filter((name) => name === 'data-semantic' || name.startsWith('data-semantic-'));
}

/**
 * 收集数组收缩后越界的索引路径（新数据较旧数据缩短的索引段），供清空多余槽位。
 * 例如 newVal={ list: ['a'] }, oldVal={ list: ['a','b','c'] } → ["list.1", "list.2"]
 */
export function collectShrunkLeaves(newVal, oldVal, prefix = '', out = []) {
  if (Array.isArray(newVal)) {
    if (Array.isArray(oldVal) && oldVal.length > newVal.length) {
      for (let i = newVal.length; i < oldVal.length; i++) {
        out.push(prefix ? `${prefix}.${i}` : `${i}`);
      }
    }
    return out;
  }
  if (newVal && typeof newVal === 'object' && oldVal && typeof oldVal === 'object') {
    for (const key of Object.keys(newVal)) {
      collectShrunkLeaves(newVal[key], oldVal[key], prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}
