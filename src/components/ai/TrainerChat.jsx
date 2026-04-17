import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, Sparkles, X } from 'lucide-react';
import { sendChatMessage } from '../../services/ai.service';
import TrainerMessage from './TrainerMessage';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingRing } from '../ui/Primitives';
import { hapticSelection } from '../../lib/platform';

/**
 * Full-screen chat on mobile, right-side sheet on desktop. Respects iOS
 * safe-area. Keyboard-friendly input.
 */
export default function TrainerChat({ onClose }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState([
        {
            id: 1,
            role: 'assistant',
            content: `Hey ${user?.name?.split(' ')[0] || 'there'} 👋 I'm your AI training coach. Ask me about programming, form cues, RPE targets, deloads, nutrition timing — anything.`,
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

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
        const userMsg = {
            id: Date.now(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setBusy(true);
        try {
            const history = messages.map((m) => ({ role: m.role, content: m.content }));
            const res = await sendChatMessage(text, history);
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content:
                        res.data?.message ||
                        "Here's a quick thought: progressive overload is the principle — consistent practice is the execution.",
                    timestamp: new Date(),
                },
            ]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: 'I had trouble reaching the coach just now. Try again in a moment.',
                    timestamp: new Date(),
                    isError: true,
                },
            ]);
            console.warn('[TrainerChat]', err);
        } finally {
            setBusy(false);
        }
    };

    const quickPrompts = [
        'Recommend a deload week',
        'Bench is stalling — what now?',
        'How to program progressive overload',
        'Best exercises for weak glutes',
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
                <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                            <Sparkles className="h-5 w-5" />
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent shadow-glow-sm" />
                        </div>
                        <div>
                            <h3
                                id="trainer-title"
                                className="text-base font-bold tracking-tight text-white"
                            >
                                AI Trainer
                            </h3>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                                Your personal coach
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

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
                                <span className="text-sm text-zinc-400">Thinking…</span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Quick prompts */}
                {messages.length <= 2 && !busy && (
                    <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-white/5 px-5 py-3">
                        {quickPrompts.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setInput(p)}
                                className="shrink-0 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all hover:border-accent/30 hover:bg-accent/5 hover:text-accent"
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input */}
                <form
                    onSubmit={send}
                    className="border-t border-white/5 p-3 pb-safe md:p-4"
                >
                    <div className="flex items-end gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about programming, form, nutrition…"
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
            </div>
        </div>
    );
}
