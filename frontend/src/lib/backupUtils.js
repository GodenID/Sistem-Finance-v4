import { getAllRecords, createRecord, deleteRecord, getRecordById } from './api';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Tables to backup
const TABLES = [
  'users',
  'vendors',
  'payment_requests',
  'kasbon',
  'klaim',
  'penyelesaian',
  'activity_logs'
];

// Fetch all data from a table
export const fetchTableData = async (tableName) => {
  try {
    const data = await getAllRecords(tableName);
    // Sort in memory by created_at desc if available
    return (data || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return [];
  }
};

// Fetch all tables data
export const fetchAllTablesData = async (onProgress) => {
  const result = {};
  let completed = 0;

  for (const table of TABLES) {
    result[table] = await fetchTableData(table);
    completed++;
    if (onProgress) {
      onProgress(Math.round((completed / TABLES.length) * 100));
    }
  }

  return result;
};

// Export as JSON
export const exportAsJSON = async (onProgress) => {
  const data = await fetchAllTablesData(onProgress);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    tables: data,
    metadata: {
      totalRecords: Object.values(data).reduce((sum, arr) => sum + arr.length, 0),
      tableCount: TABLES.length
    }
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const date = new Date().toISOString().split('T')[0];
  saveAs(blob, `backup_database_${date}.json`);

  return exportData.metadata;
};

// Escape SQL string
const escapeSQLString = (str) => {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str !== 'string') return str;
  return `'${str.replace(/'/g, "''")}'`;
};

// Format value for SQL
const formatSQLValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return value;
  if (typeof value === 'object') return escapeSQLString(JSON.stringify(value));
  return escapeSQLString(String(value));
};

// Generate SQL INSERT statements
export const exportAsSQL = async (onProgress) => {
  const data = await fetchAllTablesData(onProgress);

  let sql = `-- Backup Finance Prasasti Database\n`;
  sql += `-- Exported at: ${new Date().toISOString()}\n`;
  sql += `-- WARNING: This backup includes sensitive data (passwords)\n\n`;

  for (const [tableName, records] of Object.entries(data)) {
    if (records.length === 0) continue;

    sql += `-- Table: ${tableName}\n`;
    sql += `-- Records: ${records.length}\n`;

    for (const record of records) {
      const columns = Object.keys(record).join(', ');
      const values = Object.values(record).map(formatSQLValue).join(', ');
      sql += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
    }
    sql += '\n';
  }

  const blob = new Blob([sql], { type: 'text/plain' });
  const date = new Date().toISOString().split('T')[0];
  saveAs(blob, `backup_database_${date}.sql`);

  return { totalRecords, tableCount: TABLES.length };
};

// Extract filename from URL
const getFileNameFromUrl = (url) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname.split('/').pop() || 'file';
  } catch {
    return url.split('/').pop() || 'file';
  }
};

// Fetch file as blob - uses Worker proxy for CORS-enabled downloads
const fetchFileAsBlob = async (url) => {
  try {
    // Get Worker URL from environment
    const workerUrl = import.meta.env.VITE_R2_WORKER_URL;

    // Extract file path from the R2 public URL
    // URL format: https://files.prasastigroup.id/2025/payment-requests/12/...
    let fetchUrl = url;

    if (workerUrl && url.includes('files.prasastigroup.id')) {
      // Extract path from R2 public URL
      const urlObj = new URL(url);
      const filePath = urlObj.pathname.slice(1); // Remove leading slash
      // Use Worker URL with file path
      fetchUrl = `${workerUrl}/${filePath}`;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
  } catch (error) {
    console.error(`Error fetching file ${url}:`, error);
    return null;
  }
};

// Collect all files from database records
export const collectAllFiles = async () => {
  const files = [];

  // Payment Requests
  const prData = await fetchTableData('payment_requests');
  for (const pr of prData) {
    if (pr.lampiran) {
      files.push({
        url: pr.lampiran,
        folder: 'payment-requests',
        subfolder: pr.nomor_pr,
        filename: `lampiran_${getFileNameFromUrl(pr.lampiran)}`
      });
    }
    if (pr.bukti_transfer) {
      files.push({
        url: pr.bukti_transfer,
        folder: 'payment-requests',
        subfolder: pr.nomor_pr,
        filename: `bukti_transfer_${getFileNameFromUrl(pr.bukti_transfer)}`
      });
    }
  }

  // Kasbon
  const kasbonData = await fetchTableData('kasbon');
  for (const k of kasbonData) {
    if (k.bukti_transfer) {
      files.push({
        url: k.bukti_transfer,
        folder: 'kasbon',
        subfolder: k.nomor_kasbon,
        filename: `bukti_transfer_${getFileNameFromUrl(k.bukti_transfer)}`
      });
    }
  }

  // Klaim
  const klaimData = await fetchTableData('klaim');
  for (const kl of klaimData) {
    if (kl.lampiran) {
      files.push({
        url: kl.lampiran,
        folder: 'klaim',
        subfolder: kl.nomor_klaim,
        filename: `lampiran_${getFileNameFromUrl(kl.lampiran)}`
      });
    }
    if (kl.bukti_transfer) {
      files.push({
        url: kl.bukti_transfer,
        folder: 'klaim',
        subfolder: kl.nomor_klaim,
        filename: `bukti_transfer_${getFileNameFromUrl(kl.bukti_transfer)}`
      });
    }
  }

  // Penyelesaian
  const pnyData = await fetchTableData('penyelesaian');
  for (const p of pnyData) {
    if (p.lampiran_kasbon) {
      files.push({
        url: p.lampiran_kasbon,
        folder: 'penyelesaian',
        subfolder: p.nomor_penyelesaian,
        filename: `lampiran_kasbon_${getFileNameFromUrl(p.lampiran_kasbon)}`
      });
    }
    if (p.bukti_pengembalian) {
      files.push({
        url: p.bukti_pengembalian,
        folder: 'penyelesaian',
        subfolder: p.nomor_penyelesaian,
        filename: `bukti_pengembalian_${getFileNameFromUrl(p.bukti_pengembalian)}`
      });
    }
  }

  return files;
};

// Export files as ZIP with folder structure
export const exportFilesAsZip = async (onProgress, onStatus) => {
  const files = await collectAllFiles();

  if (files.length === 0) {
    return { success: false, message: 'Tidak ada file untuk di-backup' };
  }

  const zip = new JSZip();
  let completed = 0;
  let failed = 0;

  for (const file of files) {
    if (onStatus) {
      onStatus(`Downloading: ${file.subfolder}/${file.filename}`);
    }

    const blob = await fetchFileAsBlob(file.url);
    if (blob) {
      const path = `${file.folder}/${file.subfolder}/${file.filename}`;
      zip.file(path, blob);
    } else {
      failed++;
    }

    completed++;
    if (onProgress) {
      onProgress(Math.round((completed / files.length) * 100));
    }
  }

  if (onStatus) {
    onStatus('Membuat ZIP file...');
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  }, (metadata) => {
    if (onProgress && metadata.percent) {
      onProgress(Math.round(metadata.percent));
    }
  });

  const date = new Date().toISOString().split('T')[0];
  saveAs(zipBlob, `backup_files_${date}.zip`);

  return {
    success: true,
    totalFiles: files.length,
    downloadedFiles: files.length - failed,
    failedFiles: failed
  };
};

// Get file statistics
export const getFileStats = async () => {
  const files = await collectAllFiles();

  const stats = {
    total: files.length,
    byFolder: {}
  };

  for (const file of files) {
    if (!stats.byFolder[file.folder]) {
      stats.byFolder[file.folder] = 0;
    }
    stats.byFolder[file.folder]++;
  }

  return stats;
};

// ============ RESTORE FUNCTIONS ============

// Parse backup JSON file
export const parseBackupFile = (fileContent) => {
  try {
    const data = JSON.parse(fileContent);

    // Validate structure
    if (!data.tables || !data.exportedAt) {
      throw new Error('Format file backup tidak valid');
    }

    // Calculate stats
    const stats = {
      exportedAt: data.exportedAt,
      version: data.version || '1.0',
      tables: {}
    };

    for (const [tableName, records] of Object.entries(data.tables)) {
      stats.tables[tableName] = Array.isArray(records) ? records.length : 0;
    }

    stats.totalRecords = Object.values(stats.tables).reduce((sum, count) => sum + count, 0);

    return { success: true, data, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Restore table with replace mode (delete all then insert)
const restoreTableReplace = async (tableName, records, onProgress) => {
  if (!records || records.length === 0) {
    return { inserted: 0, failed: 0, skipped: 0 };
  }

  let inserted = 0;
  let failed = 0;

  // Delete all existing records
  // Since we don't have truncate, we fetch all and delete one by one (slow but works)
  try {
    const allRecords = await getAllRecords(tableName);
    // Be careful not to delete ALL records in one go if API doesn't support it, but getAllRecords gets all
    for (const record of allRecords) {
      try {
        await deleteRecord(tableName, record.id);
      } catch (e) {
        console.error(`Error deleting record ${record.id} in ${tableName}`, e);
      }
    }
  } catch (error) {
    console.error(`Error deleting ${tableName}:`, error);
  }

  // Insert new records
  for (const record of records) {
    try {
      await createRecord(tableName, record);
      inserted++;
    } catch (err) {
      console.error(`Error inserting into ${tableName}:`, err);
      failed++;
    }

    if (onProgress) {
      onProgress();
    }
  }

  return { inserted, failed, skipped: 0 };
};

// Restore table with merge mode (insert if not exists)
const restoreTableMerge = async (tableName, records, onProgress) => {
  if (!records || records.length === 0) {
    return { inserted: 0, failed: 0, skipped: 0 };
  }

  let inserted = 0;
  let failed = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      // Check if record exists
      try {
        const existing = await getRecordById(tableName, record.id);
        if (existing) {
          skipped++;
        } else {
          await createRecord(tableName, record);
          inserted++;
        }
      } catch (e) {
        // Not found (regardless of error reason, assume allowed to insert)
        // If it was a real error, createRecord might fail too, which is caught below
        await createRecord(tableName, record);
        inserted++;
      }
    } catch (err) {
      // Create failed
      console.error(`Error merging into ${tableName}:`, err);
      failed++;
    }

    if (onProgress) {
      onProgress();
    }
  }

  return { inserted, failed, skipped };
};

// Main restore function
export const restoreFromBackup = async (backupData, mode = 'merge', onProgress, onStatus) => {
  const results = {
    success: true,
    tables: {},
    totalInserted: 0,
    totalFailed: 0,
    totalSkipped: 0
  };

  // Order tables for restore (respect foreign keys)
  const tableOrder = [
    'users',
    'vendors',
    'payment_requests',
    'kasbon',
    'klaim',
    'penyelesaian',
    'activity_logs'
  ];

  // Calculate total records for progress
  let totalRecords = 0;
  for (const tableName of tableOrder) {
    if (backupData.tables[tableName]) {
      totalRecords += backupData.tables[tableName].length;
    }
  }

  let processedRecords = 0;

  for (const tableName of tableOrder) {
    const records = backupData.tables[tableName];

    if (!records || records.length === 0) {
      results.tables[tableName] = { inserted: 0, failed: 0, skipped: 0 };
      continue;
    }

    if (onStatus) {
      onStatus(`Restoring ${tableName}... (${records.length} records)`);
    }

    const progressCallback = () => {
      processedRecords++;
      if (onProgress) {
        onProgress(Math.round((processedRecords / totalRecords) * 100));
      }
    };

    let tableResult;
    if (mode === 'replace') {
      tableResult = await restoreTableReplace(tableName, records, progressCallback);
    } else {
      tableResult = await restoreTableMerge(tableName, records, progressCallback);
    }

    results.tables[tableName] = tableResult;
    results.totalInserted += tableResult.inserted;
    results.totalFailed += tableResult.failed;
    results.totalSkipped += tableResult.skipped;
  }

  if (results.totalFailed > 0) {
    results.success = false;
  }

  return results;
};

// Validate backup file before restore
export const validateBackupFile = (file) => {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ valid: false, error: 'File tidak ditemukan' });
      return;
    }

    if (!file.name.endsWith('.json')) {
      resolve({ valid: false, error: 'File harus berformat JSON' });
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      resolve({ valid: false, error: 'File terlalu besar (max 50MB)' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseBackupFile(e.target.result);
      if (result.success) {
        resolve({ valid: true, stats: result.stats, data: result.data });
      } else {
        resolve({ valid: false, error: result.error });
      }
    };
    reader.onerror = () => {
      resolve({ valid: false, error: 'Gagal membaca file' });
    };
    reader.readAsText(file);
  });
};
