const router = require('express').Router();
const pool = require('../db');
const { requireLogin } = require('../middleware/auth');
const { wrap, fail, ok, isoDate, AppError } = require('../utils');
const { stokMasuk, stokKeluar } = require('../services/stok');

router.use(requireLogin);
router.get('/', (req, res) => res.redirect('/transaksi/masuk'));

const compact = (d) => d.replace(/-/g, '');
async function nomor(prefix, table, col) {
  const today = isoDate();
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM ${table} WHERE ${col}=?`, [today]);
  return `${prefix}-${compact(today)}-${String(n + 1).padStart(3, '0')}`;
}
const bahanList = () => pool.query('SELECT id_bahan, kode_bahan, nama_bahan, satuan_beli, satuan_pakai, isi_per_satuan_beli, stok_saat_ini, stok_minimum, harga_beli, id_pemasok FROM bahan_baku ORDER BY nama_bahan').then(([r]) => r);

// ---------- UC-07 Stok masuk ----------
router.get('/masuk', wrap(async (req, res) => {
  const [pemasok] = await pool.query('SELECT * FROM pemasok ORDER BY nama_pemasok');
  res.render('transaksi/masuk', { title: 'Penerimaan Stok Masuk', active: 'transaksi', pemasok, bahan: await bahanList(), noDok: await nomor('PO', 'stok_masuk', 'tanggal_masuk'), today: isoDate() });
}));

router.post('/masuk', wrap(async (req, res) => {
  const b = req.body;
  if (!b.id_bahan) return fail(req, res, 'Pilih bahan baku.', '/transaksi/masuk');
  if (!b.tanggal_kedaluwarsa) return fail(req, res, 'Tanggal kedaluwarsa wajib diisi.', '/transaksi/masuk');
  try {
    const r = await stokMasuk({
      id_bahan: +b.id_bahan, id_pemasok: b.id_pemasok ? +b.id_pemasok : null, id_user: req.session.user.id,
      jumlah_satuan_beli: +String(b.jumlah_satuan_beli).replace(',', '.'), tanggal_kedaluwarsa: b.tanggal_kedaluwarsa, catatan: (b.catatan || '').trim(),
    });
    ok(req, res, `Stok masuk ${r.bahan.nama_bahan} tercatat (batch ${r.kode}). Stok sekarang ${r.stok_akhir} ${r.bahan.satuan_pakai}.`, '/transaksi/masuk');
  } catch (e) {
    if (e instanceof AppError) return fail(req, res, e.message, '/transaksi/masuk');
    throw e;
  }
}));

// ---------- UC-09 Stok keluar ----------
router.get('/keluar', wrap(async (req, res) => {
  res.render('transaksi/keluar', { title: 'Pengeluaran Stok Bahan Baku', active: 'transaksi', bahan: await bahanList(), noDok: await nomor('OUT', 'stok_keluar', 'tanggal_keluar'), now: new Date() });
}));

router.post('/keluar', wrap(async (req, res) => {
  const b = req.body;
  if (!b.id_bahan) return fail(req, res, 'Pilih bahan baku.', '/transaksi/keluar');
  if (!['pemakaian', 'rusak', 'kedaluwarsa'].includes(b.jenis_keluar)) return fail(req, res, 'Tujuan pengeluaran tidak valid.', '/transaksi/keluar');
  try {
    const r = await stokKeluar({
      id_bahan: +b.id_bahan, id_user: req.session.user.id, jumlah_keluar: +String(b.jumlah_keluar).replace(',', '.'),
      jenis_keluar: b.jenis_keluar, keterangan: (b.keterangan || '').trim(),
    });
    const peringatan = r.di_bawah_minimum ? ` Perhatian: stok kini di bawah batas minimum, bahan perlu dipesan ulang.` : '';
    req.session.flash = { type: r.di_bawah_minimum ? 'warn' : 'ok', msg: `Pengeluaran ${r.bahan.nama_bahan} tercatat. Sisa ${r.stok_akhir} ${r.bahan.satuan_pakai}.${peringatan}` };
    res.redirect('/transaksi/keluar');
  } catch (e) {
    if (e instanceof AppError) return fail(req, res, e.message, '/transaksi/keluar'); // "Stok tidak mencukupi" (UC-10)
    throw e;
  }
}));

module.exports = router;
