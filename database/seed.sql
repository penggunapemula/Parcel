-- =============================================================================
--  PARCELKU — DATA AWAL (aman dijalankan berulang kali)
-- =============================================================================

INSERT OR IGNORE INTO packages(nilai, nama, deskripsi, urut) VALUES
    (15000, 'Hemat',   'Untuk tamu umum',        1),
    (25000, 'Favorit', 'Paling banyak dipilih',  2),
    (35000, 'Premium', 'Isi paling lengkap',     3);

INSERT OR IGNORE INTO categories(nama, urut) VALUES
    ('Kebersihan', 1), ('Minuman', 2), ('Kue', 3), ('Sembako', 4);

INSERT OR IGNORE INTO settings(key, value) VALUES
    ('toko_nama',        'Parcelku'),
    ('tagline',          'Parcel seserahan custom untuk tamu undangan'),
    ('wa',               '6281234567890'),
    ('bank',             'BCA'),
    ('rek_no',           '1234567890'),
    ('rek_an',           'Nama Pemilik Toko'),
    ('jam',              'Setiap hari 08.00 - 20.00'),
    ('alamat_toko',      'Alamat toko Anda'),
    ('toko_lat',         ''),
    ('toko_lng',         ''),
    ('ongkir_dasar',     '10000'),
    ('ongkir_km_gratis', '3'),
    ('ongkir_per_km',    '2000'),
    ('ongkir_gratis_min','300000');

-- Metode pembayaran awal (admin bisa mengubah / menambah di halaman Admin)
INSERT OR IGNORE INTO payment_methods(kode, nama, tipe, keterangan, bank, no_rek, atas_nama, urut) VALUES
    ('qris',     'QRIS',            'qris',     'Scan dengan aplikasi bank atau e-wallet apa pun', NULL, NULL, NULL, 1),
    ('transfer', 'Transfer Bank',   'transfer', 'Transfer ke rekening toko',  'BCA', '1234567890', 'Nama Pemilik Toko', 2),
    ('dana',     'DANA',            'ewallet',  'Kirim ke nomor DANA toko',   'DANA', '081234567890', 'Nama Pemilik Toko', 3),
    ('cash',     'Tunai (Cash)',    'cash',     'Bayar tunai saat parcel diterima atau diambil di toko', NULL, NULL, NULL, 4);

-- Voucher contoh (kuota 0 = tanpa batas)
INSERT OR IGNORE INTO vouchers(kode, tipe, nilai, min_belanja, maks_diskon, kuota) VALUES
    ('HEMAT10',  'persen',  10, 100000, 25000, 0),
    ('POTONG5K', 'nominal', 5000, 50000, 0,    100),
    ('GRATISONGKIR', 'ongkir', 0, 150000, 0,   50);

-- Katalog barang awal (hanya dimasukkan bila tabel items masih kosong)
INSERT INTO items(nama, ikon, kategori, harga)
SELECT * FROM (
    SELECT 'Sabun Cuci Piring', '🧼', 'Kebersihan', 3000 UNION ALL
    SELECT 'Deterjen Sachet',   '🧺', 'Kebersihan', 2500 UNION ALL
    SELECT 'Tisu Saku',         '🧻', 'Kebersihan', 3000 UNION ALL
    SELECT 'Air Mineral',       '💧', 'Minuman',    3000 UNION ALL
    SELECT 'Teh Celup',         '🍵', 'Minuman',    3500 UNION ALL
    SELECT 'Kopi Sachet',       '☕', 'Minuman',    3000 UNION ALL
    SELECT 'Minuman Jeruk',     '🍊', 'Minuman',    2500 UNION ALL
    SELECT 'Sirup Botol Kecil', '🍹', 'Minuman',    8000 UNION ALL
    SELECT 'Biskuit',           '🍪', 'Kue',        4000 UNION ALL
    SELECT 'Wafer',             '🧇', 'Kue',        3500 UNION ALL
    SELECT 'Nastar',            '🍍', 'Kue',        6000 UNION ALL
    SELECT 'Kastengel',         '🧀', 'Kue',        6000 UNION ALL
    SELECT 'Keripik Singkong',  '🥔', 'Kue',        4000 UNION ALL
    SELECT 'Mie Instan',        '🍜', 'Sembako',    3500 UNION ALL
    SELECT 'Gula 1/2 kg',       '🍬', 'Sembako',    7000 UNION ALL
    SELECT 'Minyak Goreng 250ml','🛢️','Sembako',    6000
) WHERE NOT EXISTS (SELECT 1 FROM items);
