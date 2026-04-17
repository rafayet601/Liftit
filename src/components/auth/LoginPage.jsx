import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Dumbbell,
    ChevronRight,
    Zap,
    TrendingUp,
    Flame,
    Play,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saveData } from '../../lib/store';
import { LoadingRing } from '../ui/Primitives';

/**
 * Editorial, two-pane login inspired by premium product launches.
 * Left: story + trust. Right: elegant sign-in card with demo path.
 */
export default function LoginPage() {
    const { loginWithOAuth, isLoading, loginAsDemo } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const redirectTo = location.state?.from || '/';
    const [demoBusy, setDemoBusy] = useState(false);

    const handleDemo = () => {
        setDemoBusy(true);
        saveData({
            user: {
                id: 'demo-user',
                name: 'Demo Athlete',
                email: 'demo@liftit.app',
                level: 'Intermediate',
                unit: 'kg',
            },
            currentMesocycle: {
                active: true,
                name: 'Hypertrophy Meso · Push/Pull/Legs',
                weeks: 6,
                currentWeek: 2,
                daysPerWeek: 5,
                focus: 'Hypertrophy',
                startDate: new Date().toISOString(),
            },
            logs: [
                {
                    id: 'demo-1',
                    date: new Date(Date.now() - 86400000).toISOString(),
                    name: 'Push A',
                    duration: 3600,
                    workout: [
                        { name: 'Bench Press', sets: [{ weight: 80, reps: 8, rpe: 8, completed: true }] },
                    ],
                },
            ],
            program: [],
            preferences: { unit: 'kg', theme: 'dark' },
        });
        loginAsDemo();
        setTimeout(() => {
            setDemoBusy(false);
            navigate(redirectTo, { replace: true });
        }, 420);
    };

    return (
        <div className="relative min-h-dvh overflow-hidden bg-ink-950 text-white">
            {/* Ambient background */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                    background:
                        'radial-gradient(900px 500px at 12% -10%, rgba(190,242,100,0.12), transparent 60%), radial-gradient(700px 400px at 110% 110%, rgba(163,230,53,0.08), transparent 60%)',
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-grid-faint bg-grid opacity-[0.25]"
                style={{ maskImage: 'radial-gradient(ellipse at center, #000 30%, transparent 75%)' }}
            />

            <div className="mx-auto grid min-h-dvh max-w-7xl grid-cols-1 lg:grid-cols-2">
                {/* Hero / story */}
                <section className="relative hidden flex-col justify-between p-10 lg:flex xl:p-14">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-ink-950 shadow-glow-sm">
                            <Dumbbell className="h-5 w-5" strokeWidth={2.4} />
                        </div>
                        <span className="text-2xl font-extrabold tracking-tight">
                            Liftit<span className="text-accent">.</span>
                        </span>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <span className="eyebrow mb-3 inline-block">v3 · iOS ready</span>
                            <h1 className="text-[56px] font-extrabold leading-[1.02] tracking-tight">
                                Train smarter.
                                <br />
                                <span className="text-gradient-lime">Progress faster.</span>
                            </h1>
                            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-zinc-400">
                                Evidence-based mesocycle programming, an AI trainer that actually knows
                                your RPE trends, and a logging experience tuned for 45-second rest
                                periods.
                            </p>
                        </div>

                        <ul className="max-w-md space-y-3">
                            {[
                                {
                                    icon: TrendingUp,
                                    title: 'Progressive overload, automated',
                                    desc: 'Your AI coach reads every rep and picks the right next load.',
                                },
                                {
                                    icon: Zap,
                                    title: 'Mesocycle programming',
                                    desc: 'Accumulation · Intensification · Realization · Deload.',
                                },
                                {
                                    icon: Flame,
                                    title: 'Built for the floor',
                                    desc: 'Big buttons, haptic feedback, offline-first. Feels native on iOS.',
                                },
                            ].map((f) => (
                                <li
                                    key={f.title}
                                    className="group flex items-start gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-accent/30 hover:bg-white/[0.04]"
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-zinc-400 transition-colors group-hover:bg-accent group-hover:text-ink-950">
                                        <f.icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-white">{f.title}</h3>
                                        <p className="mt-0.5 text-sm text-zinc-400">{f.desc}</p>
                                    </div>
                                    <ChevronRight className="ml-auto mt-1 h-4 w-4 text-zinc-600 transition-all group-hover:-translate-x-0 group-hover:text-accent" />
                                </li>
                            ))}
                        </ul>
                    </div>

                    <footer className="flex items-center justify-between text-xs text-zinc-500">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-accent" />
                            <span>Encrypted · Private · Offline-first</span>
                        </div>
                        <span className="font-mono tracking-widest">© LIFTIT</span>
                    </footer>
                </section>

                {/* Auth card */}
                <section className="relative flex items-center justify-center px-6 py-12 safe-top lg:px-10">
                    <div className="w-full max-w-md animate-fade-in">
                        {/* Mobile brand */}
                        <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-ink-950 shadow-glow-sm">
                                <Dumbbell className="h-5 w-5" strokeWidth={2.4} />
                            </div>
                            <span className="text-xl font-extrabold tracking-tight">
                                Liftit<span className="text-accent">.</span>
                            </span>
                        </div>

                        <div className="surface-strong relative overflow-hidden p-7">
                            {/* Accent halo */}
                            <div
                                aria-hidden
                                className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
                            />

                            <div className="relative">
                                <div className="mb-7 text-center">
                                    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                                        <Sparkles className="h-3 w-3" /> AI Edition
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight text-white">
                                        Welcome back
                                    </h2>
                                    <p className="mt-1 text-sm text-zinc-400">
                                        Sign in to continue your training cycle.
                                    </p>
                                </div>

                                {isLoading || demoBusy ? (
                                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                                        <LoadingRing size={36} />
                                        <p className="text-sm text-zinc-400">
                                            {demoBusy ? 'Loading demo…' : 'Signing in…'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <button
                                            type="button"
                                            onClick={handleDemo}
                                            className="group relative flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-accent to-accent-300 px-5 py-4 text-left text-ink-950 shadow-glow transition-all active:scale-[0.99]"
                                        >
                                            <span className="flex items-center gap-3">
                                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-950/15 text-ink-950">
                                                    <Play className="h-5 w-5" strokeWidth={2.4} />
                                                </span>
                                                <span>
                                                    <span className="block text-base font-extrabold tracking-tight">
                                                        Try the Demo
                                                    </span>
                                                    <span className="block text-[11px] font-semibold uppercase tracking-widest opacity-70">
                                                        No signup · Instant access
                                                    </span>
                                                </span>
                                            </span>
                                            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                        </button>

                                        <div className="relative py-1">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t border-white/5" />
                                            </div>
                                            <div className="relative flex justify-center">
                                                <span className="bg-ink-900/85 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                                                    or sign in with
                                                </span>
                                            </div>
                                        </div>

                                        <OAuthButton provider="google" onClick={() => loginWithOAuth('google')} />
                                        <OAuthButton provider="github" onClick={() => loginWithOAuth('github')} />

                                        <div className="flex items-center justify-center gap-4 pt-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                                            <span>Encrypted</span>
                                            <span className="h-1 w-1 rounded-full bg-zinc-700" />
                                            <span>Private</span>
                                            <span className="h-1 w-1 rounded-full bg-zinc-700" />
                                            <span>Fast</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="mt-6 text-center text-[11px] text-zinc-600">
                            By continuing, you agree to our{' '}
                            <span className="text-zinc-400">Terms</span> and{' '}
                            <span className="text-zinc-400">Privacy</span>.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}

function OAuthButton({ provider, onClick }) {
    const label = provider === 'google' ? 'Continue with Google' : 'Continue with GitHub';
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4 text-left text-white transition-all hover:border-white/20 hover:bg-white/[0.05] active:scale-[0.99]"
        >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] transition-colors group-hover:bg-white/[0.08]">
                {provider === 'google' ? <GoogleGlyph /> : <GithubGlyph />}
            </span>
            <span className="flex-1 font-semibold tracking-tight">{label}</span>
            <ChevronRight className="h-4 w-4 text-zinc-500 transition-all group-hover:translate-x-1 group-hover:text-accent" />
        </button>
    );
}

function GoogleGlyph() {
    return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
        </svg>
    );
}

function GithubGlyph() {
    return (
        <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
    );
}
