import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

import PlateCalculator, { computePlates, formatPlates } from '../components/workout/PlateCalculator';
import { db } from '../data/db';
import { DataProvider } from '../data/DataProvider';
import { UnitProvider } from '../contexts/UnitContext';

describe('computePlates', () => {
    it('splits a clean kg load per side', () => {
        // 100kg = 20kg bar + 2×(25+15)
        expect(computePlates(100, 'kg')).toEqual({
            perSide: [25, 15],
            leftoverKg: 0,
            feasible: true,
        });
    });

    it('handles non-clean kg splits down to the smallest plate', () => {
        // 102.5kg → 41.25/side → 25 + 15 + 1.25
        expect(computePlates(102.5, 'kg')).toEqual({
            perSide: [25, 15, 1.25],
            leftoverKg: 0,
            feasible: true,
        });
    });

    it('repeats the heaviest plate when needed', () => {
        // 170kg → 75/side → 25 + 25 + 25
        const r = computePlates(170, 'kg');
        expect(r.feasible).toBe(true);
        expect(r.perSide).toEqual([25, 25, 25]);
    });

    it('is infeasible at bar weight and below', () => {
        expect(computePlates(20, 'kg').feasible).toBe(false);
        expect(computePlates(20, 'kg').perSide).toEqual([]);
        expect(computePlates(15, 'kg').feasible).toBe(false);
        expect(computePlates(0, 'kg').feasible).toBe(false);
        expect(computePlates(NaN, 'kg').feasible).toBe(false);
    });

    it('is infeasible below the smallest plate increment', () => {
        // 21kg → 0.5/side — no plate set makes that
        const r = computePlates(21, 'kg');
        expect(r.feasible).toBe(false);
        expect(r.perSide).toEqual([]);
        expect(r.leftoverKg).toBeCloseTo(0.5, 2);
    });

    it('uses the 45lb bar and lb plates for lbs', () => {
        // 135lb ≈ 61.23kg → one 45 per side
        const r = computePlates(61.23, 'lbs');
        expect(r.feasible).toBe(true);
        expect(r.perSide).toEqual([45]);
    });

    it('combines lb plates greedily for native lb loads', () => {
        // 220lb ≈ 99.79kg → 87.5/side → 45+35+5+2.5
        const r = computePlates(99.79, 'lbs');
        expect(r.feasible).toBe(true);
        expect(r.perSide).toEqual([45, 35, 5, 2.5]);
    });

    it('reports honest leftovers for kg-native loads in lbs mode', () => {
        // 100kg ≈ 220.46lb → 0.23lb/side cannot be made with lb plates
        const r = computePlates(100, 'lbs');
        expect(r.feasible).toBe(false);
        expect(r.perSide).toEqual([]);
        expect(r.leftoverKg).toBeGreaterThan(0);
    });

    it('falls back to kg for unknown units', () => {
        expect(computePlates(100, 'stone')).toEqual(computePlates(100, 'kg'));
    });
});

describe('formatPlates', () => {
    it('collapses runs of identical plates', () => {
        expect(formatPlates([25, 25, 5])).toBe('2×25 + 1×5');
    });

    it('joins distinct plates without counts beyond one', () => {
        expect(formatPlates([25, 15, 1.25])).toBe('1×25 + 1×15 + 1×1.25');
    });
});

describe('PlateCalculator chip', () => {
    beforeEach(() => {
        localStorage.clear();
        db.wipe();
    });

    function Providers({ children }) {
        return (
            <DataProvider>
                <UnitProvider>{children}</UnitProvider>
            </DataProvider>
        );
    }

    it('shows the per-side breakdown for a loadable weight', () => {
        render(
            <Providers>
                <PlateCalculator weightKg={100} />
            </Providers>,
        );
        expect(screen.getByText('1×25 + 1×15 /side')).toBeInTheDocument();
    });

    it('renders nothing when the load is not makeable', () => {
        const { container } = render(
            <Providers>
                <PlateCalculator weightKg={15} />
            </Providers>,
        );
        expect(container).toBeEmptyDOMElement();
    });
});
