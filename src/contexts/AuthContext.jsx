import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    loginWithOAuth as oauthLogin,
    logout as oauthLogout,
    getSession,
    getStoredUser,
    getStoredEntitlement,
    backendAvailable,
} from '../services/auth.service';

/**
 * Optional account state. The app is fully usable signed-out (local-first);
 * a user here just means cloud sync is available.
 */

const AuthContext = createContext({
    user: null,
    isAuthenticated: false,
    entitlement: null,
    isPro: true,
    isLoading: true,
    loginWithOAuth: () => {},
    logout: async () => {},
    processOAuthCallback: async () => {},
    refreshSession: async () => {},
    error: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getStoredUser());
    const [entitlement, setEntitlement] = useState(() => getStoredEntitlement());
    const [isLoading, setIsLoading] = useState(() => Boolean(getStoredUser()));
    const [error, setError] = useState(null);

    useEffect(() => {
        // Validate the cached session in the background (only if one exists
        // and this build actually has a backend to validate against).
        if (!backendAvailable() || !getStoredUser()) return undefined;
        let cancelled = false;
        getSession()
            .then((res) => {
                if (!cancelled && res.data?.user) {
                    setUser(res.data.user);
                    setEntitlement(res.data.entitlement ?? null);
                }
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
        const onExpired = () => {
            setUser(null);
            setEntitlement(null);
        };
        window.addEventListener('liftit:auth-expired', onExpired);
        return () => window.removeEventListener('liftit:auth-expired', onExpired);
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await oauthLogout();
        } finally {
            setUser(null);
            setEntitlement(null);
        }
    }, []);

    const processOAuthCallback = useCallback(async () => {
        setError(null);
        try {
            const response = await getSession();
            if (response.data?.user) {
                setUser(response.data.user);
                setEntitlement(response.data.entitlement ?? null);
            }
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
                // Unknown entitlement (older server, signed out) never gates:
                // Pro is only "off" when the server explicitly says free.
                entitlement,
                isPro: !entitlement || entitlement.plan === 'pro',
                isLoading,
                loginWithOAuth: oauthLogin,
                logout: handleLogout,
                processOAuthCallback,
                // Same fetch as the OAuth callback — re-pulls user +
                // entitlement, e.g. right after checkout completes.
                refreshSession: processOAuthCallback,
                error,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export default AuthContext;
