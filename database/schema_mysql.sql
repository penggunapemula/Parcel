-- =============================================================================
--  PARCELKU — SKEMA MYSQL / MARIADB (XAMPP)
-- -----------------------------------------------------------------------------
--  Setara dengan schema.sql (SQLite). Dipakai otomatis oleh aplikasi saat
--  DB_ENGINE=mysql, atau diimpor lewat phpMyAdmin (lihat parcelku_xampp.sql).
--  Aman dijalankan berulang kali.
-- =============================================================================

-- ---------------------------------------------------------------------------
--  1. AKUN & ALAMAT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    nama           VARCHAR(80)  NOT NULL,
    email          VARCHAR(120) NULL UNIQUE,                -- kosong hanya pada akun lama
    hp             VARCHAR(20)  NOT NULL UNIQUE,            -- nomor telepon/WhatsApp, hanya angka
    password_hash  VARCHAR(255) NULL,                       -- hash kata sandi, bukan kata sandi asli
    created        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login     DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Satu pengguna boleh punya banyak alamat; satu di antaranya menjadi alamat utama.
CREATE TABLE IF NOT EXISTS addresses (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    label      VARCHAR(40)  NOT NULL DEFAULT 'Rumah',      -- Rumah, Kantor, Rumah Orang Tua, ...
    penerima   VARCHAR(80)  NOT NULL,
    hp         VARCHAR(20)  NOT NULL,
    alamat     VARCHAR(300) NOT NULL,
    catatan    VARCHAR(120) NULL,                          -- patokan: "pagar hijau, sebelah warung"
    lat        DOUBLE       NULL,
    lng        DOUBLE       NULL,
    utama      TINYINT      NOT NULL DEFAULT 0,
    created    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_addr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_addr_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
--  2. KATALOG
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packages (
    nilai      INT PRIMARY KEY,
    nama       VARCHAR(40) NOT NULL,
    deskripsi  VARCHAR(120) NULL,
    urut       INT NOT NULL DEFAULT 0,
    aktif      TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
    id    INT AUTO_INCREMENT PRIMARY KEY,
    nama  VARCHAR(60) NOT NULL UNIQUE,
    urut  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS items (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    nama      VARCHAR(100) NOT NULL,
    ikon      VARCHAR(16)  NOT NULL DEFAULT '🎁',
    kategori  VARCHAR(60)  NOT NULL,
    harga     INT NOT NULL,
    aktif     TINYINT NOT NULL DEFAULT 1,
    foto      VARCHAR(120) NULL,
    INDEX idx_items_kategori (kategori, aktif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_methods (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    kode        VARCHAR(30)  NOT NULL UNIQUE,              -- qris, transfer, cash, dana, ...
    nama        VARCHAR(60)  NOT NULL,
    tipe        VARCHAR(10)  NOT NULL,                     -- qris | transfer | cash | ewallet
    keterangan  VARCHAR(200) NULL,
    bank        VARCHAR(60)  NULL,
    no_rek      VARCHAR(40)  NULL,
    atas_nama   VARCHAR(80)  NULL,
    qris_foto   VARCHAR(120) NULL,
    aktif       TINYINT NOT NULL DEFAULT 1,
    urut        INT NOT NULL DEFAULT 0,
    CONSTRAINT ck_pm_tipe CHECK (tipe IN ('qris','transfer','cash','ewallet'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
--  3. PROMO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vouchers (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    kode         VARCHAR(30) NOT NULL UNIQUE,
    tipe         VARCHAR(10) NOT NULL,                      -- persen | nominal | ongkir
    nilai        INT NOT NULL DEFAULT 0,
    min_belanja  INT NOT NULL DEFAULT 0,
    maks_diskon  INT NOT NULL DEFAULT 0,
    kuota        INT NOT NULL DEFAULT 0,
    dipakai      INT NOT NULL DEFAULT 0,
    aktif        TINYINT NOT NULL DEFAULT 1,
    sampai       VARCHAR(10) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
--  4. PESANAN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    kode           VARCHAR(12) NULL UNIQUE,                 -- PK0001, diisi aplikasi setelah insert
    user_id        INT NOT NULL,
    paket          INT NOT NULL,
    qty            INT NOT NULL DEFAULT 1,
    items          TEXT NOT NULL,                           -- salinan JSON isi parcel
    subtotal       INT NOT NULL DEFAULT 0,
    ongkir         INT NOT NULL DEFAULT 0,
    diskon         INT NOT NULL DEFAULT 0,
    voucher        VARCHAR(30) NULL,
    total          INT NOT NULL DEFAULT 0,
    pay_type       VARCHAR(8)  NOT NULL,                    -- dp | lunas | cod
    paid           INT NOT NULL DEFAULT 0,
    metode_bayar   VARCHAR(30) NULL,                        -- mengacu payment_methods.kode
    bukti          VARCHAR(120) NULL,
    metode         VARCHAR(8)  NOT NULL,                    -- ambil | antar | cod
    address_id     INT NULL,
    alamat         TEXT NULL,                               -- salinan alamat saat memesan
    lat            DOUBLE NULL,
    lng            DOUBLE NULL,
    tanggal_acara  VARCHAR(10) NULL,
    wadah          VARCHAR(10) NOT NULL DEFAULT 'nampan',
    bungkus        VARCHAR(10) NOT NULL DEFAULT 'pink',
    kartu          TEXT NULL,
    kartu_untuk    VARCHAR(60) NULL,
    kartu_dari     VARCHAR(60) NULL,
    kartu_gaya     VARCHAR(10) NOT NULL DEFAULT 'elegan',
    kartu_tema     VARCHAR(10) NOT NULL DEFAULT 'krem',
    catatan        TEXT NULL,
    status         VARCHAR(10) NOT NULL DEFAULT 'baru',
    created        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_orders_addr FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    CONSTRAINT ck_orders_pay    CHECK (pay_type IN ('dp','lunas','cod')),
    CONSTRAINT ck_orders_metode CHECK (metode IN ('ambil','antar','cod')),
    CONSTRAINT ck_orders_status CHECK (status IN ('baru','diproses','dikemas','siap','diantar','selesai')),
    CONSTRAINT ck_orders_qty    CHECK (qty BETWEEN 1 AND 1000),
    INDEX idx_orders_user (user_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_created (created),
    INDEX idx_orders_acara (tanggal_acara)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    order_id  INT NOT NULL,
    item_id   INT NULL,
    nama      VARCHAR(100) NOT NULL,
    ikon      VARCHAR(16)  NULL,
    foto      VARCHAR(120) NULL,
    harga     INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_oi_item  FOREIGN KEY (item_id)  REFERENCES items(id)  ON DELETE SET NULL,
    INDEX idx_oi_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    order_id  INT NOT NULL,
    jumlah    INT NOT NULL,
    catatan   VARCHAR(120) NULL,
    oleh      VARCHAR(20) NOT NULL DEFAULT 'admin',
    created   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_pay_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS status_log (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    order_id  INT NOT NULL,
    status    VARCHAR(10) NOT NULL,
    oleh      VARCHAR(20) NOT NULL DEFAULT 'sistem',
    created   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sl_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_sl_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
--  5. INTERAKSI
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    order_id  INT NOT NULL,
    sender    VARCHAR(8) NOT NULL,                          -- user | admin | sys
    `text`    VARCHAR(600) NOT NULL,
    dibaca    TINYINT NOT NULL DEFAULT 0,
    created   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_chat_order (order_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    order_id  INT NOT NULL UNIQUE,
    rating    INT NOT NULL,
    teks      VARCHAR(400) NULL,
    created   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rev_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT ck_rev_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
--  6. KONTEN & PENGATURAN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    foto     VARCHAR(120) NOT NULL,
    caption  VARCHAR(160) NULL,
    created  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Foto unggahan bila disimpan di database (STORAGE=db, dipakai di Vercel / hosting tanpa penyimpanan tetap)
CREATE TABLE IF NOT EXISTS uploads (
    name     VARCHAR(80) PRIMARY KEY,
    mime     VARCHAR(30) NOT NULL,
    data     LONGBLOB NOT NULL,
    created  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
    `key`  VARCHAR(40) PRIMARY KEY,
    value  VARCHAR(200) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
--  7. TRIGGER (pencatatan otomatis)
-- ---------------------------------------------------------------------------
DELIMITER $$

DROP TRIGGER IF EXISTS trg_orders_awal$$
CREATE TRIGGER trg_orders_awal AFTER INSERT ON orders FOR EACH ROW
BEGIN
    INSERT INTO status_log(order_id, status, oleh) VALUES (NEW.id, NEW.status, 'pelanggan');
END$$

DROP TRIGGER IF EXISTS trg_orders_ubah$$
CREATE TRIGGER trg_orders_ubah AFTER UPDATE ON orders FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO status_log(order_id, status, oleh) VALUES (NEW.id, NEW.status, 'admin');
    END IF;
    IF NEW.paid > OLD.paid THEN
        INSERT INTO payments(order_id, jumlah) VALUES (NEW.id, NEW.paid - OLD.paid);
    END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
--  8. VIEW LAPORAN
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_orders AS
SELECT o.id, o.kode, o.created, o.tanggal_acara, u.nama AS pelanggan, u.email, u.hp,
       o.paket, o.qty, o.subtotal, o.ongkir, o.diskon, o.total, o.paid,
       (o.total - o.paid) AS sisa,
       CASE WHEN o.paid >= o.total THEN 'Lunas'
            WHEN o.paid > 0        THEN 'DP'
            WHEN o.pay_type = 'cod' THEN 'COD'
            ELSE 'Belum bayar' END AS status_bayar,
       o.metode, o.metode_bayar, o.status
FROM orders o JOIN users u ON u.id = o.user_id;

CREATE OR REPLACE VIEW v_penjualan_harian AS
SELECT DATE(created) AS tanggal, COUNT(*) AS jumlah_pesanan, SUM(qty) AS jumlah_parcel,
       SUM(total) AS omzet, SUM(paid) AS uang_masuk
FROM orders GROUP BY DATE(created);

CREATE OR REPLACE VIEW v_barang_populer AS
SELECT oi.nama, COUNT(*) AS dipilih_kali, SUM(o.qty) AS total_pcs
FROM order_items oi JOIN orders o ON o.id = oi.order_id
GROUP BY oi.nama;

CREATE OR REPLACE VIEW v_pesanan_aktif AS
SELECT * FROM v_orders WHERE status <> 'selesai';

CREATE OR REPLACE VIEW v_rating AS
SELECT COUNT(*) AS jumlah_ulasan, ROUND(AVG(rating), 2) AS rata_rata FROM reviews;
