import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    loginWithOAuth as oauthLogin,
    logout as oauthLogout,
    getSession,
    getStoredUser,
} from '../services/auth.service';

/**
 * Optional account state. The app is fully usable signed-out (local-first);
 * a user here just means cloud sync is available.
 */

const AuthContext = createContext({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    loginWithOAuth: () => {},
    logout: async () => {},
    processOAuthCallback: async () => {},
    error: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getStoredUser());
    const [isLoading, setIsLoading] = useState(() => Boolean(getStoredUser()));
    const [error, setError] = useState(null);

    useEffect(() => {
        // Validate the cached session in the background (only if one exists).
        if (!getStoredUser()) return undefined;
        let cancelled = false;
        getSession()
            .then((res) => {
                if (!cancelled && res.data?.user) setUser(res.data.user);
            })
            .catch(() => {
                // 401 interceptor clears the cache; reflect it here.
                if (!cancelled && !getStoredUser()) setUser(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const onExpired = () => setUser(null);
        window.addEventListener('liftit:auth-expired', onExpired);
        return () => window.removeEventListener('liftit:auth-expired', onExpired);
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await oauthLogout();
        } finally {
            setUser(null);
        }
    }, []);

    const processOAuthCallback = useCallback(async () => {
        setError(null);
        try {
            const response = await getSession();
            if (response.data?.user) setUser(response.data.user);
            return response;
        } catch (err) {
            setError(err.message || 'Authentication failed');
            throw err;
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: Boolean(user),
                isLoading,
                loginWithOAuth: oauthLogin,
                logout: handleLogout,
                processOAuthCallback,
                error,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export default AuthContext;
