import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Archive,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  FileWarning,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getPaginatedRecords } from '../lib/api';
import { listR2Objects, extractR2Key, deleteR2Files } from '../utils/r2Upload';
import { collectFileUrls } from '../utils/fileCleanup';

// Kolom file per tabel — dipakai untuk memetakan URL yang masih terreferensi.
const FILE_TABLES = [
  { table: 'payment_requests', columns: 'lampiran,bukti_transfer' },
  { table: 'kasbon', columns: 'bukti_transfer' },
  { table: 'klaim', columns: 'lampiran,bukti_transfer' },
  { table: 'penyelesaian', columns: 'lampiran,lampiran_pengembalian,bukti_kekurangan' },
  { table: 'recurring_instances', columns: 'bukti_transfer,invoice_url' },
];

// Prefix yang dikelola otomatis (backup terjadwal) — dikecualikan dari orphan.
const MANAGED_PREFIXES = ['backups/'];

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const formatDate = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '-';
  }
};

const Storage = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { showToast } = useToast();
  const isAdmin = userRole === 'administrator';

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [hasScanned, setHasScanned] = useState(false);
  const [stats, setStats] = useState({ total: 0, referenced: 0, managed: 0, orphans: 0, orphanBytes: 0 });
  const [orphans, setOrphans] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600 mb-6">Halaman Storage hanya untuk Administrator.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isManaged = (key) => MANAGED_PREFIXES.some((p) => key.startsWith(p));

  const fetchAllReferencedKeys = async (onProgress) => {
    const referenced = new Set();
    for (const { table, columns } of FILE_TABLES) {
      let page = 1;
      for (;;) {
        const { data } = await getPaginatedRecords(table, { page, limit: 100, select: columns });
        (data || []).forEach((row) => {
          collectFileUrls(row).forEach((url) => {
            const key = extractR2Key(url);
            if (key) referenced.add(key);
          });
        });
        onProgress?.(`${table} (hal ${page}, ${referenced.size} file terreferensi)`);
        if (!data || data.length < 100) break;
        page += 1;
      }
    }
    return referenced;
  };

  const handleScan = async () => {
    setIsScanning(true);
    setHasScanned(false);
    setOrphans([]);
    setSelected(new Set());
    try {
      // 1. Daftar semua object di bucket
      setScanProgress('Membaca isi storage...');
      const objects = [];
      let cursor = null;
      for (;;) {
        const res = await listR2Objects({ cursor, limit: 500 });
        objects.push(...(res.objects || []));
        setScanProgress(`Membaca isi storage... (${objects.length} file)`);
        if (!res.truncated) break;
        cursor = res.cursor;
      }

      // 2. Daftar semua file yang masih dipakai database
      setScanProgress('Memeriksa referensi database...');
      const referenced = await fetchAllReferencedKeys(setScanProgress);

      // 3. Orphan = ada di bucket, tidak direferensi, bukan file kelolaan sistem
      let managed = 0;
      let referencedCount = 0;
      const orphanList = [];
      for (const obj of objects) {
        if (isManaged(obj.key)) {
          managed += 1;
          continue;
        }
        if (referenced.has(obj.key)) {
          referencedCount += 1;
          continue;
        }
        orphanList.push(obj);
      }
      orphanList.sort((a, b) => (b.size || 0) - (a.size || 0));

      setStats({
        total: objects.length,
        referenced: referencedCount,
        managed,
        orphans: orphanList.length,
        orphanBytes: orphanList.reduce((sum, o) => sum + (o.size || 0), 0),
      });
      setOrphans(orphanList);
      setHasScanned(true);
      showToast(
        orphanList.length === 0
          ? 'Tidak ada file yatim. Storage bersih.'
          : `Ditemukan ${orphanList.length} file yatim (${formatBytes(orphanList.reduce((s, o) => s + (o.size || 0), 0))})`,
        orphanList.length === 0 ? 'success' : 'warning'
      );
    } catch (error) {
      console.error('Error scanning storage:', error);
      showToast(error.message || 'Gagal memindai storage', 'error');
    } finally {
      setIsScanning(false);
      setScanProgress('');
    }
  };

  const toggleSelect = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === orphans.length) setSelected(new Set());
    else setSelected(new Set(orphans.map((o) => o.key)));
  };

  const handleDeleteSelected = async (keys) => {
    if (keys.length === 0) {
      showToast('Pilih minimal satu file', 'error');
      return;
    }
    const totalSize = orphans.filter((o) => keys.includes(o.key)).reduce((s, o) => s + (o.size || 0), 0);
    if (!window.confirm(`Hapus ${keys.length} file yatim (${formatBytes(totalSize)}) dari storage? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const { deleted, failed } = await deleteR2Files(keys);
      setOrphans((prev) => prev.filter((o) => !deleted.includes(o.key)));
      setSelected((prev) => {
        const next = new Set(prev);
        deleted.forEach((k) => next.delete(k));
        return next;
      });
      setStats((prev) => ({
        ...prev,
        orphans: prev.orphans - deleted.length,
        orphanBytes: Math.max(0, prev.orphanBytes - orphans.filter((o) => deleted.includes(o.key)).reduce((s, o) => s + (o.size || 0), 0)),
      }));
      if (failed.length > 0) showToast(`${deleted.length} terhapus, ${failed.length} gagal`, 'warning');
      else showToast(`${deleted.length} file yatim berhasil dihapus`, 'success');
    } catch (error) {
      console.error('Error deleting orphans:', error);
      showToast('Gagal menghapus file', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Archive className="w-7 h-7 text-primary-600" />
              Storage & File Yatim
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Pindai file di R2 yang tidak lagi dipakai database, lalu hapus untuk hemat storage
            </p>
          </div>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          {isScanning ? 'Memindai...' : hasScanned ? 'Pindai Ulang' : 'Mulai Pindai'}
        </button>
      </div>

      {isScanning && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
          <p className="text-sm text-blue-700">{scanProgress || 'Memindai...'}</p>
        </div>
      )}

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        File di folder <code className="font-mono font-semibold">backups/</code> (backup otomatis harian)
        dikecualikan dari hasil pindai. Penghapusan file yatim hanya menghapus file di storage —
        data transaksi tidak ikut berubah.
      </div>

      {hasScanned && (
        <>
          {/* Statistik */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total File', value: stats.total, icon: HardDrive, color: 'bg-blue-50 text-blue-600' },
              { label: 'Terpakai', value: stats.referenced, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
              { label: 'Backup Sistem', value: stats.managed, icon: Archive, color: 'bg-gray-100 text-gray-600' },
              { label: 'File Yatim', value: stats.orphans, icon: FileWarning, color: 'bg-rose-50 text-rose-600' },
              { label: 'Ukuran Yatim', value: formatBytes(stats.orphanBytes), icon: Trash2, color: 'bg-amber-50 text-amber-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-800">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Aksi massal */}
          {orphans.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                {selected.size === orphans.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
              </button>
              <button
                onClick={() => handleDeleteSelected([...selected])}
                disabled={selected.size === 0 || isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Hapus yang Dipilih ({selected.size})
              </button>
              <button
                onClick={() => handleDeleteSelected(orphans.map((o) => o.key))}
                disabled={isDeleting}
                className="px-4 py-2 border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 text-sm font-medium disabled:opacity-50"
              >
                Hapus Semua Yatim
              </button>
            </div>
          )}

          {/* Tabel orphan */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {orphans.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <p className="text-gray-800 font-semibold">Storage bersih</p>
                <p className="text-sm text-gray-500 mt-1">Semua file di storage masih dipakai database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={orphans.length > 0 && selected.size === orphans.length}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">File</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Ukuran</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Diupload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orphans.map((o) => (
                      <tr key={o.key} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(o.key)}
                            onChange={() => toggleSelect(o.key)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700 break-all">{o.key}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatBytes(o.size)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDate(o.uploaded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Storage;
