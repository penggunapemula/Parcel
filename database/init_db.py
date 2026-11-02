"""Buat database Parcelku dari awal: skema + data awal (+ contoh pesanan bila --demo).

Pemakaian (dari folder proyek):
    python database/init_db.py                 # buat parcelku.db bila belum ada
    python database/init_db.py --demo          # plus contoh pelanggan, pesanan, ulasan
    python database/init_db.py --reset --demo  # HAPUS database lama, buat ulang
    python database/init_db.py --db data/toko.db
"""
import argparse
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return f.read()


def demo_data(conn):
    """Isi beberapa pelanggan & pesanan contoh agar laporan dan struk bisa dicoba."""
    if conn.execute("SELECT 1 FROM orders").fetchone():
        print("Pesanan sudah ada, data demo dilewati.")
        return

    from werkzeug.security import generate_password_hash
    sandi = generate_password_hash("demo12345")  # semua akun demo: kata sandi demo12345
    users = [("Ayu Pratiwi", "ayu@demo.id", "6281234500001"), ("Komang Wirawan", "komang@demo.id", "6281234500002"),
             ("Made Sari", "made@demo.id", "6281234500003")]
    conn.executemany("INSERT OR IGNORE INTO users(nama, email, hp, password_hash) VALUES(?,?,?,?)",
                     [(n, e, h, sandi) for n, e, h in users])
    uid = {hp: i for i, hp in conn.execute("SELECT id, hp FROM users")}
    items = {r[1]: r for r in conn.execute("SELECT id, nama, ikon, harga FROM items")}
    conn.execute("INSERT INTO addresses(user_id,label,penerima,hp,alamat,utama) VALUES(?,?,?,?,?,1)",
                 (uid["6281234500001"], "Rumah", "Ayu Pratiwi", "6281234500001", "Jl. Raya Sesetan No. 12, Denpasar"))

    def order(hp, paket, qty, nama_items, metode, pay, paid, status, tgl, **extra):
        rows = [items[n] for n in nama_items]
        snap = json.dumps([{"nama": r[1], "ikon": r[2], "foto": None} for r in rows])
        subtotal = paket * qty
        ongkir = 0 if metode == "ambil" else 10000
        total = subtotal + ongkir
        cur = conn.execute(
            """INSERT INTO orders(user_id,paket,qty,items,subtotal,ongkir,total,pay_type,paid,metode,alamat,
                                  tanggal_acara,wadah,bungkus,kartu,kartu_untuk,kartu_dari,kartu_gaya,kartu_tema,status,metode_bayar)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (uid[hp], paket, qty, snap, subtotal, ongkir, total, pay, 0, metode,
             extra.get("alamat", ""), tgl, extra.get("wadah", "nampan"), extra.get("bungkus", "pink"),
             extra.get("kartu", ""), extra.get("untuk", ""), extra.get("dari", ""),
             extra.get("gaya", "elegan"), extra.get("tema", "krem"), "baru", extra.get("bayar", "transfer")))
        oid = cur.lastrowid
        conn.executemany("INSERT INTO order_items(order_id,item_id,nama,ikon,harga) VALUES(?,?,?,?,?)",
                         [(oid, r[0], r[1], r[2], r[3]) for r in rows])
        # Mengubah paid & status memicu trigger -> payments & status_log terisi otomatis.
        if paid:
            conn.execute("UPDATE orders SET paid=? WHERE id=?", (min(paid, total), oid))
        for st in ("diproses", "dikemas", "siap", "diantar", "selesai"):
            if status == "baru":
                break
            conn.execute("UPDATE orders SET status=? WHERE id=?", (st, oid))
            if st == status:
                break
        return oid

    o1 = order("6281234500001", 25000, 50, ["Sabun Cuci Piring", "Kopi Sachet", "Wafer", "Nastar", "Teh Celup"],
               "antar", "dp", 630000, "dikemas", "2026-11-20", alamat="Jl. Raya Sesetan No. 12, Denpasar",
               wadah="bulat", bungkus="emas", bayar="qris", kartu="Matur suksma sudah hadir di hari bahagia kami",
               untuk="Bapak/Ibu Tamu Undangan", dari="Ayu & Wayan", gaya="tulisan", tema="krem")
    o2 = order("6281234500002", 15000, 100, ["Air Mineral", "Biskuit", "Tisu Saku"],
               "ambil", "lunas", 1500000, "selesai", "2026-10-25", wadah="nampan", bungkus="hijau",
               kartu="Om Swastyastu, terima kasih atas doa restunya", untuk="Keluarga Besar", dari="Komang",
               gaya="elegan", tema="hijau")
    order("6281234500003", 35000, 20, ["Nastar", "Kastengel", "Sirup Botol Kecil", "Kopi Sachet", "Gula 1/2 kg"],
          "cod", "cod", 0, "baru", "2026-11-30", alamat="Jl. Teuku Umar No. 5, Denpasar",
          wadah="bulat", bungkus="putih", bayar="cash", kartu="Semoga bahagia selalu", untuk="Rekan Kerja", dari="Made",
          gaya="modern", tema="putih")
    conn.execute("INSERT INTO reviews(order_id,rating,teks) VALUES(?,?,?)", (o2, 5, "Parcelnya rapi dan cantik, tamu suka!"))
    conn.execute("INSERT INTO chat(order_id,sender,text) VALUES(?,?,?)", (o1, "user", "Kak, pitanya bisa diganti emas ya?"))
    conn.execute("INSERT INTO chat(order_id,sender,text) VALUES(?,?,?)", (o1, "admin", "Bisa kak, sudah kami ubah 👍"))
    print("Data demo: 3 pelanggan (kata sandi: demo12345), 3 pesanan, 1 ulasan, 2 chat.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default=os.getenv("DB_PATH", os.path.join(ROOT, "parcelku.db")))
    ap.add_argument("--reset", action="store_true", help="hapus database lama lebih dulu")
    ap.add_argument("--demo", action="store_true", help="isi contoh pelanggan & pesanan")
    args = ap.parse_args()

    if args.reset and os.path.exists(args.db):
        os.remove(args.db)
        print("Database lama dihapus.")
    os.makedirs(os.path.dirname(os.path.abspath(args.db)), exist_ok=True)

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(read("schema.sql").replace("-- @@AFTER_MIGRATION@@", ""))
    conn.executescript(read("seed.sql"))
    if args.demo:
        demo_data(conn)
    conn.commit()

    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY 1")]
    print(f"Database siap: {args.db}")
    for t in tables:
        print(f"  {t:<12} {conn.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]} baris")
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
