/* eslint-disable no-empty */
import window from './window';

const { localStorage: storage } = window;

/**
 * 保存数据
 * @param {string} key
 * @param {string} value
 */
export function setItem(key: string, value: string) {
    try {
        storage.setItem(key, value);
    } catch (ex) { }
}

/**
 * 获取数据
 * @param {string} key
 * @returns {string}
 */
export function getItem(key: string): string {
    try {
        return storage.getItem(key);
    } catch (ex) { }
}

/**
 * 删除数据
 * @param {string} key
 */
export function removeItem(key: string) {
    try {
        return storage.removeItem(key);
    } catch (ex) { }
}
