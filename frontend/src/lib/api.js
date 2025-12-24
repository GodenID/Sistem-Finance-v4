/**
 * API Layer - Supabase Implementation
 * Replaces Express backend with direct Supabase client calls
 */
import { supabase } from './supabase';
import { recordApiCall } from './performanceMonitor';

// ============================================
// Helper functions (compatible with old API)
// ============================================

/**
 * Get all records from a table
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
                        query = query.or(`nomor_penyelesaian.ilike.${searchValue},nomor_referensi.ilike.${searchValue},keterangan.ilike.${searchValue}`);
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
        return data;
    } catch (error) {
        success = false;
        console.error(`Error fetching ${table}:`, error);
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
        return data;
    } catch (error) {
        success = false;
        console.error(`Error fetching ${table} by id:`, error);
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
            console.error(`❌ Supabase error in ${table}:`, error);
            throw error;
        }

        return data;
    } catch (error) {
        success = false;
        console.error(`Error creating ${table}:`, error);
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
        const { data, error } = await supabase
            .from(table)
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        success = false;
        console.error(`Error updating ${table}:`, error);
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
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        success = false;
        console.error(`Error deleting ${table}:`, error);
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
        const { error } = await supabase
            .from(table)
            .delete()
            .in('id', ids);

        if (error) throw error;
        return { success: true, deleted: ids.length };
    } catch (error) {
        success = false;
        console.error(`Error bulk deleting ${table}:`, error);
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
 * Login - uses custom users table with plain text password
 */
export const login = async (username, password) => {

    // First, get the user by username
    const { data: user, error } = await supabase
        .from('users')
        .select('id, username, password, name, role')
        .eq('username', username)
        .single();


    if (error) {
        console.error('❌ Database error:', error);
        throw new Error('Username atau password salah');
    }

    if (!user) {
        console.error('❌ User not found:', username);
        throw new Error('Username atau password salah');
    }

    // Simple plain text comparison
    if (user.password !== password) {
        console.error('❌ Password mismatch');
        throw new Error('Username atau password salah');
    }

    // Store user info in localStorage
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('isAuthenticated', 'true');


    return {
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        }
    };
};

/**
 * Logout
 */
export const logout = async () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isAuthenticated');
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return null;

    const { data, error } = await supabase
        .from('users')
        .select('id, username, name, role')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error getting current user:', error);
        return null;
    }
    return data;
};

/**
 * Change password (plain text)
 */
export const changePassword = async (currentPassword, newPassword) => {
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
    return { success: true };
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
        .select('id, username, name, role, created_at')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

/**
 * Create user (plain text password)
 */
export const createUser = async (userData) => {
    const { data, error } = await supabase
        .from('users')
        .insert({
            username: userData.username,
            password: userData.password,
            name: userData.name,
            role: userData.role
        })
        .select('id, username, name, role, created_at')
        .single();

    if (error) throw error;
    return data;
};

/**
 * Update user (plain text password)
 */
export const updateUser = async (id, userData) => {
    const updates = {
        name: userData.name,
        role: userData.role
    };

    // Only update password if provided (plain text)
    if (userData.password) {
        updates.password = userData.password;
    }

    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select('id, username, name, role, created_at')
        .single();

    if (error) throw error;
    return data;
};

/**
 * Delete user
 */
export const deleteUser = async (id) => {
    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

    if (error) throw error;
    return { success: true };
};

// Export supabase client for custom queries
export { supabase };

// Default export for backward compatibility
export default supabase;
