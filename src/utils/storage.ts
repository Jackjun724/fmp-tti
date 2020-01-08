/* eslint-disable no-empty */

const storage = localStorage;

/**
 * 保存数据
 * @param key {string}
 * @param value {string}
 */
export function setItem(key: string, value: string) {
    try {
        storage.setItem(key, value);
    } catch (ex) {}
}

/**
 * 获取数据
 * @param key {string}
 * @returns {string}
 */
export function getItem(key: string) {
    try {
        return storage.getItem(key);
    } catch (ex) {}
}

/**
 * 删除数据
 * @param key {string}
 */
export function removeItem(key: string) {
    try {
        return storage.removeItem(key);
    } catch (ex) {}
}
