# Finance Prasasti Group - Dashboard

Dashboard keuangan modern dan elegant untuk Finance Prasasti Group, dibangun dengan React dan Tailwind CSS.

## 🚀 Fitur

- **Halaman Login** - Autentikasi dengan design modern dan responsif
- **Protected Routes** - Keamanan akses halaman dengan authentication
- **Dashboard Menu Cards** - 4 kartu menu utama dengan navigasi
- **Payment Request** - Kelola permintaan pembayaran dengan auto generate nomor PR
- **Kasbon** - Manajemen kasbon karyawan
- **Klaim** - Sistem klaim reimbursement
- **Penyelesaian** - Pertanggungjawaban kasbon dan payment request
- **Master Vendor** - Database vendor dan supplier
- **Responsive Design** - Tampilan optimal di semua perangkat
- **Modern UI/UX** - Design elegant dengan animasi smooth

## 📊 Modul Aplikasi

1. **Dashboard** - 4 menu cards (Payment Request, Kasbon, Klaim, Penyelesaian)
2. **Payment Request** - Form dengan auto generate nomor PR (PR-0001, PR-0002, dst), nomor QL input, tanggal otomatis, dropdown tipe perusahaan, nominal format ribuan
3. **Kasbon** - Pengajuan dan tracking kasbon karyawan
4. **Klaim** - Pengajuan klaim dengan kategori jenis
5. **Penyelesaian** - Pertanggungjawaban dengan breakdown jumlah
6. **Vendor** - Master data vendor dan supplier

## 🛠️ Teknologi

### Frontend
- **React 18** - Library UI
- **Vite** - Build tool modern dan cepat
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Library charting untuk React
- **Lucide React** - Icon library modern
- **Supabase** - Backend as a Service (Database & Auth)

### Backend & Storage
- **Supabase** - Database PostgreSQL dan Authentication
- **Cloudflare R2** - Object storage untuk file attachments
- **Cloudflare Workers** - Serverless function untuk handle file upload ke R2

### Infrastructure
- **Supabase** - PostgreSQL database
- **Cloudflare R2** - File storage dengan struktur folder terorganisir

## 📦 Instalasi

### Quick Start

Untuk setup cepat, lihat [QUICK_START.md](./QUICK_START.md)

### Setup Lengkap

Untuk panduan setup lengkap, lihat [SETUP.md](./SETUP.md)

### Setup Cepat (Windows)

```bash
# Setup otomatis
setup-all.bat

# Atau manual
npm install
copy .env.example .env
# Edit .env dengan credential Supabase dan R2 Worker URL
```

### Setup Cepat (Linux/Mac)

```bash
chmod +x setup-frontend.sh
./setup-frontend.sh
```

### Menjalankan Aplikasi

1. **Frontend**:
```bash
npm run dev
```
Frontend akan berjalan di `http://localhost:3000`

2. **Login ke aplikasi**:
- Buka `http://localhost:3000`
- Login dengan user yang sudah dibuat di Supabase
- Sistem autentikasi menggunakan Supabase

**Catatan**: 
- Backend menggunakan Supabase (database & auth)
- File upload menggunakan Cloudflare Worker (tidak perlu server terpisah)

## 🔐 Fitur Autentikasi

### Halaman Login
- ✨ Design modern dengan gradient background
- 📝 Form validation
- 👁️ Show/hide password toggle
- ✅ Remember me checkbox
- 🔗 Social login buttons (Google & Facebook UI)
- ⏳ Loading state animation
- ⚠️ Error handling dengan alert message

### Protected Routes
- 🔒 Semua halaman dashboard dilindungi dengan autentikasi
- 🔄 Redirect otomatis ke `/login` jika belum authenticated
- 💾 Session management dengan Supabase Auth
- ⚡ Loading screen saat checking authentication

### User Management
- 👤 Display username di header
- 📋 User dropdown menu dengan opsi:
  - Profil Saya
  - Pengaturan
  - **Logout** (hapus session dan redirect ke login)

### Role-Based Access
- **Administrator** - Full access
- **Team Finance** - Finance operations
- **BOD** - Board of Directors
- **Manager** - Management access
- **Staff** - Staff access
- **Guest** - Limited access (manual input nama karyawan)

## 🏗️ Build untuk Production

```bash
npm run build
```

File hasil build akan ada di folder `dist/`.

## 📱 Preview

```bash
npm run preview
```

## 🎨 Kustomisasi

### Warna
Edit file `tailwind.config.js` untuk mengubah tema warna:
```javascript
colors: {
  primary: { ... },
  secondary: { ... }
}
```

### Data
Edit komponen di folder `src/components/` untuk mengubah data dummy dengan data real dari API.

## 📄 Struktur Project

```
finance-prasasti-dashboard/
├── cloudflare-worker/          # Cloudflare Worker untuk R2 upload
│   ├── r2-upload-simple.js     # Worker dengan R2 bindings (recommended)
│   ├── r2-upload-proxy.js      # Worker dengan S3 API (alternatif)
│   ├── wrangler.toml           # Worker configuration
│   └── README.md               # Dokumentasi Worker
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx       # Menu cards utama
│   │   ├── Header.jsx          # Header dengan search & notifikasi
│   │   ├── Sidebar.jsx         # Navigasi sidebar
│   │   └── FilePreview.jsx     # File preview component
│   ├── pages/
│   │   ├── PaymentRequest.jsx  # Halaman Payment Request
│   │   ├── Kasbon.jsx          # Halaman Kasbon
│   │   ├── Klaim.jsx           # Halaman Klaim
│   │   ├── Penyelesaian.jsx    # Halaman Penyelesaian
│   │   └── Vendor.jsx          # Master Vendor
│   ├── context/
│   │   ├── AuthContext.jsx     # Authentication context
│   │   └── VendorContext.jsx   # Vendor context
│   ├── lib/
│   │   └── supabase.js         # Supabase client
│   ├── services/
│   │   └── api.js              # API service
│   ├── App.jsx                 # Router configuration
│   ├── main.jsx
│   └── index.css
├── supabase/
│   └── schema.sql              # Database schema
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── .env.example                # Frontend env template
├── SETUP.md                    # Panduan setup lengkap
├── QUICK_START.md              # Quick start guide
└── R2_FOLDER_STRUCTURE.md      # Dokumentasi struktur R2
```

## ✨ Fitur Payment Request

### Auto Generate & Format
- **Nomor PR**: Auto generate (PR-0001, PR-0002, dst)
- **Nomor QL**: Input manual angka
- **Tanggal**: Otomatis hari ini
- **Tipe**: Dropdown pilihan (Prasasti Selaras, Mutiari Garden, Wood and Steel)
- **Nama Karyawan**: Auto dari user yang login
- **Vendor**: Dropdown dari database vendor + opsi tambah vendor baru
- **Nominal**: Format otomatis dengan pemisah ribuan (100.000 bukan 100000)

### Vendor Integration
- 📋 **Dropdown Vendor**: Pilih vendor dari database Supabase
- ➕ **Tambah Vendor**: Tombol untuk menambah vendor baru langsung dari form PR
- 🔄 **Auto Update**: Vendor baru langsung tersedia di dropdown setelah ditambahkan
- 💾 **Shared Database**: Data vendor tersinkronisasi dengan Supabase
- ✅ **Validasi Nomor Rekening**: Mencegah duplikasi nomor rekening vendor

### File Upload & Storage
- 📎 **Upload Lampiran**: Upload file (PDF, gambar, dll) ke Cloudflare R2
- 📁 **Struktur Folder Terorganisir**: File disimpan dengan struktur `{document-type}/{year}/{month}/{document-id}/`
- 👁️ **Preview File**: Preview file langsung di browser tanpa download
- 🔗 **Public URL**: File dapat diakses langsung via URL publik
- 📊 **Organized Storage**: File terorganisir berdasarkan jenis dokumen, waktu, dan ID dokumen

### Status Tracking
- **Status Approval**: Pending, Approved, Rejected
- **Disetujui Oleh**: Nama approver
- **Status Transfer**: Belum Transfer, Sudah Transfer, Tidak Transfer

### Aksi
- **Detail**: Modal popup dengan informasi lengkap PR

## 🔧 Development

- Edit komponen React di folder `src/components/`
- Styling menggunakan Tailwind CSS classes
- Hot module replacement aktif saat development

## 📝 Lisensi

Private - Finance Prasasti Group

---

Dibuat dengan ❤️ untuk Finance Prasasti Group

