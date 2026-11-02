-- =============================================================================
--  PARCELKU — SKEMA DATABASE LENGKAP (SQLite 3)
-- -----------------------------------------------------------------------------
--  File ini adalah sumber kebenaran struktur database. Aman dijalankan berulang
--  kali (semua memakai IF NOT EXISTS) dan dibagi dua tahap:
--
--    Tahap 1  : tabel                      (sebelum migrasi kolom database lama)
--    Tahap 2  : index, trigger, view       (setelah migrasi, di bawah penanda)
--
--  Cara membuat database baru lengkap dengan data awal:
--      python database/init_db.py            (data awal saja)
--      python database/init_db.py --demo     (plus contoh pesanan)
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
--  1. PENGGUNA
--     Pelanggan masuk cukup dengan nama + nomor HP (tanpa kata sandi).
--     Admin memakai satu kata sandi dari berkas .env, jadi tidak ada di tabel.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY,
    nama           TEXT    NOT NULL,
    email          TEXT    UNIQUE,                     -- untuk masuk (kosong hanya pada akun lama)
    hp             TEXT    NOT NULL UNIQUE,            -- nomor telepon/WhatsApp, format 62xxxxxxxxxx
    password_hash  TEXT,                               -- hash kata sandi, bukan kata sandi asli
    created        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    last_login     TEXT
);

-- Satu pengguna boleh punya banyak alamat; satu di antaranya menjadi alamat utama.
CREATE TABLE IF NOT EXISTS addresses (
    id        INTEGER PRIMARY KEY,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label     TEXT    NOT NULL DEFAULT 'Rumah',        -- Rumah, Kantor, Rumah Orang Tua, ...
    penerima  TEXT    NOT NULL,
    hp        TEXT    NOT NULL,
    alamat    TEXT    NOT NULL,
    catatan   TEXT,                                    -- patokan
    lat       REAL,
    lng       REAL,
    utama     INTEGER NOT NULL DEFAULT 0 CHECK (utama IN (0,1)),
    created   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------------------------------------------------------------------------
--  2. KATALOG: paket, kategori, barang
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packages (                  -- pilihan nilai parcel
    nilai      INTEGER PRIMARY KEY,                    -- 15000 / 25000 / 35000
    nama       TEXT    NOT NULL,                       -- Hemat / Favorit / Premium
    deskripsi  TEXT,
    urut       INTEGER NOT NULL DEFAULT 0,
    aktif      INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1))
);

CREATE TABLE IF NOT EXISTS categories (                -- kelompok barang
    id    INTEGER PRIMARY KEY,
    nama  TEXT    NOT NULL UNIQUE,
    urut  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (                     -- isi parcel yang bisa dipilih
    id        INTEGER PRIMARY KEY,
    nama      TEXT    NOT NULL,
    ikon      TEXT    NOT NULL DEFAULT '🎁',           -- emoji bila belum ada foto
    kategori  TEXT    NOT NULL,                        -- mengacu categories.nama
    harga     INTEGER NOT NULL CHECK (harga > 0),
    aktif     INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
    foto      TEXT                                     -- nama berkas di folder uploads/
);

-- Metode pembayaran yang bisa dipilih pelanggan (dikelola admin)
CREATE TABLE IF NOT EXISTS payment_methods (
    id          INTEGER PRIMARY KEY,
    kode        TEXT    NOT NULL UNIQUE,               -- qris, transfer, cash, dana, ...
    nama        TEXT    NOT NULL,                      -- nama yang tampil ke pelanggan
    tipe        TEXT    NOT NULL CHECK (tipe IN ('qris','transfer','cash','ewallet')),
    keterangan  TEXT,
    bank        TEXT,                                  -- nama bank / e-wallet
    no_rek      TEXT,
    atas_nama   TEXT,
    qris_foto   TEXT,                                  -- gambar kode QRIS (folder uploads/)
    aktif       INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
    urut        INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
--  3. PROMO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vouchers (
    id           INTEGER PRIMARY KEY,
    kode         TEXT    NOT NULL UNIQUE,
    tipe         TEXT    NOT NULL CHECK (tipe IN ('persen','nominal','ongkir')),
    nilai        INTEGER NOT NULL DEFAULT 0,           -- persen (1-100) atau rupiah
    min_belanja  INTEGER NOT NULL DEFAULT 0,
    maks_diskon  INTEGER NOT NULL DEFAULT 0,           -- 0 = tanpa batas
    kuota        INTEGER NOT NULL DEFAULT 0,           -- 0 = tanpa batas
    dipakai      INTEGER NOT NULL DEFAULT 0,
    aktif        INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
    sampai       TEXT                                  -- tanggal kedaluwarsa (YYYY-MM-DD)
);

-- ---------------------------------------------------------------------------
--  4. PESANAN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY,
    kode           TEXT UNIQUE,                        -- PK0001, dibuat otomatis oleh trigger
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    paket          INTEGER NOT NULL,                   -- nilai paket per parcel
    qty            INTEGER NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 1000),
    items          TEXT    NOT NULL DEFAULT '[]',      -- salinan JSON isi parcel (untuk tampilan cepat)

    -- Rincian harga
    subtotal       INTEGER NOT NULL DEFAULT 0,
    ongkir         INTEGER NOT NULL DEFAULT 0,
    diskon         INTEGER NOT NULL DEFAULT 0,
    voucher        TEXT,
    total          INTEGER NOT NULL DEFAULT 0,

    -- Pembayaran
    pay_type       TEXT    NOT NULL CHECK (pay_type IN ('dp','lunas','cod')),
    paid           INTEGER NOT NULL DEFAULT 0 CHECK (paid >= 0),
    metode_bayar   TEXT,                               -- mengacu payment_methods.kode
    bukti          TEXT,                               -- foto bukti transfer terbaru

    -- Pengambilan
    metode         TEXT    NOT NULL CHECK (metode IN ('ambil','antar','cod')),
    address_id     INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
    alamat         TEXT,                               -- salinan alamat saat memesan
    lat            REAL,
    lng            REAL,
    tanggal_acara  TEXT,                               -- tanggal parcel dibutuhkan

    -- Tampilan parcel
    wadah          TEXT    NOT NULL DEFAULT 'nampan' CHECK (wadah IN ('nampan','bulat')),
    bungkus        TEXT    NOT NULL DEFAULT 'pink'   CHECK (bungkus IN ('pink','emas','hijau','putih')),

    -- Kartu ucapan custom
    kartu          TEXT,                               -- isi pesan
    kartu_untuk    TEXT,                               -- nama penerima
    kartu_dari     TEXT,                               -- nama pengirim
    kartu_gaya     TEXT    NOT NULL DEFAULT 'elegan' CHECK (kartu_gaya IN ('elegan','tulisan','modern')),
    kartu_tema     TEXT    NOT NULL DEFAULT 'krem'   CHECK (kartu_tema IN ('krem','hijau','putih')),

    catatan        TEXT,
    status         TEXT    NOT NULL DEFAULT 'baru'
                   CHECK (status IN ('baru','diproses','dikemas','siap','diantar','selesai')),
    created        TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Rincian isi tiap pesanan (hasil normalisasi dari orders.items)
CREATE TABLE IF NOT EXISTS order_items (
    id        INTEGER PRIMARY KEY,
    order_id  INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id   INTEGER REFERENCES items(id) ON DELETE SET NULL,
    nama      TEXT    NOT NULL,                        -- disalin saat pesan, tidak berubah walau katalog diubah
    ikon      TEXT,
    foto      TEXT,
    harga     INTEGER NOT NULL DEFAULT 0
);

-- Riwayat pembayaran: setiap kali admin mengubah nominal "dibayar" tercatat di sini
CREATE TABLE IF NOT EXISTS payments (
    id       INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    jumlah   INTEGER NOT NULL CHECK (jumlah > 0),
    catatan  TEXT,
    oleh     TEXT    NOT NULL DEFAULT 'admin',
    created  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Riwayat perubahan status (dipakai untuk linimasa di struk)
CREATE TABLE IF NOT EXISTS status_log (
    id       INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status   TEXT    NOT NULL,
    oleh     TEXT    NOT NULL DEFAULT 'sistem',
    created  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------------------------------------------------------------------------
--  5. INTERAKSI PELANGGAN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat (
    id        INTEGER PRIMARY KEY,
    order_id  INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender    TEXT    NOT NULL CHECK (sender IN ('user','admin','sys')),
    text      TEXT    NOT NULL,
    dibaca    INTEGER NOT NULL DEFAULT 0 CHECK (dibaca IN (0,1)),
    created   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS reviews (
    id        INTEGER PRIMARY KEY,
    order_id  INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    rating    INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    teks      TEXT,
    created   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------------------------------------------------------------------------
--  6. KONTEN & PENGATURAN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery (
    id       INTEGER PRIMARY KEY,
    foto     TEXT NOT NULL,
    caption  TEXT,
    created  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Foto unggahan bila disimpan di database (STORAGE=db, dipakai di Vercel / hosting tanpa penyimpanan tetap)
CREATE TABLE IF NOT EXISTS uploads (
    name     TEXT PRIMARY KEY,
    mime     TEXT NOT NULL,
    data     BLOB NOT NULL,
    created  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
    key    TEXT PRIMARY KEY,
    value  TEXT
);

-- @@AFTER_MIGRATION@@
-- =============================================================================
--  TAHAP 2 — INDEX, TRIGGER, VIEW
-- =============================================================================

-- ---------- Index untuk pencarian & laporan ----------
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_addr_user        ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders(created);
CREATE INDEX IF NOT EXISTS idx_orders_acara     ON orders(tanggal_acara);
CREATE INDEX IF NOT EXISTS idx_order_items_ord  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item ON order_items(item_id);
CREATE INDEX IF NOT EXISTS idx_payments_order   ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_status_log_order ON status_log(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_order       ON chat(order_id, id);
CREATE INDEX IF NOT EXISTS idx_items_kategori   ON items(kategori, aktif);

-- ---------- Trigger: otomatisasi pencatatan ----------
-- Kode pesanan PK0001, PK0002, ... diisi otomatis bila belum ada.
CREATE TRIGGER IF NOT EXISTS trg_orders_kode
AFTER INSERT ON orders
WHEN NEW.kode IS NULL
BEGIN
    UPDATE orders SET kode = 'PK' || printf('%04d', NEW.id) WHERE id = NEW.id;
END;

-- Catat status awal pesanan.
CREATE TRIGGER IF NOT EXISTS trg_orders_status_awal
AFTER INSERT ON orders
BEGIN
    INSERT INTO status_log(order_id, status, oleh) VALUES (NEW.id, NEW.status, 'pelanggan');
END;

-- Catat setiap perubahan status.
CREATE TRIGGER IF NOT EXISTS trg_orders_status_ubah
AFTER UPDATE OF status ON orders
WHEN NEW.status <> OLD.status
BEGIN
    INSERT INTO status_log(order_id, status, oleh) VALUES (NEW.id, NEW.status, 'admin');
END;

-- Catat setiap penambahan nominal pembayaran.
CREATE TRIGGER IF NOT EXISTS trg_orders_bayar
AFTER UPDATE OF paid ON orders
WHEN NEW.paid > OLD.paid
BEGIN
    INSERT INTO payments(order_id, jumlah) VALUES (NEW.id, NEW.paid - OLD.paid);
END;

-- ---------- View: laporan siap pakai ----------
-- Ringkasan pesanan lengkap dengan nama pelanggan dan status bayar.
CREATE VIEW IF NOT EXISTS v_orders AS
SELECT o.id, o.kode, o.created, o.tanggal_acara, u.nama AS pelanggan, u.email, u.hp,
       o.paket, o.qty, o.subtotal, o.ongkir, o.diskon, o.total, o.paid,
       (o.total - o.paid) AS sisa,
       CASE WHEN o.paid >= o.total THEN 'Lunas'
            WHEN o.paid > 0        THEN 'DP'
            WHEN o.pay_type = 'cod' THEN 'COD'
            ELSE 'Belum bayar' END AS status_bayar,
       o.metode, o.metode_bayar, o.status
FROM orders o JOIN users u ON u.id = o.user_id;

-- Penjualan per hari (tidak termasuk pesanan yang belum dibayar sama sekali).
CREATE VIEW IF NOT EXISTS v_penjualan_harian AS
SELECT date(created) AS tanggal, COUNT(*) AS jumlah_pesanan, SUM(qty) AS jumlah_parcel,
       SUM(total) AS omzet, SUM(paid) AS uang_masuk
FROM orders GROUP BY date(created) ORDER BY tanggal DESC;

-- Barang paling sering dipilih pelanggan.
CREATE VIEW IF NOT EXISTS v_barang_populer AS
SELECT oi.nama, COUNT(*) AS dipilih_kali, SUM(o.qty) AS total_pcs
FROM order_items oi JOIN orders o ON o.id = oi.order_id
GROUP BY oi.nama ORDER BY dipilih_kali DESC;

-- Pesanan yang belum selesai, urut dari tanggal acara terdekat.
CREATE VIEW IF NOT EXISTS v_pesanan_aktif AS
SELECT * FROM v_orders WHERE status <> 'selesai' ORDER BY tanggal_acara;

-- Penilaian rata-rata.
CREATE VIEW IF NOT EXISTS v_rating AS
SELECT COUNT(*) AS jumlah_ulasan, ROUND(AVG(rating), 2) AS rata_rata FROM reviews;
