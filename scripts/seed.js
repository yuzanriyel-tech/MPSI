// Data dummy untuk pengembangan & UAT (laporan: data awal berupa data dummy).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const { stokMasuk, stokKeluar } = require('../src/services/stok');
const { isoDate, addDays } = require('../src/utils');

(async () => {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM users');
  if (n > 0) { console.log('Data sudah ada, seed dilewati. Jalankan "npm run db:reset" untuk mengulang.'); return pool.end(); }

  const hash = (p) => bcrypt.hash(p, 10);
  await pool.query('INSERT INTO users (nama,username,password,role,status_aktif) VALUES ?', [[
    ['Dinda Nathasya', 'admin', await hash('admin123'), 'pengelola', 1],
    ['Rani Novita', 'rani', await hash('rani123'), 'karyawan', 1],
    ['Budi Santoso', 'budi', await hash('budi123'), 'karyawan', 0],
  ]]);
  const [[admin]] = await pool.query("SELECT id_user FROM users WHERE username='admin'");
  const [[rani]] = await pool.query("SELECT id_user FROM users WHERE username='rani'");

  await pool.query('INSERT INTO kategori (nama_kategori) VALUES ?', [[['Bahan Baku Utama'], ['Dairy & Susu'], ['Pemanis & Sirup'], ['Packaging']]]);
  await pool.query('INSERT INTO pemasok (nama_pemasok,no_telepon,alamat) VALUES ?', [[
    ['CV Kopi Nusantara', '0751-111222', 'Padang'], ['PT Greenfields', '0751-333444', 'Padang'],
    ['UD Sumber Manis', '0751-555666', 'Padang'], ['Monin Official', '021-7778899', 'Jakarta'], ['CV Packaging Prima', '0751-999000', 'Padang'],
  ]]);
  const kat = Object.fromEntries((await pool.query('SELECT * FROM kategori'))[0].map((k) => [k.nama_kategori, k.id_kategori]));
  const pem = Object.fromEntries((await pool.query('SELECT * FROM pemasok'))[0].map((p) => [p.nama_pemasok, p.id_pemasok]));

  // [kode, nama, kategori, pemasok, satuan_beli, satuan_pakai, isi, minimum, harga/satuan pakai, masa simpan]
  const bahan = [
    ['BB-KOP-001', 'Kopi Arabika Gayo', 'Bahan Baku Utama', 'CV Kopi Nusantara', 'kg', 'kg', 1, 8, 135000, 180],
    ['BB-SUS-002', 'Susu Full Cream Greenfields', 'Dairy & Susu', 'PT Greenfields', 'Karton', 'L', 12, 6, 18000, 60],
    ['BB-GUL-003', 'Gula Pasir Kristal', 'Bahan Baku Utama', 'UD Sumber Manis', 'kg', 'kg', 1, 10, 16000, 365],
    ['BB-SRP-004', 'Sirup Karamel Monin', 'Pemanis & Sirup', 'Monin Official', 'btl', 'btl', 1, 4, 95000, 365],
    ['PK-CUP-005', 'Paper Cup Radjo 12oz', 'Packaging', 'CV Packaging Prima', 'pcs', 'pcs', 1, 100, 600, 730],
  ];
  for (const b of bahan) {
    await pool.query(
      'INSERT INTO bahan_baku (kode_bahan,nama_bahan,id_kategori,id_pemasok,satuan_beli,satuan_pakai,isi_per_satuan_beli,stok_minimum,harga_beli,masa_simpan_hari) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [b[0], b[1], kat[b[2]], pem[b[3]], b[4], b[5], b[6], b[7], b[8], b[9]]);
  }
  const id = Object.fromEntries((await pool.query('SELECT id_bahan, kode_bahan FROM bahan_baku'))[0].map((r) => [r.kode_bahan, r.id_bahan]));

  const t = isoDate();
  const masuk = (kode, beli, hari, user = admin.id_user) => stokMasuk({ id_bahan: id[kode], id_user: user, jumlah_satuan_beli: beli, tanggal_masuk: addDays(t, hari) });
  const keluar = (kode, jml, hari, jenis = 'pemakaian', ket = 'Operasional bar') => stokKeluar({ id_bahan: id[kode], id_user: rani.id_user, jumlah_keluar: jml, tanggal_keluar: addDays(t, hari), jenis_keluar: jenis, keterangan: ket });

  await masuk('BB-KOP-001', 15, -7);  await keluar('BB-KOP-001', 4, -5); await keluar('BB-KOP-001', 3, -3); await keluar('BB-KOP-001', 3, -1);   // sisa 5 (menipis)
  await masuk('BB-SUS-002', 3, -6);   await keluar('BB-SUS-002', 10, -4); await keluar('BB-SUS-002', 16, -2);                                        // sisa 10 (aman)
  await masuk('BB-GUL-003', 40, -6);  await keluar('BB-GUL-003', 10, -3); await keluar('BB-GUL-003', 10, 0);                                        // sisa 20 (aman)
  await masuk('BB-SRP-004', 6, -5);   await keluar('BB-SRP-004', 4, -2);                                                                           // sisa 2 (menipis)
  await masuk('PK-CUP-005', 300, -5); await keluar('PK-CUP-005', 300, -1);                                                                         // sisa 0 (habis)

  console.log('Seed selesai. Akun uji:\n  pengelola : admin / admin123\n  karyawan  : rani  / rani123\n  nonaktif  : budi  / budi123');
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
