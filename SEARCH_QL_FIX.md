# Perbaikan Search Nomor QL

## Masalah
Ketika user mengetik "31" di search box, sistem menampilkan semua nomor QL yang mengandung "31", termasuk:
- QL-31 ✓ (yang diinginkan)
- QL-131 ✗ (tidak diinginkan)
- QL-312 ✗ (tidak diinginkan)
- QL-3100 ✗ (tidak diinginkan)

Ini terjadi karena menggunakan `includes()` yang mencocokkan substring di mana saja.

## Solusi

Menggunakan logika search yang lebih cerdas:

### 1. Jika User Mengetik Angka Saja
Contoh: `31`, `123`, `5`

**Logika:**
- Extract angka dari nomor QL (hapus semua karakter non-digit)
- Cek apakah angka QL **dimulai dengan** search term
- Menggunakan `startsWith()` untuk pencocokan

**Contoh:**
```javascript
Search: "31"
QL-31   -> Extract: "31"  -> startsWith("31") -> ✓ MATCH
QL-131  -> Extract: "131" -> startsWith("31") -> ✗ NO MATCH
QL-312  -> Extract: "312" -> startsWith("31") -> ✓ MATCH (dimulai dengan 31)
QL-3100 -> Extract: "3100" -> startsWith("31") -> ✓ MATCH (dimulai dengan 31)
```

### 2. Jika User Mengetik dengan Format Lengkap
Contoh: `QL-31`, `ql-123`, `Q-5`

**Logika:**
- Gunakan `includes()` untuk pencocokan substring
- Case-insensitive

**Contoh:**
```javascript
Search: "QL-31"
QL-31   -> includes("ql-31") -> ✓ MATCH
QL-131  -> includes("ql-31") -> ✗ NO MATCH
QL-312  -> includes("ql-31") -> ✗ NO MATCH
```

## Implementasi

```javascript
const applyFilters = (data) => {
  let filtered = filterByPeriod(data);
  
  if (searchQL.trim()) {
    const searchTerm = searchQL.toLowerCase().trim();
    filtered = filtered.filter(item => {
      const nomorQL = (item.nomor_ql || '').toLowerCase();
      
      // Jika search term hanya angka
      if (/^\d+$/.test(searchTerm)) {
        // Extract angka dari nomor QL
        const qlNumber = nomorQL.replace(/[^\d]/g, '');
        // Cek apakah dimulai dengan search term
        return qlNumber.startsWith(searchTerm);
      }
      
      // Jika mengandung huruf/karakter lain, gunakan includes
      return nomorQL.includes(searchTerm);
    });
  }
  
  return filtered;
};
```

## Regex Explanation

### `/^\d+$/`
- `^` : Awal string
- `\d+` : Satu atau lebih digit (0-9)
- `$` : Akhir string
- Artinya: String hanya berisi angka, tidak ada karakter lain

### `replace(/[^\d]/g, '')`
- `[^\d]` : Semua karakter yang BUKAN digit
- `g` : Global (semua occurrence)
- `''` : Replace dengan string kosong
- Artinya: Hapus semua karakter non-digit

## Test Cases (UPDATED - Exact Match)

| Input | QL-31 | QL-131 | QL-312 | QL-3100 | QL-231 |
|-------|-------|--------|--------|---------|--------|
| `31` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `131` | ✗ | ✓ | ✗ | ✗ | ✗ |
| `312` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `QL-31` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `ql-131` | ✗ | ✓ | ✗ | ✗ | ✗ |
| `3` | ✗ | ✗ | ✗ | ✗ | ✗ |

**Perubahan**: Sekarang menggunakan **exact match** (`===`) bukan `startsWith()`, jadi "31" hanya cocok dengan QL-31, tidak dengan QL-312 atau QL-3100.

## Benefits

1. **Lebih Akurat**: Mengurangi false positive
2. **Fleksibel**: Mendukung search dengan atau tanpa prefix
3. **User-Friendly**: User bisa mengetik angka saja untuk search cepat
4. **Case-Insensitive**: Tidak peduli huruf besar/kecil

## Catatan

Jika user ingin mencari QL yang mengandung "31" di tengah (seperti QL-131), mereka bisa mengetik:
- `131` (angka lengkap)
- `QL-131` (format lengkap)
- `1-131` (partial format)

## Alternative Solutions (Tidak Digunakan)

### 1. Exact Match
```javascript
return nomorQL === searchTerm;
```
**Cons**: Terlalu strict, user harus mengetik persis sama

### 2. Word Boundary Regex
```javascript
return new RegExp(`\\b${searchTerm}\\b`, 'i').test(nomorQL);
```
**Cons**: Kompleks, tidak cocok untuk format dengan dash

### 3. Split by Dash
```javascript
const parts = nomorQL.split('-');
return parts.some(part => part === searchTerm);
```
**Cons**: Tidak fleksibel untuk format berbeda
