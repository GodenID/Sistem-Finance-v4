import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Database, 
  FolderArchive, 
  Download, 
  FileJson, 
  FileCode,
  Loader2,
  CheckCircle,
  AlertCircle,
  HardDrive,
  FolderOpen,
  Upload,
  RotateCcw,
  FileUp,
  AlertTriangle,
  Table
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  exportAsJSON, 
  exportAsSQL, 
  exportFilesAsZip, 
  getFileStats,
  validateBackupFile,
  restoreFromBackup
} from '../lib/backupUtils';

const Backup = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState('database');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [fileStats, setFileStats] = useState(null);
  
  // Restore states
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreStats, setRestoreStats] = useState(null);
  const [restoreData, setRestoreData] = useState(null);
  const [restoreMode, setRestoreMode] = useState('merge');
  const [showConfirm, setShowConfirm] = useState(false);

  // Check admin access
  const isAdmin = userRole === 'administrator';

  useEffect(() => {
    if (isAdmin) {
      loadFileStats();
    }
  }, [isAdmin]);

  const loadFileStats = async () => {
    try {
      const stats = await getFileStats();
      setFileStats(stats);
    } catch (error) {
      console.error('Error loading file stats:', error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600 mb-4">
            Hanya Administrator yang dapat mengakses halaman Backup.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleExportJSON = async () => {
    setIsLoading(true);
    setProgress(0);
    setResult(null);
    setStatus('Mengambil data dari database...');
    
    try {
      const metadata = await exportAsJSON(setProgress);
      setResult({
        type: 'success',
        message: `Berhasil export ${metadata.totalRecords} records dari ${metadata.tableCount} tabel`
      });
    } catch (error) {
      setResult({
        type: 'error',
        message: `Error: ${error.message}`
      });
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  const handleExportSQL = async () => {
    setIsLoading(true);
    setProgress(0);
    setResult(null);
    setStatus('Mengambil data dari database...');
    
    try {
      const metadata = await exportAsSQL(setProgress);
      setResult({
        type: 'success',
        message: `Berhasil export ${metadata.totalRecords} records sebagai SQL`
      });
    } catch (error) {
      setResult({
        type: 'error',
        message: `Error: ${error.message}`
      });
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  const handleExportFiles = async () => {
    setIsLoading(true);
    setProgress(0);
    setResult(null);
    
    try {
      const res = await exportFilesAsZip(setProgress, setStatus);
      if (res.success) {
        setResult({
          type: 'success',
          message: `Berhasil backup ${res.downloadedFiles} dari ${res.totalFiles} file${res.failedFiles > 0 ? ` (${res.failedFiles} gagal)` : ''}`
        });
      } else {
        setResult({
          type: 'warning',
          message: res.message
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: `Error: ${error.message}`
      });
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  // Handle file selection for restore
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setRestoreFile(file);
    setRestoreStats(null);
    setRestoreData(null);
    setResult(null);
    
    const validation = await validateBackupFile(file);
    if (validation.valid) {
      setRestoreStats(validation.stats);
      setRestoreData(validation.data);
    } else {
      setResult({
        type: 'error',
        message: validation.error
      });
      setRestoreFile(null);
    }
  };

  // Handle restore
  const handleRestore = async () => {
    if (!restoreData) return;
    
    setShowConfirm(false);
    setIsLoading(true);
    setProgress(0);
    setResult(null);
    
    try {
      const results = await restoreFromBackup(
        restoreData,
        restoreMode,
        setProgress,
        setStatus
      );
      
      if (results.success) {
        setResult({
          type: 'success',
          message: `Restore selesai! ${results.totalInserted} data berhasil di-restore, ${results.totalSkipped} di-skip, ${results.totalFailed} gagal`
        });
      } else {
        setResult({
          type: 'warning',
          message: `Restore selesai dengan error. ${results.totalInserted} berhasil, ${results.totalSkipped} di-skip, ${results.totalFailed} gagal`
        });
      }
      
      // Reset restore states
      setRestoreFile(null);
      setRestoreStats(null);
      setRestoreData(null);
    } catch (error) {
      setResult({
        type: 'error',
        message: `Error: ${error.message}`
      });
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Backup Data</h1>
                <p className="text-sm text-gray-500">Export database dan file attachments</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-800">Perhatian</h3>
              <p className="text-sm text-amber-700">
                Backup database termasuk data sensitif seperti password user. 
                Simpan file backup di tempat yang aman dan jangan bagikan kepada pihak yang tidak berwenang.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'database'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Database</span>
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'files'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>File Attachments</span>
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'restore'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restore</span>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'database' && (
          <div className="space-y-4">
            {/* JSON Export */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FileJson className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Export JSON</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Export semua data dalam format JSON. Cocok untuk backup lengkap dan mudah di-import ulang.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">users</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">vendors</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">payment_requests</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">kasbon</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">klaim</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">penyelesaian</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">activity_logs</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleExportJSON}
                  disabled={isLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading && activeTab === 'database' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download JSON</span>
                </button>
              </div>
            </div>

            {/* SQL Export */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <FileCode className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Export SQL</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Export semua data sebagai SQL INSERT statements. Cocok untuk restore ke database PostgreSQL.
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      * Termasuk password user dalam format hash
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleExportSQL}
                  disabled={isLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading && activeTab === 'database' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download SQL</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-4">
            {/* File Stats */}
            {fileStats && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <HardDrive className="w-5 h-5 text-gray-600" />
                  <h3 className="font-bold text-gray-800">Statistik File</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{fileStats.total}</p>
                    <p className="text-xs text-gray-600">Total File</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{fileStats.byFolder['payment-requests'] || 0}</p>
                    <p className="text-xs text-gray-600">Payment Request</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{fileStats.byFolder['kasbon'] || 0}</p>
                    <p className="text-xs text-gray-600">Kasbon</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{fileStats.byFolder['klaim'] || 0}</p>
                    <p className="text-xs text-gray-600">Klaim</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-600">{fileStats.byFolder['penyelesaian'] || 0}</p>
                    <p className="text-xs text-gray-600">Penyelesaian</p>
                  </div>
                </div>
              </div>
            )}

            {/* ZIP Export */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                    <FolderArchive className="w-6 h-6 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Export File sebagai ZIP</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Download semua lampiran dan bukti transfer dalam satu file ZIP dengan struktur folder terorganisir.
                    </p>
                    <div className="mt-3 text-xs text-gray-500 font-mono bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <FolderOpen className="w-4 h-4" />
                        <span>backup_files_YYYY-MM-DD.zip</span>
                      </div>
                      <div className="ml-6 mt-1 space-y-1">
                        <div>├── payment-requests/PR-0001/...</div>
                        <div>├── kasbon/KSB-0001/...</div>
                        <div>├── klaim/KLM-0001/...</div>
                        <div>└── penyelesaian/PNY-0001/...</div>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleExportFiles}
                  disabled={isLoading || (fileStats && fileStats.total === 0)}
                  className="flex items-center space-x-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading && activeTab === 'files' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download ZIP</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'restore' && (
          <div className="space-y-4">
            {/* Warning */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-800">Peringatan!</h3>
                  <p className="text-sm text-red-700">
                    Restore database dapat menghapus atau menimpa data yang ada. 
                    Pastikan Anda sudah backup data terbaru sebelum melakukan restore.
                  </p>
                </div>
              </div>
            </div>

            {/* Upload File */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <FileUp className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">Upload File Backup</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Pilih file backup JSON yang sudah di-export sebelumnya.
                  </p>
                  
                  <div className="mt-4">
                    <label className="block">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
                      />
                    </label>
                  </div>
                  
                  {restoreFile && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">
                        File: {restoreFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Size: {(restoreFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Preview */}
            {restoreStats && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Table className="w-5 h-5 text-gray-600" />
                  <h3 className="font-bold text-gray-800">Preview Data Backup</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Tanggal Backup</p>
                    <p className="font-medium text-gray-800">
                      {new Date(restoreStats.exportedAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Total Records</p>
                    <p className="font-medium text-gray-800">{restoreStats.totalRecords}</p>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Data per Tabel:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(restoreStats.tables).map(([table, count]) => (
                      <div key={table} className="p-2 bg-gray-50 rounded-lg text-center">
                        <p className="text-lg font-bold text-gray-800">{count}</p>
                        <p className="text-xs text-gray-500">{table}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Restore Options */}
            {restoreStats && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 mb-4">Mode Restore</h3>
                
                <div className="space-y-3">
                  <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="merge"
                      checked={restoreMode === 'merge'}
                      onChange={(e) => setRestoreMode(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-800">Merge (Aman)</p>
                      <p className="text-sm text-gray-600">
                        Hanya tambahkan data baru. Data yang sudah ada tidak akan diubah.
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-start space-x-3 p-3 border border-red-200 rounded-lg cursor-pointer hover:bg-red-50">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="replace"
                      checked={restoreMode === 'replace'}
                      onChange={(e) => setRestoreMode(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-red-800">Replace All (Berbahaya)</p>
                      <p className="text-sm text-red-600">
                        Hapus semua data lama dan ganti dengan data dari backup. 
                        Data yang tidak ada di backup akan hilang!
                      </p>
                    </div>
                  </label>
                </div>
                
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={isLoading}
                  className="mt-6 w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Mulai Restore</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Konfirmasi Restore</h3>
                <p className="text-gray-600 mb-4">
                  {restoreMode === 'replace' 
                    ? 'PERINGATAN: Mode Replace akan menghapus SEMUA data yang ada dan menggantinya dengan data backup. Aksi ini TIDAK DAPAT dibatalkan!'
                    : 'Anda akan melakukan restore dengan mode Merge. Data yang sudah ada tidak akan diubah.'}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Total {restoreStats?.totalRecords || 0} records akan di-restore.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleRestore}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      restoreMode === 'replace'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                  >
                    Ya, Restore
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {isLoading && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {status && (
              <p className="text-sm text-gray-600 mt-2">{status}</p>
            )}
          </div>
        )}

        {/* Result */}
        {result && !isLoading && (
          <div className={`mt-6 rounded-xl border p-4 ${
            result.type === 'success' 
              ? 'bg-green-50 border-green-200' 
              : result.type === 'warning'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              {result.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className={`w-5 h-5 ${result.type === 'warning' ? 'text-amber-600' : 'text-red-600'}`} />
              )}
              <p className={`font-medium ${
                result.type === 'success' 
                  ? 'text-green-800' 
                  : result.type === 'warning'
                  ? 'text-amber-800'
                  : 'text-red-800'
              }`}>
                {result.message}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Backup;
