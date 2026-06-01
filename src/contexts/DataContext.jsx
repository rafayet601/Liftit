import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadData, saveData } from '../lib/store';
import { isAuthenticated } from '../lib/api';
import { migrateLocalData } from '../services/user.service';

const DataContext = createContext({
    data: null,
    isLoading: true,
    isSyncing: false,
    lastSyncTime: null,
    isOnline: true,
    saveData: () => {},
    syncData: async () => {},
    updateData: () => {},
});

export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const loadLocalData = () => {
            const storedData = loadData();
            setData(storedData);
            setIsLoading(false);
        };

        loadLocalData();
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncData();
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
        // Intentionally run once: syncData is referenced via closure and will be
        // invoked via the `online` event handler when connectivity returns.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveLocal = useCallback((newData) => {
        saveData(newData);
        setData(newData);
    }, []);

    const syncData = useCallback(async () => {
        if (!isAuthenticated() || !isOnline) return;

        setIsSyncing(true);
        try {
            const currentData = loadData();
            const response = await migrateLocalData(currentData);
            if (response.data) {
                setLastSyncTime(new Date());
            }
        } catch (err) {
            console.error('Sync failed:', err);
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline]);

    const updateData = useCallback((updates) => {
        setData(prev => {
            const newData = { ...prev, ...updates };
            saveLocal(newData);
            return newData;
        });
    }, [saveLocal]);

    const value = {
        data,
        isLoading,
        isSyncing,
        lastSyncTime,
        isOnline,
        saveData: saveLocal,
        syncData,
        updateData,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

export default DataContext;
