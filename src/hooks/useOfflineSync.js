import { useState, useEffect, useCallback } from 'react';
import { isAuthenticated } from '../lib/api';
import { migrateLocalData } from '../services/user.service';
import { loadData, saveData } from '../lib/store';

export const useOfflineSync = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingChanges, setPendingChanges] = useState([]);
    const [lastSyncTime, setLastSyncTime] = useState(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const addPendingChange = useCallback((change) => {
        setPendingChanges(prev => [...prev, { ...change, timestamp: Date.now() }]);
    }, []);

    const syncToServer = useCallback(async () => {
        if (!isOnline || !isAuthenticated()) return;

        setIsSyncing(true);
        try {
            const localData = loadData();
            const response = await migrateLocalData(localData);
            
            if (response.data?.success) {
                setPendingChanges([]);
                setLastSyncTime(new Date());
                localStorage.setItem('liftit_last_sync', Date.now().toString());
            }
        } catch (err) {
            console.error('Sync failed:', err);
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline]);

    useEffect(() => {
        if (isOnline && pendingChanges.length > 0) {
            syncToServer();
        }
    }, [isOnline, pendingChanges.length, syncToServer]);

    const forceSync = useCallback(async () => {
        const localData = loadData();
        saveData(localData);
        return syncToServer();
    }, [syncToServer]);

    return {
        isOnline,
        isSyncing,
        pendingChanges: pendingChanges.length,
        lastSyncTime,
        addPendingChange,
        syncToServer,
        forceSync,
    };
};

export default useOfflineSync;
