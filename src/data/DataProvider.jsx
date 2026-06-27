/**
 * React bindings for the local-first repository (db.js).
 *
 * Components never touch localStorage or the network for app data — they
 * read snapshots via these hooks and write through `db.*`, which notifies
 * subscribers synchronously. Background sync runs opportunistically.
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore,
} from 'react';
import { db } from './db';
import { runSync } from './sync';
import { initializeStorage } from './storage';

const SyncContext = createContext({
    isOnline: true,
    isSyncing: false,
    pendingOps: 0,
    lastSyncedAt: null,
    requestSync: () => {},
});

export const useSyncStatus = () => useContext(SyncContext);

/* ------------------------------------------------------------------ */
/* Snapshot hooks                                                      */
/* ------------------------------------------------------------------ */

function useDbSnapshot(selector) {
    // Cache the selected snapshot; recompute only when db notifies.
    const subscribe = useCallback((onChange) => db.subscribe(onChange), []);
    const getSnapshot = useMemo(() => {
        let cachedDoc = null;
        let cachedValue = null;
        return () => {
            const current = db.get();
            if (current !== cachedDoc) {
                cachedDoc = current;
                cachedValue = selector();
            }
            return cachedValue;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return useSyncExternalStore(subscribe, getSnapshot);
}

/** All workouts, newest first. */
export const useWorkouts = () => useDbSnapshot(() => db.workouts.list());

/** The active program, or null. */
export const useActiveProgram = () => useDbSnapshot(() => db.programs.getActive());

/** All programs, newest first. */
export const usePrograms = () => useDbSnapshot(() => db.programs.list());

/** App settings (units, goal, AI provider config…). */
export const useSettings = () => useDbSnapshot(() => db.settings.get());

/** Built-in + custom exercises. */
export const useExercises = () => useDbSnapshot(() => db.exercises.all());

/* ------------------------------------------------------------------ */
/* Provider: connectivity + opportunistic sync                          */
/* ------------------------------------------------------------------ */

export function DataProvider({ children }) {
    const [isOnline, setIsOnline] = useState(() => navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState(
        () => db.get().meta.lastSyncedAt,
    );
    const pendingOps = useDbSnapshot(() => db.sync.pendingOps().length);

    // Initialize storage layer on mount (async, non-blocking)
    useEffect(() => {
        initializeStorage().catch((e) => {
            console.error('[DataProvider] failed to initialize storage', e);
        });
    }, []);

    const requestSync = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            const result = await runSync();
            if (result.pushed > 0) setLastSyncedAt(db.get().meta.lastSyncedAt);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    useEffect(() => {
        const onOnline = () => {
            setIsOnline(true);
            requestSync();
        };
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, [requestSync]);

    // Push pending work shortly after mount and whenever the queue grows.
    useEffect(() => {
        if (!pendingOps || !isOnline) return undefined;
        const t = setTimeout(() => requestSync(), 2500);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingOps, isOnline]);

    const value = useMemo(
        () => ({ isOnline, isSyncing, pendingOps, lastSyncedAt, requestSync }),
        [isOnline, isSyncing, pendingOps, lastSyncedAt, requestSync],
    );

    return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
