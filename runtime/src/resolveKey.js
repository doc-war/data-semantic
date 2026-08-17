/**
 * data-semantic key resolution
 * Handles absolute, relative (.key), and numbered ([n]) keys.
 */

/**
 * Classify a raw key into its type.
 * @param {string} raw
 * @returns {'absolute'|'relative'|'numbered'}
 */
export function classifyKey(raw) {
  if (raw.startsWith('.')) return 'relative';
  if (raw.startsWith('[') || /\[\d+\]/.test(raw)) return 'numbered';
  return 'absolute';
}

/**
 * Detect legacy dot-subscript pattern (e.g. "pages.list.0.name").
 * This is deprecated — tools should warn.
 * @param {string} raw
 * @returns {boolean}
 */
export function isLegacySubscript(raw) {
  return /\.\d+(?=\.|$)/.test(raw);
}

/**
 * Strip bracket segments and convert to pure dot-notation.
 * "list[0].title" → "list.0.title"
 * "a[0].b[1].c" → "a.0.b.1.c"
 * @param {string} path
 * @returns {string}
 */
function expandBrackets(path) {
  return path.replace(/\[(\d+)\]/g, '.$1');
}

/**
 * Resolve a raw key to a full dot-notation path given a context.
 *
 * - absolute: returns expanded key as-is (from data root)
 * - relative: strips leading '.', expands brackets, prepends context
 * - numbered: expands brackets, prepends context
 *
 * @param {string} raw - The raw key value from the attribute
 * @param {string|null} context - The current semantic context (e.g. "categories.2"), or null for root
 * @returns {string} Resolved dot-notation path
 */
export function resolveRawKey(raw, context) {
  const type = classifyKey(raw);

  if (type === 'absolute') {
    return expandBrackets(raw);
  }

  // relative or numbered — resolve against context
  const base = context || '';

  if (type === 'relative') {
    // strip leading '.', expand brackets
    const rest = expandBrackets(raw.slice(1));
    return base ? `${base}.${rest}` : rest;
  }

  // numbered: expand brackets, prepend context
  const expanded = expandBrackets(raw);
  return base ? `${base}.${expanded}` : expanded;
}
