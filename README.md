# MPSI – Sistem Informasi Persediaan Bahan Baku · Cafe Radjo Roastery

Implementasi UI Figma **UI-MPSI** dengan **Express.js + EJS + MySQL**, mengikuti laporan TB MPSI Kelompok 4
(use case UC-01…UC-13, kamus data 7 tabel, aturan FEFO & safety stock alert).

## Menjalankan

```bash
npm install
cp .env.example .env        # isi DB_USER / DB_PASSWORD MySQL Anda
npm run db:init             # buat database + tabel
npm run db:seed             # data dummy + akun uji
npm run dev                 # http://localhost:3000
```

Akun uji: `admin / admin123` (Pengelola) · `rani / rani123` (Karyawan) · `budi / budi123` (nonaktif).
`npm run db:reset` menghapus database lalu mengisi ulang.

## Struktur

```
database/schema.sql        skema MySQL (kamus data D.7)
scripts/                   init-db.js, seed.js
src/app.js                 bootstrap Express, session, helper tampilan
src/services/stok.js       konversi satuan, FEFO, validasi saldo (transaksi DB)
src/routes/                auth, dashboard, bahan, transaksi, laporan, akun
views/                     halaman EJS (login, dashboard, bahan, transaksi, laporan, akun)
public/                    css/style.css (token warna dari Figma), js/app.js
```

## Peta layar Figma → halaman

| Frame Figma | Route | Use case |
|---|---|---|
| figma-login | `GET /login` | UC-01, 02 |
| figma-dashboard-frame | `GET /` | UC-03, 04 |
| figma-master-barang | `GET /bahan` (+ `?status=perlu-dipesan`) | UC-06, 11 |
| figma-tambah-barang | `GET /bahan/baru`, `/bahan/:id/edit` | UC-06 |
| figma-stok-masuk | `GET/POST /transaksi/masuk` | UC-07, 08 |
| figma-stok-keluar | `GET/POST /transaksi/keluar` | UC-09, 10 |
| figma-laporan-riwayat | `GET /laporan`, `/laporan/export.csv` | UC-12 |
| figma-akun-pengguna + modal nonaktifkan | `GET /akun` | UC-05 |

## Perbedaan desain Figma vs laporan (perlu keputusan tim)

- **Login "Lokasi Outlet"** dihilangkan: laporan hanya mencakup satu kafe.
- **Peran Barista/Kasir** di Figma disederhanakan menjadi **Karyawan** (laporan hanya punya 2 peran).
- **Foto bahan** (dropzone) dihilangkan: tidak ada kolomnya di kamus data.
- **Tombol Export Excel / Download PDF** diganti **Export CSV**.
- Kolom **Saldo Akhir** per transaksi, kartu tren %, dan sparkline dashboard belum dibuat.
- Tambahan kolom di luar kamus data (dibutuhkan Figma): `bahan_baku.harga_beli`, `stok_masuk.catatan`, `created_at` di tabel transaksi.
- Halaman **Pengaturan → Profil** (frame Figma) belum dibuat; menu Pengaturan hanya berisi Akun Pengguna.

## Catatan keamanan (prototype)

Password di-hash bcrypt, query memakai parameter, akses dibatasi per peran. Belum ada proteksi CSRF dan rate-limit login;
session memakai MemoryStore. Tambahkan `csurf`/`express-rate-limit` dan `express-mysql-session` sebelum dipakai sungguhan.
