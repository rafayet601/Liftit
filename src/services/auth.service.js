import { post, get, put, del, setAuthToken } from '../lib/api';

const AUTH_ENDPOINTS = {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    session: '/auth/me',
    google: '/auth/google',
    github: '/auth/github',
    callback: '/auth/callback',
};

export const loginWithOAuth = (provider) => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${AUTH_ENDPOINTS[provider]}`;
};

export const handleAuthCallback = async (code) => {
    const response = await post(AUTH_ENDPOINTS.callback, { code });
    if (response.data?.token) {
        setAuthToken(response.data.token);
        localStorage.setItem('liftit_user', JSON.stringify(response.data.user));
    }
    return response;
};

export const login = async (email, password) => {
    const response = await post(AUTH_ENDPOINTS.login, { email, password });
    if (response.data?.token) {
        setAuthToken(response.data.token);
        localStorage.setItem('liftit_user', JSON.stringify(response.data.user));
    }
    return response;
};

export const register = async (email, password, name) => {
    const response = await post(AUTH_ENDPOINTS.register, { email, password, name });
    if (response.data?.token) {
        setAuthToken(response.data.token);
        localStorage.setItem('liftit_user', JSON.stringify(response.data.user));
    }
    return response;
};

export const logout = async () => {
    try {
        await post(AUTH_ENDPOINTS.logout);
    } finally {
        setAuthToken(null);
        localStorage.removeItem('liftit_user');
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
    const user = localStorage.getItem('liftit_user');
    return user ? JSON.parse(user) : null;
};

export default {
    loginWithOAuth,
    handleAuthCallback,
    login,
    register,
    logout,
    getSession,
    getStoredUser,
};
