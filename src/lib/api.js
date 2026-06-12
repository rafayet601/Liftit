import axios from 'axios';

/**
 * Thin HTTP client for the optional sync/auth backend. App data never
 * blocks on this — the repository (src/data/db.js) is the source of truth
 * and sync.js drains changes in the background.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
    return api.request({ method, url: endpoint, data, ...options });
};

export const get = (endpoint, options = {}) => apiRequest('GET', endpoint, null, options);
export const post = (endpoint, data, options = {}) => apiRequest('POST', endpoint, data, options);
export const put = (endpoint, data, options = {}) => apiRequest('PUT', endpoint, data, options);
export const del = (endpoint, options = {}) => apiRequest('DELETE', endpoint, null, options);

/** Cookie-based auth: "authenticated" means we have a cached session user. */
export const isAuthenticated = () => {
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
