/**
 * Realtime tanpa Supabase Realtime.
 *
 * Dulu hook ini membuka channel `postgres_changes` ke Supabase. Setelah
 * database pindah ke Postgres biasa, perubahan tabel dipantau dengan polling
 * revisi ringan (counter pg_stat_user_tables) lewat backend.
 *
 * Kontrak pemakaian tidak berubah: satu channel per tabel, refcount, dan
 * callback onAnyChange dipanggil saat revisi tabel berubah.
 */
import { useEffect, useRef } from 'react';
import logger from '../lib/logger';

const BACKEND_URL = (import.meta.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');
const POLL_INTERVAL_MS = 15000;

const tableChannels = new Map();

let pollTimer = null;

const authHeaders = () => {
    try {
        const token = localStorage.getItem('authToken');
        return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
        return {};
    }
};

const fetchRevision = async (table) => {
    if (!BACKEND_URL) return null;
    try {
        const response = await fetch(`${BACKEND_URL}/api/data/${table}/changes`, { headers: authHeaders() });
        if (!response.ok) return null;
        const body = await response.json();
        return body?.data?.revision ?? null;
    } catch {
        return null;
    }
};

const dispatch = (table) => {
    const entry = tableChannels.get(table);
    if (!entry) return;
    entry.subscribers.forEach((handlers) => {
        try {
            handlers.onAnyChange?.('REFRESH', null, null);
        } catch (error) {
            console.error(`Realtime handler error (${table}):`, error);
        }
    });
};

const pollTable = async (table) => {
    const entry = tableChannels.get(table);
    if (!entry) return;
    const revision = await fetchRevision(table);
    if (revision === null) return;
    if (entry.revision === null) {
        entry.revision = revision;
        return;
    }
    if (revision !== entry.revision) {
        entry.revision = revision;
        logger.realtime(table, 'CHANGE', { revision });
        dispatch(table);
    }
};

const pollAll = () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    for (const table of tableChannels.keys()) {
        pollTable(table);
    }
};

const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(pollAll, POLL_INTERVAL_MS);
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', pollAll);
    }
};

const stopPolling = () => {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', pollAll);
    }
};

const ensureChannel = (table) => {
    let entry = tableChannels.get(table);
    if (entry) {
        entry.refCount += 1;
        return entry;
    }

    entry = { refCount: 1, subscribers: new Set(), revision: null };
    tableChannels.set(table, entry);
    startPolling();
    pollTable(table);
    return entry;
};

const releaseChannel = (table, handlers) => {
    const entry = tableChannels.get(table);
    if (!entry) return;
    entry.subscribers.delete(handlers);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
        logger.realtime(table, 'UNSUBSCRIBE');
        tableChannels.delete(table);
    }
    if (tableChannels.size === 0) stopPolling();
};

/**
 * Subscribe ke perubahan sebuah tabel.
 * @param {string} table - nama tabel
 * @param {{onInsert?:Function,onUpdate?:Function,onDelete?:Function,onAnyChange?:Function}} handlers
 * @param {boolean} enabled - apakah subscription aktif
 */
export const useRealtimeSubscription = (table, handlers, enabled = true) => {
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        if (!enabled) return;

        const entry = ensureChannel(table);
        const subscriber = {
            onInsert: (...a) => handlersRef.current.onInsert?.(...a),
            onUpdate: (...a) => handlersRef.current.onUpdate?.(...a),
            onDelete: (...a) => handlersRef.current.onDelete?.(...a),
            onAnyChange: (...a) => handlersRef.current.onAnyChange?.(...a),
        };
        entry.subscribers.add(subscriber);

        return () => releaseChannel(table, subscriber);
    }, [table, enabled]);

    return null;
};

export default useRealtimeSubscription;
