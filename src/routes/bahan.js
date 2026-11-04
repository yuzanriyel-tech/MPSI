const router = require('express').Router();
const pool = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { wrap, fail, ok, AppError } = require('../utils');
const { stokMasuk, STATUS_SQL } = require('../services/stok');

router.use(requireLogin);

async function lookups() {
  const [kategori] = await pool.query('SELECT * FROM kategori ORDER BY nama_kategori');
  const [pemasok] = await pool.query('SELECT * FROM pemasok ORDER BY nama_pemasok');
  return { kategori, pemasok };
}

function parseForm(b) {
  const n = (x) => (x === '' || x == null ? NaN : +String(x).replace(',', '.'));
  return {
    kode_bahan: (b.kode_bahan || '').trim(),
    nama_bahan: (b.nama_bahan || '').trim(),
    id_kategori: +b.id_kategori,
    id_pemasok: b.id_pemasok ? +b.id_pemasok : null,
    satuan_beli: (b.satuan_beli || '').trim(),
    satuan_pakai: (b.satuan_pakai || '').trim(),
    isi: n(b.isi_per_satuan_beli),
    stok_awal: n(b.stok_awal) || 0,
    stok_minimum: n(b.stok_minimum),
    harga_beli: n(b.harga_beli) || 0,
    masa: Math.round(n(b.masa_simpan_hari)) || 180,
  };
}
function validate(f) {
  if (!f.nama_bahan) return 'Nama bahan wajib diisi.';
  if (!f.id_kategori) return 'Kategori wajib dipilih.';
  if (!f.satuan_beli || !f.satuan_pakai) return 'Satuan beli dan satuan pakai wajib diisi.';
  if (!(f.isi > 0)) return 'Isi per satuan beli harus lebih dari 0.';
  if (!(f.stok_minimum >= 0)) return 'Batas minimum wajib diisi (boleh 0).';
  if (f.stok_awal < 0) return 'Stok awal tidak boleh negatif.';
  if (f.kode_bahan.length > 10) return 'Kode bahan maksimal 10 karakter.';
  return null;
}

// UC-06 (lihat daftar) + UC-11 (filter perlu dipesan)
router.get('/', wrap(async (req, res) => {
  const { q = '', kategori = '', status = '' } = req.query;
  const page = Math.max(1, +req.query.page || 1);
  const per = 10;
  const where = [], params = [];
  if (q) { where.push('(b.nama_bahan LIKE ? OR b.kode_bahan LIKE ? OR k.nama_kategori LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (kategori) { where.push('b.id_kategori=?'); params.push(kategori); }
  if (status === 'perlu-dipesan') where.push('b.stok_saat_ini<=b.stok_minimum');
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const from = 'FROM bahan_baku b JOIN kategori k ON k.id_kategori=b.id_kategori LEFT JOIN pemasok p ON p.id_pemasok=b.id_pemasok';

  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n ${from} ${w}`, params);
  const [rows] = await pool.query(
    `SELECT b.*, k.nama_kategori, p.nama_pemasok, ${STATUS_SQL} status ${from} ${w}
     ORDER BY (b.stok_saat_ini<=b.stok_minimum) DESC, b.nama_bahan LIMIT ? OFFSET ?`, [...params, per, (page - 1) * per]);
  const [chips] = await pool.query('SELECT k.id_kategori, k.nama_kategori, COUNT(b.id_bahan) n FROM kategori k LEFT JOIN bahan_baku b ON b.id_kategori=k.id_kategori GROUP BY k.id_kategori ORDER BY k.nama_kategori');
  const [[c]] = await pool.query('SELECT COUNT(*) semua, SUM(stok_saat_ini<=stok_minimum) pesan FROM bahan_baku');

  res.render('bahan/index', { title: 'Data Master Bahan Baku', active: 'bahan', rows, chips, c, n, page, per, pages: Math.ceil(n / per), qs: { q, kategori, status } });
}));

router.get('/baru', requireRole('pengelola'), wrap(async (req, res) => {
  res.render('bahan/form', { title: 'Tambah Bahan Baku', active: 'bahan', item: null, ...(await lookups()) });
}));

router.post('/', requireRole('pengelola'), wrap(async (req, res) => {
  const f = parseForm(req.body);
  const err = validate(f);
  if (err) return fail(req, res, err, '/bahan/baru');
  try {
    if (!f.kode_bahan) {
      const [[{ nx }]] = await pool.query('SELECT IFNULL(MAX(id_bahan),0)+1 nx FROM bahan_baku');
      f.kode_bahan = `BB-${String(nx).padStart(3, '0')}`;
    }
    const [r] = await pool.query(
      `INSERT INTO bahan_baku (id_kategori,id_pemasok,kode_bahan,nama_bahan,satuan_beli,satuan_pakai,isi_per_satuan_beli,stok_minimum,masa_simpan_hari,harga_beli)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [f.id_kategori, f.id_pemasok, f.kode_bahan, f.nama_bahan, f.satuan_beli, f.satuan_pakai, f.isi, f.stok_minimum, f.masa, f.harga_beli]);
    if (f.stok_awal > 0) {
      await stokMasuk({ id_bahan: r.insertId, id_pemasok: f.id_pemasok, id_user: req.session.user.id, jumlah_pakai: f.stok_awal, catatan: 'Stok awal' });
    }
    ok(req, res, `Bahan "${f.nama_bahan}" berhasil ditambahkan.`, '/bahan');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return fail(req, res, 'Kode bahan sudah digunakan.', '/bahan/baru');
    if (e instanceof AppError) return fail(req, res, e.message, '/bahan/baru');
    throw e;
  }
}));

router.get('/:id', wrap(async (req, res, next) => {
  const [[item]] = await pool.query(
    `SELECT b.*, k.nama_kategori, p.nama_pemasok, ${STATUS_SQL} status FROM bahan_baku b
     JOIN kategori k ON k.id_kategori=b.id_kategori LEFT JOIN pemasok p ON p.id_pemasok=b.id_pemasok WHERE b.id_bahan=?`, [req.params.id]);
  if (!item) return next();
  const [batches] = await pool.query('SELECT * FROM stok_masuk WHERE id_bahan=? AND sisa_stok>0 ORDER BY tanggal_kedaluwarsa', [item.id_bahan]);
  res.render('bahan/detail', { title: item.nama_bahan, active: 'bahan', item, batches });
}));

router.get('/:id/edit', requireRole('pengelola'), wrap(async (req, res, next) => {
  const [[item]] = await pool.query('SELECT * FROM bahan_baku WHERE id_bahan=?', [req.params.id]);
  if (!item) return next();
  res.render('bahan/form', { title: 'Ubah Bahan Baku', active: 'bahan', item, ...(await lookups()) });
}));

router.post('/:id', requireRole('pengelola'), wrap(async (req, res) => {
  const back = `/bahan/${req.params.id}/edit`;
  const f = parseForm(req.body);
  const err = validate(f);
  if (err) return fail(req, res, err, back);
  try {
    if (!f.kode_bahan) throw new AppError('Kode bahan wajib diisi.');
    await pool.query(
      `UPDATE bahan_baku SET id_kategori=?,id_pemasok=?,kode_bahan=?,nama_bahan=?,satuan_beli=?,satuan_pakai=?,isi_per_satuan_beli=?,stok_minimum=?,masa_simpan_hari=?,harga_beli=? WHERE id_bahan=?`,
      [f.id_kategori, f.id_pemasok, f.kode_bahan, f.nama_bahan, f.satuan_beli, f.satuan_pakai, f.isi, f.stok_minimum, f.masa, f.harga_beli, req.params.id]);
    ok(req, res, 'Data bahan baku diperbarui.', '/bahan');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return fail(req, res, 'Kode bahan sudah digunakan.', back);
    if (e instanceof AppError) return fail(req, res, e.message, back);
    throw e;
  }
}));

// hapus hanya jika belum pernah ada transaksi (menjaga riwayat)
router.post('/:id/hapus', requireRole('pengelola'), wrap(async (req, res) => {
  const [[t]] = await pool.query('SELECT (SELECT COUNT(*) FROM stok_masuk WHERE id_bahan=?) + (SELECT COUNT(*) FROM stok_keluar WHERE id_bahan=?) n', [req.params.id, req.params.id]);
  if (t.n > 0) return fail(req, res, 'Bahan sudah memiliki riwayat transaksi sehingga tidak dapat dihapus.', '/bahan');
  await pool.query('DELETE FROM bahan_baku WHERE id_bahan=?', [req.params.id]);
  ok(req, res, 'Bahan baku dihapus.', '/bahan');
}));

module.exports = router;
