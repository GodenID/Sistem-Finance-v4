# Laporan Gabungan - Data Transaksi Berdasarkan QL dan Tipe

## Perubahan yang Dilakukan

### 1. Menambahkan Mutiari Decoration
Tipe perusahaan "Mutiari Decoration" sudah ditambahkan ke:
- `TIPE_OPTIONS` di `src/constants/companyTypes.js`
- `COMPANY_TYPES_WITH_COLORS` dengan warna purple
- `COMPANY_IDS` dengan ID "MD"

### 2. Tabel Detail Transaksi Gabungan
Tabel detail sekarang menampilkan data gabungan dari 3 modul:
- Payment Request
- Kasbon
- Klaim

**Struktur Tabel Baru:**
| Nomor QL | Tipe | Jumlah Transaksi | Detail Modul | Total Nominal |
|----------|------|------------------|--------------|---------------|
| QL-12345 | Prasasti Selaras | 3 | PR, Kasbon, Klaim | Rp 50.000.000 |

**Kolom-kolom:**
1. **Nomor QL**: Nomor QL dari transaksi
2. **Tipe**: Tipe perusahaan (Prasasti Selaras, Mutiari Garden, dll)
3. **Jumlah Transaksi**: Total transaksi dengan QL dan tipe yang sama
4. **Detail Modul**: Badge untuk setiap modul (warna berbeda)
   - Payment Request: Biru
   - Kasbon: Hijau
   - Klaim: Ungu
5. **Total Nominal**: Total nominal dari semua transaksi

### 3. Filter ID Perusahaan Opsional
Filter ID Perusahaan sekarang bersifat opsional:
- Label ditambahkan "(Opsional)"
- Placeholder: "-- Pilih ID Perusahaan (Opsional) --"
- User bisa memilih atau tidak memilih ID Perusahaan

### 4. Fungsi getCombinedDataByQL()
Fungsi baru untuk menggabungkan data:

```javascript
const getCombinedDataByQL = () => {
  // Gabungkan semua data dari 3 modul
  const allData = [
    ...filteredData.paymentRequests.map(item => ({ ...item, modul: 'Payment Request' })),
    ...filteredData.kasbon.map(item => ({ ...item, modul: 'Kasbon' })),
    ...filteredData.klaim.map(item => ({ ...item, modul: 'Klaim' }))
  ];

  // Group by nomor_ql dan tipe
  const grouped = allData.reduce((acc, item) => {
    const key = `${item.nomor_ql}_${item.tipe}`;
    // ... grouping logic
  }, {});

  // Sort by tipe, then by nomor_ql
  return Object.values(grouped).sort(...);
};
```

## Cara Kerja

### Grouping Logic
1. Data dari 3 modul digabungkan dengan menambahkan field `modul`
2. Data di-group berdasarkan kombinasi `nomor_ql` dan `tipe`
3. Setiap group berisi:
   - `nomor_ql`: Nomor QL
   - `tipe`: Tipe perusahaan
   - `items`: Array of transaksi dalam group
   - `totalNominal`: Total nominal dari semua transaksi
   - `count`: Jumlah transaksi

### Sorting
Data diurutkan berdasarkan:
1. Tipe (alphabetically)
2. Nomor QL (alphabetically)

### Badge Modul
Setiap transaksi ditampilkan sebagai badge dengan warna berbeda:
- **Payment Request**: `bg-blue-100 text-blue-700`
- **Kasbon**: `bg-emerald-100 text-emerald-700`
- **Klaim**: `bg-violet-100 text-violet-700`

Hover pada badge menampilkan tooltip dengan nomor referensi dan nominal.

## Contoh Data

### Input (3 modul):
**Payment Request:**
- PR-0001, QL-12345, Prasasti Selaras, Rp 30.000.000

**Kasbon:**
- KBN-0001, QL-12345, Prasasti Selaras, Rp 10.000.000

**Klaim:**
- KLM-0001, QL-12345, Prasasti Selaras, Rp 5.000.000

### Output (Tabel Gabungan):
| Nomor QL | Tipe | Jumlah | Detail Modul | Total |
|----------|------|--------|--------------|-------|
| QL-12345 | Prasasti Selaras | 3 | [PR] [Kasbon] [Klaim] | Rp 45.000.000 |

## Filter yang Bekerja

Semua filter tetap bekerja pada data gabungan:
1. **Periode**: Filter berdasarkan tanggal
2. **Nomor QL**: Search nomor QL
3. **Tipe**: Filter tipe perusahaan
4. **ID Perusahaan**: Filter ID (opsional)

## Export Excel

Export Excel juga menggunakan data yang sudah difilter dari masing-masing modul (belum gabungan di sheet terpisah).

## Benefits

1. **Visibility**: Melihat semua transaksi dengan QL yang sama dalam satu baris
2. **Analysis**: Mudah menganalisis total transaksi per QL dan tipe
3. **Efficiency**: Tidak perlu membuka 3 sheet berbeda untuk melihat data terkait
4. **Flexibility**: Filter opsional memberikan fleksibilitas dalam analisis

## Future Improvements

1. Expandable rows untuk melihat detail setiap transaksi
2. Export sheet khusus untuk data gabungan
3. Chart untuk visualisasi data gabungan
4. Filter berdasarkan modul (show/hide PR, Kasbon, Klaim)
5. Subtotal per tipe
