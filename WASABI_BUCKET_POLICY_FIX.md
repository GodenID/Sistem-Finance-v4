# Fix: Bucket Policy Error - Invalid Resource

## Masalah

Error: **"Policy has invalid resource: `arn:aws:s3:::finance-prasasti/*`"**

Ini terjadi karena nama bucket di policy tidak sesuai dengan nama bucket yang sebenarnya.

## Solusi

### Step 1: Cek Nama Bucket yang Benar

Di Wasabi Console, lihat **"Bucket Policy Editor ARN"** di atas editor:
```
Bucket Policy Editor ARN: arn:aws:s3:::finance-v3
```

Nama bucket Anda adalah: **`finance-v3`** (bukan `finance-prasasti`)

### Step 2: Gunakan Nama Bucket yang Benar

Copy-paste policy ini (menggunakan nama bucket yang benar):

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

**Perhatikan**: `finance-v3` harus sama dengan nama bucket yang ada di ARN!

### Step 3: Handle Warning "Public Access"

Jika muncul warning: **"The following policy items are not available to you: Public Access"**

Ini berarti Anda perlu enable public access terlebih dahulu:

1. Di Wasabi Console, pilih bucket
2. Klik tab **"Settings"** atau **"Access Control"**
3. Cari **"Public Access"** atau **"Block Public Access"**
4. **Disable** atau **Uncheck** semua block public access settings:
   - ❌ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Block public and cross-account access to buckets and objects through any public bucket or access point policies
5. Klik **"Save"**
6. Konfirmasi perubahan

### Step 4: Save Policy

1. Paste policy dengan nama bucket yang benar
2. Klik **"Save"** atau **"Update Policy"**
3. Error harus hilang

## Cara Cek Nama Bucket

1. Di Wasabi Console, lihat daftar buckets
2. Nama bucket terlihat jelas di list
3. Atau lihat ARN di bucket policy editor: `arn:aws:s3:::NAMA_BUCKET`

## Template Policy

Gunakan template ini dan ganti `NAMA_BUCKET_ANDA`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::NAMA_BUCKET_ANDA/*"
    }
  ]
}
```

## Troubleshooting

### Error masih muncul setelah fix
- ✅ Pastikan nama bucket di `Resource` sama persis dengan ARN
- ✅ Pastikan format ARN benar: `arn:aws:s3:::bucket-name/*`
- ✅ Pastikan tidak ada typo atau spasi

### Warning "Public Access" masih muncul
- ✅ Enable public access dulu (lihat Step 3 di atas)
- ✅ Tunggu beberapa menit untuk perubahan ter-apply
- ✅ Refresh halaman

### Policy tidak bisa di-save
- ✅ Cek format JSON (harus valid JSON)
- ✅ Pastikan semua tanda kutip benar
- ✅ Pastikan tidak ada karakter aneh

## Quick Fix untuk Bucket `finance-v3`

Copy-paste langsung ini:

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

Klik **Save** → Done! ✅

