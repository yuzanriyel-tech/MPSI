const router = require('express').Router();
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { wrap, isoDate, addDays } = require('../utils');

router.use(requireRole('pengelola'));

const UNION = `
  SELECT 'masuk' jenis, sm.id_stok_masuk id, sm.kode_batch no_transaksi, sm.tanggal_masuk tanggal, sm.created_at ts,
         b.id_kategori, b.nama_bahan, b.satuan_pakai satuan, sm.jumlah_masuk jumlah, u.nama petugas, IFNULL(sm.catatan,'') ket
  FROM stok_masuk sm JOIN bahan_baku b ON b.id_bahan=sm.id_bahan JOIN users u ON u.id_user=sm.id_user
  UNION ALL
  SELECT 'keluar', sk.id_stok_keluar, CONCAT('OUT-',DATE_FORMAT(sk.tanggal_keluar,'%Y%m%d'),'-',LPAD(sk.id_stok_keluar,3,'0')), sk.tanggal_keluar, sk.created_at,
         b.id_kategori, b.nama_bahan, b.satuan_pakai, sk.jumlah_keluar, u.nama, CONCAT(sk.jenis_keluar, IFNULL(CONCAT(': ',sk.keterangan),''))
  FROM stok_keluar sk JOIN bahan_baku b ON b.id_bahan=sk.id_bahan JOIN users u ON u.id_user=sk.id_user`;

function filters(q) {
  const today = isoDate();
  const f = { dari: q.dari || addDays(today, -30), sampai: q.sampai || today, jenis: q.jenis || '', kategori: q.kategori || '', cari: (q.cari || '').trim() };
  const where = ['t.tanggal BETWEEN ? AND ?'], params = [f.dari, f.sampai];
  if (f.jenis === 'masuk' || f.jenis === 'keluar') { where.push('t.jenis=?'); params.push(f.jenis); }
  if (f.kategori) { where.push('t.id_kategori=?'); params.push(f.kategori); }
  if (f.cari) { where.push('(t.no_transaksi LIKE ? OR t.ket LIKE ? OR t.nama_bahan LIKE ?)'); params.push(`%${f.cari}%`, `%${f.cari}%`, `%${f.cari}%`); }
  return { f, where: 'WHERE ' + where.join(' AND '), params };
}

// UC-12
router.get('/', wrap(async (req, res) => {
  const { f, where, params } = filters(req.query);
  const [rows] = await pool.query(`SELECT * FROM (${UNION}) t ${where} ORDER BY t.tanggal DESC, t.ts DESC, t.id DESC LIMIT 200`, params);
  const [[sum]] = await pool.query(
    `SELECT COUNT(*) n, IFNULL(SUM(CASE WHEN jenis='masuk' THEN jumlah END),0) masuk, IFNULL(SUM(CASE WHEN jenis='keluar' THEN jumlah END),0) keluar FROM (${UNION}) t ${where}`, params);
  const [kategori] = await pool.query('SELECT * FROM kategori ORDER BY nama_kategori');
  const [rekap] = await pool.query(
    `SELECT b.kode_bahan, b.nama_bahan, b.satuan_pakai, b.stok_saat_ini, b.stok_minimum,
            (SELECT IFNULL(SUM(jumlah_masuk),0) FROM stok_masuk WHERE id_bahan=b.id_bahan) total_masuk,
            (SELECT IFNULL(SUM(jumlah_keluar),0) FROM stok_keluar WHERE id_bahan=b.id_bahan) total_keluar
     FROM bahan_baku b ORDER BY b.nama_bahan`);
  res.render('laporan/index', { title: 'Laporan & Riwayat Mutasi Stok', active: 'laporan', rows, sum, kategori, rekap, f, query: new URLSearchParams(req.query).toString() });
}));

router.get('/export.csv', wrap(async (req, res) => {
  const { where, params } = filters(req.query);
  const [rows] = await pool.query(`SELECT * FROM (${UNION}) t ${where} ORDER BY t.tanggal DESC, t.ts DESC, t.id DESC`, params);
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [['Tanggal', 'No Transaksi', 'Bahan Baku', 'Jenis', 'Jumlah', 'Satuan', 'Petugas', 'Keterangan'].join(',')];
  for (const r of rows) lines.push([r.tanggal, r.no_transaksi, r.nama_bahan, r.jenis === 'masuk' ? 'Stok Masuk' : 'Stok Keluar', r.jumlah, r.satuan, r.petugas, r.ket].map(esc).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="riwayat-stok-${isoDate()}.csv"`);
  res.send('\ufeff' + lines.join('\r\n'));
}));

module.exports = router;
