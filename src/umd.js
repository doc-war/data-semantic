/**
 * UMD 构建专用入口
 * 仅暴露默认单例，使全局 DataSemantic 直接指向单例实例（可调用 DataSemantic.render）
 */
import DataSemantic from './index.js';

export default DataSemantic;
