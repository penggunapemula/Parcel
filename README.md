# Parcelku - Website UMKM Parcel Seserahan

Website pemesanan parcel seserahan (paket Rp15.000 / Rp25.000 / Rp35.000) dengan isi custom, foto, COD berlokasi,
pelacakan status, chat admin-pelanggan, dan notifikasi order ke HP lewat Telegram.

## Struktur
```
parcelku/
├── app.py                  # titik masuk (python app.py)
├── requirements.txt
├── server/                 # BACKEND (Flask + SQLite)
│   ├── __init__.py         # pabrik aplikasi, registrasi rute
│   ├── config.py           # konfigurasi & konstanta (paket, alur status, data awal)
│   ├── db.py               # koneksi, skema, migrasi, seed
│   ├── utils.py            # otorisasi, notifikasi Telegram, upload gambar aman
│   ├── auth.py             # login pelanggan & admin
│   ├── catalog.py          # barang, foto barang, galeri, pengaturan toko
│   ├── pricing.py          # hitung subtotal, ongkir (jarak), voucher
│   ├── vouchers.py         # kelola voucher + estimasi harga /api/quote
│   └── orders.py           # pesanan, chat, bukti bayar, ulasan, ekspor CSV
├── frontend/               # FRONTEND (HTML / CSS / JS terpisah per halaman)
│   ├── beranda.html  masuk.html  pesan.html  pesanan.html  admin.html
│   ├── img/  foto contoh parcel jadi
│   ├── css/  base.css shell.css components.css parcel-view.css + <halaman>.css
│   └── js/   core.js shell.js chat.js parcel-view.js + <halaman>.js
└── uploads/                # foto barang, galeri, bukti bayar (otomatis terisi)
```

## Menjalankan
```
pip install -r requirements.txt
python app.py        # buka http://localhost:5000
```
Windows: klik dua kali `MULAI-WINDOWS.bat`. Mac/Linux: `./MULAI-MAC-LINUX.sh`.
Admin: halaman Masuk, tab Admin (kata sandi bawaan `admin123`, ganti lewat `ADMIN_PASSWORD`).

## Notifikasi order ke HP (Telegram, gratis)
1. Telegram: chat **@BotFather**, kirim `/newbot`, salin **token**.
2. Kirim pesan apa saja ke bot barumu, buka `https://api.telegram.org/bot<TOKEN>/getUpdates`, salin angka `"chat":{"id":...}`.
3. Jalankan dengan variabel (lihat `.env.example`):
```
export TELEGRAM_BOT_TOKEN="isi_token"
export TELEGRAM_CHAT_ID="isi_chat_id"
export ADMIN_PASSWORD="kata_sandi_kuat"
export SECRET_KEY="teks_acak_panjang"
python app.py
```
Pesanan baru, chat pelanggan, bukti bayar, dan ulasan langsung masuk ke HP.

## Fitur
**Pelanggan:** demo susun parcel, foto barang, isi otomatis, pencarian & kategori, preview kotak parcel, warna pita,
kartu ucapan, tanggal dibutuhkan, ambil/antar/COD (GPS), DP/lunas, unggah bukti bayar, pelacak status + notifikasi
perubahan, chat admin, struk cetak, pesan ulang, ulasan bintang, tema gelap/terang, bisa dipasang sebagai aplikasi (PWA).

**Admin:** daftar & detail pesanan (urut tanggal acara, penanda H-n, chat belum dibaca), status 1 klik, catat DP/lunas,
lihat bukti bayar, cetak label, ringkasan uang masuk 7 hari, daftar belanja bahan, ekspor CSV, kelola katalog
(harga, foto, sembunyikan), galeri foto parcel, pengaturan toko (nama, WhatsApp, rekening, jam, alamat).

**Baru (v4):** voucher (diskon persen, potongan nominal, gratis ongkir; min. belanja, maks. potongan, kuota, masa berlaku),
ongkir otomatis (tarif dasar + tarif per km di luar batas gratis, dihitung dari lokasi toko ke lokasi pelanggan, bisa gratis
jika belanja mencapai batas), rincian harga di pesanan/struk/label, tampilan **iOS glass** (kartu kaca, tab bar bawah di HP,
segmented control, switch, bottom sheet, animasi pegas, kilau mengikuti kursor, barang "terbang" ke kotak parcel, getaran haptic).

**Atur ongkir:** Dashboard Admin > Pengaturan. Isi koordinat toko (tombol "Pakai lokasiku sebagai lokasi toko"), ongkir dasar,
gratis sampai berapa km, tambahan per km, dan batas belanja gratis ongkir. Tanpa koordinat toko, ongkir memakai tarif dasar.

## Catatan produksi
Pasang di hosting HTTPS (VPS / PythonAnywhere) agar GPS dan instalasi PWA berfungsi. Foto dikecilkan otomatis di browser
sebelum diunggah; server memvalidasi tipe file (JPG/PNG/WEBP) dan ukuran (maks 6 MB). Cadangkan `parcelku.db` dan folder `uploads/`.

## Desain v5 (putih gradasi hijau)
Palet dibatasi 5 warna di `frontend/css/base.css`: putih, hijau muda, hijau, hijau tua (teks), emas (aksen).
Tema gelap dihapus agar tampilan konsisten.

**Wadah parcel live** (`js/parcel-view.js` + `css/parcel-view.css`): barang yang dicentang langsung muncul di
wadah (nampan hijau emas atau keranjang bulat). Saat budget penuh, parcel otomatis "dibungkus" dengan plastik,
bunga kamboja, pita sesuai pilihan, dan kartu ucapan. Pilihan wadah tersimpan di kolom `orders.wadah`
(migrasi otomatis saat aplikasi dijalankan).

**Foto contoh** ada di `frontend/img/`. Ganti file dengan nama yang sama untuk memperbarui galeri.

## Versi terbaru
- **Kartu ucapan custom**: isi *Untuk*, pesan, dan *Dari*, pilih 3 gaya tulisan (Elegan, Tulisan tangan, Modern) dan 3 warna
  kartu, dengan pratinjau langsung (`js/kartu.js`, `css/kartu.css`). Tampil di pesanan, admin, dan struk.
- **Struk baru** (`struk.html`): barcode Code 39 yang bisa dipindai, stempel status bayar, rincian isi, riwayat
  pembayaran, linimasa pesanan, kartu ucapan, dan cara bayar. Bisa dicetak / disimpan PDF, ukuran lebar atau 80 mm.
- **Database lengkap** di folder `database/` (skema, trigger, view laporan, data awal, ERD). Lihat `database/README.md`.
- **Font**: satu keluarga Plus Jakarta Sans untuk seluruh situs; font hias (Cormorant Garamond, Dancing Script)
  hanya dipakai di kartu ucapan.

## Akun, alamat, dan metode pembayaran (terbaru)
- **Daftar & masuk** dengan email, kata sandi, dan nomor telepon (kata sandi disimpan sebagai hash). Pelanggan lama
  yang dulu masuk dengan nomor WhatsApp cukup **Daftar** memakai nomor yang sama agar pesanan lamanya ikut terhubung.
- **Akun Saya** (`akun.html`): ubah profil, ganti kata sandi, dan kelola **banyak alamat** (Rumah, Kantor, dll.).
  Saat memesan, pelanggan tinggal memilih salah satu alamat tersimpan.
- **Metode pembayaran**: QRIS, transfer bank, e-wallet, atau tunai. Admin mengelolanya di **Dashboard > Pembayaran**
  (tambah, ubah, aktif/nonaktif, unggah gambar QRIS). Tunai dibayar saat parcel diterima; metode lain bisa DP 50% atau lunas.
- **Database XAMPP (MySQL)**: lihat `database/README.md`.

## Deploy ke Vercel
Vercel menjalankan aplikasi sebagai fungsi serverless: folder proyek **tidak bisa ditulis** dan tidak ada penyimpanan
tetap. Karena itu aplikasi ini sudah disiapkan (`vercel.json`, `api/index.py`) dengan syarat berikut:

1. **Pakai MySQL online**, bukan XAMPP lokal (`127.0.0.1` tidak bisa dijangkau dari internet). Contoh layanan: TiDB Cloud,
   Aiven, Railway. Buat satu database kosong; tabel dibuat otomatis saat aplikasi pertama dibuka.
2. Di Vercel: **Settings > Environment Variables**, isi:

   | Variabel | Isi |
   |----------|-----|
   | `DB_ENGINE` | `mysql` |
   | `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | dari layanan database (atau cukup satu `MYSQL_URL`) |
   | `MYSQL_SSL` | `1` bila layanan database mewajibkan koneksi terenkripsi |
   | `ADMIN_PASSWORD` | kata sandi admin yang kuat |
   | `SECRET_KEY` | teks acak panjang (kunci sesi login) |
   | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | opsional, untuk notifikasi |

3. **Redeploy** setelah mengisi variabel (variabel baru hanya berlaku pada deploy berikutnya).
4. Foto unggahan (QRIS, bukti bayar, foto barang) otomatis disimpan **di database**, jadi tidak hilang saat deploy ulang.
   Foto dikecilkan di browser sebelum diunggah; batas ukuran permintaan Vercel sekitar 4,5 MB.

Bila database belum tersambung, situs menampilkan halaman penjelasan (bukan error 500) dan penyebab pastinya tercatat di
**Vercel > Logs** pada baris `[ERROR DATABASE]`.

## Jadwal, lacak pesanan, dan template (terbaru)
- **Kapasitas harian & minimal hari pesan**: atur di Dashboard > Pengaturan (`kapasitas_harian`, `min_hari_pesan`). Form pesan
  menampilkan sisa kuota per tanggal dan menolak jumlah yang melebihi sisa; server ikut memeriksa.
- **Lacak pesanan publik** (`lacak.html`): tanpa login, cukup kode pesanan + 4 digit akhir nomor telepon. Hanya status dan riwayat
  yang tampil (tanpa alamat, email, atau harga), dan percobaan salah dibatasi.
- **Template isi parcel**: Kebutuhan dapur, Manis & camilan, Bersih rumah, dan Serba ada, sekali klik di langkah "Pilih isi".
- **Kirim update WhatsApp** di detail pesanan admin: pesan status siap kirim ke pelanggan.
