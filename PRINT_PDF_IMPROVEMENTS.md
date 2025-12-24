# Print & PDF Export Improvements

## Payment Request Detail Page

### 1. Print-Friendly Layout ✅

#### Print Styles
```css
@media print {
  /* Hide non-essential elements */
  body * {
    visibility: hidden;
  }
  
  /* Show only printable area */
  #printable-area, #printable-area * {
    visibility: visible;
  }
  
  /* Hide buttons and navigation */
  .no-print {
    display: none !important;
  }
  
  /* Prevent page breaks inside cards */
  .card {
    break-inside: avoid;
  }
}
```

#### Features:
- **Print Header**: Header khusus yang hanya muncul saat print
  - Logo/Title perusahaan
  - Tanggal cetak
  - Nomor PR dan QL yang prominent
  
- **Clean Layout**: Semua elemen UI (buttons, sidebar, navigation) disembunyikan
- **Optimized Content**: Hanya konten penting yang di-print
- **Page Break Control**: Card tidak terpotong di tengah halaman
- **Professional Look**: Border dan spacing yang rapi

### 2. Enhanced PDF Export ✅

#### Design Features:

**Header Section:**
- Background biru dengan logo/title putih
- Company name dan tanggal cetak
- Professional dan eye-catching

**Document Info Box:**
- Background abu-abu terang
- Nomor PR dan QL yang jelas
- Status badge di pojok kanan (dengan warna sesuai status)

**Sections dengan Styling:**
- **Judul Section**: Warna biru, bold, dengan garis bawah
- **Field Labels**: Abu-abu, bold
- **Values**: Hitam, normal weight
- **Spacing**: Konsisten dan rapi

**Nominal Highlight:**
- Box dengan background biru muda
- Border biru
- Font size lebih besar
- Prominent dan mudah dibaca

**Status Section:**
- Status Approval dengan color coding
- Status Transfer
- Disetujui oleh

**Footer:**
- Garis pemisah
- Disclaimer text
- Page number

#### Color Scheme:
```javascript
const primaryColor = [37, 99, 235];      // Blue
const grayColor = [107, 114, 128];       // Gray
const lightGrayColor = [243, 244, 246];  // Light Gray
```

#### Status Colors:
- **Approved**: Green background (#dcfce7), green text (#16a34a)
- **Rejected**: Red background (#fee2e2), red text (#dc2626)
- **Pending**: Yellow background (#fef3c7), yellow text (#d97706)

### 3. Implementation Details

#### Print Button:
```javascript
<button onClick={() => window.print()}>
  <Printer className="w-5 h-5" />
  <span>Print</span>
</button>
```

#### Export PDF Button:
```javascript
<button onClick={handleExportPDF}>
  <Download className="w-5 h-5" />
  <span>Export PDF</span>
</button>
```

#### PDF Generation:
```javascript
const handleExportPDF = () => {
  const doc = new jsPDF();
  
  // Header with background
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Sections with styling
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('SECTION TITLE', margin, yPos);
  
  // Line under section
  doc.setDrawColor(...primaryColor);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
  
  // Save with descriptive filename
  doc.save(`Payment-Request-${pr.nomor_pr}.pdf`);
};
```

### 4. Responsive Design

#### Desktop:
- 3-column grid (2 main + 1 sidebar)
- Full width cards
- All details visible

#### Tablet:
- 2-column grid
- Stacked layout
- Optimized spacing

#### Mobile:
- Single column
- Stacked cards
- Touch-friendly buttons

#### Print:
- Single column
- Full width
- Optimized for A4 paper

### 5. Content Structure

**Main Content (Left 2 columns):**
1. Informasi Dasar
   - Nomor PR, QL
   - Tanggal
   - Nama Karyawan
   - Tipe & ID Perusahaan

2. Informasi Vendor
   - Nama Vendor
   - Kategori
   - Bank & Rekening

3. Keterangan (if any)

4. Lampiran (if any)

**Sidebar (Right 1 column):**
1. Nominal Card (highlighted)
2. Status Card
   - Status Approval
   - Disetujui Oleh
   - Status Transfer

### 6. PDF Layout Structure

```
┌─────────────────────────────────────────┐
│ [BLUE HEADER]                           │
│ PAYMENT REQUEST                         │
│ Prasasti Group                          │
│ Tanggal Cetak: ...                      │
├─────────────────────────────────────────┤
│ [GRAY BOX]                              │
│ Nomor PR: PR-0001    [Status Badge]    │
│ Nomor QL: QL-12345                      │
├─────────────────────────────────────────┤
│ INFORMASI DASAR                         │
│ ─────────────────────────────────────   │
│ Tanggal: ...                            │
│ Nama Karyawan: ...                      │
│ Tipe: ...                               │
│ ID Perusahaan: ...                      │
├─────────────────────────────────────────┤
│ INFORMASI VENDOR                        │
│ ─────────────────────────────────────   │
│ Nama Vendor: ...                        │
│ Bank: ...                               │
│ Rekening: ...                           │
├─────────────────────────────────────────┤
│ [BLUE HIGHLIGHT BOX]                    │
│ NOMINAL                                 │
│ Rp 50.000.000                           │
├─────────────────────────────────────────┤
│ STATUS                                  │
│ ─────────────────────────────────────   │
│ Status Approval: Approved               │
│ Disetujui Oleh: Manager                 │
│ Status Transfer: Sudah Transfer         │
├─────────────────────────────────────────┤
│ KETERANGAN                              │
│ ─────────────────────────────────────   │
│ Lorem ipsum dolor sit amet...           │
├─────────────────────────────────────────┤
│ [FOOTER]                                │
│ ─────────────────────────────────────   │
│ Dokumen ini digenerate...  Halaman 1/1  │
└─────────────────────────────────────────┘
```

### 7. Browser Compatibility

**Print:**
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support

**PDF Export:**
- All modern browsers: ✅ jsPDF library support

### 8. File Naming Convention

**PDF Files:**
- Format: `Payment-Request-{nomor_pr}.pdf`
- Example: `Payment-Request-PR-0001.pdf`
- Descriptive dan mudah dicari

### 9. Best Practices Applied

1. **Separation of Concerns**: Print styles terpisah dari screen styles
2. **Progressive Enhancement**: Halaman tetap functional tanpa print/PDF
3. **Accessibility**: Semantic HTML dan proper heading hierarchy
4. **Performance**: Lazy loading untuk preview modal
5. **User Experience**: Clear visual feedback dan loading states

### 10. Future Enhancements

- [ ] Add watermark untuk draft documents
- [ ] Multiple page support untuk data panjang
- [ ] Custom paper size selection
- [ ] Email PDF directly from app
- [ ] Batch export multiple PRs
- [ ] QR code untuk verification
- [ ] Digital signature support
