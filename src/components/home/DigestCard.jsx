import React from 'react';
import { Newspaper } from 'lucide-react';
import { Card, Chip } from '../ui/Primitives';

/**
 * Weekly digest card for Home. Shows ONLY values computed by
 * analytics.weeklyDigest — when there's no data yet, the message from the
 * engine is already an honest empty state, so we render it verbatim.
 */

const ACWR_CHIP = {
    spike: { tone: 'danger', label: 'Load spike' },
    detrend: { tone: 'warning', label: 'Load taper' },
    balanced: { tone: 'success', label: 'Balanced load' },
    insufficient_data: { tone: 'steel', label: 'No load history yet' },
};

export default function DigestCard({ digest }) {
    if (!digest) return null;
    const acwrChip = ACWR_CHIP[digest.acwrStatus] ?? { tone: 'default', label: digest.acwrStatus };

    return (
        <Card className="flex flex-wrap items-center justify-between gap-4" data-testid="digest-card">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Newspaper className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                    <div className="eyebrow mb-0.5">Weekly digest</div>
                    <p className="truncate text-sm text-ink-300" title={digest.message}>
                        {digest.message}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="steel">{digest.sessions} session{digest.sessions === 1 ? '' : 's'}</Chip>
                {digest.volumeDeltaPct !== null ? (
                    <Chip tone={digest.volumeDeltaPct >= 0 ? 'success' : 'default'}>
                        {digest.volumeDeltaPct >= 0 ? '+' : ''}
                        {digest.volumeDeltaPct}% volume
                    </Chip>
                ) : (
                    <Chip>{Math.round(digest.volumeCmp.current).toLocaleString()} kg this week</Chip>
                )}
                <Chip tone={digest.prCount > 0 ? 'accent' : 'default'}>
                    {digest.prCount} PR{digest.prCount === 1 ? '' : 's'}
                </Chip>
                <Chip tone={acwrChip.tone}>{acwrChip.label}</Chip>
            </div>
        </Card>
    );
}
