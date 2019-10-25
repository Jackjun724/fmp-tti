var index = (function (window, document) {
    var windowHeight = window.innerHeight, performance = window.performance, setTimeout = window.setTimeout;
    var timing = performance && performance.timing;
    /** requestStart时间 */
    var START_TIME = timing && timing.requestStart;
    /** 页面周期，超过5秒强制上报 */
    var DURATION = window.TTI_LIMIT || 5000;
    /** FMP计算区间 */
    var FMP_DURATION = 50;
    /** 是否开启统计 */
    var enabled = true;
    /**
     * 检测完成回调
     * @param result {Object} 检测结果
     * @param result.fcp {number}
     * @param result.fmp {number}
     * @param result.tti {number}
     */
    var onEnded;
    /** FCP（首次内容渲染） */
    var fcp;
    /** FMP（首次有意义渲染） */
    var fmp;
    /** TTI时间，值为-1表示正在计算 */
    var tti;
    var ended;
    var currentPaintPoint;
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
    function getText(node) {
        var text = node.textContent;
        return text && text.trim();
    }
    /** 是否已经出发DomReady */
    var isReady;
    /** DomReady时要执行的方法 */
    var onReady;
    /**
     * DOMContentLoaded 后触发
     * @param next {Function}
     */
    function domReady(next) {
        if (isReady) {
            next();
        }
        else {
            onReady = next;
        }
    }
    /**
     * 是否是有内容的文本标签
     * @param node {Node} 元素节点
     */
    function isContentText(node) {
        return node && node.nodeType === 1 && getText(node) && isContentElement(node.parentElement);
    }
    /**
     * 是否是有效的内容标签
     * @param node {HTMLElement} 元素节点
     */
    function isContentElement(node) {
        var tagName = node && node.tagName;
        return tagName && !/^(?:HEAD|META|LINK|STYLE|SCRIPT)$/.test(tagName);
    }
    /**
     * 测试节点得分
     * @param node {HTMLElement} 待检测节点
     * @returns {number} 得分
     */
    function checkNodeScore(node) {
        var score = 0;
        if (node !== document.body) {
            // 只看一屏内的标签
            var domReac = node.getBoundingClientRect();
            if (domReac.top < windowHeight) {
                if (domReac.width > 0 && domReac.height > 0) {
                    var isImage = node.tagName === 'IMG';
                    if (!isImage) {
                        if (getText(node) || getComputedStyle(node).backgroundImage !== 'none') {
                            // 只统计首屏内元素，不再需要根据top值来计算得分
                            // score += top > windowHeight ? (windowHeight / top) * (windowHeight / top) : 1;
                            score = 1;
                            // 加上子元素得分
                            var childNodes = node.childNodes;
                            if (childNodes && childNodes.length) {
                                score += checkNodeList(childNodes);
                            }
                        }
                    }
                    else if (!!node.src) {
                        score = 1;
                    }
                }
            }
        }
        return score;
    }
    var timer = 0;
    var ttiDuration = 1;
    /**
     * 检测可交互时间
     */
    function checkTTI() {
        if (timer > 0) {
            clearTimeout(timer);
        }
        // 标记开始计算TTI
        tti = 0;
        var startTime;
        var lastLongTaskTime;
        var checkLongTask = function () {
            if (enabled && !ended) {
                var lastFrameTime_1 = getNow();
                if (!startTime) {
                    startTime = lastLongTaskTime = lastFrameTime_1;
                }
                // ios 不支持 requestIdleCallback，所以都使用 setTimeout
                timer = setTimeout(function () {
                    var currentFrameTime = getNow();
                    var taskTime = currentFrameTime - lastFrameTime_1;
                    // 模仿tcp拥塞控制方式，根据耗时变化动态调整检测间隔，减少CPU消耗
                    if (taskTime - ttiDuration < 10) {
                        if (ttiDuration < 16) {
                            ttiDuration = ttiDuration * 2;
                        }
                        else if (ttiDuration < 25) {
                            ttiDuration = ttiDuration + 1;
                        }
                        else {
                            ttiDuration = 25;
                        }
                    }
                    else if (taskTime > 50) {
                        ttiDuration = Math.max(1, ttiDuration / 2);
                    }
                    if (currentFrameTime - lastFrameTime_1 > 50) {
                        lastLongTaskTime = currentFrameTime;
                    }
                    if (currentFrameTime - lastLongTaskTime > 1000 || currentFrameTime - START_TIME > 5000) {
                        tti = lastLongTaskTime - START_TIME;
                    }
                    else {
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
    function addScore(score) {
        if (score > 0) {
            var time = getNow() - START_TIME;
            var paintPoint = {
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
            var targetFmp = paintPoint;
            while ((paintPoint = paintPoint.p)) {
                if (time - paintPoint.t > FMP_DURATION) {
                    // 超过判断区间，中断链表遍历
                    delete paintPoint.p;
                }
                else {
                    score += paintPoint.s;
                    if (paintPoint.s > targetFmp.s) {
                        targetFmp = paintPoint;
                    }
                }
            }
            var fmpScore = fmp ? fmp.m : 0;
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
    function addImgScore() {
        addScore(checkNodeScore(this));
        this.removeEventListener('load', addImgScore);
    }
    /**
     * 测试节点列表得分
     * @param nodes {NodeList} 节点列表
     * @returns {number} 得分
     */
    function checkNodeList(nodes) {
        var score = 0;
        for (var i = 0, l = nodes.length; i < l; i++) {
            var node = nodes[i];
            if (node.tagName === 'IMG') {
                node.addEventListener('load', addImgScore);
            }
            else if (isContentElement(node)) {
                score += checkNodeScore(node);
            }
            else if (isContentText(node)) {
                score += 1;
            }
        }
        return score;
    }
    if (!enabled || !START_TIME || typeof MutationObserver !== 'function') {
        ended = true;
    }
    else {
        document.addEventListener('DOMContentLoaded', function () {
            isReady = true;
            if (onReady) {
                onReady();
            }
        });
        var observer_1 = new MutationObserver(function (records) {
            // 等到body标签初始化完才开始计算
            if (enabled && document.body) {
                var score_1 = 0;
                records.forEach(function (record) {
                    score_1 += checkNodeList(record.addedNodes);
                });
                addScore(score_1);
            }
        });
        observer_1.observe(document, {
            childList: true,
            subtree: true
        });
        // 上报统计结果
        setTimeout(function () {
            if (!ended) {
                ended = true;
                observer_1.disconnect();
                if (enabled && typeof onEnded === 'function') {
                    var slow = DURATION * 2;
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
        stop: function () {
            enabled = false;
        },
        /**
         * 检测完成后触发
         * @param callback({ fcp, fmp, tti }) {Function}
         */
        then: function (callback) {
            onEnded = callback;
        }
    };
})(window, document);

export default index;
