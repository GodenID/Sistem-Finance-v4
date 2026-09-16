/**
 * API Layer - Supabase Implementation
 * Replaces Express backend with direct Supabase client calls
 */
import { supabase } from './supabase';
import { recordApiCall } from './performanceMonitor';
import logger from './logger';

const MUTATION_BLOCKED_MESSAGE = 'Akun Anda sedang suspended. Akses hanya untuk melihat data.';
const SUSPENDED_LOGIN_MESSAGE = 'Akun Anda sedang suspended. Hubungi administrator.';

// ============================================
// No.3: Backend auth (sesi JWT terverifikasi server) + No.6 audit
// Aktif bila VITE_BACKEND_URL diset. Tanpa itu, fallback ke mode
// Supabase-direct seperti sebelumnya (dengan audit best-effort).
// ============================================

export const BACKEND_URL = (import.meta.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');
export const isBackendAuthEnabled = () => !!BACKEND_URL;

const AUTH_TOKEN_KEY = 'authToken';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || '';
export const setAuthToken = (token) => {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
};

async function backendFetch(path, { method = 'GET', body = null, token = null } = {}) {
    const res = await fetch(`${BACKEND_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `Request gagal (${res.status})`);
        err.response = { data, status: res.status };
        throw err;
    }
    return data;
}

/** No.6: audit event auth via Supabase (dipakai hanya pada mode tanpa backend). */
export const logAuthAudit = async ({ userId = null, userName = '', action, detail = {} }) => {
    try {
        await supabase.from('activity_logs').insert({
            table_name: 'auth',
            record_id: userId || NIL_UUID,
            record_number: userName || null,
            action,
            changed_by: userId || null,
            changed_by_name: userName || null,
            new_value: JSON.stringify(detail).slice(0, 4000),
        });
    } catch {
        /* best-effort */
    }
};

export const isCurrentUserSuspended = () => localStorage.getItem('userStatus') === 'suspended';

const persistLoginPermissions = (permissions) => {
    try {
        if (permissions && typeof permissions === 'object') {
            localStorage.setItem('userPermissions', JSON.stringify(permissions));
        } else if (typeof permissions === 'string' && permissions) {
            localStorage.setItem('userPermissions', permissions);
        } else {
            localStorage.removeItem('userPermissions');
        }
    } catch {
        /* abaikan */
    }
};

/** Insert/update user dengan kolom permissions; fallback bila kolom belum dimigrasi. */
const stripPermissionsOnMissingColumn = (error) => {
    const msg = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return msg.includes('permissions') && (msg.includes('column') || msg.includes('schema') || msg.includes('could not find'));
};

export const ensureCanMutate = () => {
    if (isCurrentUserSuspended()) {
        throw new Error(MUTATION_BLOCKED_MESSAGE);
    }
};

// ============================================
// Health Check
// ============================================

export const checkSupabaseHealth = async () => {
    const startTime = performance.now();
    try {
        const { error } = await supabase
            .from('app_settings')
            .select('key')
            .limit(1)
            .single();

        const latency = Math.round(performance.now() - startTime);

        if (error) {
            return { status: 'down', latency, error: error.message };
        }

        return { status: 'up', latency };
    } catch (err) {
        const latency = Math.round(performance.now() - startTime);
        return { status: 'down', latency, error: err.message };
    }
};

// ============================================
// Helper functions (compatible with old API)
// ============================================

/**
 * Kolom search default per tabel (dipakai pagination server-side).
 * Disamakan dengan logika `search` di getAllRecords agar hasil konsisten.
 */
const SEARCH_COLUMNS = {
    payment_requests: ['nomor_pr', 'nomor_ql', 'nama_karyawan', 'nama_event', 'keterangan'],
    kasbon: ['nomor_kasbon', 'nomor_ql', 'nama_karyawan', 'nama_event', 'keterangan'],
    klaim: ['nomor_klaim', 'nomor_ql', 'nama_karyawan', 'nama_event', 'keterangan'],
    penyelesaian: ['nomor_penyelesaian', 'nomor_kasbon', 'nomor_ql', 'nama_karyawan', 'nama_event', 'keterangan'],
    vendors: ['nama', 'kategori', 'kontak'],
    users: ['username', 'name', 'email'],
};

const buildOrSearch = (table, search, customColumns) => {
    const cols = customColumns?.length ? customColumns : (SEARCH_COLUMNS[table] || []);
    if (!cols.length) return null;
    // Escape koma & escape char PostgREST agar tidak merusak sintaks .or()
    const safe = String(search).replace(/[%\\,]/g, '').trim().slice(0, 100);
    if (!safe) return null;
    const pattern = `%${safe}%`;
    return cols.map((c) => `${c}.ilike.${pattern}`).join(',');
};

const applyTableFilters = (query, table, filters = {}) => {
    Object.keys(filters).forEach((key) => {
        const val = filters[key];
        if (val === undefined || val === null || val === '') return;
        if (key === 'start_date') {
            query = query.gte('created_at', val);
        } else if (key === 'end_date') {
            query = query.lte('created_at', val + 'T23:59:59');
        } else if (key === 'search') {
            const orFilter = buildOrSearch(table, val);
            if (orFilter) query = query.or(orFilter);
        } else if (key.startsWith('_')) {
            // Skip kunci internal pagination (_page, _limit, dst)
        } else {
            query = query.eq(key, val);
        }
    });
    return query;
};

/**
 * Get paginated records — FIX #1 & #2: pagination + filter di server.
 * Mengembalikan { data, count, page, limit, totalPages } agar tabel besar
 * tidak lagi download ribuan row untuk menampilkan 10-20 row.
 *
 * @example
 * const { data, count } = await getPaginatedRecords('kasbon', {
 *   page: 1, limit: 20, search: 'QL-12', filters: { status_transfer: 'Belum Transfer' }
 * });
 */
export const getPaginatedRecords = async (table, options = {}) => {
    const startTime = performance.now();
    let success = true;

    const {
        page = 1,
        limit = 20,
        filters = {},
        search = '',
        searchColumns = null,
        select = '*',
        orderBy = 'created_at',
        ascending = false,
    } = options;

    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    try {
        let query = supabase.from(table).select(select, { count: 'exact' });

        query = applyTableFilters(query, table, filters);

        if (search && String(search).trim()) {
            const orFilter = buildOrSearch(table, search, searchColumns);
            if (orFilter) query = query.or(orFilter);
        }

        query = query.order(orderBy, { ascending }).range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        const totalPages = Math.ceil((count || 0) / safeLimit);
        logger.api('GET', `${table} p${safePage}`, Math.round(performance.now() - startTime), true, `${data?.length || 0}/${count || 0}`);
        return { data: data || [], count: count || 0, page: safePage, limit: safeLimit, totalPages };
    } catch (error) {
        success = false;
        logger.error('API', `GET paginated ${table} failed`, error);
        throw error;
    } finally {
        const duration = Math.round(performance.now() - startTime);
        recordApiCall(`GET ${table} paginated`, duration, success);
    }
};

/**
 * Hitung total row tanpa download data (HEAD request + count exact).
 * Dipakai untuk badge statistik tanpa fetch select('*').
 */
export const countRecords = async (table, filters = {}) => {
    let query = supabase.from(table).select('id', { count: 'exact', head: true });
    query = applyTableFilters(query, table, filters);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
};

/**
 * Ambil ringkasan status (total/pending/approved/rejected) via 4x HEAD count.
 * Jauh lebih ringan daripada download semua row lalu .filter() di browser.
 * Dipakai Dashboard & kartu statistik list.
 */
export const getStatusCounts = async (table, statusField = 'status_approval') => {
    const [total, pending, approved, rejected] = await Promise.all([
        countRecords(table),
        countRecords(table, { [statusField]: 'Pending' }),
        countRecords(table, { [statusField]: 'Approved' }),
        countRecords(table, { [statusField]: 'Rejected' }),
    ]);
    return { total, pending, approved, rejected };
};

const normalizeRpcCount = (node) => ({
    total: Number(node?.total || 0),
    pending: Number(node?.pending || 0),
    approved: Number(node?.approved || 0),
    rejected: Number(node?.rejected || 0),
});

/**
 * Seluruh angka Dashboard dalam 1 round-trip via RPC get_dashboard_counts
 * (migration: supabase/migrations/add_dashboard_count_rpc.sql).
 * - Cache 30 detik: navigasi bolak-balik terasa instan.
 * - Fallback otomatis ke 4x getStatusCounts bila RPC belum dimigrasi.
 * Format: { payment_requests, kasbon, klaim, penyelesaian } masing-masing
 * { total, pending, approved, rejected }.
 */
export const getDashboardCounts = async () => {
    return cachedQuery('dashboard:counts', 30000, async () => {
        try {
            const { data, error } = await supabase.rpc('get_dashboard_counts');
            if (error) throw error;
            if (!data) throw new Error('RPC kosong');
            return {
                payment_requests: normalizeRpcCount(data.payment_requests),
                kasbon: normalizeRpcCount(data.kasbon),
                klaim: normalizeRpcCount(data.klaim),
                penyelesaian: normalizeRpcCount(data.penyelesaian),
            };
        } catch {
            // Fallback: cara lama (16 request) bila RPC belum ada di DB
            const [payment_requests, kasbon, klaim, penyelesaian] = await Promise.all([
                getStatusCounts('payment_requests'),
                getStatusCounts('kasbon'),
                getStatusCounts('klaim'),
                getStatusCounts('penyelesaian'),
            ]);
            return { payment_requests, kasbon, klaim, penyelesaian };
        }
    });
};

/**
 * Ambil baris ringan untuk kebutuhan notifikasi/chart saja
 * (kolom minimal + filter tanggal di server).
 */
export const getLightweightRows = async (table, { columns = 'id,created_at,status_approval', filters = {}, since = null, limit = 500 } = {}) => {
    let query = supabase.from(table).select(columns).order('created_at', { ascending: false }).limit(limit);
    query = applyTableFilters(query, table, filters);
    if (since) query = query.gte('created_at', since);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

/**
 * FIX #6: cache sesi untuk data master yang jarang berubah (vendors, users).
 * Navigasi antar halaman tidak lagi fetch ulang tiap mount — TTL default 60 dtk.
 * Mutasi (create/update/delete vendor) memanggil invalidateCache() agar segar.
 */
const sessionCache = new Map();

export const cachedQuery = async (key, ttlMs, fetcher) => {
    const now = Date.now();
    const hit = sessionCache.get(key);
    if (hit && now - hit.at < ttlMs) return hit.data;
    const data = await fetcher();
    sessionCache.set(key, { at: now, data });
    return data;
};

export const invalidateCache = (prefix) => {
    if (!prefix) {
        sessionCache.clear();
        return;
    }
    [...sessionCache.keys()].forEach((k) => {
        if (k === prefix || k.startsWith(prefix)) sessionCache.delete(k);
    });
};
/**
 * Get all records from a table
 * NOTE: hanya untuk tabel kecil (vendors, users, changelog).
 * Untuk tabel transaksional besar gunakan getPaginatedRecords.
 */
export const getAllRecords = async (table, filters = {}) => {
    const startTime = performance.now();
    let success = true;

    try {
        let query = supabase.from(table).select('*');

        // Apply filters
        Object.keys(filters).forEach((key) => {
            if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
                // Handle date range filters
                if (key === 'start_date') {
                    query = query.gte('created_at', filters[key]);
                } else if (key === 'end_date') {
                    query = query.lte('created_at', filters[key] + 'T23:59:59');
                } else if (key === 'search') {
                    // Search across multiple fields based on table
                    const searchValue = `%${filters[key]}%`;
                    if (table === 'payment_requests') {
                        query = query.or(`nomor_pr.ilike.${searchValue},nomor_ql.ilike.${searchValue},nama_karyawan.ilike.${searchValue},keterangan.ilike.${searchValue}`);
                    } else if (table === 'kasbon') {
                        query = query.or(`nomor_kasbon.ilike.${searchValue},nomor_ql.ilike.${searchValue},keterangan.ilike.${searchValue}`);
                    } else if (table === 'klaim') {
                        query = query.or(`nomor_klaim.ilike.${searchValue},nomor_ql.ilike.${searchValue},keterangan.ilike.${searchValue}`);
                    } else if (table === 'penyelesaian') {
                        query = query.or(`nomor_penyelesaian.ilike.${searchValue},nomor_kasbon.ilike.${searchValue},nomor_ql.ilike.${searchValue},nama_karyawan.ilike.${searchValue},nama_event.ilike.${searchValue},nomor_referensi.ilike.${searchValue},keterangan.ilike.${searchValue}`);
                    } else if (table === 'vendors') {
                        query = query.or(`nama.ilike.${searchValue},kategori.ilike.${searchValue},kontak.ilike.${searchValue}`);
                    }
                } else {
                    query = query.eq(key, filters[key]);
                }
            }
        });

        // Order by created_at descending by default
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;
        logger.api('GET', table, Math.round(performance.now() - startTime), true, `${data?.length || 0} records`);
        return data;
    } catch (error) {
        success = false;
        logger.error('API', `GET ${table} failed`, error);
        throw error;
    } finally {
        const duration = Math.round(performance.now() - startTime);
        recordApiCall(`GET ${table}`, duration, success);
    }
};

/**
 * Get single record by ID
 */
export const getRecordById = async (table, id) => {
    const startTime = performance.now();
    let success = true;

    try {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        logger.api('GET', `${table}/${id}`, Math.round(performance.now() - startTime), true);
        return data;
    } catch (error) {
        success = false;
        logger.error('API', `GET ${table}/${id} failed`, error);
        throw error;
    } finally {
        const duration = Math.round(performance.now() - startTime);
        recordApiCall(`GET ${table}/${id}`, duration, success);
    }
};

/**
 * Create new record
 */
export const createRecord = async (table, record) => {
    const startTime = performance.now();
    let success = true;

    try {
        ensureCanMutate();

        // Only add created_by for tables that have this column
        const tablesWithCreatedBy = ['payment_requests', 'recurring_transactions'];
        const userId = localStorage.getItem('userId');

        if (userId && tablesWithCreatedBy.includes(table) && !record.created_by) {
            record.created_by = userId;
        }

        // Add user_id for tables that use user_id instead
        const tablesWithUserId = ['kasbon', 'klaim', 'penyelesaian'];
        if (userId && tablesWithUserId.includes(table) && !record.user_id) {
            record.user_id = userId;
        }

        const { data, error } = await supabase
            .from(table)
            .insert(record)
            .select()
            .single();

        if (error) {
            logger.error('API', `POST ${table} Supabase error`, error);
            throw error;
        }

        logger.api('POST', table, Math.round(performance.now() - startTime), true, record);
        return data;
    } catch (error) {
        success = false;
        logger.error('API', `POST ${table} failed`, error);
        throw error;
    } finally {
        const duration = Math.round(performance.now() - startTime);
        recordApiCall(`POST ${table}`, duration, success);
    }
};

/**
 * Update record
 */
export const updateRecord = async (table, id, updates) => {
    const startTime = performance.now();
    let success = true;

    try {
        ensureCanMutate();

        const { data, error } = await supabase
            .from(table)
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        logger.api('PUT', `${table}/${id}`, Math.round(performance.now() - startTime), true, updates);
        return data;
    } catch (error) {
        success = false;
        logger.error('API', `PUT ${table}/${id} failed`, error);
        throw error;
    } finally {
        const duration = Math.round(performance.now() - startTime);
        recordApiCall(`PUT ${table}/${id}`, duration, success);
    }
};

/**
 * Delete record
 */
export const deleteRecord = async (table, id) => {
    const startTime = performance.now();
    let success = true;

    try {
        ensureCanMutate();

        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);

        if (error) throw error;
        logger.api('DELETE', `${table}/${id}`, Math.round(performance.now() - startTime), true);
        return { success: true };
    } catch (error) {
        success = false;
        logger.error('API', `DELETE ${table}/${id} failed`, error);
        throw error;
    } finally {
        const duration = Math.round(performance.now() - startTime);
        recordApiCall(`DELETE ${table}/${id}`, duration, success);
    }
};

/**
 * Bulk delete records - Only for Administrator role
 */
export const bulkDeleteRecords = async (table, ids) => {
    const startTime = performance.now();
    let success = true;

    try {
        ensureCanMutate();

        const { error } = await supabase
            .from(table)
            .delete()
            .in('id', ids);

        if (error) throw error;
        logger.api('BULK DELETE', `${table} (${ids.length})`, Math.round(performance.now() - startTime), true);
        return { success: true, deleted: ids.length };
    } catch (error) {
        success = false;
        logger.error('API', `BULK DELETE ${table} failed`, error);
        throw error;
    } finally {
        const duration = Math.round(performance.now() - startTime);
        recordApiCall(`BULK DELETE ${table} (${ids.length} records)`, duration, success);
    }
};

// ============================================
// Special endpoints
// ============================================

/**
 * Update approval status
 */
export const updateApprovalStatus = async (table, id, status_approval) => {
    ensureCanMutate();

    const userName = localStorage.getItem('userName');

    const { data, error } = await supabase
        .from(table)
        .update({
            status_approval,
            disetujui_oleh: status_approval === 'Approved' ? userName : null
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Update transfer status
 */
export const updateTransferStatus = async (table, id, status_transfer, bukti_transfer = null) => {
    ensureCanMutate();

    const updates = { status_transfer };
    if (bukti_transfer) {
        updates.bukti_transfer = bukti_transfer;
    }

    const { data, error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Get kasbon by nomor
 */
export const getKasbonByNomor = async (nomor) => {
    const { data, error } = await supabase
        .from('kasbon')
        .select('*')
        .eq('nomor_kasbon', nomor)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
    return data;
};

/**
 * Check if kasbon has penyelesaian
 */
export const checkKasbonPenyelesaian = async (nomorKasbon) => {
    const { data, error } = await supabase
        .from('penyelesaian')
        .select('id, nomor_penyelesaian')
        .eq('nomor_referensi', nomorKasbon);

    if (error) throw error;
    return {
        exists: data && data.length > 0,
        penyelesaian: data && data.length > 0 ? data[0] : null
    };
};

// ============================================
// Auth functions (Custom Auth - Plain Text Password)
// ============================================

/**
 * Login.
 * - Mode backend (VITE_BACKEND_URL diset, No.3): kredensial diverifikasi
 *   server-side; sesi = JWT (persistent, tanpa batas idle/absolut di frontend).
 * - Mode Supabase-direct (fallback): seperti sebelumnya + audit best-effort.
 * Param guardToken dipertahankan opsional untuk kompatibilitas (diabaikan —
 * proteksi bot kini via Turnstile gate kunjungan, bukan captcha di form).
 */
export const login = async (username, password, guardToken = '') => {
    logger.auth('LOGIN_ATTEMPT', username);

    if (isBackendAuthEnabled()) {
        const data = await backendFetch('/api/auth/login', {
            method: 'POST',
            body: { username, password },
        });
        const user = data.user;
        setAuthToken(data.token);
        localStorage.setItem('userId', user.id);
        localStorage.setItem('userName', user.name);
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userEmail', user.email || '');
        localStorage.setItem('userStatus', user.status || 'active');
        localStorage.setItem('emailNotificationsEnabled', user.email_notifications_enabled === false ? 'false' : 'true');
        persistLoginPermissions(user.permissions);
        localStorage.setItem('isAuthenticated', 'true');
        // Sesi persistent — tidak ada sessionStartedAt / batas waktu.
        localStorage.removeItem('sessionStartedAt');
        logger.auth('LOGIN_SUCCESS', username, { role: user.role, name: user.name, via: 'backend' });
        return {
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                email: user.email || '',
                status: user.status || 'active',
                email_notifications_enabled: user.email_notifications_enabled !== false,
                permissions: user.permissions || null
            }
        };
    }

    // First, get the user by username
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

    if (error) {
        logger.error('AUTH', 'Database error during login', error);
        await logAuthAudit({ userName: username, action: 'login_failed', detail: { reason: 'db_or_not_found' } });
        throw new Error('Username atau password salah');
    }

    if (!user) {
        logger.warn('AUTH', `User not found: ${username}`);
        await logAuthAudit({ userName: username, action: 'login_failed', detail: { reason: 'user_not_found' } });
        throw new Error('Username atau password salah');
    }

    // Simple plain text comparison
    if (user.password !== password) {
        logger.warn('AUTH', `Password mismatch for user: ${username}`);
        await logAuthAudit({ userId: user.id, userName: username, action: 'login_failed', detail: { reason: 'wrong_password' } });
        throw new Error('Username atau password salah');
    }

    if ((user.status || 'active') === 'suspended') {
        logger.warn('AUTH', `Suspended user attempted login: ${username}`);
        await logAuthAudit({ userId: user.id, userName: username, action: 'login_blocked', detail: { reason: 'suspended' } });
        throw new Error(SUSPENDED_LOGIN_MESSAGE);
    }

    // Store user info in localStorage
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('userEmail', user.email || '');
    localStorage.setItem('userStatus', user.status || 'active');
    localStorage.setItem('emailNotificationsEnabled', user.email_notifications_enabled === false ? 'false' : 'true');
    persistLoginPermissions(user.permissions);
    localStorage.setItem('isAuthenticated', 'true');
    // Sesi persistent — tidak ada sessionStartedAt / batas waktu.
    localStorage.removeItem('sessionStartedAt');

    await logAuthAudit({ userId: user.id, userName: username, action: 'login_success', detail: { via: 'supabase-direct' } });
    logger.auth('LOGIN_SUCCESS', username, { role: user.role, name: user.name });

    return {
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            email: user.email || '',
            status: user.status || 'active',
            email_notifications_enabled: user.email_notifications_enabled !== false,
            permissions: user.permissions || null
        }
    };
};

/**
 * Logout
 */
export const logout = async () => {
    const username = localStorage.getItem('userName');
    logger.auth('LOGOUT', username);
    if (isBackendAuthEnabled()) {
        try {
            await backendFetch('/api/auth/logout', { method: 'POST', token: getAuthToken() });
        } catch {
            /* best-effort */
        }
    }
    setAuthToken(null);
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userStatus');
    localStorage.removeItem('emailNotificationsEnabled');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('isAuthenticated');
    // Bersihkan sisa key sesi lama bila masih ada
    localStorage.removeItem('sessionStartedAt');
    sessionStorage.removeItem('session_expired');
};

/**
 * Get current user — No.3: bila backend aktif, sesi diverifikasi
 * server-side (JWT + status akun terkini). Gagal verifikasi = null.
 */
export const getCurrentUser = async () => {
    if (isBackendAuthEnabled()) {
        const token = getAuthToken();
        if (!token) return null;
        try {
            const data = await backendFetch('/api/auth/me', { token });
            return data.user;
        } catch {
            return null;
        }
    }

    const userId = localStorage.getItem('userId');
    if (!userId) return null;

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        logger.error('AUTH', 'Error getting current user', error);
        return null;
    }
    return data;
};

/**
 * Change password.
 * - Mode backend: via server (verifikasi password lama server-side).
 * - Mode Supabase-direct: seperti sebelumnya + audit.
 * (Proteksi bot kini via Turnstile gate kunjungan — bukan captcha per-form.)
 */
export const changePassword = async (currentPassword, newPassword, guardToken = '') => {
    ensureCanMutate();

    if (isBackendAuthEnabled()) {
        const data = await backendFetch('/api/auth/change-password', {
            method: 'POST',
            token: getAuthToken(),
            body: { currentPassword, newPassword },
        });
        return { success: true, message: data.message };
    }

    const userId = localStorage.getItem('userId');
    if (!userId) throw new Error('Not authenticated');

    // Get current user with password
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('password')
        .eq('id', userId)
        .single();

    if (fetchError || !user) throw new Error('User not found');

    // Verify current password (plain text)
    if (user.password !== currentPassword) {
        throw new Error('Password saat ini salah');
    }

    // Update with new plain text password
    const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', userId);

    if (updateError) throw updateError;
    await logAuthAudit({ userId, userName: localStorage.getItem('userName') || '', action: 'pwd_changed', detail: { via: 'supabase-direct' } });
    return { success: true };
};

// ============================================
// No.8: Lupa / reset password (via backend — anti-enumerasi, token
// sekali pakai di email). Butuh VITE_BACKEND_URL + tabel password_resets
// (supabase/migrations/add_password_resets.sql) + RESEND_API_KEY.
// ============================================

export const forgotPassword = async (identifier, guardToken = '') => {
    if (!isBackendAuthEnabled()) {
        throw new Error('Fitur reset password membutuhkan backend. Hubungi administrator.');
    }
    return backendFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { username: identifier },
    });
};

export const resetPassword = async (token, newPassword, guardToken = '') => {
    if (!isBackendAuthEnabled()) {
        throw new Error('Fitur reset password membutuhkan backend. Hubungi administrator.');
    }
    return backendFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword },
    });
};

// ============================================
// Upload functions
// ============================================

// Import R2 upload utility (unchanged - still uses Cloudflare Worker)
import { uploadFileToR2 } from '../utils/r2Upload';

/**
 * Upload single file using R2 Worker
 * @param {File} file - File to upload
 * @param {string} type - Document type (klaim, payment-request, penyelesaian)
 * @param {string} documentId - Document ID (e.g., KLM-0001, PR-0001)
 * @param {string} userName - User name who uploads the file
 */
export const uploadFile = async (file, type = 'general', documentId = null, userName = null) => {
    return await uploadFileToR2(file, type, documentId, userName);
};

/**
 * Upload multiple files
 */
export const uploadFiles = async (files, type = 'general') => {
    const promises = files.map(file => uploadFileToR2(file, type));
    const results = await Promise.all(promises);
    return results.map(r => r.url);
};

// ============================================
// User Management
// ============================================

/**
 * Get all users
 */
export const getAllUsers = async () => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

/**
 * Create user (plain text password)
 */
export const createUser = async (userData) => {
    ensureCanMutate();

    const payload = {
        username: userData.username,
        password: userData.password,
        name: userData.name,
        role: userData.role,
        email: userData.email || null,
        email_notifications_enabled: userData.email_notifications_enabled !== false,
        status: userData.status || 'active'
    };
    if (userData.permissions !== undefined) payload.permissions = userData.permissions;

    try {
        const { data, error } = await supabase
            .from('users')
            .insert(payload)
            .select('*')
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        if (payload.permissions !== undefined && stripPermissionsOnMissingColumn(error)) {
            delete payload.permissions;
            const { data, error: retryError } = await supabase
                .from('users')
                .insert(payload)
                .select('*')
                .single();
            if (retryError) throw retryError;
            return data;
        }
        throw error;
    }
};

/**
 * Update user (plain text password)
 */
export const updateUser = async (id, userData) => {
    ensureCanMutate();

    const updates = {
        name: userData.name,
        role: userData.role,
        email: userData.email || null,
        email_notifications_enabled: userData.email_notifications_enabled !== false,
        status: userData.status || 'active'
    };
    if (userData.permissions !== undefined) updates.permissions = userData.permissions;

    // Only update password if provided (plain text)
    if (userData.password) {
        updates.password = userData.password;
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        if (updates.permissions !== undefined && stripPermissionsOnMissingColumn(error)) {
            delete updates.permissions;
            const { data, error: retryError } = await supabase
                .from('users')
                .update(updates)
                .eq('id', id)
                .select('*')
                .single();
            if (retryError) throw retryError;
            return data;
        }
        throw error;
    }
};

/**
 * Delete user
 */
export const deleteUser = async (id) => {
    ensureCanMutate();

    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

    if (error) throw error;
    return { success: true };
};

// ============================================
// Maintenance Mode
// ============================================

export const getMaintenanceMode = async () => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single();

        if (error) {
            logger.error('MAINTENANCE', 'Error fetching maintenance mode', error);
            return false;
        }
        const isOn = data?.value === 'true';
        logger.info('MAINTENANCE', `Status: ${isOn ? 'ON' : 'OFF'}`);
        return isOn;
    } catch (err) {
        logger.error('MAINTENANCE', 'Error fetching maintenance mode', err);
        return false;
    }
};

export const setMaintenanceMode = async (enabled, userId) => {
    logger.info('MAINTENANCE', `Setting maintenance mode: ${enabled ? 'ON' : 'OFF'}`, { userId });
    const { error } = await supabase
        .from('app_settings')
        .update({ value: enabled ? 'true' : 'false', updated_by: userId || null })
        .eq('key', 'maintenance_mode');

    if (error) {
        logger.error('MAINTENANCE', 'Error setting maintenance mode', error);
        throw error;
    }
    logger.info('MAINTENANCE', `Maintenance mode set to ${enabled ? 'ON' : 'OFF'} successfully`);
    return true;
};

// Export supabase client for custom queries
export { supabase };

// Default export for backward compatibility
export default supabase;
