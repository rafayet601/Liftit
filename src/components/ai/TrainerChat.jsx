import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Bot, MessageCircle, X, Settings as SettingsIcon } from 'lucide-react';
import { chat, coachAvailable, hasUserProvider, getAiConfig, AI_PROVIDERS } from '../../ai/providers';
import { buildCoachSystemPrompt } from '../../ai/coach';
import TrainerMessage from './TrainerMessage';
import { useSettings } from '../../data/DataProvider';
import { LoadingRing } from '../ui/Primitives';
import { hapticSelection } from '../../lib/platform';

/**
 * Coach — chat grounded in the lifter's real program + history. Uses the
 * user's own AI provider (Settings → AI Coach), falling back to the app
 * server when signed in. Full-screen on mobile, side sheet on desktop.
 */
export default function TrainerChat({ onClose }) {
    const settings = useSettings();
    const available = coachAvailable();
    const providerLabel = hasUserProvider()
        ? `${AI_PROVIDERS[getAiConfig().provider]?.label}${getAiConfig().model ? ` · ${getAiConfig().model}` : ''}`
        : 'Built-in coach';

    const [messages, setMessages] = useState([
        {
            id: 1,
            role: 'assistant',
            content: `Hey ${settings.name?.split(' ')[0] || 'there'} — I'm Coach. I can see your program and recent sessions, so ask me anything: programming, plateaus, form cues, deloads.`,
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    const systemPrompt = useMemo(() => buildCoachSystemPrompt(), []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, busy]);

    useEffect(() => {
        const id = setTimeout(() => inputRef.current?.focus(), 120);
        return () => clearTimeout(id);
    }, []);

    const send = async (e) => {
        e?.preventDefault();
        const text = input.trim();
        if (!text || busy) return;
        hapticSelection();
        const userMsg = { id: Date.now(), role: 'user', content: text, timestamp: new Date() };
        const history = [...messages.slice(1), userMsg].map((m) => ({
            role: m.role,
            content: m.content,
        }));
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setBusy(true);
        try {
            const reply = await chat(history, systemPrompt);
            setMessages((prev) => [
                ...prev,
                { id: Date.now() + 1, role: 'assistant', content: reply, timestamp: new Date() },
            ]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: err.message || 'Something went wrong reaching the model.',
                    timestamp: new Date(),
                    isError: true,
                },
            ]);
        } finally {
            setBusy(false);
        }
    };

    const quickPrompts = [
        'How am I progressing?',
        'Bench is stalling — what now?',
        'Plan my next block',
        'Should I deload soon?',
    ];

    return (
        <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:justify-end md:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trainer-title"
        >
            <div className="surface-strong flex h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border-b-0 md:h-[88vh] md:rounded-3xl md:border-b">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                            <MessageCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 id="trainer-title" className="font-display text-base font-bold tracking-tight text-white">
                                Coach
                            </h3>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
                                {available ? providerLabel : 'Not configured'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-white/5 hover:text-white"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

                {!available ? (
                    /* Honest setup state — no fake replies */
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                            <Bot className="h-7 w-7" />
                        </div>
                        <div>
                            <h4 className="font-display text-lg font-bold text-white">
                                Bring your own model
                            </h4>
                            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-400">
                                Coach uses an AI provider of your choice — Anthropic, OpenAI, Groq, or any
                                OpenAI-compatible endpoint. Add your API key once and it stays on this
                                device. Or sign in to use the built-in coach.
                            </p>
                        </div>
                        <Link to="/settings" onClick={onClose} className="btn-primary">
                            <SettingsIcon className="h-4 w-4" /> Configure in Settings
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Messages */}
                        <div className="flex-1 space-y-4 overflow-y-auto p-5">
                            {messages.map((m) => (
                                <TrainerMessage key={m.id} message={m} />
                            ))}
                            {busy && (
                                <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                        <Bot className="h-4 w-4" />
                                    </div>
                                    <div className="surface inline-flex items-center gap-2 rounded-2xl rounded-tl-sm px-4 py-2.5">
                                        <LoadingRing size={14} />
                                        <span className="text-sm text-ink-400">Thinking…</span>
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Quick prompts */}
                        {messages.length <= 2 && !busy && (
                            <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-white/[0.07] px-5 py-3">
                                {quickPrompts.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setInput(p)}
                                        className="shrink-0 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-ink-300 transition-colors hover:border-accent/30 hover:text-accent"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input */}
                        <form onSubmit={send} className="border-t border-white/[0.07] p-3 pb-safe md:p-4">
                            <div className="flex items-end gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about your training…"
                                    className="input"
                                    disabled={busy}
                                    autoComplete="off"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || busy}
                                    className="btn-primary btn-lg aspect-square h-12 !px-0"
                                    aria-label="Send"
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
