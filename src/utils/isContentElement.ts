/**
 * 是否是有效的内容标签
 * @param node {HTMLElement} 元素节点
 */
export default function isContentElement(node: HTMLElement) {
    let tagName = node && node.tagName;
    return tagName && !/^(?:HEAD|META|LINK|STYLE|SCRIPT)$/.test(tagName);
}
