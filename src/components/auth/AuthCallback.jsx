import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingRing } from '../ui/Primitives';

/**
 * OAuth callback landing — verifies token, surfaces failures gracefully,
 * and soft-navigates to the destination on success.
 */
export default function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { processOAuthCallback, isAuthenticated } = useAuth();
    const [error, setError] = useState(null);

    const isAuthenticatedValue =
        typeof isAuthenticated === 'function'
            ? isAuthenticated()
            : Boolean(isAuthenticated);

    useEffect(() => {
        if (isAuthenticatedValue) {
            navigate('/', { replace: true });
            return;
        }

        const token = searchParams.get('token');
        const errParam = searchParams.get('error');

        if (errParam) {
            setError(errParam);
            return;
        }

        if (token) {
            localStorage.setItem('liftit_token', token);
            processOAuthCallback(token)
                .then(() => navigate('/', { replace: true }))
                .catch((err) =>
                    setError(err?.message || 'Authentication failed'),
                );
        } else {
            navigate('/login', { replace: true });
        }
    }, [
        searchParams,
        navigate,
        processOAuthCallback,
        isAuthenticatedValue,
    ]);

    if (error) {
        return (
            <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-ink-950 px-4">
                <div className="w-full max-w-sm text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
                        <AlertTriangle className="h-7 w-7" />
                    </div>
                    <div className="eyebrow mb-2 text-red-400/80">
                        Sign-in failed
                    </div>
                    <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
                        We couldn&apos;t sign you in
                    </h2>
                    <p className="mb-6 text-sm text-zinc-400">{error}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/login', { replace: true })}
                        className="btn-primary inline-flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to sign in
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-ink-950 px-4">
            <div className="w-full max-w-sm text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent shadow-glow-sm">
                    <ShieldCheck className="h-7 w-7" />
                </div>
                <div className="eyebrow mb-2">Securely signing you in</div>
                <h2 className="mb-6 text-2xl font-bold tracking-tight text-white">
                    Almost there
                </h2>
                <div className="flex items-center justify-center gap-3 text-sm text-zinc-400">
                    <LoadingRing size={18} />
                    Completing authentication…
                </div>
            </div>
        </div>
    );
}
