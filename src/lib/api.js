import axios from 'axios';

/**
 * Thin HTTP client for the optional sync/auth backend. App data never
 * blocks on this — the repository (src/data/db.js) is the source of truth
 * and sync.js drains changes in the background.
 *
 * The backend is opt-in: VITE_API_URL must be set for any network call to
 * happen. When it's unset the app runs purely local-first and every
 * account/sync affordance hides itself (see backendAvailable). This is what
 * lets the same build ship to a static host with no server behind it —
 * without it, a production bundle would fire at http://localhost:3001 and
 * get blocked as mixed content.
 *
 * On Cloudflare Pages the API is served same-origin by Pages Functions, so
 * the deployed value is simply "/api".
 */

const configured = import.meta.env.VITE_API_URL;

export const API_BASE_URL = configured || (import.meta.env.DEV ? 'http://localhost:3001/api' : '');

/** True when a sync/auth backend is configured for this build. */
export const backendAvailable = () => Boolean(API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
    timeout: 8000,
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Session expired: drop the cached user. The app keeps working
            // locally; auth-dependent UI listens for this event.
            try {
                localStorage.removeItem('liftit_user');
            } catch {
                /* ignore */
            }
            window.dispatchEvent(new CustomEvent('liftit:auth-expired'));
        }
        return Promise.reject(error);
    },
);

export const apiRequest = async (method, endpoint, data = null, options = {}) => {
    if (!backendAvailable()) {
        throw new Error('No sync backend is configured for this build.');
    }
    return api.request({ method, url: endpoint, data, ...options });
};

export const get = (endpoint, options = {}) => apiRequest('GET', endpoint, null, options);
export const post = (endpoint, data, options = {}) => apiRequest('POST', endpoint, data, options);
export const put = (endpoint, data, options = {}) => apiRequest('PUT', endpoint, data, options);
export const del = (endpoint, options = {}) => apiRequest('DELETE', endpoint, null, options);

/** Cookie-based auth: "authenticated" means we have a cached session user. */
export const isAuthenticated = () => {
    if (!backendAvailable()) return false;
    try {
        return Boolean(localStorage.getItem('liftit_user'));
    } catch {
        return false;
    }
};

export const getStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem('liftit_user'));
    } catch {
        return null;
    }
};

export default api;
