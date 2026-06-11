import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { NAV_ITEMS } from '../../App';
import { hapticSelection } from '../../lib/platform';

/**
 * Bottom tab bar for mobile/iOS — five equal tabs, generous touch targets,
 * safe-area aware. The Workout tab is the visual anchor.
 */
export default function MobileNav() {
    const location = useLocation();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden" aria-label="Primary">
            <div className="border-t border-white/[0.07] bg-ink-950/90 backdrop-blur-xl pb-safe">
                <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-1.5">
                    {NAV_ITEMS.map((item) => {
                        const isActive =
                            item.path === '/'
                                ? location.pathname === '/'
                                : location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => hapticSelection()}
                                aria-current={isActive ? 'page' : undefined}
                                className={clsx(
                                    'relative flex w-16 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors',
                                    isActive ? 'text-accent' : 'text-ink-500 hover:text-white',
                                )}
                            >
                                {isActive && (
                                    <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent" />
                                )}
                                <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.3 : 2} />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
