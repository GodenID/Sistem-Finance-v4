/**
 * Custom hook for Supabase Realtime subscriptions
 * Enables real-time updates without page refresh
 */
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

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
    const channelRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;

        // Create a unique channel name
        const channelName = `realtime-${table}-${Date.now()}`;

        // Subscribe to the table changes
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: table,
                },
                (payload) => {
                    console.log(`[Realtime] ${table} INSERT:`, payload);
                    if (onInsert) onInsert(payload.new);
                    if (onAnyChange) onAnyChange('INSERT', payload.new);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: table,
                },
                (payload) => {
                    console.log(`[Realtime] ${table} UPDATE:`, payload);
                    if (onUpdate) onUpdate(payload.new, payload.old);
                    if (onAnyChange) onAnyChange('UPDATE', payload.new, payload.old);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: table,
                },
                (payload) => {
                    console.log(`[Realtime] ${table} DELETE:`, payload);
                    if (onDelete) onDelete(payload.old);
                    if (onAnyChange) onAnyChange('DELETE', null, payload.old);
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] ${table} subscription status:`, status);
            });

        channelRef.current = channel;

        // Cleanup on unmount
        return () => {
            if (channelRef.current) {
                console.log(`[Realtime] Unsubscribing from ${table}`);
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [table, enabled]);

    return channelRef.current;
};

export default useRealtimeSubscription;
