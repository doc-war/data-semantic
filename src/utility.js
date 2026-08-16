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

/** 解析嵌套路径，支持数组索引，例如 "user.addresses.0.city" */
export function getValueByPath(obj, path) {
  if (!obj || typeof obj !== 'object') return undefined;
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    if (/^\d+$/.test(key) && Array.isArray(current)) {
      return current[parseInt(key, 10)];
    }
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
