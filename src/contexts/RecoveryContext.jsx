import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { db } from '../data/db';
import { useSettings } from '../data/DataProvider';
import {
    computeReadiness,
    createRecoveryProvider,
    noopProvider,
} from '../data/recovery';

/**
 * Recovery readiness context.
 *
 * Opt-in (db.settings.recovery.enabled, default false) and on-device: the
 * provider is polled locally, readiness is computed locally, nothing is
 * synced. When disabled or when no wearable source is available, readiness
 * is null and the provider is a clean no-op — no UI should block on it.
 */

const RecoveryContext = createContext({
    provider: noopProvider,
    readiness: null,
    enabled: false,
    setEnabled: () => {},
    refresh: async () => {},
});

export const useRecovery = () => useContext(RecoveryContext);

export function RecoveryProvider({ children, provider }) {
    const settings = useSettings();
    const enabled = Boolean(settings.recovery?.enabled);
    const activeProvider = useMemo(() => provider ?? createRecoveryProvider(), [provider]);
    const available = activeProvider.available();

    const [readiness, setReadiness] = useState(null);

    const refresh = useCallback(async () => {
        if (!enabled || !activeProvider.available()) {
            setReadiness(null);
            return;
        }
        try {
            const samples = await activeProvider.fetchRecent(30);
            setReadiness(computeReadiness(samples));
        } catch (e) {
            console.error('[recovery] failed to compute readiness', e);
            setReadiness(null);
        }
    }, [enabled, activeProvider]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const setEnabled = useCallback((next) => {
        db.settings.update({ recovery: { enabled: Boolean(next) } });
    }, []);

    const value = useMemo(
        () => ({
            provider: activeProvider,
            readiness: enabled && available ? readiness : null,
            enabled,
            setEnabled,
            refresh,
        }),
        [activeProvider, readiness, enabled, available, setEnabled, refresh],
    );

    return <RecoveryContext.Provider value={value}>{children}</RecoveryContext.Provider>;
}

export default RecoveryContext;
