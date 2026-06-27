import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dumbbell, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { db } from '../data/db';
import { generateProgram, GOALS } from '../engine/generator';
import { Segmented, Card } from '../components/ui/Primitives';
import { hapticSuccess } from '../lib/platform';
import WaveDistortion from '../components/ui/WaveDistortion';
import LinearGradient from '../components/ui/LinearGradient';
import Glass from '../components/ui/Glass';

/**
 * First-run flow: four quick questions → optional instant program.
 * Everything is stored on-device; signing in is offered later for sync.
 */
const STEPS = ['name', 'units', 'training', 'program'];

export default function Onboarding() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        name: '',
        units: 'kg',
        experience: 'intermediate',
        goal: 'hypertrophy',
        daysPerWeek: 4,
    });

    const finish = (withProgram) => {
        db.settings.update({
            name: form.name.trim(),
            units: form.units,
            experience: form.experience,
            goal: form.goal,
            onboarded: true,
        });
        if (withProgram) {
            db.programs.save(
                generateProgram({
                    goal: form.goal,
                    experience: form.experience,
                    daysPerWeek: form.daysPerWeek,
                }),
            );
        }
        hapticSuccess();
        navigate(withProgram ? '/program' : '/', { replace: true });
    };

    const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
    const back = () => setStep((s) => Math.max(s - 1, 0));

    return (
        <div className="safe-top safe-bottom relative flex min-h-dvh flex-col bg-transparent px-5 py-8 overflow-hidden">
            <WaveDistortion
                preset="aurora"
                amplitude={0.06}
                frequency={2.0}
                speed={0.3}
                opacity={0.4}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 0,
                }}
            />

            <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col">
                {/* Brand + progress */}
                <div className="mb-10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-purple text-ink-950">
                            <Dumbbell className="h-4.5 w-4.5 h-5 w-5" strokeWidth={2.4} />
                        </span>
                        <span className="font-display text-lg font-bold text-white">
                            Liftit<span className="text-accent">.</span>
                        </span>
                    </div>
                    <div className="flex gap-1.5">
                        {STEPS.map((s, i) => (
                            <span
                                key={s}
                                className={`h-1.5 w-6 rounded-full transition-all duration-300 ${i <= step ? 'bg-accent' : 'bg-white/10'}`}
                                style={i <= step ? { boxShadow: '0 0 8px rgba(139,92,246,0.5)' } : undefined}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex flex-1 flex-col justify-center animate-fade-in" key={step}>
                    {step === 0 && (
                        <StepShell
                            title="What should we call you?"
                            subtitle="Everything stays on this device until you choose to sync."
                        >
                            <input
                                autoFocus
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && next()}
                                placeholder="Your name"
                                className="input text-lg"
                                aria-label="Your name"
                            />
                        </StepShell>
                    )}

                    {step === 1 && (
                        <StepShell title="How do you load the bar?" subtitle="You can switch anytime in Settings.">
                            <Segmented
                                value={form.units}
                                onChange={(units) => setForm((f) => ({ ...f, units }))}
                                options={[
                                    { value: 'kg', label: 'Kilograms' },
                                    { value: 'lbs', label: 'Pounds' },
                                ]}
                            />
                        </StepShell>
                    )}

                    {step === 2 && (
                        <StepShell
                            title="Your training, roughly."
                            subtitle="This seeds your first program — the engine adapts from your logs after that."
                        >
                            <div className="space-y-5">
                                <div>
                                    <div className="eyebrow mb-2">Experience</div>
                                    <Segmented
                                        value={form.experience}
                                        onChange={(experience) => setForm((f) => ({ ...f, experience }))}
                                        options={[
                                            { value: 'beginner', label: 'Beginner' },
                                            { value: 'intermediate', label: 'Intermediate' },
                                            { value: 'advanced', label: 'Advanced' },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <div className="eyebrow mb-2">Main goal</div>
                                    <Segmented
                                        value={form.goal}
                                        onChange={(goal) => setForm((f) => ({ ...f, goal }))}
                                        options={Object.entries(GOALS).map(([value, g]) => ({
                                            value,
                                            label: g.label,
                                        }))}
                                    />
                                </div>
                                <div>
                                    <div className="eyebrow mb-2">Days per week</div>
                                    <Segmented
                                        value={form.daysPerWeek}
                                        onChange={(daysPerWeek) => setForm((f) => ({ ...f, daysPerWeek }))}
                                        options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
                                    />
                                </div>
                            </div>
                        </StepShell>
                    )}

                    {step === 3 && (
                        <StepShell
                            title="Want a program built now?"
                            subtitle={`A ${form.daysPerWeek}-day ${GOALS[form.goal].label.toLowerCase()} block, periodized over 6 weeks, ready before you blink. You can also start freestyle and add one later.`}
                        >
                            <div className="space-y-2.5">
                                <button type="button" onClick={() => finish(true)} className="btn-primary btn-lg w-full">
                                    <Sparkles className="h-5 w-5" /> Build my program
                                </button>
                                <button type="button" onClick={() => finish(false)} className="btn-secondary w-full">
                                    Skip — I'll log freestyle
                                </button>
                            </div>
                        </StepShell>
                    )}
                </div>

                {/* Nav */}
                <div className="mt-8 flex items-center justify-between">
                    {step > 0 ? (
                        <button type="button" onClick={back} className="btn-ghost">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                    ) : (
                        <Link to="/login" className="text-xs text-ink-500 hover:text-white">
                            Have an account? Sign in
                        </Link>
                    )}
                    {step < STEPS.length - 1 && (
                        <button type="button" onClick={next} className="btn-primary">
                            Continue <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            <LinearGradient
                preset="purpleToSteel"
                animated
                variant="strip"
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    borderRadius: 0,
                    opacity: 0.6,
                }}
            />
        </div>
    );
}

function StepShell({ title, subtitle, children }) {
    return (
        <Glass
            tint="purple"
            glow
            wave
            wavePreset="purple"
            gradientBorder
            gradientPreset="purpleToSteel"
            className="w-full max-w-md mx-auto my-auto animate-scale-in"
        >
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
                {title}
            </h1>
            <p className="mb-7 mt-2 text-[15px] text-ink-400">{subtitle}</p>
            {children}
        </Glass>
    );
}
