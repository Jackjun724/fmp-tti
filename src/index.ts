import * as storage from './utils/storage'
import getText from './utils/getText';
import isContentElement from './utils/isContentElement';
import isContentText from './utils/isContentText';

/** 渲染统计点 */
interface SpdPoint {
    /** 距离 navigationStart 时间 */
    t: number;
    /** 和上一个点相比增加得分 */
    s: number;
    /** FMP得分 */
    m: number;
    /** 用链表的方式记录上一个渲染点 */
    p: SpdPoint;
}

/** 测速结果 */
interface SpdResult {
    /** fcp时间 */
    fcp: number;
    /** fmp时间 */
    fmp: number;
    /** tti时间 */
    tti: number;
}

// 使用临时变量，建设压缩后的文件大小
const win = window;
const doc = document;

const { innerHeight: windowHeight, performance, setTimeout } = win;
let timing = performance && performance.timing;
/** 开始时间 */
const START_TIME: number = timing && timing.navigationStart;
/** 页面周期，超过10秒强制上报 */
const DURATION: number = (<any>win).TTI_LIMIT || 10000;
/** FMP计算区间 */
const FMP_DURATION: number = 50;

/** 用来存储检测结果 */
const cacheKey = `ft-${location.pathname}`;

/** 是否开启统计 */
let enabled = true;
/**
 * 检测完成回调
 * @param result {SpdResult} 检测结果
 */
let onEnded: Function;

/** FCP（首次内容渲染） */
let fcp: SpdPoint;
/** FMP（首次有意义渲染） */
let fmp: SpdPoint;
let ended: boolean;
let currentPaintPoint: SpdPoint;
let result: SpdResult;
let lastResult: string;

/** 是否已经出发DomReady */
let isReady: boolean;
/** DomReady时要执行的方法 */
let onReady: Function;

/**
 * 获取从 navigationStart 到当前的时间
 * @returns {number}
 */
function getNow(): number {
    return Date.now() - START_TIME;
}

/**
 * 测试节点得分
 * @param node {HTMLElement} 待检测节点
 * @returns {number} 得分
 */
function checkNodeScore(node: HTMLElement): number {
    let score = 0;
    if (node !== doc.body) {
        // 只看一屏内的标签
        const domReac = node.getBoundingClientRect();
        if (domReac.top < windowHeight) {
            if (domReac.width > 0 && domReac.height > 0) {
                const isImage = node.tagName === 'IMG';
                if (!isImage) {
                    if (getText(node) || getComputedStyle(node).backgroundImage !== 'none') {
                        // 只统计首屏内元素，不再需要根据top值来计算得分
                        // score += top > windowHeight ? (windowHeight / top) * (windowHeight / top) : 1;
                        score = 1;
                        // 加上子元素得分
                        const { childNodes } = node;
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
    clearTimeout(timer);
    // 标记开始计算TTI
    let startTime: number;
    let lastLongTaskTime: number;
    function checkLongTask() {
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
                if (currentFrameTime - lastLongTaskTime > 1000 || currentFrameTime > DURATION) {
                    // 记录下来，如果页面被关闭，下次打开时可以使用本次结果上报
                    result = {
                        fcp: fcp.t,
                        fmp: fmp.t,
                        tti: lastLongTaskTime
                    };
                    storage.setItem(cacheKey, JSON.stringify(result));
                } else {
                    checkLongTask();
                }
            }, ttiDuration);
        }
    }
    checkLongTask();
}

/**
 * 记录每阶段得分变化
 * @param score {number} 本次得分
 */
function addScore(score: number) {
    if (score > 0) {
        let time = getNow();
        let paintPoint: SpdPoint = {
            t: getNow(),
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
                if (isReady) {
                    checkTTI();
                } else {
                    onReady = checkTTI;
                }
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
function checkNodeList(nodes: NodeList): number {
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
    doc.addEventListener('DOMContentLoaded', () => {
        isReady = true;
        if (onReady) {
            onReady();
        }
    });
    let observer = new MutationObserver(records => {
        // 等到body标签初始化完才开始计算
        if (enabled && doc.body) {
            let score = 0;
            records.forEach(record => {
                score += checkNodeList(record.addedNodes);
            });
            addScore(score);
        }
    });
    observer.observe(doc, {
        childList: true,
        subtree: true
    });
    // 上报统计结果
    setTimeout(() => {
        if (!ended) {
            storage.removeItem(cacheKey);
            ended = true;
            observer.disconnect();
            if (enabled && typeof onEnded === 'function') {
                let now = getNow();
                onEnded(result || {
                    fcp: fcp ? fcp.t : now,
                    fmp: fmp ? fmp.t : now,
                    tti: now
                });
            }
        }
    }, DURATION);
    // 读取上次检测结果
    lastResult = storage.getItem(cacheKey);
}

export default {
    /** navigationStart时间 */
    startTime: START_TIME,
    /**
     * 获取从 navigationStart 到当前的时间
     * @returns {number}
     */
    now: getNow,
    /** 停止检测 */
    stop() {
        enabled = false;
    },
    /**
     * 检测是否有上次未完成的检测结果，有结果时会触发回调
     * @param callback({ fcp, fmp, tti }) {Function}
     */
    last(callback: Function) {
        if (lastResult) {
            try {
                callback(JSON.parse(lastResult));
                // eslint-disable-next-line no-empty
            } catch (error) { }
            storage.removeItem(cacheKey);
        }
    },
    /**
     * 检测完成后触发
     * @param callback({ fcp, fmp, tti }) {Function}
     */
    then(callback: Function) {
        onEnded = callback;
    }
};
