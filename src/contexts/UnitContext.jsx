import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UnitContext = createContext({
    unit: 'kg',
    toggleUnit: () => {},
    convertWeight: (val) => val,
    displayWeight: (val) => val,
    toKg: (val) => val,
});

export const useUnit = () => useContext(UnitContext);

function readStoredUnit() {
    if (typeof window === 'undefined') return 'kg';
    try {
        const saved = window.localStorage.getItem('liftit_unit');
        return saved === 'lbs' ? 'lbs' : 'kg';
    } catch {
        return 'kg';
    }
}

export function UnitProvider({ children }) {
    // Hydrate synchronously so tests & SSR-free cold renders see the correct unit.
    const [unit, setUnit] = useState(readStoredUnit);

    useEffect(() => {
        try {
            window.localStorage.setItem('liftit_unit', unit);
        } catch {}
    }, [unit]);

    const toggleUnit = useCallback(() => {
        setUnit((u) => (u === 'kg' ? 'lbs' : 'kg'));
    }, []);

    /**
     * Convert a KG value into the user's preferred display unit.
     * Returns a Number (never an empty string) — callers are responsible for
     * deciding whether to render blank for zero. This avoids input "ghosting".
     */
    const displayWeight = useCallback(
        (kgValue) => {
            const n = Number(kgValue);
            if (!Number.isFinite(n)) return 0;
            if (unit === 'kg') return Math.round(n * 10) / 10;
            return Math.round(n * 2.20462 * 10) / 10;
        },
        [unit],
    );

    /**
     * Convert a value in the user's current unit back to KG for storage.
     * Accepts numbers or numeric strings. Returns 0 for non-numeric input.
     */
    const toKg = useCallback(
        (userValue) => {
            const n = Number(userValue);
            if (!Number.isFinite(n)) return 0;
            if (unit === 'kg') return Math.round(n * 100) / 100;
            return Math.round((n / 2.20462) * 100) / 100;
        },
        [unit],
    );

    const convertWeight = displayWeight;

    return (
        <UnitContext.Provider value={{ unit, toggleUnit, displayWeight, toKg, convertWeight }}>
            {children}
        </UnitContext.Provider>
    );
}
