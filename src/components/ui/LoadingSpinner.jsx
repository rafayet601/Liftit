import React from 'react';
import clsx from 'clsx';

const sizeMap = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-[3px]',
};

export default function LoadingSpinner({ size = 'md', className = '', full = false, label }) {
    const spinner = (
        <div
            className={clsx(
                'animate-spin rounded-full border-white/10 border-t-accent',
                sizeMap[size],
            )}
            role="status"
            aria-label={label || 'Loading'}
        />
    );
    if (full) {
        return (
            <div className={clsx('flex min-h-[60vh] flex-col items-center justify-center gap-3', className)}>
                {spinner}
                {label && <p className="text-sm text-zinc-500">{label}</p>}
            </div>
        );
    }
    return <div className={clsx('flex items-center justify-center', className)}>{spinner}</div>;
}
