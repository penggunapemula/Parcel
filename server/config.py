"""Konfigurasi dan konstanta aplikasi Parcelku."""
import os
import secrets

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_env(path):
    """Baca file .env sederhana (KEY=nilai) tanpa library tambahan."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env(os.path.join(BASE, ".env"))


def _secret_key():
    """Pakai SECRET_KEY dari lingkungan; bila kosong, buat acak sekali lalu simpan ke berkas."""
    env = os.getenv("SECRET_KEY")
    if env:
        return env
    path = os.path.join(BASE, ".secret_key")
    if os.path.exists(path):
        return open(path, encoding="utf-8").read().strip()
    key = secrets.token_hex(32)
    with open(path, "w", encoding="utf-8") as f:
        f.write(key)
    return key

FRONTEND = os.path.join(BASE, "frontend")
UPLOADS = os.path.join(BASE, "uploads")
DB_PATH = os.getenv("DB_PATH", os.path.join(BASE, "parcelku.db"))

# Mesin database: "mysql" (XAMPP / MariaDB) atau "sqlite" (satu berkas, tanpa server)
DB_ENGINE = os.getenv("DB_ENGINE", "sqlite").strip().lower()
MYSQL = dict(
    host=os.getenv("MYSQL_HOST", "127.0.0.1"),
    port=int(os.getenv("MYSQL_PORT", "3306")),
    user=os.getenv("MYSQL_USER", "root"),          # bawaan XAMPP: root
    password=os.getenv("MYSQL_PASSWORD", ""),      # bawaan XAMPP: kosong
    database=os.getenv("MYSQL_DATABASE", "parcelku"),
)

SECRET_KEY = _secret_key()
PRODUCTION = os.getenv("PRODUCTION", "0") == "1"  # 1 = cookie hanya lewat HTTPS
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_CHAT = os.getenv("TELEGRAM_CHAT_ID", "")

PAKET = (15000, 25000, 35000)
BUNGKUS = ("pink", "emas", "hijau", "putih")
WADAH = ("nampan", "bulat")  # nampan hijau emas / keranjang bulat
KARTU_GAYA = ("elegan", "tulisan", "modern")  # gaya huruf kartu ucapan
KARTU_TEMA = ("krem", "hijau", "putih")  # warna kartu ucapan
FLOW = {
    "ambil": ["baru", "diproses", "dikemas", "siap", "selesai"],
    "antar": ["baru", "diproses", "dikemas", "diantar", "selesai"],
    "cod":   ["baru", "diproses", "dikemas", "diantar", "selesai"],
}

MAX_UPLOAD = 6 * 1024 * 1024
IMAGE_MAGIC = ((b"\xff\xd8\xff", "jpg"), (b"\x89PNG\r\n\x1a\n", "png"))

DEFAULT_SETTINGS = {
    "toko_nama": "Parcelku",
    "tagline": "Parcel seserahan custom untuk tamu undangan",
    "wa": "6281234567890",
    "bank": "BCA",
    "rek_no": "1234567890",
    "rek_an": "Nama Pemilik Toko",
    "jam": "Setiap hari 08.00 - 20.00",
    "alamat_toko": "Alamat toko Anda",
    # Ongkir: tarif dasar + tarif per km di atas batas gratis km. Koordinat toko dipakai untuk menghitung jarak.
    "toko_lat": "", "toko_lng": "",
    "ongkir_dasar": "10000", "ongkir_km_gratis": "3", "ongkir_per_km": "2000", "ongkir_gratis_min": "300000",
}

SEED_ITEMS = [
    ("Sabun Cuci Piring", "🧼", "Kebersihan", 3000), ("Deterjen Sachet", "🧺", "Kebersihan", 2500),
    ("Tisu Saku", "🧻", "Kebersihan", 3000), ("Air Mineral", "💧", "Minuman", 3000),
    ("Teh Celup", "🍵", "Minuman", 3500), ("Kopi Sachet", "☕", "Minuman", 3000),
    ("Minuman Jeruk", "🍊", "Minuman", 2500), ("Sirup Botol Kecil", "🍹", "Minuman", 8000),
    ("Biskuit", "🍪", "Kue", 4000), ("Wafer", "🧇", "Kue", 3500),
    ("Nastar", "🍍", "Kue", 6000), ("Kastengel", "🧀", "Kue", 6000),
    ("Keripik Singkong", "🥔", "Kue", 4000), ("Mie Instan", "🍜", "Sembako", 3500),
    ("Gula 1/2 kg", "🍬", "Sembako", 7000), ("Minyak Goreng 250ml", "🛢️", "Sembako", 6000),
]
