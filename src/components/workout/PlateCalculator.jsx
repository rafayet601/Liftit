import React, { useMemo } from 'react';
import clsx from 'clsx';
import { useUnit } from '../../contexts/UnitContext';

/**
 * Plate math for a barbell load. Weight comes in as stored KG; the bar and
 * plate set follow the display unit (20kg bar + kg plates, 45lb bar + lb
 * plates). Greedy largest-first per side; `perSide` is in display units.
 */
const KG_PER_LB = 2.20462;

const PLATE_SETS = {
    kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
    lbs: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
};

// Tolerance for float/rounding noise when matching the requested load.
const EPS_KG = 0.05;

export function computePlates(weightKg, unit = 'kg') {
    const spec = PLATE_SETS[unit] ?? PLATE_SETS.kg;
    const toKg = (v) => (unit === 'lbs' ? v / KG_PER_LB : v);
    const barKg = toKg(spec.bar);
    const totalKg = Number(weightKg) || 0;
    const perSideTargetKg = (totalKg - barKg) / 2;

    if (!(perSideTargetKg > EPS_KG)) {
        return { perSide: [], leftoverKg: 0, feasible: false };
    }

    const perSide = [];
    let loadedKg = 0;
    for (const plate of spec.plates) {
        const plateKg = toKg(plate);
        while (loadedKg + plateKg <= perSideTargetKg + EPS_KG) {
            perSide.push(plate);
            loadedKg += plateKg;
        }
    }

    const leftoverKg = Math.max(0, Math.round((perSideTargetKg - loadedKg) * 100) / 100);
    const feasible = leftoverKg <= EPS_KG;
    return { perSide: feasible ? perSide : [], leftoverKg, feasible };
}

/** "2×20 + 1×5" — collapses runs of identical plates into count×weight. */
export function formatPlates(perSide) {
    const groups = [];
    for (const p of perSide) {
        const last = groups[groups.length - 1];
        if (last && last.weight === p) last.count += 1;
        else groups.push({ weight: p, count: 1 });
    }
    return groups.map((g) => `${g.count}×${g.weight}`).join(' + ');
}

/**
 * Compact per-side plate hint shown under a set's weight input.
 * Renders nothing when the load can't be made with standard plates.
 */
export default function PlateCalculator({ weightKg, className }) {
    const { unit } = useUnit();
    const result = useMemo(() => computePlates(weightKg, unit), [weightKg, unit]);

    if (!result.feasible || !result.perSide.length) return null;

    return (
        <span
            className={clsx(
                'mt-1.5 inline-flex items-center rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ink-500 tabular-nums',
                className,
            )}
        >
            {formatPlates(result.perSide)} /side
        </span>
    );
}
