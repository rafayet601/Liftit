import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { NAV_ITEMS } from '../../App';
import { hapticSelection } from '../../lib/platform';
import LinearGradient from '../ui/LinearGradient';

export default function MobileNav() {
    const location = useLocation();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden" aria-label="Primary">
            <LinearGradient
                preset="purpleToSteel"
                animated
                variant="strip"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '1px',
                    borderRadius: 0,
                    opacity: 0.5,
                    zIndex: 1,
                }}
            />
            <div
                className="border-t border-white/[0.08] pb-safe"
                style={{
                    background: 'rgba(11, 11, 12, 0.92)',
                    backdropFilter: 'blur(24px) saturate(120%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(120%)',
                    boxShadow: '0 -1px 0 rgba(255,255,255,0.06), 0 -8px 32px rgba(0,0,0,0.4)',
                }}
            >
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
                                unstable_viewTransition
                                onClick={() => hapticSelection()}
                                aria-current={isActive ? 'page' : undefined}
                                className={clsx(
                                    'relative flex w-16 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-200',
                                    isActive ? 'text-accent' : 'text-ink-500 hover:text-white',
                                )}
                            >
                                {isActive && (
                                    <>
                                        <span
                                            className="absolute inset-x-5 top-0 h-0.5 rounded-full"
                                            style={{
                                                background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
                                                boxShadow: '0 0 8px rgba(139,92,246,0.8), 0 0 16px rgba(139,92,246,0.3)',
                                            }}
                                        />
                                        <span
                                            className="absolute inset-1 rounded-xl"
                                            style={{ background: 'rgba(139,92,246,0.08)' }}
                                        />
                                    </>
                                )}
                                <item.icon
                                    className="relative h-5 w-5"
                                    strokeWidth={isActive ? 2.4 : 2}
                                    style={
                                        isActive
                                            ? { filter: 'drop-shadow(0 0 5px rgba(139,92,246,0.6))' }
                                            : undefined
                                    }
                                />
                                <span className="relative">{item.name}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
