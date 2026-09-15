/**
 * Custom hook for Supabase Realtime subscriptions
 * Enables real-time updates without page refresh
 *
 * FIX #5: channel dipakai BERSAMA per tabel (module registry + refcount).
 * Sebelumnya tiap useRealtimeSubscription() membuka websocket channel sendiri
 * (4 di notifikasi + 1 per halaman = ~9 channel) — sekarang maks 1 per tabel
 * tidak peduli berapa komponen berlangganan.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

// Registry: table -> { channel, refCount, subscribers: Set<handlers> }
const tableChannels = new Map();

const dispatch = (table, eventType, a, b) => {
    const entry = tableChannels.get(table);
    if (!entry) return;
    entry.subscribers.forEach(({ onInsert, onUpdate, onDelete, onAnyChange }) => {
        try {
            if (eventType === 'INSERT') {
                logger.realtime(table, 'INSERT', a);
                if (onInsert) onInsert(a);
                if (onAnyChange) onAnyChange('INSERT', a);
            } else if (eventType === 'UPDATE') {
                logger.realtime(table, 'UPDATE', a);
                if (onUpdate) onUpdate(a, b);
                if (onAnyChange) onAnyChange('UPDATE', a, b);
            } else if (eventType === 'DELETE') {
                logger.realtime(table, 'DELETE', b);
                if (onDelete) onDelete(b);
                if (onAnyChange) onAnyChange('DELETE', null, b);
            }
        } catch (err) {
            console.error(`Realtime handler error (${table} ${eventType}):`, err);
        }
    });
};

const ensureChannel = (table) => {
    let entry = tableChannels.get(table);
    if (entry) {
        entry.refCount += 1;
        return entry;
    }

    const channel = supabase
        .channel(`realtime-${table}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (p) => dispatch(table, 'INSERT', p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, (p) => dispatch(table, 'UPDATE', p.new, p.old))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) => dispatch(table, 'DELETE', null, p.old))
        .subscribe((status) => {
            logger.realtime(table, 'SUBSCRIBE', { status });
        });

    entry = { channel, refCount: 1, subscribers: new Set() };
    tableChannels.set(table, entry);
    return entry;
};

const releaseChannel = (table, handlers) => {
    const entry = tableChannels.get(table);
    if (!entry) return;
    entry.subscribers.delete(handlers);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
        logger.realtime(table, 'UNSUBSCRIBE');
        supabase.removeChannel(entry.channel);
        tableChannels.delete(table);
    }
};

/**
 * Hook to subscribe to realtime changes on a table
 * @param {string} table - The table name to subscribe to
 * @param {function} onInsert - Callback when a new record is inserted
 * @param {function} onUpdate - Callback when a record is updated
 * @param {function} onDelete - Callback when a record is deleted
 * @param {boolean} enabled - Whether the subscription is enabled
 */
export const useRealtimeSubscription = (
    table,
    { onInsert, onUpdate, onDelete, onAnyChange },
    enabled = true
) => {
    // Selalu pegang versi terbaru agar dispatch memakai closure fresh
    // tanpa membuka channel baru (deps effect tetap [table, enabled]).
    const handlersRef = useRef({ onInsert, onUpdate, onDelete, onAnyChange });
    handlersRef.current = { onInsert, onUpdate, onDelete, onAnyChange };

    useEffect(() => {
        if (!enabled) return;

        const entry = ensureChannel(table);
        // Subscriber stabil yang meneruskan ke ref terbaru
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
