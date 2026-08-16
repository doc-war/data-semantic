/**
 * data-semantic 类型声明
 */

export interface DataSemanticRuntimeOptions {
  /** 根元素或文档对象，默认 document */
  root?: HTMLElement | Document;
  /** 允许通过 data-semantic-<attr> 注入的属性白名单 */
  allowedAttrs?: string[];
  /** 是否在控制台警告缺失 key / 非法属性，默认仅开发环境开启 */
  warnOnMissing?: boolean;
}

export declare class DataSemanticRuntime {
  constructor(options?: DataSemanticRuntimeOptions);

  /**
   * 渲染数据
   * - 首次调用：自动建立索引 + 全量渲染
   * - 后续调用：自动判断增量更新或全量替换
   * - DOM 结构变化：自动检测并重建索引
   */
  render(data: Record<string, unknown>): void;

  /** 销毁实例，释放内存（用于 SPA 或组件卸载） */
  destroy(): void;
}

/** 开箱即用的全局单例 */
export declare const DataSemantic: DataSemanticRuntime;

export default DataSemantic;
