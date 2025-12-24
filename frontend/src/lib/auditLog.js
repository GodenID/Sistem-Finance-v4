import { supabase, createRecord } from './api';

/**
 * Log activity ke tabel activity_logs
 * @param {Object} params - Parameter log
 * @param {string} params.tableName - Nama tabel ('payment_requests', 'kasbon', 'klaim', 'penyelesaian')
 * @param {string} params.recordId - UUID dari record yang diubah
 * @param {string} params.recordNumber - Nomor dokumen (PR-0001, KBN-0001, dll)
 * @param {string} params.action - Aksi ('create', 'update', 'delete', 'approve', 'reject', 'transfer')
 * @param {string} params.fieldChanged - Nama field yang diubah (opsional)
 * @param {string} params.oldValue - Nilai lama (opsional)
 * @param {string} params.newValue - Nilai baru (opsional)
 * @param {string} params.changedBy - UUID user yang melakukan perubahan
 * @param {string} params.changedByName - Nama user yang melakukan perubahan
 */
export const logActivity = async ({
  tableName,
  recordId,
  recordNumber,
  action,
  fieldChanged = null,
  oldValue = null,
  newValue = null,
  changedBy = null,
  changedByName = null
}) => {
  try {
    // Validate required fields
    if (!tableName || !recordId || !action) {
      console.warn('logActivity: Missing required fields', { tableName, recordId, action });
      return null;
    }

    const logData = {
      table_name: tableName,
      record_id: recordId,
      record_number: recordNumber || null,
      action: action,
      field_changed: fieldChanged || null,
      old_value: oldValue || null,
      new_value: newValue || null,
      changed_by: changedBy,
      changed_by_name: changedByName || null
    };

    const { data, error } = await supabase
      .from('activity_logs')
      .insert(logData)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error logging activity:', error);
    return null;
  }
};

/**
 * Get activity logs untuk record tertentu
 * @param {string} recordId - UUID dari record
 * @returns {Promise<Array>} - Array of activity logs
 */
export const getActivityLogsByRecord = async (recordId) => {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('record_id', recordId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return [];
  }
};

/**
 * Get semua activity logs dengan pagination
 * @param {Object} options - Options
 * @param {number} options.page - Halaman (default 1)
 * @param {number} options.limit - Jumlah per halaman (default 50)
 * @param {string} options.tableName - Filter by table name (opsional)
 * @param {string} options.action - Filter by action (opsional)
 * @returns {Promise<Object>} - { data, count, error }
 */
export const getAllActivityLogs = async ({
  page = 1,
  limit = 50,
  tableName = null,
  action = null,
  startDate = null,
  endDate = null
} = {}) => {
  try {
    let query = supabase
      .from('activity_logs')
      .select('*', { count: 'exact' });

    if (tableName) query = query.eq('table_name', tableName);
    if (action) query = query.eq('action', action);
    if (startDate) query = query.gte('changed_at', startDate);
    if (endDate) query = query.lte('changed_at', endDate + 'T23:59:59');

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order('changed_at', { ascending: false });

    const { data, count, error } = await query;

    if (error) throw error;
    return { data: data || [], count: count || 0, error: null };
  } catch (error) {
    console.error('Error in getAllActivityLogs:', error);
    return { data: [], count: 0, error };
  }
};

/**
 * Helper untuk mendapatkan label aksi dalam bahasa Indonesia
 * @param {string} action - Kode aksi
 * @returns {string} - Label aksi
 */
export const getActionLabel = (action) => {
  const labels = {
    'create': 'Dibuat',
    'update': 'Diperbarui',
    'delete': 'Dihapus',
    'approve': 'Disetujui',
    'reject': 'Ditolak',
    'transfer': 'Transfer',
    'bulk_delete': 'Hapus Massal'
  };
  return labels[action] || action;
};

/**
 * Helper untuk mendapatkan warna badge berdasarkan aksi
 * @param {string} action - Kode aksi
 * @returns {string} - Tailwind classes untuk badge
 */
export const getActionBadgeColor = (action) => {
  const colors = {
    'create': 'bg-blue-100 text-blue-700',
    'update': 'bg-amber-100 text-amber-700',
    'delete': 'bg-rose-100 text-rose-700',
    'approve': 'bg-emerald-100 text-emerald-700',
    'reject': 'bg-rose-100 text-rose-700',
    'transfer': 'bg-indigo-100 text-indigo-700',
    'bulk_delete': 'bg-red-100 text-red-700'
  };
  return colors[action] || 'bg-gray-100 text-gray-700';
};

/**
 * Helper untuk mendapatkan label tabel dalam bahasa Indonesia
 * @param {string} tableName - Nama tabel
 * @returns {string} - Label tabel
 */
export const getTableLabel = (tableName) => {
  const labels = {
    'payment_requests': 'Payment Request',
    'kasbon': 'Kasbon',
    'klaim': 'Klaim',
    'penyelesaian': 'Penyelesaian'
  };
  return labels[tableName] || tableName;
};

export default {
  logActivity,
  getActivityLogsByRecord,
  getAllActivityLogs,
  getActionLabel,
  getActionBadgeColor,
  getTableLabel
};
