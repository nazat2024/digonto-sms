/**
 * Polyfills for older Chrome / Windows 7 support
 * This file MUST be loaded BEFORE pdf.mjs or any module scripts.
 */

// Polyfill for Promise.withResolvers (Chrome < 119 / Windows 7 support)
if (typeof Promise.withResolvers === 'undefined') {
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}
