/**
 * data-semantic 运行时测试（jsdom）
 * 运行：npm test
 */
import { JSDOM } from 'jsdom';
import assert from 'node:assert';

let pass = 0;
let fail = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      pass++;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      fail++;
      console.error(`  ✗ ${name}`);
      console.error(err.message);
    });
}

function createDom(html) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`);
  return dom;
}

async function loadRuntime(dom) {
  global.window = dom.window;
  global.document = dom.window.document;
  const { DataSemanticRuntime, DataSemantic } = await import('../src/index.js');
  return { DataSemanticRuntime, DataSemantic };
}

const html = `
  <h1 data-semantic="page.title">default</h1>
  <p data-semantic="user.name"></p>
  <p data-semantic="user.addresses.0.city"></p>
  <input data-semantic-placeholder="search.placeholder">
  <img data-semantic-src="avatar" data-semantic-alt="user.name">
  <a data-semantic-href="link.url">link</a>
  <meta data-semantic-content="seo.description">
  <span data-semantic-data-role="user.role"></span>
  <span data-semantic-style="user.name" style="color:red"></span>
  <div data-semantic="missingKey">keep-me</div>
  <p data-semantic="user.age"></p>
`;

const dom = createDom(html);

// jsdom 环境相关全局（供运行时内部使用）
Object.assign(global, {
  window: dom.window,
  document: dom.window.document,
  Node: dom.window.Node,
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement
});

const { DataSemanticRuntime, DataSemantic } = await loadRuntime(dom);
const d = dom.window.document;

// ==================== 测试用例 ====================

await test('首次 render 自动挂载并渲染文本绑定', () => {
  const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: false });
  rt.render({
    page: { title: 'Hello World' }
  });
  assert.strictEqual(d.querySelector('h1').textContent, 'Hello World');
});

await test('支持嵌套路径与数组索引', () => {
  const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: false });
  rt.render({
    user: { name: '张三', addresses: [{ city: '北京' }] }
  });
  assert.strictEqual(d.querySelector('p[data-semantic="user.name"]').textContent, '张三');
  assert.strictEqual(d.querySelector('p[data-semantic="user.addresses.0.city"]').textContent, '北京');
});

await test('白名单属性绑定（placeholder/src/alt/href/content）', () => {
  const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: false });
  rt.render({
    search: { placeholder: '请输入关键词' },
    avatar: 'a.png',
    user: { name: '张三' },
    link: { url: '#/x' },
    seo: { description: 'desc' }
  });
  assert.strictEqual(d.querySelector('input').getAttribute('placeholder'), '请输入关键词');
  assert.strictEqual(d.querySelector('img').getAttribute('src'), 'a.png');
  assert.strictEqual(d.querySelector('img').getAttribute('alt'), '张三');
  assert.strictEqual(d.querySelector('a').getAttribute('href'), '#/x');
  assert.strictEqual(d.querySelector('meta[data-semantic-content]').getAttribute('content'), 'desc');
});

await test('data-semantic-data-* 透传到 data-*', () => {
  const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: false });
  rt.render({ user: { role: 'admin' } });
  assert.strictEqual(d.querySelector('[data-semantic-data-role]').getAttribute('data-role'), 'admin');
});

await test('白名单外属性绑定被忽略并告警', () => {
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: true });
    rt.render({ user: { name: 'x' } });
  } finally {
    console.warn = origWarn;
  }
  assert.ok(warnings.some((w) => w.includes('style')));
  assert.strictEqual(d.querySelector('[data-semantic-style]').style.color, 'red');
});

await test('显式传 undefined 清空对应 DOM 并告警', () => {
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: true });
    rt.render({ missingKey: undefined }); // 显式删除字段
  } finally {
    console.warn = origWarn;
  }
  assert.strictEqual(d.querySelector('[data-semantic="missingKey"]').textContent, '');
  assert.ok(warnings.some((w) => w.includes('missingKey')));
});

await test('warnOnMissing=false 时缺失 key 不告警', () => {
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: false });
    rt.render({});
  } finally {
    console.warn = origWarn;
  }
  assert.strictEqual(warnings.filter((w) => w.includes('missingKey')).length, 0);
});

await test('相同顶层 key 集合 → 增量深合并', () => {
  const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: false });
  rt.render({ page: { title: 'A' }, user: { name: 'B', age: 20 } });
  // 相同顶层 key 集合 → 增量深合并，未提供的子字段保留
  rt.render({ page: { title: 'C' }, user: { age: 30 } });
  assert.strictEqual(d.querySelector('h1').textContent, 'C');
  assert.strictEqual(d.querySelector('p[data-semantic="user.name"]').textContent, 'B');
  assert.strictEqual(d.querySelector('p[data-semantic="user.age"]').textContent, '30');
});

await test('流式增量：不同顶层 key 分批渲染互不覆盖', () => {
  const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: false });
  rt.render({ page: { title: 'A' } });
  rt.render({ other: { x: 1 } }); // 不同顶层 key，纯增量合并
  assert.strictEqual(d.querySelector('h1').textContent, 'A');
});

await test('细粒度渲染：只更新传入路径，其余槽位保持原值', () => {
  const dom4 = createDom('<h1 data-semantic="page.title"></h1><p data-semantic="user.name"></p><img data-semantic-src="avatar">');
  const rt = new DataSemanticRuntime({ root: dom4.window.document.body, warnOnMissing: false });
  rt.render({ page: { title: 'A' }, user: { name: 'B' }, avatar: 'x.png' });
  rt.render({ page: { title: 'C' } }); // 只涉及 page.title
  const doc4 = dom4.window.document;
  assert.strictEqual(doc4.querySelector('h1').textContent, 'C');
  assert.strictEqual(doc4.querySelector('p').textContent, 'B');
  assert.strictEqual(doc4.querySelector('img').getAttribute('src'), 'x.png');
});

await test('AI 流式输出：小块数据高频注入，未涉及槽位不被打扰', () => {
  const dom5 = createDom('<h1 data-semantic="page.title"></h1><p data-semantic="user.name"></p>');
  const rt = new DataSemanticRuntime({ root: dom5.window.document.body, warnOnMissing: false });
  rt.render({ page: { title: '你' } });
  rt.render({ page: { title: '你好' } });
  rt.render({ user: { name: '助手' } });
  rt.render({ page: { title: '你好世界' } });
  const doc5 = dom5.window.document;
  assert.strictEqual(doc5.querySelector('h1').textContent, '你好世界');
  assert.strictEqual(doc5.querySelector('p').textContent, '助手');
});

await test('render({}) 为无操作，不重置已有渲染', () => {
  const dom6 = createDom('<h1 data-semantic="page.title"></h1>');
  const rt = new DataSemanticRuntime({ root: dom6.window.document.body, warnOnMissing: false });
  rt.render({ page: { title: 'keep' } });
  rt.render({});
  assert.strictEqual(dom6.window.document.querySelector('h1').textContent, 'keep');
});

await test('自定义 allowedAttrs 白名单生效', () => {
  const d2 = createDom('<div data-semantic-title="k"></div>');
  const rt = new DataSemanticRuntime({ root: d2.window.document.body, allowedAttrs: ['title'], warnOnMissing: false });
  rt.render({ k: 'tip' });
  assert.strictEqual(d2.window.document.querySelector('div').getAttribute('title'), 'tip');
});

await test('DOM 结构变化后自动重建索引', () => {
  const d3 = createDom('<p data-semantic="a">0</p>');
  const rt = new DataSemanticRuntime({ root: d3.window.document.body, warnOnMissing: false });
  rt.render({ a: '1' });
  // 动态新增绑定节点
  const p = d3.window.document.createElement('p');
  p.setAttribute('data-semantic', 'b');
  d3.window.document.body.appendChild(p);
  rt.render({ b: '2' });
  assert.strictEqual(p.textContent, '2');
});

await test('自动注入 data-semantic 协议 meta（注入到全局 document）', () => {
  const semantic = d.querySelector('meta[name="data-semantic"]');
  const semanticUi = d.querySelector('meta[name="semantic-ui"]');
  assert.ok(semantic, 'data-semantic meta 存在');
  assert.strictEqual(semantic.content, '1.0');
  assert.ok(semanticUi, 'semantic-ui meta 存在');
  assert.ok(semanticUi.content.includes('protocol=data-semantic'));
});

await test('destroy 后渲染被忽略', () => {
  const rt = new DataSemanticRuntime({ root: d.body, warnOnMissing: false });
  rt.render({ page: { title: 'keep' } });
  rt.destroy();
  rt.render({ page: { title: 'gone' } });
  assert.strictEqual(d.querySelector('h1').textContent, 'keep');
});

await test('默认导出单例可渲染（浏览器绑定 document）', () => {
  DataSemantic.render({ page: { title: '单例' } });
  assert.strictEqual(d.querySelector('h1').textContent, '单例');
});

// ==================== 结果汇总 ====================
console.log(`\n共 ${pass + fail} 个用例，通过 ${pass}，失败 ${fail}`);
if (fail > 0) {
  process.exit(1);
}
