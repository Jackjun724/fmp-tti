/**
 * 获取节点文本内容
 * @param {Node} node 元素节点
 * @returns {string} 文本内容
 */
export default function getText(node: Node): string {
    let text = node.textContent;
    return text && text.trim();
}
