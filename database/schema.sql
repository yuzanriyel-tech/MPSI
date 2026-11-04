-- Skema mengikuti Kamus Data (Lampiran D.7) laporan TB MPSI Kelompok 4.
-- Tambahan di luar kamus data (dibutuhkan desain Figma), ditandai [+]:
--   bahan_baku.harga_beli, stok_masuk.catatan, created_at pada stok_masuk & stok_keluar.

CREATE TABLE IF NOT EXISTS users (
  id_user INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('pengelola','karyawan') NOT NULL DEFAULT 'karyawan',
  status_aktif BOOLEAN NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kategori (
  id_kategori INT AUTO_INCREMENT PRIMARY KEY,
  nama_kategori VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pemasok (
  id_pemasok INT AUTO_INCREMENT PRIMARY KEY,
  nama_pemasok VARCHAR(100) NOT NULL,
  no_telepon VARCHAR(20),
  alamat TEXT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bahan_baku (
  id_bahan INT AUTO_INCREMENT PRIMARY KEY,
  id_kategori INT NOT NULL,
  id_pemasok INT NULL,
  kode_bahan VARCHAR(10) NOT NULL UNIQUE,
  nama_bahan VARCHAR(100) NOT NULL,
  satuan_beli VARCHAR(20) NOT NULL,
  satuan_pakai VARCHAR(20) NOT NULL,
  isi_per_satuan_beli DECIMAL(10,2) NOT NULL DEFAULT 1,
  stok_saat_ini DECIMAL(10,2) NOT NULL DEFAULT 0,
  stok_minimum DECIMAL(10,2) NOT NULL DEFAULT 0,
  masa_simpan_hari INT NOT NULL DEFAULT 180,
  harga_beli DECIMAL(12,2) NOT NULL DEFAULT 0,            -- [+] harga per satuan pakai
  CONSTRAINT fk_bahan_kategori FOREIGN KEY (id_kategori) REFERENCES kategori(id_kategori),
  CONSTRAINT fk_bahan_pemasok  FOREIGN KEY (id_pemasok)  REFERENCES pemasok(id_pemasok) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stok_masuk (
  id_stok_masuk INT AUTO_INCREMENT PRIMARY KEY,
  id_bahan INT NOT NULL,
  id_pemasok INT NULL,
  id_user INT NOT NULL,
  kode_batch VARCHAR(20) NOT NULL UNIQUE,
  tanggal_masuk DATE NOT NULL,
  jumlah_satuan_beli DECIMAL(10,2) NOT NULL,
  jumlah_masuk DECIMAL(10,2) NOT NULL,
  sisa_stok DECIMAL(10,2) NOT NULL,
  tanggal_kedaluwarsa DATE NOT NULL,
  catatan TEXT NULL,                                       -- [+]
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- [+]
  CONSTRAINT fk_sm_bahan   FOREIGN KEY (id_bahan)   REFERENCES bahan_baku(id_bahan),
  CONSTRAINT fk_sm_pemasok FOREIGN KEY (id_pemasok) REFERENCES pemasok(id_pemasok) ON DELETE SET NULL,
  CONSTRAINT fk_sm_user    FOREIGN KEY (id_user)     REFERENCES users(id_user),
  INDEX idx_sm_fefo (id_bahan, tanggal_kedaluwarsa)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stok_keluar (
  id_stok_keluar INT AUTO_INCREMENT PRIMARY KEY,
  id_bahan INT NOT NULL,
  id_user INT NOT NULL,
  tanggal_keluar DATE NOT NULL,
  jumlah_keluar DECIMAL(10,2) NOT NULL,
  jenis_keluar ENUM('pemakaian','rusak','kedaluwarsa') NOT NULL DEFAULT 'pemakaian',
  keterangan TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- [+]
  CONSTRAINT fk_sk_bahan FOREIGN KEY (id_bahan) REFERENCES bahan_baku(id_bahan),
  CONSTRAINT fk_sk_user  FOREIGN KEY (id_user)  REFERENCES users(id_user)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS detail_stok_keluar (
  id_detail INT AUTO_INCREMENT PRIMARY KEY,
  id_stok_keluar INT NOT NULL,
  id_stok_masuk INT NOT NULL,
  jumlah_diambil DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_dsk_keluar FOREIGN KEY (id_stok_keluar) REFERENCES stok_keluar(id_stok_keluar) ON DELETE CASCADE,
  CONSTRAINT fk_dsk_masuk  FOREIGN KEY (id_stok_masuk)  REFERENCES stok_masuk(id_stok_masuk)
) ENGINE=InnoDB;
