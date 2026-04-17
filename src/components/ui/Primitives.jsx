import React from 'react';
import clsx from 'clsx';

/**
 * Liftit UI primitives — lightweight, composable building blocks used across
 * pages. Keep these tiny and predictable; pages should compose, not fork.
 */

export function Card({ as: As = 'div', className, padded = true, hover = false, ...rest }) {
    return (
        <As
            className={clsx(
                'surface',
                padded && 'p-5 md:p-6',
                hover && 'surface-hover',
                className,
            )}
            {...rest}
        />
    );
}

export function SectionTitle({ eyebrow, title, description, action, className }) {
    return (
        <div className={clsx('mb-5 flex flex-wrap items-end justify-between gap-3', className)}>
            <div className="min-w-0">
                {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
                <h2 className="truncate text-2xl font-bold tracking-tight text-white md:text-[28px]">
                    {title}
                </h2>
                {description && (
                    <p className="mt-1 max-w-xl text-sm text-zinc-400">{description}</p>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

export function PageHeader({ eyebrow, title, description, icon: Icon, actions }) {
    return (
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 md:mb-10">
            <div className="flex min-w-0 items-start gap-4">
                {Icon && (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/5 bg-accent/10 text-accent shadow-glow-sm md:h-14 md:w-14">
                        <Icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2} />
                    </div>
                )}
                <div className="min-w-0">
                    {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
                    <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight text-white md:text-4xl">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-1 max-w-2xl text-sm text-zinc-400 md:text-base">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
    );
}

export function Chip({ children, tone = 'default', className, icon: Icon }) {
    const toneCls = {
        default: 'chip',
        accent: 'chip-accent',
        success: 'chip-success',
        warning: 'chip-warning',
        danger: 'chip-danger',
    }[tone] || 'chip';
    return (
        <span className={clsx(toneCls, className)}>
            {Icon && <Icon className="h-3 w-3" />}
            {children}
        </span>
    );
}

export function StatTile({ label, value, delta, icon: Icon, accent = false, className }) {
    return (
        <Card
            padded={false}
            className={clsx(
                'group flex flex-col gap-3 p-4 md:p-5',
                accent &&
                    'border-accent/20 bg-gradient-to-br from-accent/10 via-transparent to-transparent',
                className,
            )}
        >
            <div className="flex items-center justify-between">
                <span className="eyebrow">{label}</span>
                {Icon && (
                    <div
                        className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-lg border border-white/5',
                            accent ? 'bg-accent/20 text-accent' : 'bg-white/[0.03] text-zinc-400',
                        )}
                    >
                        <Icon className="h-4 w-4" />
                    </div>
                )}
            </div>
            <div className="flex items-baseline gap-2">
                <span
                    className={clsx(
                        'text-3xl font-bold tracking-tight tabular-nums md:text-4xl',
                        accent ? 'text-gradient-lime' : 'text-white',
                    )}
                >
                    {value}
                </span>
                {delta && (
                    <span
                        className={clsx(
                            'text-xs font-semibold tracking-tight',
                            delta.positive ? 'text-emerald-400' : 'text-zinc-500',
                        )}
                    >
                        {delta.label}
                    </span>
                )}
            </div>
        </Card>
    );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
    return (
        <Card
            className={clsx(
                'flex flex-col items-center justify-center py-12 text-center',
                className,
            )}
        >
            {Icon && (
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] text-zinc-400">
                    <Icon className="h-7 w-7" />
                </div>
            )}
            <h3 className="mb-1 text-lg font-bold text-white">{title}</h3>
            {description && (
                <p className="mb-5 max-w-sm text-sm text-zinc-400">{description}</p>
            )}
            {action}
        </Card>
    );
}

export function ButtonLink({ to, onClick, variant = 'primary', size, className, children, ...rest }) {
    const classes = clsx(
        {
            'btn-primary': variant === 'primary',
            'btn-secondary': variant === 'secondary',
            'btn-outline': variant === 'outline',
            'btn-ghost': variant === 'ghost',
            'btn-danger': variant === 'danger',
        },
        size === 'lg' && 'btn-lg',
        size === 'xl' && 'btn-xl',
        className,
    );
    // Render a semantic <button> (callers use react-router <Link> directly
    // when they need routing). Keeping this simple avoids nesting issues.
    return (
        <button type="button" className={classes} onClick={onClick} {...rest}>
            {children}
        </button>
    );
}

export function Divider({ className }) {
    return <div className={clsx('divider', className)} />;
}

export function LoadingRing({ size = 24, className }) {
    return (
        <span
            className={clsx(
                'inline-block animate-spin rounded-full border-2 border-white/10 border-t-accent',
                className,
            )}
            style={{ width: size, height: size }}
            role="status"
            aria-label="Loading"
        />
    );
}

export function ProgressBar({ value = 0, className, tone = 'accent' }) {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    const toneCls =
        tone === 'accent'
            ? 'bg-gradient-to-r from-accent-400 to-accent'
            : tone === 'success'
              ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              : tone === 'warning'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                : 'bg-white/20';
    return (
        <div
            className={clsx(
                'h-1.5 w-full overflow-hidden rounded-full bg-white/5',
                className,
            )}
            role="progressbar"
            aria-valuenow={safe}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className={clsx('h-full rounded-full transition-[width] duration-500', toneCls)}
                style={{ width: `${safe}%` }}
            />
        </div>
    );
}
