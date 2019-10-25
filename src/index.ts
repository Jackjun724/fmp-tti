/** 渲染统计点 */
interface SpdPoint {
    /** 距离 requestStart 时间 */
    t: number;
    /** 和上一个点相比增加得分 */
    s: number;
    /** FMP得分 */
    m: number;
    /** 用链表的方式记录上一个渲染点 */
    p: SpdPoint;
}

export default (function(window: Window, document: Document) {
    const { innerHeight: windowHeight, performance, setTimeout } = window;
    let timing = performance && performance.timing;
    /** requestStart时间 */
    const START_TIME: number = timing && timing.requestStart;
    /** 页面周期，超过5秒强制上报 */
    const DURATION: number = (<any>window).TTI_LIMIT || 5000;
    /** FMP计算区间 */
    const FMP_DURATION: number = 50;

    /** 是否开启统计 */
    let enabled = true;
    /**
     * 检测完成回调
     * @param result {Object} 检测结果
     * @param result.fcp {number}
     * @param result.fmp {number}
     * @param result.tti {number}
     */
    let onEnded: Function;

    /** FCP（首次内容渲染） */
    let fcp: SpdPoint;
    /** FMP（首次有意义渲染） */
    let fmp: SpdPoint;
    /** TTI时间，值为-1表示正在计算 */
    let tti: number;
    let ended: boolean;
    let currentPaintPoint: SpdPoint;

    /**
     * 获取当前系统时间
     * @returns {number} 当前系统时间戳
     */
    function getNow() {
        return Date.now();
    }

    /**
     * 获取节点文本内容
     * @param node {Node} 元素节点
     * @returns {string} 文本内容
     */
    function getText(node: Node): string {
        let text = node.textContent;
        return text && text.trim();
    }

    /** 是否已经出发DomReady */
    let isReady: boolean;
    /** DomReady时要执行的方法 */
    let onReady: Function;

    /**
     * DOMContentLoaded 后触发
     * @param next {Function}
     */
    function domReady(next: Function) {
        if (isReady) {
            next();
        } else {
            onReady = next;
        }
    }

    /**
     * 是否是有内容的文本标签
     * @param node {Node} 元素节点
     */
    function isContentText(node: Node) {
        return node && node.nodeType === 1 && getText(node) && isContentElement(node.parentElement);
    }

    /**
     * 是否是有效的内容标签
     * @param node {HTMLElement} 元素节点
     */
    function isContentElement(node: HTMLElement) {
        let tagName = node && node.tagName;
        return tagName && !/^(?:HEAD|META|LINK|STYLE|SCRIPT)$/.test(tagName);
    }

    /**
     * 测试节点得分
     * @param node {HTMLElement} 待检测节点
     * @returns {number} 得分
     */
    function checkNodeScore(node: HTMLElement) {
        let score = 0;
        if (node !== document.body) {
            // 只看一屏内的标签
            let domReac = node.getBoundingClientRect();
            if (domReac.top < windowHeight) {
                if (domReac.width > 0 && domReac.height > 0) {
                    let isImage = node.tagName === 'IMG';
                    if (!isImage) {
                        if (getText(node) || getComputedStyle(node).backgroundImage !== 'none') {
                            // 只统计首屏内元素，不再需要根据top值来计算得分
                            // score += top > windowHeight ? (windowHeight / top) * (windowHeight / top) : 1;
                            score = 1;
                            // 加上子元素得分
                            let { childNodes } = node;
                            if (childNodes && childNodes.length) {
                                score += checkNodeList(childNodes);
                            }
                        }
                    } else if (!!(<HTMLImageElement>node).src) {
                        score = 1;
                    }
                }
            }
        }
        return score;
    }

    let timer = 0;
    let ttiDuration = 1;
    /**
     * 检测可交互时间
     */
    function checkTTI() {
        if (timer > 0) {
            clearTimeout(timer);
        }
        // 标记开始计算TTI
        tti = 0;
        let startTime: number;
        let lastLongTaskTime: number;
        let checkLongTask = () => {
            if (enabled && !ended) {
                let lastFrameTime = getNow();
                if (!startTime) {
                    startTime = lastLongTaskTime = lastFrameTime;
                }
                // ios 不支持 requestIdleCallback，所以都使用 setTimeout
                timer = setTimeout(() => {
                    let currentFrameTime = getNow();
                    let taskTime = currentFrameTime - lastFrameTime;
                    // 模仿tcp拥塞控制方式，根据耗时变化动态调整检测间隔，减少CPU消耗
                    if (taskTime - ttiDuration < 10) {
                        if (ttiDuration < 16) {
                            ttiDuration = ttiDuration * 2;
                        } else if (ttiDuration < 25) {
                            ttiDuration = ttiDuration + 1;
                        } else {
                            ttiDuration = 25;
                        }
                    } else if (taskTime > 50) {
                        ttiDuration = Math.max(1, ttiDuration / 2);
                    }
                    if (currentFrameTime - lastFrameTime > 50) {
                        lastLongTaskTime = currentFrameTime;
                    }
                    if (currentFrameTime - lastLongTaskTime > 1000 || currentFrameTime - START_TIME > 5000) {
                        tti = lastLongTaskTime - START_TIME;
                    } else {
                        checkLongTask();
                    }
                }, ttiDuration);
            }
        };
        checkLongTask();
    }

    /**
     * 记录每阶段得分变化
     * @param score {number} 本次得分
     */
    function addScore(score: number) {
        if (score > 0) {
            let time = getNow() - START_TIME;
            let paintPoint: SpdPoint = {
                t: getNow() - START_TIME,
                s: score,
                m: 0,
                p: currentPaintPoint
            };
            currentPaintPoint = paintPoint;
            if (!fcp) {
                fcp = paintPoint;
            }
            // 选取得分变化最大的区间中得分变化最大的点作为FMP
            let targetFmp = paintPoint;
            while ((paintPoint = paintPoint.p)) {
                if (time - paintPoint.t > FMP_DURATION) {
                    // 超过判断区间，中断链表遍历
                    delete paintPoint.p;
                } else {
                    score += paintPoint.s;
                    if (paintPoint.s > targetFmp.s) {
                        targetFmp = paintPoint;
                    }
                }
            }
            let fmpScore = fmp ? fmp.m : 0;
            if (score >= fmpScore) {
                targetFmp.m = score;
                if (fmp !== targetFmp) {
                    fmp = targetFmp;
                    // 计算TTI
                    domReady(checkTTI);
                }
            }
        }
    }

    /**
     * 计算并记录图片节点得分
     * @param event {Event}
     */
    function addImgScore(this: HTMLImageElement) {
        addScore(checkNodeScore(this));
        this.removeEventListener('load', addImgScore);
    }

    /**
     * 测试节点列表得分
     * @param nodes {NodeList} 节点列表
     * @returns {number} 得分
     */
    function checkNodeList(nodes: NodeList) {
        let score = 0;
        for (let i = 0, l = nodes.length; i < l; i++) {
            let node = nodes[i]
            if ((<HTMLElement>node).tagName === 'IMG') {
                node.addEventListener('load', addImgScore);
            } else if (isContentElement(<HTMLElement>node)) {
                score += checkNodeScore(<HTMLElement>node);
            } else if (isContentText(node)) {
                score += 1;
            }
        }
        return score;
    }

    if (!enabled || !START_TIME || typeof MutationObserver !== 'function') {
        ended = true;
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            isReady = true;
            if (onReady) {
                onReady();
            }
        });
        let observer = new MutationObserver(records => {
            // 等到body标签初始化完才开始计算
            if (enabled && document.body) {
                let score = 0;
                records.forEach(record => {
                    score += checkNodeList(record.addedNodes);
                });
                addScore(score);
            }
        });
        observer.observe(document, {
            childList: true,
            subtree: true
        });
        // 上报统计结果
        setTimeout(() => {
            if (!ended) {
                ended = true;
                observer.disconnect();
                if (enabled && typeof onEnded === 'function') {
                    let slow = DURATION * 2;
                    onEnded({
                        fcp: fcp ? fcp.t : slow,
                        fmp: fmp ? fmp.t : slow,
                        tti: tti > 0 ? tti : slow
                    });
                }
            }
        }, DURATION);
    }

    return {
        /** requestStart时间 */
        startTime: START_TIME,
        /**
         * 获取当前系统时间
         * @returns {number} 当前系统时间戳
         */
        now: getNow,
        /** 停止检测 */
        stop() {
            enabled = false;
        },
        /**
         * 检测完成后触发
         * @param callback({ fcp, fmp, tti }) {Function}
         */
        then(callback: Function) {
            onEnded = callback;
        }
    };
})(window, document);
