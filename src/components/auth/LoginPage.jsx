import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Dumbbell, ArrowLeft, Sparkles, ShieldCheck, HardDrive } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { get, backendAvailable } from '../../lib/api';
import { db } from '../../data/db';
import { useSettings } from '../../data/DataProvider';
import WaveDistortion from '../ui/WaveDistortion';
import LinearGradient from '../ui/LinearGradient';
import Glass from '../ui/Glass';

/**
 * Sign-in is optional in Liftit v4 — the app is local-first. This page is
 * the gateway to cloud sync, plus an explicit demo-data path.
 */

/**
 * GitHub's mark, inlined rather than imported. Lucide dropped its brand icons
 * in v1, so `import { Github } from 'lucide-react'` pins the whole app to
 * 0.x. Takes className and inherits colour so it drops into the button
 * exactly like a lucide icon.
 */
function GithubMark({ className }) {
    return (
        <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
    );
}

const PROVIDER_BUTTONS = {
    google: { label: 'Continue with Google', Icon: ShieldCheck },
    github: { label: 'Continue with GitHub', Icon: GithubMark },
};

export default function LoginPage() {
    const { loginWithOAuth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const settings = useSettings();
    const redirectTo = location.state?.from || '/';

    // Only render buttons for providers the deployment actually has OAuth
    // credentials for. Start optimistic (both) and refine from the API; on
    // fetch failure keep the defaults — each button surfaces its own error
    // via /auth/callback if it truly isn't configured.
    const [providers, setProviders] = useState(() =>
        backendAvailable() ? Object.keys(PROVIDER_BUTTONS) : [],
    );
    useEffect(() => {
        if (!backendAvailable()) return undefined;
        let cancelled = false;
        get('/auth/providers')
            .then((res) => {
                const list = res?.data?.providers;
                if (!cancelled && Array.isArray(list)) {
                    setProviders(list.filter((p) => PROVIDER_BUTTONS[p]));
                }
            })
            .catch(() => {
                /* keep optimistic defaults */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const tryDemo = () => {
        db.seedDemo();
        db.settings.update({ onboarded: true });
        navigate('/', { replace: true });
    };

    const continueLocal = () => {
        navigate(settings.onboarded ? redirectTo : '/onboarding', { replace: true });
    };

    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-transparent px-5 text-white">
            <WaveDistortion
                preset="aurora"
                amplitude={0.08}
                frequency={2.0}
                speed={0.35}
                opacity={0.5}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 0,
                }}
            />

            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                    background:
                        'radial-gradient(900px 500px at 80% -10%, rgba(139,92,246,0.1), transparent 60%)',
                }}
            />

            <Glass
                tint="purple"
                glow
                wave
                wavePreset="aurora"
                gradientBorder
                gradientPreset="purpleToSteel"
                radius={20}
                className="w-full max-w-md animate-scale-in glass-prismatic"
            >
                {/* Brand */}
                <div className="mb-10 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-purple text-ink-950">
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
                    <span className="text-gradient-purple">across devices.</span>
                </h1>
                <p className="mt-3 text-[15px] text-ink-400">
                    Liftit works fully on this device — signing in just adds backup and sync. Your
                    local workouts come with you.
                </p>

                {providers.length > 0 ? (
                    <div className="mt-8 space-y-2.5">
                        {providers.map((name) => {
                            const { label, Icon } = PROVIDER_BUTTONS[name];
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => loginWithOAuth(name)}
                                    className="btn-secondary btn-lg w-full bg-white/[0.04] hover:bg-white/[0.08] hover:scale-[1.01] hover:border-white/20 transition-all border border-white/10"
                                >
                                    <Icon className="h-5 w-5" /> {label}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink-400">
                        Cloud sync isn't enabled on this deployment — your training data lives on
                        this device. You can back it up anytime with Export in Settings.
                    </p>
                )}

                <LinearGradient preset="purpleToSteel" variant="strip" className="my-6" style={{ opacity: 0.3 }} />

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
                        unstable_viewTransition
                        className="mt-8 inline-flex items-center justify-center gap-1.5 text-sm text-ink-500 hover:text-white touch-target pt-safe"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to the app
                    </Link>
                )}
            </Glass>
        </div>
    );
}
