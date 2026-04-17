import React, { useCallback, useEffect, useState } from 'react';
import {
    Sparkles,
    Check,
    X,
    ChevronRight,
    ChevronLeft,
    Dumbbell,
    Target,
    Calendar,
    AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { generateAIContent } from '../../services/ai.service';
import { Chip, LoadingRing, ProgressBar } from '../ui/Primitives';
import { hapticLight, hapticSelection, hapticSuccess } from '../../lib/platform';

const EXPERIENCE_OPTIONS = [
    { value: 'Beginner', description: 'Less than 1 year training', icon: '🌱' },
    { value: 'Intermediate', description: '1–3 years of consistent work', icon: '💪' },
    { value: 'Advanced', description: '3+ years, dialed technique', icon: '🔥' },
];

const FOCUS_OPTIONS = [
    {
        value: 'Hypertrophy',
        description: 'Build size with moderate-rep volume',
    },
    {
        value: 'Strength',
        description: 'Heavier loads, lower reps, longer rest',
    },
    {
        value: 'Endurance',
        description: 'Higher reps, short rest, conditioning',
    },
];

const EQUIPMENT_OPTIONS = ['Full Gym', 'Home (Basic)', 'Home (Dumbbells)'];

function StepDot({ active, completed, children }) {
    return (
        <div
            className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                completed
                    ? 'border-accent bg-accent text-black'
                    : active
                      ? 'border-accent text-accent'
                      : 'border-white/10 text-zinc-500',
            )}
        >
            {completed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : children}
        </div>
    );
}

export default function ProgramGenerator({ onComplete, onClose }) {
    const [step, setStep] = useState(1);
    const [config, setConfig] = useState({
        experience: 'Intermediate',
        days: 4,
        focus: 'Hypertrophy',
        injuries: '',
        equipment: 'Full Gym',
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedProgram, setGeneratedProgram] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && !isGenerating) onClose?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, isGenerating]);

    const updateConfig = useCallback((patch) => {
        hapticSelection();
        setConfig((c) => ({ ...c, ...patch }));
    }, []);

    const goNext = useCallback(() => {
        hapticLight();
        setStep((s) => Math.min(4, s + 1));
    }, []);

    const goBack = useCallback(() => {
        hapticLight();
        setStep((s) => Math.max(1, s - 1));
    }, []);

    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const response = await generateAIContent(config);
            setGeneratedProgram(response?.data || response);
            hapticSuccess();
            setStep(4);
        } catch (err) {
            console.error('Failed to generate program:', err);
            setError(err?.message || 'Something went wrong generating your program.');
        } finally {
            setIsGenerating(false);
        }
    }, [config]);

    const progressValue = (step / 4) * 100;
    const daysHint =
        config.days === 3
            ? 'Full Body Split recommended'
            : config.days === 4
              ? 'Upper/Lower Split recommended'
              : 'Push / Pull / Legs recommended';

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-md md:items-center md:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="program-generator-title"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isGenerating) onClose?.();
            }}
        >
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/5 bg-zinc-950 shadow-2xl md:rounded-3xl">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-white/5 px-5 py-4 md:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent shadow-glow-sm">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3
                                id="program-generator-title"
                                className="truncate text-base font-bold text-white md:text-lg"
                            >
                                AI Program Generator
                            </h3>
                            <p className="text-xs text-zinc-500">
                                Step {step} of 4 · tailored to your profile
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isGenerating}
                        className="btn-ghost p-2 text-zinc-400 hover:text-white disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

                {/* Progress bar + step dots */}
                <div className="border-b border-white/5 px-5 pb-4 pt-3 md:px-6">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <StepDot active={step === 1} completed={step > 1}>
                            1
                        </StepDot>
                        <div className="h-px flex-1 bg-white/5" />
                        <StepDot active={step === 2} completed={step > 2}>
                            2
                        </StepDot>
                        <div className="h-px flex-1 bg-white/5" />
                        <StepDot active={step === 3} completed={step > 3}>
                            3
                        </StepDot>
                        <div className="h-px flex-1 bg-white/5" />
                        <StepDot active={step === 4} completed={step === 4 && generatedProgram}>
                            4
                        </StepDot>
                    </div>
                    <ProgressBar value={progressValue} />
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-6 md:px-6">
                    {error && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 1 && (
                        <section className="animate-fade-in space-y-5">
                            <div className="flex items-center gap-2">
                                <Dumbbell className="h-4 w-4 text-accent" />
                                <span className="eyebrow">Tell us about you</span>
                            </div>
                            <h4 className="text-2xl font-bold tracking-tight text-white">
                                Experience level
                            </h4>
                            <div className="grid gap-3">
                                {EXPERIENCE_OPTIONS.map(({ value, description, icon }) => {
                                    const selected = config.experience === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => updateConfig({ experience: value })}
                                            className={clsx(
                                                'group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all',
                                                selected
                                                    ? 'border-accent/40 bg-accent/10 shadow-glow-sm'
                                                    : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
                                            )}
                                        >
                                            <span
                                                className={clsx(
                                                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl',
                                                    selected
                                                        ? 'bg-accent/20'
                                                        : 'bg-white/5',
                                                )}
                                            >
                                                {icon}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div
                                                    className={clsx(
                                                        'font-semibold',
                                                        selected ? 'text-white' : 'text-zinc-200',
                                                    )}
                                                >
                                                    {value}
                                                </div>
                                                <div className="text-sm text-zinc-500">
                                                    {description}
                                                </div>
                                            </div>
                                            {selected && (
                                                <Check
                                                    className="h-5 w-5 shrink-0 text-accent"
                                                    strokeWidth={2.5}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {step === 2 && (
                        <section className="animate-fade-in space-y-6">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-accent" />
                                <span className="eyebrow">Weekly schedule</span>
                            </div>
                            <h4 className="text-2xl font-bold tracking-tight text-white">
                                Training days
                            </h4>
                            <div className="grid grid-cols-4 gap-3">
                                {[3, 4, 5, 6].map((d) => {
                                    const selected = config.days === d;
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => updateConfig({ days: d })}
                                            className={clsx(
                                                'flex h-20 flex-col items-center justify-center rounded-2xl border text-center transition-all',
                                                selected
                                                    ? 'border-accent bg-accent text-black shadow-glow-sm'
                                                    : 'border-white/5 bg-white/[0.02] text-zinc-300 hover:border-white/10 hover:bg-white/[0.04]',
                                            )}
                                        >
                                            <span className="text-2xl font-bold tabular-nums">
                                                {d}
                                            </span>
                                            <span
                                                className={clsx(
                                                    'text-[11px] font-medium uppercase tracking-wider',
                                                    selected ? 'text-black/70' : 'text-zinc-500',
                                                )}
                                            >
                                                days
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-sm text-zinc-400">
                                {daysHint}
                            </div>
                        </section>
                    )}

                    {step === 3 && (
                        <section className="animate-fade-in space-y-6">
                            <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-accent" />
                                <span className="eyebrow">Dial it in</span>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-2xl font-bold tracking-tight text-white">
                                    Primary focus
                                </h4>
                                <div className="grid gap-3">
                                    {FOCUS_OPTIONS.map(({ value, description }) => {
                                        const selected = config.focus === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => updateConfig({ focus: value })}
                                                className={clsx(
                                                    'flex items-center justify-between rounded-2xl border p-4 text-left transition-all',
                                                    selected
                                                        ? 'border-accent/40 bg-accent/10'
                                                        : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
                                                )}
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-white">
                                                        {value}
                                                    </div>
                                                    <div className="text-sm text-zinc-500">
                                                        {description}
                                                    </div>
                                                </div>
                                                {selected && (
                                                    <Check
                                                        className="h-5 w-5 shrink-0 text-accent"
                                                        strokeWidth={2.5}
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="space-y-2">
                                    <label
                                        htmlFor="pg-equipment"
                                        className="eyebrow block"
                                    >
                                        Equipment available
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {EQUIPMENT_OPTIONS.map((eq) => {
                                            const selected = config.equipment === eq;
                                            return (
                                                <button
                                                    key={eq}
                                                    type="button"
                                                    onClick={() =>
                                                        updateConfig({ equipment: eq })
                                                    }
                                                    className={clsx(
                                                        'rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all',
                                                        selected
                                                            ? 'border-accent bg-accent/10 text-accent'
                                                            : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:border-white/10 hover:text-zinc-200',
                                                    )}
                                                >
                                                    {eq}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label
                                        htmlFor="pg-injuries"
                                        className="eyebrow block"
                                    >
                                        Injuries / limitations{' '}
                                        <span className="text-zinc-600">(optional)</span>
                                    </label>
                                    <input
                                        id="pg-injuries"
                                        type="text"
                                        value={config.injuries}
                                        onChange={(e) =>
                                            setConfig((c) => ({
                                                ...c,
                                                injuries: e.target.value,
                                            }))
                                        }
                                        className="input"
                                        placeholder="e.g. Shoulder tweak, skip overhead press"
                                    />
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                <div className="eyebrow mb-2">Summary</div>
                                <div className="flex flex-wrap gap-2">
                                    <Chip tone="accent">{config.experience}</Chip>
                                    <Chip>{config.days} days / wk</Chip>
                                    <Chip>{config.focus}</Chip>
                                    <Chip>{config.equipment}</Chip>
                                </div>
                            </div>
                        </section>
                    )}

                    {step === 4 && (
                        <section className="animate-fade-in space-y-6">
                            <div className="text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 shadow-glow-sm">
                                    <Check
                                        className="h-8 w-8 text-accent"
                                        strokeWidth={2.5}
                                    />
                                </div>
                                <h4 className="text-2xl font-bold tracking-tight text-white">
                                    Your program is ready
                                </h4>
                                <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
                                    We&apos;ve built a personalized plan based on your experience,
                                    schedule, and focus.
                                </p>
                            </div>

                            {generatedProgram && (
                                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                    <div className="eyebrow mb-3">Preview</div>
                                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-300">
                                        {typeof generatedProgram === 'string'
                                            ? generatedProgram
                                            : JSON.stringify(generatedProgram, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Footer / nav */}
                <footer className="safe-bottom flex items-center gap-3 border-t border-white/5 bg-zinc-950/80 px-5 py-4 backdrop-blur md:px-6">
                    {step > 1 && step < 4 && (
                        <button
                            type="button"
                            onClick={goBack}
                            disabled={isGenerating}
                            className="btn-outline inline-flex items-center gap-1"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </button>
                    )}
                    <div className="flex-1" />
                    {step < 3 && (
                        <button
                            type="button"
                            onClick={goNext}
                            className="btn-primary inline-flex items-center gap-1"
                        >
                            Continue
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    )}
                    {step === 3 && (
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="btn-primary inline-flex min-w-[160px] items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <LoadingRing size={16} />
                                    Generating…
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Generate program
                                </>
                            )}
                        </button>
                    )}
                    {step === 4 && (
                        <button
                            type="button"
                            onClick={() => {
                                hapticSuccess();
                                onComplete?.(generatedProgram);
                            }}
                            className="btn-primary inline-flex items-center gap-2"
                        >
                            Start program
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
}
