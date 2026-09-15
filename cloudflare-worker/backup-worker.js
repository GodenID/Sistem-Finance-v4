/**
 * Cloudflare Worker untuk Backup Otomatis
 * Cron: Setiap hari jam 23:00 WIB (16:00 UTC)
 * 
 * Fitur:
 * - Mengambil data dari Supabase
 * - Membuat backup JSON
 * - Mengupload ke R2 Storage
 */

export default {
    // Handle scheduled events (cron trigger)
    async scheduled(event, env, ctx) {
        ctx.waitUntil(performBackup(env));
    },

    // Handle HTTP requests (for manual trigger)
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Manual backup trigger
        if (url.pathname === '/backup' && request.method === 'POST') {
            // Check for auth header
            const authHeader = request.headers.get('Authorization');
            const expectedAuth = `Bearer ${env.BACKUP_SECRET}`;

            if (!env.BACKUP_SECRET || authHeader !== expectedAuth) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            try {
                const result = await performBackup(env);
                return new Response(JSON.stringify(result), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // List backups
        if (url.pathname === '/backups' && request.method === 'GET') {
            try {
                const list = await env.BACKUP_BUCKET.list({ prefix: 'backups/' });
                const backups = list.objects.map(obj => ({
                    key: obj.key,
                    size: obj.size,
                    uploaded: obj.uploaded
                }));
                return new Response(JSON.stringify({ backups }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        return new Response('Finance V3 Backup Worker', {
            headers: { 'Content-Type': 'text/plain' }
        });
    }
};

// Tables to backup
const TABLES = [
    'users',
    'vendors',
    'payment_requests',
    'kasbon',
    'klaim',
    'penyelesaian',
    'activity_logs',
    'recurring_transactions',
    'recurring_instances'
];

async function performBackup(env) {
    const startTime = Date.now();
    console.log('[Backup] Starting scheduled backup...');

    try {
        // Fetch all data from Supabase
        const data = {};
        let totalRecords = 0;

        for (const table of TABLES) {
            try {
                const records = await fetchFromSupabase(env, table);
                data[table] = records;
                totalRecords += records.length;
                console.log(`[Backup] ${table}: ${records.length} records`);
            } catch (error) {
                console.error(`[Backup] Error fetching ${table}:`, error.message);
                data[table] = [];
            }
        }

        // Create backup object
        const backup = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            type: 'scheduled',
            tables: data,
            metadata: {
                totalRecords,
                tableCount: TABLES.length,
                backupDuration: Date.now() - startTime
            }
        };

        // Generate filename with WIB timestamp
        const now = new Date();
        const wibOffset = 7 * 60 * 60 * 1000; // UTC+7
        const wibDate = new Date(now.getTime() + wibOffset);
        const dateStr = wibDate.toISOString().split('T')[0];
        const timeStr = wibDate.toISOString().split('T')[1].substring(0, 5).replace(':', '-');
        const filename = `backups/backup_${dateStr}_${timeStr}.json`;

        // Upload to R2
        await env.BACKUP_BUCKET.put(filename, JSON.stringify(backup, null, 2), {
            httpMetadata: {
                contentType: 'application/json'
            },
            customMetadata: {
                exportedAt: backup.exportedAt,
                totalRecords: String(totalRecords)
            }
        });

        console.log(`[Backup] Successfully uploaded: ${filename}`);

        // Clean old backups (keep last 30 days)
        await cleanOldBackups(env);

        return {
            success: true,
            filename,
            totalRecords,
            tableCount: TABLES.length,
            duration: Date.now() - startTime
        };

    } catch (error) {
        console.error('[Backup] Backup failed:', error);
        throw error;
    }
}

async function fetchFromSupabase(env, table) {
    const url = `${env.SUPABASE_URL}/rest/v1/${table}?select=*`;

    const response = await fetch(url, {
        headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch ${table}: ${response.status}`);
    }

    return await response.json();
}

async function cleanOldBackups(env, keepDays = 30) {
    try {
        const list = await env.BACKUP_BUCKET.list({ prefix: 'backups/' });
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - keepDays);

        for (const obj of list.objects) {
            if (obj.uploaded < cutoffDate) {
                await env.BACKUP_BUCKET.delete(obj.key);
                console.log(`[Backup] Deleted old backup: ${obj.key}`);
            }
        }
    } catch (error) {
        console.error('[Backup] Error cleaning old backups:', error);
    }
}
