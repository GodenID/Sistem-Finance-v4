# Laporan Realtime - Update Documentation

## Perubahan yang Dilakukan

### 1. Import Supabase
```javascript
import { getAllRecords } from '../lib/supabase';
```

### 2. State Management
Menambahkan state untuk menyimpan data realtime:
```javascript
const [isLoading, setIsLoading] = useState(true);
const [reportData, setReportData] = useState({
  paymentRequests: [],
  kasbon: [],
  klaim: [],
  penyelesaian: []
});
```

### 3. Fetch Data dari Supabase
Data diambil dari 4 tabel secara paralel:
- `payment_requests`
- `kasbon`
- `klaim`
- `penyelesaian`

```javascript
useEffect(() => {
  const fetchReportData = async () => {
    const [prData, kasbonData, klaimData, penyelesaianData] = await Promise.all([
      getAllRecords('payment_requests'),
      getAllRecords('kasbon'),
      getAllRecords('klaim'),
      getAllRecords('penyelesaian')
    ]);
    // ... set state
  };
  fetchReportData();
}, [canAccessLaporan]);
```

### 4. Kalkulasi Statistik Realtime
Fungsi `calculateStats()` menghitung:
- Total transaksi
- Total nominal
- Jumlah approved
- Jumlah pending

### 5. Data Per Kategori
Fungsi `getDataByCategory()` mengelompokkan data berdasarkan tipe:
- Prasasti Selaras
- Mutiari Garden
- Wood and Steel
- Lainnya

### 6. Export Excel Realtime
Semua sheet di Excel menggunakan data realtime:
- Sheet 1: Ringkasan (Summary)
- Sheet 2: Payment Request Detail
- Sheet 3: Kasbon Detail
- Sheet 4: Klaim Detail
- Sheet 5: Penyelesaian Detail
- Sheet 6: Master Vendor (masih dummy)
- Sheet 7: Analisis per Kategori

### 7. UI Updates

#### Summary Cards
- Menampilkan loading state ('...')
- Data realtime untuk Total, Nominal, Approved, Pending

#### Tabel Detail Transaksi
- Loading state dengan spinner
- Empty state jika tidak ada data
- Data dikelompokkan per kategori (tipe)
- Menampilkan total transaksi dan nominal per kategori

## Fitur yang Ditambahkan

1. **Loading State**: Indikator loading saat data sedang diambil
2. **Empty State**: Pesan jika tidak ada data
3. **Realtime Calculation**: Semua angka dihitung dari data aktual
4. **Dynamic Export**: Excel export menggunakan data realtime

## Data yang Masih Dummy

1. **Master Vendor** di Excel - Perlu integrasi dengan tabel vendors
2. **Chart Trend** - Placeholder untuk chart (bisa diimplementasi dengan library chart)
3. **Chart Distribusi** - Placeholder untuk chart

## Catatan

- Data di-refresh setiap kali halaman dibuka
- Untuk auto-refresh berkala, bisa tambahkan interval di useEffect
- Filter periode (hari ini, minggu ini, dll) belum diimplementasi - masih perlu filter berdasarkan tanggal

## Filter yang Sudah Diimplementasi

### 1. Filter Periode
- **Hari Ini**: Menampilkan transaksi hari ini saja
- **Minggu Ini**: 7 hari terakhir
- **Bulan Ini**: Dari tanggal 1 bulan berjalan
- **Kuartal Ini**: Dari awal kuartal (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
- **Tahun Ini**: Dari 1 Januari tahun berjalan
- **Custom**: Pilih tanggal dari dan sampai secara manual

### 2. Filter Pencarian
- **Nomor QL**: Cari berdasarkan nomor QL (contoh: QL-12345)
- **Tipe**: Filter berdasarkan tipe perusahaan (Prasasti Selaras, Mutiari Garden, Wood and Steel)
- **ID Perusahaan**: Filter berdasarkan ID perusahaan

### 3. Tombol Reset Filter
Tombol "Reset Filter" muncul ketika ada filter aktif untuk mengembalikan ke default (Bulan Ini, tanpa filter tambahan)

## Cara Kerja Filter

1. **Filter Periode**: Memfilter data berdasarkan `created_at` field
2. **Filter QL**: Case-insensitive search pada field `nomor_ql`
3. **Filter Tipe**: Exact match pada field `tipe`
4. **Filter ID Perusahaan**: Exact match pada field `id_perusahaan`
5. **Kombinasi Filter**: Semua filter bekerja bersamaan (AND logic)

## Export Excel dengan Filter

Export Excel akan menggunakan data yang sudah difilter:
- Summary menggunakan statistik dari filtered data
- Semua detail sheet (PR, Kasbon, Klaim, Penyelesaian) hanya menampilkan data yang sudah difilter
- Analisis kategori dihitung dari filtered data

## TODO untuk Improvement

1. ✅ ~~Implementasi filter periode (today, week, month, etc)~~ - DONE
2. ✅ ~~Search functionality~~ - DONE
3. ✅ ~~Filter berdasarkan tipe dan ID perusahaan~~ - DONE
4. Tambahkan chart library (recharts, chart.js, dll)
5. Integrasi vendor name dari vendor_id
6. Auto-refresh data setiap X menit
7. Export PDF selain Excel
8. Filter berdasarkan status approval
9. Filter berdasarkan nama karyawan
10. Download filtered data as CSV
