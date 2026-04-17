import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginWithOAuth as oauthLogin, logout as oauthLogout, getSession, getStoredUser } from '../services/auth.service';
import { isAuthenticated as checkAuth, getAuthToken, enableDemoMode, isInDemoMode } from '../lib/api';

const AuthContext = createContext({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    loginWithOAuth: () => {},
    loginAsDemo: () => {},
    logout: async () => {},
    processOAuthCallback: async () => {},
    error: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const initAuth = async () => {
            const storedUser = getStoredUser();
            if (storedUser) {
                setUser(storedUser);
            }

            // If in demo mode, use stored user and skip server validation
            if (isInDemoMode()) {
                if (!storedUser) {
                    setUser({ name: 'Demo Athlete', id: 'demo' });
                }
                setIsLoading(false);
                return;
            }

            if (checkAuth()) {
                try {
                    const response = await getSession();
                    if (response.data?.user) {
                        setUser(response.data.user);
                    }
                } catch (err) {
                    if (isInDemoMode()) {
                        setUser(storedUser || { name: 'Demo Athlete', id: 'demo' });
                    } else {
                        console.warn('Session check failed:', err);
                    }
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const handleOAuthLogin = useCallback((provider) => {
        oauthLogin(provider);
    }, []);

    const loginAsDemo = useCallback(() => {
        enableDemoMode();
        const demoUser = {
            id: 'demo-user',
            name: 'Demo Athlete',
            email: 'demo@liftit.app',
            level: 'Intermediate',
            unit: 'kg',
            isDemo: true,
        };
        setUser(demoUser);
        localStorage.setItem('liftit_user', JSON.stringify(demoUser));
        localStorage.setItem('liftit_token', 'demo-token');
        return demoUser;
    }, []);

    const handleLogout = useCallback(async () => {
        setIsLoading(true);
        try {
            await oauthLogout();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            setUser(null);
            localStorage.removeItem('liftit_user');
            localStorage.removeItem('liftit_token');
            setIsLoading(false);
        }
    }, []);

    const processOAuthCallback = useCallback(async (token) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await getSession();
            if (response.data?.user) {
                setUser(response.data.user);
                localStorage.setItem('liftit_user', JSON.stringify(response.data.user));
            }
            return response;
        } catch (err) {
            setError(err.message || 'Authentication failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const value = {
        user,
        isAuthenticated: !!user || isInDemoMode(),
        isLoading,
        loginWithOAuth: handleOAuthLogin,
        loginAsDemo,
        logout: handleLogout,
        processOAuthCallback,
        error,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export default AuthContext;
