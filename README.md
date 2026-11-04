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
| figma-master-barang | `GET /bahan` (+ `?status=perlu-dipesan`) | UC-06 |
| (tidak ada frame; mengikuti laporan) | `GET /pemantauan?bulan=YYYY-MM` (Pengelola) | UC-11 |
| figma-tambah-barang | `GET /bahan/baru`, `/bahan/:id/edit` | UC-06 |
| figma-stok-masuk | `GET/POST /transaksi/masuk` (tanggal diterima dapat diisi, termasuk mundur) | UC-07, 08 |
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

## Perubahan setelah review (frontend)

- **UC-11** halaman *Pemantauan Stok Minimum* (`/pemantauan`, hanya Pengelola): pilih bulan; saldo dihitung dari riwayat transaksi sampai akhir bulan (atau hari ini), dibandingkan dengan stok minimum; daftar batch mendekati/melewati kedaluwarsa; pesan "Stok aman" bila kosong. Menu: Laporan ▾ → Pemantauan Stok Minimum.
- **UC-07** form stok masuk punya input *Tanggal Barang Diterima* (tidak boleh masa depan); usulan tanggal kedaluwarsa otomatis dari masa simpan bahan; pemasok wajib dipilih.
- **Nomor dokumen** seragam: `PO-YYYYMMDD-NNN` / `OUT-YYYYMMDD-NNN` (id transaksi). Form menampilkan "dibuat otomatis"; nomor sebenarnya muncul di notifikasi setelah simpan dan sama dengan yang ada di Laporan (`utils.noDokumen` ↔ `CONCAT` di `routes/laporan.js`). Batch tampil di kolom keterangan.
- **Laporan**: ringkasan berupa jumlah transaksi (sebelumnya menjumlah satuan berbeda); transaksi yang dicatat mundur diberi penanda "dicatat <tanggal>".
- **Akun**: username terkunci saat edit; password wajib hanya saat tambah akun.
- Menambahkan `.env.example`.

## Catatan untuk tim backend (belum dikerjakan; di luar lingkup frontend)

1. Sesi akun yang dinonaktifkan masih aktif sampai logout: cek `status_aktif` per request di `middleware/auth.js`.
2. `POST /akun/:id` belum memvalidasi `role` (nilai ENUM salah → error 500).
3. `routes/auth.js`: `throw err` di callback `regenerate` → ganti `next(err)`.
4. `utils.fail()` menyimpan seluruh `req.body` (termasuk password) ke session.
5. Skema memuat kolom di luar Kamus Data (`harga_beli`, `catatan`, `created_at` ×2, `id_pemasok` nullable): samakan dengan laporan (Tabel D.20–D.22 + ERD) atau hapus.
6. Belum ada CSRF dan pembatasan percobaan login; belum ada UI kelola kategori/pemasok.

## Catatan keamanan (prototype)

Password di-hash bcrypt, query memakai parameter, akses dibatasi per peran. Belum ada proteksi CSRF dan rate-limit login;
session memakai MemoryStore. Tambahkan `csurf`/`express-rate-limit` dan `express-mysql-session` sebelum dipakai sungguhan.
