/**
 * data-semantic 入口文件
 * 导出运行时核心与开箱即用的全局单例
 */
import { DataSemanticRuntime } from './runtime.js';

export { DataSemanticRuntime };

/** 开箱即用的全局单例（浏览器环境绑定 document，SSR/Node 环境下 root 为空，渲染时自动忽略） */
const DataSemantic = new DataSemanticRuntime({
  root: typeof document !== 'undefined' ? document : undefined
});

export default DataSemantic;
export { DataSemantic };

// 浏览器全局挂载（UMD / CDN 场景）
if (typeof window !== 'undefined' && typeof window.DataSemantic === 'undefined') {
  window.DataSemantic = DataSemantic;
  window.DataSemanticRuntime = DataSemanticRuntime;
}
