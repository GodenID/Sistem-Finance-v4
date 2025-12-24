# Setup Bucket Policy untuk Public Read di Wasabi

## Step-by-Step Guide

### Step 1: Login ke Wasabi Console

1. Kunjungi https://console.wasabi.com
2. Login dengan akun Wasabi Anda

### Step 2: Pilih Bucket

1. Setelah login, Anda akan melihat daftar buckets
2. Klik pada bucket yang ingin dikonfigurasi (misalnya: `finance-prasasti`)

### Step 3: Buka Access Control Settings

1. Di halaman bucket, klik tab **"Access Control"** atau **"Policies"**
2. Scroll ke bagian **"Bucket Policy"**

### Step 4: Edit Bucket Policy

1. Klik tombol **"Edit"** atau **"Edit Bucket Policy"**
2. Akan muncul text editor untuk bucket policy

### Step 5: Copy-Paste Policy

Copy-paste policy berikut ke text editor (ganti `YOUR_BUCKET_NAME` dengan nama bucket Anda):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

**Contoh untuk bucket `finance-v3` (nama bucket Anda):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::finance-v3/*"
    }
  ]
}
```

**PENTING**: Ganti `finance-v3` dengan nama bucket Anda yang sebenarnya! (Lihat ARN di atas editor)

### Step 6: Save Policy

1. Klik **"Save"** atau **"Update Policy"**
2. Tunggu beberapa detik hingga policy ter-apply

### Step 7: Verifikasi

1. Upload file test ke bucket
2. Copy URL file (format: `https://finance-prasasti.s3.ap-southeast-1.wasabisys.com/path/to/file.pdf`)
3. Buka URL di browser (tanpa login) → Harus bisa diakses

## Policy Penjelasan

### Policy Components:

- **Version**: `2012-10-17` - Format policy version (AWS S3 standard)
- **Statement**: Array of policy statements
  - **Sid**: Statement ID (identifier untuk policy statement)
  - **Effect**: `Allow` - Allow action
  - **Principal**: `*` - Semua user (public access)
  - **Action**: `s3:GetObject` - Hanya allow read/download, tidak allow write/delete
  - **Resource**: `arn:aws:s3:::bucket-name/*` - Semua file di bucket

### Keamanan:

✅ **Aman**: Policy ini hanya allow **read** (download), tidak allow:
- ❌ Upload/Write (`s3:PutObject`)
- ❌ Delete (`s3:DeleteObject`)
- ❌ List bucket (`s3:ListBucket`)

## Alternative: Policy dengan CORS (Jika Perlu)

Jika Anda perlu CORS untuk akses dari browser, tambahkan statement CORS:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::finance-prasasti/*"
    },
    {
      "Sid": "PublicReadGetObjectHead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::finance-prasasti/*"
    }
  ]
}
```

## Setup CORS di Wasabi (Optional)

Jika file tidak bisa diakses dari browser karena CORS:

1. Di Wasabi Console, pilih bucket
2. Klik tab **"CORS"** atau **"Cross-Origin Resource Sharing"**
3. Klik **"Edit CORS Configuration"**
4. Copy-paste konfigurasi berikut:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type", "Last-Modified"],
    "MaxAgeSeconds": 3600
  }
]
```

5. Klik **"Save"**

## Troubleshooting

### Error: "Access Denied"
- ✅ Pastikan bucket policy sudah di-save
- ✅ Pastikan nama bucket di policy benar
- ✅ Tunggu beberapa menit untuk policy terpropagasi

### Error: "CORS policy"
- ✅ Setup CORS configuration (lihat section di atas)
- ✅ Pastikan `AllowedOrigins` includes domain frontend Anda

### File tidak bisa diakses
- ✅ Pastikan bucket policy sudah allow `s3:GetObject`
- ✅ Pastikan URL file benar
- ✅ Test akses file langsung di browser

## Verifikasi Policy

### Test 1: Akses File Langsung
```
https://finance-prasasti.s3.ap-southeast-1.wasabisys.com/payment-requests/2025/11/pr-0001/file.pdf
```

Harus bisa diakses tanpa error.

### Test 2: Cek Policy di Console
1. Buka Wasabi Console → Bucket → Access Control
2. Cek bucket policy → Harus ada policy yang allow `s3:GetObject`

### Test 3: Test dari Frontend
1. Upload file dari aplikasi
2. Klik "Lihat" → Harus buka file di tab baru
3. Klik "Download" → Harus bisa download

## Catatan Penting

1. **Security**: Policy ini membuat semua file di bucket bisa diakses publik. Pastikan tidak ada data sensitif.

2. **Best Practice**: Untuk production, lebih baik:
   - Gunakan signed URLs (presigned URLs) untuk file sensitif
   - Atau restrict access berdasarkan IP/origin

3. **Cost**: Wasabi tidak charge untuk egress (download), jadi public read tidak ada biaya tambahan.

4. **Performance**: Public read langsung dari Wasabi biasanya lebih cepat daripada melalui Worker proxy.

## Referensi

- Wasabi Bucket Policy Docs: https://wasabi.com/wp-content/themes/wasabi/docs/API_Guide/index.html#t=topics/Bucket_Policy.htm
- AWS S3 Policy Examples: https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-bucket-policies.html

