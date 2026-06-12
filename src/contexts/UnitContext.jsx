import React, { createContext, useContext, useCallback } from 'react';
import { db } from '../data/db';
import { useSettings } from '../data/DataProvider';

/**
 * Weight-unit conversion at the display edge. The repository stores KG
 * everywhere; this context renders/parses the user's preferred unit.
 * The preference itself lives in db.settings (synced with everything else).
 */

const KG_PER_LB = 1 / 2.20462;

const UnitContext = createContext({
    unit: 'kg',
    toggleUnit: () => {},
    setUnit: () => {},
    convertWeight: (val) => val,
    displayWeight: (val) => val,
    toKg: (val) => val,
});

export const useUnit = () => useContext(UnitContext);

export function UnitProvider({ children }) {
    const settings = useSettings();
    const unit = settings.units === 'lbs' ? 'lbs' : 'kg';

    const setUnit = useCallback((next) => {
        db.settings.update({ units: next === 'lbs' ? 'lbs' : 'kg' });
    }, []);

    const toggleUnit = useCallback(() => {
        setUnit(unit === 'kg' ? 'lbs' : 'kg');
    }, [unit, setUnit]);

    /** KG → display unit, rounded to 0.1. Always returns a Number. */
    const displayWeight = useCallback(
        (kgValue) => {
            const n = Number(kgValue);
            if (!Number.isFinite(n)) return 0;
            const v = unit === 'kg' ? n : n / KG_PER_LB;
            return Math.round(v * 10) / 10;
        },
        [unit],
    );

    /** Display unit → KG for storage. Returns 0 for non-numeric input. */
    const toKg = useCallback(
        (userValue) => {
            const n = Number(userValue);
            if (!Number.isFinite(n)) return 0;
            const v = unit === 'kg' ? n : n * KG_PER_LB;
            return Math.round(v * 100) / 100;
        },
        [unit],
    );

    return (
        <UnitContext.Provider
            value={{ unit, toggleUnit, setUnit, displayWeight, toKg, convertWeight: displayWeight }}
        >
            {children}
        </UnitContext.Provider>
    );
}
