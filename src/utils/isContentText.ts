import getText from './getText';
import isContentElement from './isContentElement';

/**
 * 是否是有内容的文本标签
 * @param {Node} node 元素节点
 */
export default function isContentText(node: Node): boolean {
    return node && node.nodeType === 1 && getText(node) && isContentElement(node.parentElement);
}
