// Changelog data - Update this file when releasing new versions
// APP_VERSION otomatis diambil dari entry pertama changelog

export const changelog = [
  {
    version: '1.7.0',
    date: '2024-12-09',
    isNew: true,
    changes: [
      { type: 'new', text: 'Dashboard Charts - Grafik trend transaksi 7 hari, pie chart status, bar chart perbandingan modul' },
      { type: 'new', text: 'Halaman Profil User - Edit nama, ubah password, statistik aktivitas' },
      { type: 'new', text: 'Transaksi Berulang - Buat dan kelola transaksi otomatis (harian/mingguan/bulanan/tahunan)' },
      { type: 'improved', text: 'Print Friendly - Optimasi tampilan cetak untuk halaman detail transaksi' },
      { type: 'improved', text: 'Header dropdown dengan menu Profil Saya' },
    ]
  },
  {
    version: '1.6.0',
    date: '2024-12-03',
    isNew: false,
    changes: [
      { type: 'improved', text: 'Tampilan versi di halaman Login lebih rapih' },
      { type: 'improved', text: 'Footer Sidebar menampilkan "Finance Prasasti Group"' },
      { type: 'improved', text: 'Versi aplikasi auto-sync dari changelog di Login & Sidebar' },
    ]
  },
  {
    version: '1.5.0',
    date: '2024-12-03',
    isNew: false,
    changes: [
      { type: 'new', text: 'Fitur Backup database (JSON & SQL)' },
      { type: 'new', text: 'Fitur Restore database dari backup JSON' },
      { type: 'new', text: 'Fitur Backup file attachments sebagai ZIP' },
      { type: 'new', text: 'Halaman Changelog untuk melihat update terbaru' },
      { type: 'new', text: 'Performance Dashboard untuk monitoring aplikasi' },
      { type: 'improved', text: 'Filter tanggal di Activity Log' },
      { type: 'improved', text: 'Pagination 10 item per halaman di Activity Log' },
      { type: 'improved', text: 'Grafik real data di halaman Laporan (Area, Pie, Bar Chart)' },
    ]
  },
  {
    version: '1.4.0',
    date: '2024-12-02',
    changes: [
      { type: 'new', text: 'Notifikasi realtime dengan bell icon' },
      { type: 'new', text: 'Activity Log / Audit Trail lengkap' },
      { type: 'new', text: 'Panel riwayat aktivitas di halaman detail' },
      { type: 'improved', text: 'Logging aktivitas dengan data lengkap (nomor, detail, user)' },
      { type: 'fix', text: 'Error 409 foreign key constraint pada activity_logs' },
    ]
  },
  {
    version: '1.3.0',
    date: '2024-11-28',
    changes: [
      { type: 'new', text: 'Halaman Laporan gabungan semua modul' },
      { type: 'new', text: 'Export laporan ke Excel' },
      { type: 'new', text: 'Filter berdasarkan periode, tipe, dan perusahaan' },
      { type: 'improved', text: 'Statistik per modul dengan ringkasan' },
    ]
  },
  {
    version: '1.2.0',
    date: '2024-11-25',
    changes: [
      { type: 'new', text: 'Modul Penyelesaian Kasbon' },
      { type: 'new', text: 'Fitur approve/reject untuk semua modul' },
      { type: 'new', text: 'Upload bukti transfer' },
      { type: 'improved', text: 'Halaman detail untuk setiap transaksi' },
      { type: 'fix', text: 'Bug upload file di mobile' },
    ]
  },
  {
    version: '1.1.0',
    date: '2024-11-20',
    changes: [
      { type: 'new', text: 'Modul Klaim dengan lampiran' },
      { type: 'new', text: 'Manajemen Vendor' },
      { type: 'new', text: 'Halaman Karyawan (admin only)' },
      { type: 'improved', text: 'UI responsive untuk mobile' },
    ]
  },
  {
    version: '1.0.0',
    date: '2024-11-15',
    changes: [
      { type: 'new', text: 'Rilis awal Finance Prasasti' },
      { type: 'new', text: 'Dashboard dengan ringkasan transaksi' },
      { type: 'new', text: 'Modul Payment Request' },
      { type: 'new', text: 'Modul Kasbon' },
      { type: 'new', text: 'Sistem login dan role-based access' },
    ]
  }
];

// APP_VERSION otomatis dari entry pertama changelog
export const APP_VERSION = changelog[0]?.version || '1.0.0';

export const getChangeTypeConfig = (type) => {
  const configs = {
    new: {
      label: 'NEW',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-200'
    },
    improved: {
      label: 'IMPROVED',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200'
    },
    fix: {
      label: 'FIX',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200'
    },
    removed: {
      label: 'REMOVED',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      borderColor: 'border-red-200'
    }
  };
  return configs[type] || configs.new;
};
