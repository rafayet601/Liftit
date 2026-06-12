import { post, get } from '../lib/api';

/**
 * Optional cookie-based OAuth against the sync backend. The app never
 * requires this — it only unlocks cross-device sync.
 */

const AUTH_ENDPOINTS = {
    logout: '/auth/logout',
    session: '/auth/me',
    google: '/auth/google',
    github: '/auth/github',
};

export const loginWithOAuth = (provider) => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${AUTH_ENDPOINTS[provider]}`;
};

export const logout = async () => {
    try {
        await post(AUTH_ENDPOINTS.logout);
    } finally {
        try {
            localStorage.removeItem('liftit_user');
        } catch {
            /* ignore */
        }
    }
};

export const getSession = async () => {
    const response = await get(AUTH_ENDPOINTS.session);
    if (response.data?.user) {
        localStorage.setItem('liftit_user', JSON.stringify(response.data.user));
    }
    return response;
};

export const getStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem('liftit_user'));
    } catch {
        return null;
    }
};
