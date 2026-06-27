import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Dumbbell, ArrowLeft, Github, Sparkles, ShieldCheck, HardDrive } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/db';
import { useSettings } from '../../data/DataProvider';
import WaveDistortion from '../ui/WaveDistortion';
import LinearGradient from '../ui/LinearGradient';
import Glass from '../ui/Glass';

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

                <div className="mt-8 space-y-2.5">
                    <button
                        type="button"
                        onClick={() => loginWithOAuth('google')}
                        className="btn-secondary btn-lg w-full bg-white/[0.04] hover:bg-white/[0.08] hover:scale-[1.01] hover:border-white/20 transition-all border border-white/10"
                    >
                        <ShieldCheck className="h-5 w-5" /> Continue with Google
                    </button>
                    <button
                        type="button"
                        onClick={() => loginWithOAuth('github')}
                        className="btn-secondary btn-lg w-full bg-white/[0.04] hover:bg-white/[0.08] hover:scale-[1.01] hover:border-white/20 transition-all border border-white/10"
                    >
                        <Github className="h-5 w-5" /> Continue with GitHub
                    </button>
                </div>

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
