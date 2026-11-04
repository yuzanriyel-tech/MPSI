const router = require('express').Router();
const pool = require('../db');
const { requireLogin } = require('../middleware/auth');
const { wrap, isoDate, addDays } = require('../utils');
const { STATUS_SQL } = require('../services/stok');

router.get('/', requireLogin, wrap(async (req, res) => {
  const [[tot]] = await pool.query(
    `SELECT COUNT(*) total,
            SUM(stok_saat_ini>0 AND stok_saat_ini<=stok_minimum) menipis,
            SUM(stok_saat_ini<=0) habis,
            IFNULL(SUM(stok_saat_ini*harga_beli),0) nilai
     FROM bahan_baku`);

  const [menipisList] = await pool.query(
    `SELECT nama_bahan, stok_saat_ini, stok_minimum, satuan_pakai FROM bahan_baku
     WHERE stok_saat_ini<=stok_minimum ORDER BY stok_saat_ini/NULLIF(stok_minimum,0) ASC LIMIT 3`);

  // grafik 7 hari terakhir
  const today = isoDate();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const [m] = await pool.query('SELECT tanggal_masuk d, SUM(jumlah_masuk) t FROM stok_masuk WHERE tanggal_masuk>=? GROUP BY d', [days[0]]);
  const [k] = await pool.query('SELECT tanggal_keluar d, SUM(jumlah_keluar) t FROM stok_keluar WHERE tanggal_keluar>=? GROUP BY d', [days[0]]);
  const mm = Object.fromEntries(m.map((r) => [r.d, r.t]));
  const kk = Object.fromEntries(k.map((r) => [r.d, r.t]));
  const chart = {
    labels: days.map((d) => `${+d.slice(8)}/${+d.slice(5, 7)}`),
    masuk: days.map((d) => mm[d] || 0),
    keluar: days.map((d) => kk[d] || 0),
  };

  const [top] = await pool.query(
    `SELECT b.nama_bahan, COUNT(*) kali FROM stok_keluar s JOIN bahan_baku b ON b.id_bahan=s.id_bahan
     WHERE s.jenis_keluar='pemakaian' AND s.tanggal_keluar>=? GROUP BY b.id_bahan ORDER BY kali DESC LIMIT 3`, [addDays(today, -30)]);
  const maxKali = Math.max(1, ...top.map((t) => t.kali));
  top.forEach((t) => (t.pct = Math.round((t.kali / maxKali) * 100)));

  const [aktivitas] = await pool.query(
    `SELECT * FROM (
       SELECT 'masuk' jenis, b.nama_bahan, s.jumlah_masuk jumlah, b.satuan_pakai satuan, s.created_at ts FROM stok_masuk s JOIN bahan_baku b ON b.id_bahan=s.id_bahan
       UNION ALL
       SELECT 'keluar', b.nama_bahan, s.jumlah_keluar, b.satuan_pakai, s.created_at FROM stok_keluar s JOIN bahan_baku b ON b.id_bahan=s.id_bahan
     ) t ORDER BY ts DESC LIMIT 4`);

  const [stok] = await pool.query(
    `SELECT b.*, k.nama_kategori, ${STATUS_SQL} status FROM bahan_baku b JOIN kategori k ON k.id_kategori=b.id_kategori
     ORDER BY (b.stok_saat_ini/NULLIF(b.stok_minimum,0)) ASC, b.nama_bahan LIMIT 6`);

  res.render('dashboard', { title: 'Dashboard', active: 'dashboard', tot, menipisList, chart, top, aktivitas, stok, now: new Date() });
}));

module.exports = router;
