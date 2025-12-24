# Quick Setup: Wasabi Bucket Policy untuk Public Read

## 🚀 5 Menit Setup

### Step 1: Login Wasabi Console
https://console.wasabi.com

### Step 2: Pilih Bucket
Klik bucket Anda (misalnya: `finance-prasasti`)

### Step 3: Edit Bucket Policy
1. Klik tab **"Access Control"**
2. Scroll ke **"Bucket Policy"**
3. Klik **"Edit"**

### Step 4: Paste Policy
Copy-paste ini (ganti `finance-v3` dengan nama bucket Anda - lihat ARN di atas editor):

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

**⚠️ PENTING**: Pastikan nama bucket di `Resource` sama dengan ARN bucket yang ditampilkan di atas editor!

### Step 5: Save
Klik **"Save"** → Done! ✅

## 🧪 Test

Upload file, lalu akses URL langsung di browser:
```
https://finance-v3.s3.ap-southeast-1.wasabisys.com/path/to/file.pdf
```
(atau sesuai dengan region bucket Anda)

Harus bisa diakses!

## 📖 Detail Lengkap

Lihat `WASABI_BUCKET_POLICY_SETUP.md` untuk:
- Penjelasan policy
- Setup CORS
- Troubleshooting
- Best practices

