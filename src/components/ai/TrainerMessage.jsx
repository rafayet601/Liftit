import React from 'react';
import { Bot, User } from 'lucide-react';
import clsx from 'clsx';

export default function TrainerMessage({ message }) {
    const isUser = message.role === 'user';
    const ts = message.timestamp
        ? new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
          })
        : '';

    return (
        <div className={clsx('flex items-end gap-2.5', isUser && 'flex-row-reverse')}>
            <div
                className={clsx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                    isUser ? 'bg-accent text-ink-950' : 'bg-accent/10 text-accent',
                )}
            >
                {isUser ? (
                    <User className="h-4 w-4" strokeWidth={2.4} />
                ) : (
                    <Bot className="h-4 w-4" />
                )}
            </div>
            <div
                className={clsx(
                    'max-w-[80%] rounded-2xl px-4 py-2.5',
                    isUser
                        ? 'rounded-br-sm bg-accent text-ink-950'
                        : message.isError
                          ? 'rounded-bl-sm border border-red-500/20 bg-red-500/10 text-red-200'
                          : 'surface rounded-bl-sm text-zinc-100',
                )}
            >
                <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">
                    {message.content}
                </p>
                {ts && (
                    <p
                        className={clsx(
                            'mt-1.5 text-[10px] font-semibold uppercase tracking-widest',
                            isUser ? 'text-ink-950/50' : 'text-zinc-500',
                        )}
                    >
                        {ts}
                    </p>
                )}
            </div>
        </div>
    );
}
