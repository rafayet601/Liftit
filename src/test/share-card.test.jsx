import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import ShareCard, { buildPrCardModel } from '../components/ui/ShareCard';
import { db } from '../data/db';
import { DataProvider } from '../data/DataProvider';
import { UnitProvider } from '../contexts/UnitContext';

const EVENT = {
    date: '2026-08-27T09:00:00.000Z',
    workoutId: 'w1',
    exerciseId: 'barbell-bench-press',
    prs: [
        { type: 'weight', value: 100 },
        { type: 'e1rm', value: 105 },
    ],
};

function Providers({ children }) {
    return (
        <DataProvider>
            <UnitProvider>{children}</UnitProvider>
        </DataProvider>
    );
}

describe('buildPrCardModel', () => {
    it('prefers the weight PR and formats value + date', () => {
        const m = buildPrCardModel(EVENT, 'kg', (v) => v);
        expect(m.label).toBe('Heaviest set');
        expect(m.value).toBe('100 kg');
        expect(m.sub).toBeUndefined();
        expect(m.date).toContain('2026');
    });

    it('falls back to e1rm, then reps PRs', () => {
        const e1 = buildPrCardModel(
            { date: EVENT.date, prs: [{ type: 'e1rm', value: 120.5 }] },
            'kg',
            (v) => v,
        );
        expect(e1.label).toBe('Est. 1RM');
        expect(e1.value).toBe('120.5 kg');

        const reps = buildPrCardModel(
            { date: EVENT.date, prs: [{ type: 'reps', value: 12, weight: 80 }] },
            'kg',
            (v) => v,
        );
        expect(reps.label).toBe('Rep record');
        expect(reps.value).toBe('12 reps');
        expect(reps.sub).toBe('@ 80 kg');
    });

    it('respects the display unit', () => {
        const m = buildPrCardModel(EVENT, 'lbs', (v) => Math.round(v * 2.20462 * 10) / 10);
        expect(m.value).toBe('220.5 lbs');
    });

    it('returns null for PR-less events (no fabricated numbers)', () => {
        expect(buildPrCardModel({ date: EVENT.date, prs: [] }, 'kg', (v) => v)).toBeNull();
        expect(buildPrCardModel(null, 'kg', (v) => v)).toBeNull();
    });
});

describe('ShareCard', () => {
    beforeEach(() => {
        localStorage.clear();
        db.wipe();
    });

    it('renders a share button for a PR event', () => {
        render(
            <Providers>
                <ShareCard event={EVENT} />
            </Providers>,
        );
        expect(screen.getByRole('button', { name: /share pr/i })).toBeInTheDocument();
    });

    it('renders nothing when the event has no PRs', () => {
        const { container } = render(
            <Providers>
                <ShareCard event={{ date: EVENT.date, prs: [] }} />
            </Providers>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('degrades to a console-safe no-op when canvas is unavailable (jsdom)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(
            <Providers>
                <ShareCard event={EVENT} />
            </Providers>,
        );
        expect(() => fireEvent.click(screen.getByRole('button', { name: /share pr/i }))).not.toThrow();
        warn.mockRestore();
    });
});
