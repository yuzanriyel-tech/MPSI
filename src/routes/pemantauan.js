const router = require('express').Router();
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { wrap, isoDate, round2 } = require('../utils');

router.use(requireRole('pengelola'));

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// UC-11 Memantau Stok Minimum Bulanan (Pengelola)
// - Saldo tiap bahan dihitung dari riwayat transaksi sampai akhir bulan terpilih (atau hari ini bila bulan berjalan),
//   lalu dibandingkan dengan stok minimum.
// - Batch yang masih punya sisa dan kedaluwarsa sampai akhir bulan terpilih ditampilkan sebagai "mendekati kedaluwarsa".
router.get('/', wrap(async (req, res) => {
  const today = isoDate();
  const bulanIni = today.slice(0, 7);
  let bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.bulan || '') ? req.query.bulan : bulanIni;
  if (bulan > bulanIni) bulan = bulanIni; // bulan depan belum punya data transaksi

  const [y, m] = bulan.split('-').map(Number);
  const awal = `${bulan}-01`;
  const akhirBulan = `${bulan}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const batas = akhirBulan > today ? today : akhirBulan; // saldo dihitung sampai tanggal ini

  const [semua] = await pool.query(
    `SELECT b.id_bahan, b.kode_bahan, b.nama_bahan, b.satuan_beli, b.satuan_pakai, b.isi_per_satuan_beli, b.stok_minimum,
            k.nama_kategori, p.nama_pemasok,
            (SELECT IFNULL(SUM(jumlah_masuk),0) FROM stok_masuk WHERE id_bahan=b.id_bahan AND tanggal_masuk<=?)
          - (SELECT IFNULL(SUM(jumlah_keluar),0) FROM stok_keluar WHERE id_bahan=b.id_bahan AND tanggal_keluar<=?) saldo,
            (SELECT IFNULL(SUM(jumlah_keluar),0) FROM stok_keluar WHERE id_bahan=b.id_bahan AND tanggal_keluar BETWEEN ? AND ?) pakai_bulan
     FROM bahan_baku b JOIN kategori k ON k.id_kategori=b.id_kategori LEFT JOIN pemasok p ON p.id_pemasok=b.id_pemasok
     ORDER BY b.nama_bahan`, [batas, batas, awal, batas]);

  const perluPesan = semua
    .map((b) => {
      const saldo = round2(b.saldo);
      return {
        ...b, saldo,
        status: saldo <= 0 ? 'habis' : 'menipis',
        kurang: round2(Math.max(0, b.stok_minimum - saldo)),
        kurangBeli: Math.ceil((Math.max(0, b.stok_minimum - saldo) / b.isi_per_satuan_beli) * 100) / 100,
      };
    })
    .filter((b) => b.saldo <= b.stok_minimum)
    .sort((a, b) => a.saldo / (a.stok_minimum || 1) - b.saldo / (b.stok_minimum || 1));

  const [kedaluwarsa] = await pool.query(
    `SELECT s.kode_batch, s.sisa_stok, s.tanggal_kedaluwarsa, b.nama_bahan, b.satuan_pakai
     FROM stok_masuk s JOIN bahan_baku b ON b.id_bahan=s.id_bahan
     WHERE s.sisa_stok>0 AND s.tanggal_kedaluwarsa<=? ORDER BY s.tanggal_kedaluwarsa, s.id_stok_masuk`, [akhirBulan]);
  kedaluwarsa.forEach((s) => { s.lewat = s.tanggal_kedaluwarsa < today; });

  res.render('pemantauan/index', {
    title: 'Pemantauan Stok Minimum', active: 'pemantauan',
    bulan, bulanIni, namaBulan: `${BULAN[m - 1]} ${y}`, batas, total: semua.length, perluPesan, kedaluwarsa, today,
  });
}));

module.exports = router;
