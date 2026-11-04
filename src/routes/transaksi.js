const router = require('express').Router();
const pool = require('../db');
const { requireLogin } = require('../middleware/auth');
const { wrap, fail, ok, isoDate, noDokumen, AppError } = require('../utils');
const { stokMasuk, stokKeluar } = require('../services/stok');

router.use(requireLogin);
router.get('/', (req, res) => res.redirect('/transaksi/masuk'));

const bahanList = () => pool.query('SELECT id_bahan, kode_bahan, nama_bahan, satuan_beli, satuan_pakai, isi_per_satuan_beli, stok_saat_ini, stok_minimum, harga_beli, masa_simpan_hari, id_pemasok FROM bahan_baku ORDER BY nama_bahan').then(([r]) => r);

// ---------- UC-07 Stok masuk ----------
router.get('/masuk', wrap(async (req, res) => {
  const [pemasok] = await pool.query('SELECT * FROM pemasok ORDER BY nama_pemasok');
  res.render('transaksi/masuk', { title: 'Penerimaan Stok Masuk', active: 'transaksi', pemasok, bahan: await bahanList(), today: isoDate() });
}));

router.post('/masuk', wrap(async (req, res) => {
  const b = req.body;
  const today = isoDate();
  const tgl = (b.tanggal_masuk || today).trim(); // UC-07: tanggal masuk diisi pengguna (boleh mundur untuk stok yang terlewat)
  if (!b.id_bahan) return fail(req, res, 'Pilih bahan baku.', '/transaksi/masuk');
  if (!b.id_pemasok) return fail(req, res, 'Pilih pemasok.', '/transaksi/masuk');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl) || isNaN(new Date(tgl))) return fail(req, res, 'Tanggal penerimaan tidak valid.', '/transaksi/masuk');
  if (tgl > today) return fail(req, res, 'Tanggal penerimaan tidak boleh di masa depan.', '/transaksi/masuk');
  if (!b.tanggal_kedaluwarsa) return fail(req, res, 'Tanggal kedaluwarsa wajib diisi.', '/transaksi/masuk');
  try {
    const r = await stokMasuk({
      id_bahan: +b.id_bahan, id_pemasok: +b.id_pemasok, id_user: req.session.user.id,
      jumlah_satuan_beli: +String(b.jumlah_satuan_beli).replace(',', '.'), tanggal_masuk: tgl,
      tanggal_kedaluwarsa: b.tanggal_kedaluwarsa, catatan: (b.catatan || '').trim(),
    });
    const [[row]] = await pool.query('SELECT id_stok_masuk FROM stok_masuk WHERE kode_batch=?', [r.kode]);
    const no = noDokumen('masuk', tgl, row.id_stok_masuk);
    ok(req, res, `Stok masuk ${r.bahan.nama_bahan} tercatat sebagai ${no} (batch ${r.kode}). Stok sekarang ${r.stok_akhir} ${r.bahan.satuan_pakai}.`, '/transaksi/masuk');
  } catch (e) {
    if (e instanceof AppError) return fail(req, res, e.message, '/transaksi/masuk');
    throw e;
  }
}));

// ---------- UC-09 Stok keluar ----------
router.get('/keluar', wrap(async (req, res) => {
  res.render('transaksi/keluar', { title: 'Pengeluaran Stok Bahan Baku', active: 'transaksi', bahan: await bahanList(), now: new Date() });
}));

router.post('/keluar', wrap(async (req, res) => {
  const b = req.body;
  if (!b.id_bahan) return fail(req, res, 'Pilih bahan baku.', '/transaksi/keluar');
  if (!['pemakaian', 'rusak', 'kedaluwarsa'].includes(b.jenis_keluar)) return fail(req, res, 'Tujuan pengeluaran tidak valid.', '/transaksi/keluar');
  const tgl = isoDate();
  try {
    const r = await stokKeluar({
      id_bahan: +b.id_bahan, id_user: req.session.user.id, jumlah_keluar: +String(b.jumlah_keluar).replace(',', '.'),
      tanggal_keluar: tgl, jenis_keluar: b.jenis_keluar, keterangan: (b.keterangan || '').trim(),
    });
    const no = noDokumen('keluar', tgl, r.id);
    const peringatan = r.di_bawah_minimum ? ` Perhatian: stok kini di bawah batas minimum, bahan perlu dipesan ulang.` : '';
    req.session.flash = { type: r.di_bawah_minimum ? 'warn' : 'ok', msg: `Pengeluaran ${r.bahan.nama_bahan} tercatat sebagai ${no}. Sisa ${r.stok_akhir} ${r.bahan.satuan_pakai}.${peringatan}` };
    res.redirect('/transaksi/keluar');
  } catch (e) {
    if (e instanceof AppError) return fail(req, res, e.message, '/transaksi/keluar'); // "Stok tidak mencukupi" (UC-10)
    throw e;
  }
}));

module.exports = router;
