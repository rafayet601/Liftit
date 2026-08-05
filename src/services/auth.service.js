import { post, get, API_BASE_URL, backendAvailable } from '../lib/api';

/**
 * Optional cookie-based OAuth against the sync backend. The app never
 * requires this — it only unlocks cross-device sync. Every entry point is a
 * no-op when no backend is configured (see lib/api.js).
 */

const AUTH_ENDPOINTS = {
    logout: '/auth/logout',
    session: '/auth/me',
    google: '/auth/google',
    github: '/auth/github',
};

const ENTITLEMENT_KEY = 'liftit_entitlement';

export { backendAvailable };

export const loginWithOAuth = (provider) => {
    if (!backendAvailable()) return;
    window.location.href = `${API_BASE_URL}${AUTH_ENDPOINTS[provider]}`;
};

export const logout = async () => {
    try {
        if (backendAvailable()) await post(AUTH_ENDPOINTS.logout);
    } finally {
        try {
            localStorage.removeItem('liftit_user');
            localStorage.removeItem(ENTITLEMENT_KEY);
        } catch {
            /* ignore */
        }
    }
};

export const getSession = async () => {
    const response = await get(AUTH_ENDPOINTS.session);
    // The API returns { user: {...} }. Tolerate a bare user object too, so a
    // server responding with the older flat shape still signs people in
    // rather than silently dropping the session.
    const user = response.data?.user ?? (response.data?.id ? response.data : null);
    // Older servers don't send an entitlement. null means "unknown", and the
    // UI treats unknown as unrestricted — a client updated ahead of the
    // server can never lock anyone out of sync.
    const entitlement = response.data?.entitlement ?? null;
    if (user) {
        localStorage.setItem('liftit_user', JSON.stringify(user));
        if (entitlement) localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify(entitlement));
        else localStorage.removeItem(ENTITLEMENT_KEY);
    }
    return { ...response, data: { ...response.data, user, entitlement } };
};

export const getStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem('liftit_user'));
    } catch {
        return null;
    }
};

export const getStoredEntitlement = () => {
    try {
        return JSON.parse(localStorage.getItem(ENTITLEMENT_KEY));
    } catch {
        return null;
    }
};
