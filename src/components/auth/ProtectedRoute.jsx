import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

/**
 * Gate component that redirects unauthenticated users to /login while
 * preserving the original destination for post-login return.
 */
export default function ProtectedRoute({ children }) {
    const location = useLocation();
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return <LoadingSpinner full label="Loading your workspace…" />;
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                state={{ from: location.pathname + location.search }}
                replace
            />
        );
    }

    return children;
}
