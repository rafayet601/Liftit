import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, Calendar, BarChart3, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useModal } from '../../contexts/ModalContext';
import { hapticSelection } from '../../lib/platform';

/**
 * Bottom tab bar for mobile/iOS. Inspired by native iOS tab bars: generous
 * touch targets, translucent material, subtle active-state pill, respects
 * safe area. Includes a centre AI-trainer FAB that feels native.
 */
export default function MobileNav() {
    const location = useLocation();
    const { openTrainer } = useModal();

    const left = [
        { name: 'Home', icon: LayoutDashboard, path: '/' },
        { name: 'Train', icon: Dumbbell, path: '/tracker' },
    ];
    const right = [
        { name: 'Program', icon: Calendar, path: '/program' },
        { name: 'Stats', icon: BarChart3, path: '/analytics' },
    ];

    const renderItem = (item) => {
        const isActive = location.pathname === item.path;
        return (
            <Link
                key={item.path}
                to={item.path}
                onClick={() => hapticSelection()}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                    'relative flex w-16 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
                    isActive ? 'text-accent' : 'text-zinc-500 hover:text-white',
                )}
            >
                {isActive && (
                    <span className="absolute inset-x-4 top-1 h-0.5 rounded-full bg-accent shadow-[0_0_12px_rgba(190,242,100,0.6)]" />
                )}
                <item.icon className={clsx('h-5 w-5', isActive && 'drop-shadow-[0_0_10px_rgba(190,242,100,0.4)]')} strokeWidth={isActive ? 2.3 : 2} />
                <span>{item.name}</span>
            </Link>
        );
    };

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-50 md:hidden"
            aria-label="Primary"
        >
            {/* Blur layer respecting iOS safe area */}
            <div className="border-t border-white/5 bg-ink-950/75 backdrop-blur-2xl pb-safe">
                <div className="relative mx-auto flex max-w-md items-center justify-between px-4 pt-2">
                    <div className="flex flex-1 items-center justify-around">
                        {left.map(renderItem)}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            hapticSelection();
                            openTrainer();
                        }}
                        aria-label="AI Trainer"
                        className="relative -mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-ink-950 shadow-glow ring-4 ring-ink-950 active:scale-95"
                    >
                        <Sparkles className="h-6 w-6" strokeWidth={2.2} />
                    </button>

                    <div className="flex flex-1 items-center justify-around">
                        {right.map(renderItem)}
                    </div>
                </div>
            </div>
        </nav>
    );
}
