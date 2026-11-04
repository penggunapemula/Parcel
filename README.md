# Parcelku

Situs pemesanan parcel seserahan (Flask + MySQL, tampilan statis di folder `public/`).

## Jalan di komputer sendiri
1. Salin `.env.example` menjadi `.env`, isi pengaturannya (XAMPP: `DB_ENGINE=mysql`, host `127.0.0.1`).
2. Windows: klik `MULAI-WINDOWS.bat`. Mac/Linux: `./MULAI-MAC-LINUX.sh`.
3. Buka http://localhost:5000

## Deploy ke Vercel (WAJIB: database online)
Vercel tidak bisa menjangkau XAMPP/`127.0.0.1` di komputer Anda. Buat database MySQL online
(mis. TiDB Cloud Starter atau Aiven, gratis), lalu isi **Settings → Environment Variables** di Vercel:

| Nama | Isi |
|---|---|
| `DB_ENGINE` | `mysql` |
| `MYSQL_URL` | `mysql://USER:SANDI@HOST:4000/parcelku?ssl-mode=require` (atau isi `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`) |
| `MYSQL_SSL` | `1` |
| `ADMIN_PASSWORD` | kata sandi admin yang kuat (jangan `admin123`) |
| `SECRET_KEY` | teks acak panjang |

Lalu **Redeploy**. File `.env` tidak ikut di-deploy dan tidak dibaca di Vercel.
Cek status di `https://DOMAIN-ANDA/api/health` (harus `"status":"ok"`).
Tabel dibuat otomatis saat pertama kali tersambung.
