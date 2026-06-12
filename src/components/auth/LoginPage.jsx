import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Dumbbell, ArrowLeft, Github, Sparkles, ShieldCheck, HardDrive } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/db';
import { useSettings } from '../../data/DataProvider';

/**
 * Sign-in is optional in Liftit v4 — the app is local-first. This page is
 * the gateway to cloud sync, plus an explicit demo-data path.
 */
export default function LoginPage() {
    const { loginWithOAuth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const settings = useSettings();
    const redirectTo = location.state?.from || '/';

    const tryDemo = () => {
        db.seedDemo();
        db.settings.update({ onboarded: true });
        navigate('/', { replace: true });
    };

    const continueLocal = () => {
        navigate(settings.onboarded ? redirectTo : '/onboarding', { replace: true });
    };

    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink-950 px-5 text-white">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                    background:
                        'radial-gradient(900px 500px at 80% -10%, rgba(255,107,58,0.1), transparent 60%)',
                }}
            />

            <div className="w-full max-w-md animate-fade-in">
                {/* Brand */}
                <div className="mb-10 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-ember text-ink-950">
                        <Dumbbell className="h-5 w-5" strokeWidth={2.4} />
                    </div>
                    <div>
                        <span className="font-display text-2xl font-bold tracking-tight">
                            Liftit<span className="text-accent">.</span>
                        </span>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-500">
                            Track lifts · build programs
                        </p>
                    </div>
                </div>

                <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
                    Sync your training
                    <br />
                    <span className="text-gradient-ember">across devices.</span>
                </h1>
                <p className="mt-3 text-[15px] text-ink-400">
                    Liftit works fully on this device — signing in just adds backup and sync. Your
                    local workouts come with you.
                </p>

                <div className="mt-8 space-y-2.5">
                    <button
                        type="button"
                        onClick={() => loginWithOAuth('google')}
                        className="btn-secondary btn-lg w-full"
                    >
                        <ShieldCheck className="h-5 w-5" /> Continue with Google
                    </button>
                    <button
                        type="button"
                        onClick={() => loginWithOAuth('github')}
                        className="btn-secondary btn-lg w-full"
                    >
                        <Github className="h-5 w-5" /> Continue with GitHub
                    </button>
                </div>

                <div className="my-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-600">
                    <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
                </div>

                <div className="space-y-2.5">
                    <button type="button" onClick={continueLocal} className="btn-primary btn-lg w-full">
                        <HardDrive className="h-5 w-5" /> Use on this device only
                    </button>
                    <button type="button" onClick={tryDemo} className="btn-ghost w-full">
                        <Sparkles className="h-4 w-4" /> Explore with sample data
                    </button>
                </div>

                {settings.onboarded && (
                    <Link
                        to="/"
                        className="mt-8 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to the app
                    </Link>
                )}
            </div>
        </div>
    );
}
