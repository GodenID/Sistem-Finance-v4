# Fitur Approve & Reject

## Payment Request

### Fitur yang Ditambahkan:
1. **Tombol Approve** - Menyetujui Payment Request
2. **Tombol Reject** - Menolak Payment Request
3. **Custom Confirm Dialog** - Dialog konfirmasi yang lebih menarik dan user-friendly

### Lokasi Tombol:
1. **Di Tabel (List View)**
   - Tombol Approve (hijau) dan Reject (orange) muncul di kolom Aksi
   - Hanya muncul jika status approval = 'Pending'
   - Hanya bisa diakses oleh Manager/Administrator

2. **Di Modal Detail**
   - Tombol Approve dan Reject muncul di footer modal
   - Sebelah kiri tombol Print dan Export PDF
   - Hanya muncul jika status approval = 'Pending'
   - Hanya bisa diakses oleh Manager/Administrator

### Cara Kerja:
- **Approve**: Mengubah `status_approval` menjadi 'Approved' dan menyimpan nama user di `disetujui_oleh`
- **Reject**: Mengubah `status_approval` menjadi 'Rejected' dan menyimpan nama user di `disetujui_oleh`
- **Delete**: Menghapus data Payment Request secara permanen
- Setelah approve/reject/delete, data akan di-refresh otomatis
- Custom confirm dialog muncul sebelum approve/reject/delete dengan:
  - Icon yang sesuai dengan aksi (CheckCircle untuk approve, XCircle untuk reject/delete)
  - Warna yang berbeda (hijau untuk approve, merah untuk reject/delete)
  - Animasi smooth (fadeIn dan slideUp)
  - Backdrop blur untuk fokus pada dialog

### Permissions:
- Hanya user dengan role `manager` atau `administrator` yang bisa approve/reject
- User dengan role `guest` atau `user` hanya bisa melihat status

## Status Badge:
- **Pending**: Badge kuning/amber
- **Approved**: Badge hijau/emerald
- **Rejected**: Badge merah/rose

## Catatan untuk Modul Lain:
Untuk menambahkan fitur approve/reject di modul Kasbon, Klaim, dan Penyelesaian:

1. Import fungsi dari Supabase:
```javascript
import { getAllRecords, updateRecord } from '../lib/supabase';
```

2. Tambahkan fungsi approve dan reject:
```javascript
const handleApprove = async (item) => {
  if (!window.confirm(`Apakah Anda yakin ingin menyetujui ${item.nomorXXX}?`)) {
    return;
  }
  try {
    await updateRecord('nama_tabel', item.id, {
      status_approval: 'Approved',
      disetujui_oleh: userName || 'Manager'
    });
    showToast('Berhasil disetujui', 'success');
    await fetchData(); // Refresh data
  } catch (error) {
    console.error('Error:', error);
    showToast('Gagal menyetujui', 'error');
  }
};

const handleReject = async (item) => {
  if (!window.confirm(`Apakah Anda yakin ingin menolak ${item.nomorXXX}?`)) {
    return;
  }
  try {
    await updateRecord('nama_tabel', item.id, {
      status_approval: 'Rejected',
      disetujui_oleh: userName || 'Manager'
    });
    showToast('Berhasil ditolak', 'success');
    await fetchData(); // Refresh data
  } catch (error) {
    console.error('Error:', error);
    showToast('Gagal menolak', 'error');
  }
};
```

3. Tambahkan tombol di UI (sama seperti PaymentRequest)


## Custom Confirm Dialog Component

### Komponen Baru: `ConfirmDialog.jsx`

Komponen reusable untuk konfirmasi aksi dengan tampilan yang lebih menarik.

### Props:
- `isOpen` (boolean) - Status dialog terbuka/tertutup
- `onClose` (function) - Callback saat dialog ditutup
- `onConfirm` (function) - Callback saat tombol konfirmasi diklik
- `title` (string) - Judul dialog
- `message` (string) - Pesan konfirmasi
- `confirmText` (string) - Text tombol konfirmasi (default: 'Konfirmasi')
- `cancelText` (string) - Text tombol batal (default: 'Batal')
- `type` (string) - Tipe dialog: 'warning', 'success', 'danger'

### Tipe Dialog:
1. **success** (hijau) - Untuk approve/konfirmasi positif
   - Icon: CheckCircle
   - Warna: Green
   
2. **danger** (merah) - Untuk reject/delete/aksi berbahaya
   - Icon: XCircle
   - Warna: Red
   
3. **warning** (kuning) - Untuk peringatan umum
   - Icon: AlertTriangle
   - Warna: Amber

### Fitur:
- Backdrop blur untuk fokus
- Animasi smooth (fadeIn & slideUp)
- Responsive design
- Tombol close (X) di pojok kanan atas
- Shadow dan border radius modern
- Hover effects pada tombol

### Cara Penggunaan:

```javascript
// 1. Import component
import ConfirmDialog from '../components/ConfirmDialog';

// 2. Tambahkan state
const [confirmDialog, setConfirmDialog] = useState({
  isOpen: false,
  type: 'warning',
  title: '',
  message: '',
  onConfirm: () => {}
});

// 3. Panggil dialog
const handleAction = (item) => {
  setConfirmDialog({
    isOpen: true,
    type: 'success', // atau 'danger', 'warning'
    title: 'Konfirmasi Aksi',
    message: 'Apakah Anda yakin?',
    onConfirm: async () => {
      // Lakukan aksi di sini
      await doSomething();
    }
  });
};

// 4. Render component
<ConfirmDialog
  isOpen={confirmDialog.isOpen}
  onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
  onConfirm={confirmDialog.onConfirm}
  title={confirmDialog.title}
  message={confirmDialog.message}
  type={confirmDialog.type}
  confirmText="Ya, Lanjutkan"
  cancelText="Batal"
/>
```

### Animasi CSS:
Animasi ditambahkan di `src/index.css`:
- `animate-fadeIn` - Fade in backdrop
- `animate-slideUp` - Slide up dialog dari bawah
