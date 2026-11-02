"""Pindahkan data dari database lama (SQLite, parcelku.db) ke MySQL XAMPP.

Pemakaian (XAMPP MySQL sudah menyala, file .env sudah berisi DB_ENGINE=mysql):
    python database/sqlite_ke_mysql.py                 # memakai parcelku.db di folder proyek
    python database/sqlite_ke_mysql.py data/lama.db    # atau tentukan berkasnya

Aman dijalankan pada database MySQL yang masih kosong. Akun lama (yang dulu masuk dengan nomor
WhatsApp) ikut dipindahkan; pemiliknya bisa mengambil alih dengan "Daftar" memakai nomor yang sama.
"""
import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.environ["DB_ENGINE"] = "mysql"

from server import db  # noqa: E402

# Urutan penyalinan mengikuti relasi (induk dulu, anak kemudian).
TABLES = ["users", "addresses", "packages", "categories", "items", "vouchers", "payment_methods",
          "orders", "order_items", "payments", "status_log", "chat", "reviews", "gallery", "settings"]


def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "parcelku.db")
    if not os.path.exists(src_path):
        sys.exit(f"Berkas {src_path} tidak ditemukan.")

    db.init_db()  # pastikan database & tabel MySQL sudah ada
    src = sqlite3.connect(src_path)
    src.row_factory = sqlite3.Row
    dst = db.MySQLConn()
    dst.execute("SET FOREIGN_KEY_CHECKS=0")

    for table in TABLES:
        try:
            rows = src.execute(f"SELECT * FROM {table}").fetchall()
        except sqlite3.OperationalError:
            continue  # tabel belum ada di database lama
        if not rows:
            continue
        have = {r["Field"] for r in dst.execute(f"SHOW COLUMNS FROM {table}").fetchall()}
        cols = [c for c in rows[0].keys() if c in have]
        names = ",".join(f"`{c}`" for c in cols)
        marks = ",".join("?" * len(cols))
        dst.execute(f"DELETE FROM {table}")
        dst.executemany(f"INSERT INTO {table}({names}) VALUES({marks})", [tuple(r[c] for c in cols) for r in rows])
        print(f"  {table:<16} {len(rows)} baris")

    dst.execute("SET FOREIGN_KEY_CHECKS=1")
    dst.commit()
    dst.close()
    print("Selesai. Jalankan aplikasi dengan DB_ENGINE=mysql.")


if __name__ == "__main__":
    main()
