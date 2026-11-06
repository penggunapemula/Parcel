"""Koneksi database (SQLite atau MySQL/MariaDB bawaan XAMPP), skema, migrasi ringan, dan data awal.

Pilih mesin lewat berkas .env:
    DB_ENGINE=mysql    -> XAMPP / MariaDB (butuh paket pymysql)
    DB_ENGINE=sqlite   -> satu berkas parcelku.db (tanpa server)

Semua query di aplikasi ditulis dengan tanda tanya (?) sebagai placeholder. Untuk MySQL, `translate()`
mengubahnya otomatis ke gaya %s sehingga kode rute tidak perlu tahu mesin mana yang dipakai.
"""
import json
import os
import re
import sqlite3
from flask import g
from . import config

MYSQL = config.DB_ENGINE == "mysql"

SCHEMA_FILE = os.path.join(config.BASE, "database", "schema_mysql.sql" if MYSQL else "schema.sql")
SPLIT = "-- @@AFTER_MIGRATION@@"  # SQLite: tahap 1 = tabel, tahap 2 = index/trigger/view

# Kolom tambahan untuk database SQLite lama: (tabel, kolom, definisi)
MIGRATIONS = [
    ("orders", "tanggal_acara", "TEXT"), ("orders", "kartu", "TEXT"),
    ("orders", "bungkus", "TEXT DEFAULT 'pink'"), ("orders", "wadah", "TEXT DEFAULT 'nampan'"), ("orders", "bukti", "TEXT"),
    ("orders", "kartu_untuk", "TEXT"), ("orders", "kartu_dari", "TEXT"),
    ("orders", "kartu_gaya", "TEXT DEFAULT 'elegan'"), ("orders", "kartu_tema", "TEXT DEFAULT 'krem'"),
    ("orders", "subtotal", "INTEGER DEFAULT 0"), ("orders", "diskon", "INTEGER DEFAULT 0"),
    ("orders", "ongkir", "INTEGER DEFAULT 0"), ("orders", "voucher", "TEXT"),
    ("orders", "address_id", "INTEGER"), ("orders", "metode_bayar", "TEXT"),
    ("users", "email", "TEXT"), ("users", "password_hash", "TEXT"), ("users", "last_login", "TEXT"),
    ("items", "foto", "TEXT"), ("chat", "dibaca", "INTEGER DEFAULT 0"),
]


# --------------------------------------------------------------------------- MySQL
def translate(sql):
    """Ubah SQL gaya SQLite (?) menjadi gaya MySQL (%s)."""
    sql = sql.replace("%", "%%")
    sql = sql.replace("INSERT OR REPLACE INTO", "REPLACE INTO").replace("INSERT OR IGNORE INTO", "INSERT IGNORE INTO")
    if "settings" in sql:  # `key` adalah kata khusus di MySQL
        sql = re.sub(r"(?<!`)\bkey\b(?!`)", "`key`", sql)
    return sql.replace("?", "%s")


class MySQLConn:
    """Pembungkus tipis agar koneksi PyMySQL berperilaku seperti sqlite3 (execute/commit/close)."""

    def __init__(self, database=True):
        import pymysql
        from pymysql.constants import FIELD_TYPE
        conv = pymysql.converters.conversions.copy()
        for t in (FIELD_TYPE.DATETIME, FIELD_TYPE.TIMESTAMP, FIELD_TYPE.DATE):
            conv[t] = lambda value: value          # tanggal/jam tetap berupa teks 'YYYY-MM-DD HH:MM:SS'
        for t in (FIELD_TYPE.DECIMAL, FIELD_TYPE.NEWDECIMAL):
            conv[t] = float                        # SUM()/AVG() jadi angka biasa, bukan Decimal
        cfg = dict(config.MYSQL)
        if not database:
            cfg.pop("database")
        self.raw = pymysql.connect(**cfg, charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor, conv=conv)

    def execute(self, sql, args=()):
        cur = self.raw.cursor()
        cur.execute(translate(sql), args)
        return cur

    def executemany(self, sql, seq):
        cur = self.raw.cursor()
        cur.executemany(translate(sql), seq)
        return cur

    def commit(self):
        self.raw.commit()

    def close(self):
        self.raw.close()


def split_statements(script):
    """Pecah skrip SQL menjadi perintah satu per satu; mengerti baris `DELIMITER` untuk trigger."""
    delim, buf, out = ";", [], []
    for line in script.splitlines():
        stripped = line.strip()
        if stripped.upper().startswith("DELIMITER"):
            delim = stripped.split()[1]
            continue
        if not stripped or stripped.startswith("--"):
            continue
        buf.append(line)
        if stripped.endswith(delim):
            out.append("\n".join(buf).rstrip()[: -len(delim)])
            buf = []
    return [s for s in out if s.strip()]


# --------------------------------------------------------------------------- koneksi per-permintaan
def connect():
    if MYSQL:
        return MySQLConn()
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def db():
    if "db" not in g:
        g.db = connect()
    return g.db


def close_db(_=None):
    conn = g.pop("db", None)
    if conn:
        conn.close()


def q(sql, args=(), one=False):
    """Jalankan query dan kembalikan baris (atau satu baris bila one=True)."""
    cur = db().execute(sql, args)
    rows = cur.fetchall()
    db().commit()
    return (rows[0] if rows else None) if one else rows


def run(sql, args=()):
    """Jalankan perintah tulis dan kembalikan id baris terakhir."""
    cur = db().execute(sql, args)
    db().commit()
    return cur.lastrowid


# --------------------------------------------------------------------------- inisialisasi
def _rows(conn, sql, args=()):
    return [tuple(r.values()) if isinstance(r, dict) else tuple(r) for r in conn.execute(sql, args).fetchall()]


def backfill_order_items(conn):
    """Isi order_items untuk pesanan lama yang hanya punya salinan JSON di orders.items."""
    catalog = {r[1]: (r[0], r[2]) for r in _rows(conn, "SELECT id, nama, harga FROM items")}
    todo = _rows(conn, "SELECT id, items FROM orders WHERE id NOT IN (SELECT DISTINCT order_id FROM order_items)")
    for oid, raw in todo:
        for it in json.loads(raw or "[]"):
            item_id, harga = catalog.get(it.get("nama"), (None, 0))
            conn.execute("INSERT INTO order_items(order_id,item_id,nama,ikon,foto,harga) VALUES(?,?,?,?,?,?)",
                         (oid, item_id, it.get("nama"), it.get("ikon"), it.get("foto"), harga))


def seed_payment_methods(conn):
    """Isi metode pembayaran awal bila tabel masih kosong (rekening diambil dari pengaturan toko)."""
    if _rows(conn, "SELECT 1 FROM payment_methods LIMIT 1"):
        return
    s = {r[0]: r[1] for r in _rows(conn, "SELECT `key`, value FROM settings" if MYSQL else "SELECT key, value FROM settings")}
    rows = [
        ("qris", "QRIS", "qris", "Scan dengan aplikasi bank atau e-wallet apa pun", None, None, None, 1),
        ("transfer", "Transfer Bank", "transfer", "Transfer ke rekening toko", s.get("bank"), s.get("rek_no"), s.get("rek_an"), 2),
        ("dana", "DANA", "ewallet", "Kirim ke nomor DANA toko", "DANA", s.get("wa"), s.get("rek_an"), 3),
        ("cash", "Tunai (Cash)", "cash", "Bayar tunai saat parcel diterima atau diambil di toko", None, None, None, 4),
    ]
    conn.executemany("INSERT INTO payment_methods(kode,nama,tipe,keterangan,bank,no_rek,atas_nama,urut) VALUES(?,?,?,?,?,?,?,?)", rows)


def ensure_valid_sqlite(path):
    """Bila berkas SQLite rusak ("file is not a database"), pindahkan sebagai cadangan lalu mulai dengan database baru."""
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return
    try:
        probe = sqlite3.connect(path)
        probe.execute("PRAGMA schema_version").fetchone()
        probe.close()
    except sqlite3.DatabaseError:
        import time as _t
        backup = f"{path}.rusak-{_t.strftime('%Y%m%d-%H%M%S')}"
        os.replace(path, backup)
        print(f"[PERINGATAN] {os.path.basename(path)} rusak. Disimpan sebagai {os.path.basename(backup)}, database baru dibuat.")


def init_db():
    """Siapkan database: tabel -> migrasi kolom lama -> index/trigger/view -> data awal."""
    with open(SCHEMA_FILE, encoding="utf-8") as f:
        script = f.read()

    if MYSQL:
        name = config.MYSQL["database"]
        boot = MySQLConn(database=False)
        boot.execute(f"CREATE DATABASE IF NOT EXISTS `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        boot.commit()
        boot.close()
        conn = MySQLConn()
        for stmt in split_statements(script):
            conn.execute(stmt)
    else:
        tables, rest = script.split(SPLIT)
        ensure_valid_sqlite(config.DB_PATH)
        conn = sqlite3.connect(config.DB_PATH)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(tables)
        for table, col, ddl in MIGRATIONS:
            cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]
            if col not in cols:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")
        conn.executescript(rest)

    if not _rows(conn, "SELECT 1 FROM items LIMIT 1"):
        conn.executemany("INSERT INTO items(nama,ikon,kategori,harga) VALUES(?,?,?,?)", config.SEED_ITEMS)
    conn.executemany("INSERT OR IGNORE INTO packages(nilai,nama,deskripsi,urut) VALUES(?,?,?,?)",
                     [(15000, "Hemat", "Untuk tamu umum", 1), (25000, "Favorit", "Paling banyak dipilih", 2),
                      (35000, "Premium", "Isi paling lengkap", 3)])
    conn.execute("INSERT OR IGNORE INTO categories(nama) SELECT DISTINCT kategori FROM items")
    for k, v in config.DEFAULT_SETTINGS.items():
        conn.execute("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", (k, v))
    seed_payment_methods(conn)
    backfill_order_items(conn)
    conn.commit()
    conn.close()
