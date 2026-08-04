/**
 * Storage abstraction layer that bridges localStorage and @capacitor/preferences.
 *
 * On web: uses localStorage for synchronous compatibility
 * On mobile: uses Capacitor Preferences (async) with in-memory sync cache
 *
 * The cache is updated synchronously on all operations, ensuring that reads
 * return immediately while background writes happen asynchronously.
 */

import { Preferences } from '@capacitor/preferences';

let _isNative = null;

const IS_NATIVE = () => {
    if (_isNative !== null) return _isNative;
    try {
        if (typeof window === 'undefined') {
            _isNative = false;
            return false;
        }
        const Cap = window.Capacitor;
        if (!Cap || !Cap.getPlatform) {
            _isNative = false;
            return false;
        }
        const platform = Cap.getPlatform();
        _isNative = platform === 'ios' || platform === 'android';
        return _isNative;
    } catch {
        _isNative = false;
        return false;
    }
};

const CACHE = new Map();
let initialized = false;

/**
 * Initialize the storage layer (async).
 * On web: no-op. On mobile: load from Capacitor into cache.
 */
export async function initializeStorage() {
    if (initialized) return;
    if (!IS_NATIVE()) {
        initialized = true;
        return;
    }

    try {
        const { keys } = await Preferences.keys();
        for (const key of keys) {
            const { value } = await Preferences.get({ key });
            if (value !== null) {
                CACHE.set(key, value);
            }
        }
        initialized = true;
    } catch (e) {
        console.error('[storage] failed to initialize Capacitor', e);
        initialized = true; // Continue anyway
    }
}

/**
 * Get a value (synchronous read from cache or localStorage).
 */
export function getItem(key) {
    if (IS_NATIVE()) {
        return CACHE.get(key) ?? null;
    }
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.error('[storage] failed to read from localStorage', e);
        return null;
    }
}

/**
 * Set a value (synchronous cache update + async storage write).
 */
export function setItem(key, value) {
    if (IS_NATIVE()) {
        CACHE.set(key, value);
        // Fire and forget: persist asynchronously
        Preferences.set({ key, value }).catch((e) =>
            console.error('[storage] failed to write to Capacitor', e)
        );
    } else {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error('[storage] failed to write to localStorage', e);
        }
    }
}

/**
 * Remove a value (synchronous cache update + async storage deletion).
 */
export function removeItem(key) {
    if (IS_NATIVE()) {
        CACHE.delete(key);
        // Fire and forget: remove asynchronously
        Preferences.remove({ key }).catch((e) =>
            console.error('[storage] failed to remove from Capacitor', e)
        );
    } else {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('[storage] failed to remove from localStorage', e);
        }
    }
}

/**
 * Clear all storage (synchronous cache clear + async storage clear).
 */
export function clear() {
    if (IS_NATIVE()) {
        CACHE.clear();
        // Fire and forget: clear asynchronously
        Preferences.clear().catch((e) =>
            console.error('[storage] failed to clear Capacitor', e)
        );
    } else {
        try {
            localStorage.clear();
        } catch (e) {
            console.error('[storage] failed to clear localStorage', e);
        }
    }
}

/**
 * Test helper: reset the cache (for unit tests).
 */
export function __resetForTest() {
    CACHE.clear();
    initialized = false;
}
