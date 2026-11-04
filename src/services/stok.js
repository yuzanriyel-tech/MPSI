// Logika bisnis stok: konversi satuan (UC-08), FEFO & validasi saldo (UC-10).
const pool = require('../db');
const { AppError, isoDate, addDays, round2 } = require('../utils');

/**
 * UC-07 + UC-08: catat stok masuk sebagai satu batch.
 * Isi salah satu: jumlah_satuan_beli (form stok masuk) atau jumlah_pakai (stok awal bahan baru).
 */
async function stokMasuk(d) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[b]] = await conn.query('SELECT * FROM bahan_baku WHERE id_bahan=? FOR UPDATE', [d.id_bahan]);
    if (!b) throw new AppError('Bahan baku tidak ditemukan.');

    let beli, masuk;
    if (d.jumlah_pakai != null) {
      masuk = round2(d.jumlah_pakai);
      beli = round2(masuk / b.isi_per_satuan_beli);
    } else {
      beli = round2(d.jumlah_satuan_beli);
      masuk = round2(beli * b.isi_per_satuan_beli); // konversi satuan beli -> satuan pakai
    }
    if (!(masuk > 0)) throw new AppError('Jumlah harus lebih dari 0.');

    const tgl = d.tanggal_masuk || isoDate();
    const exp = d.tanggal_kedaluwarsa || addDays(tgl, b.masa_simpan_hari);
    if (exp < tgl) throw new AppError('Tanggal kedaluwarsa tidak boleh sebelum tanggal masuk.');

    const base = `BB-${String(b.id_bahan).padStart(3, '0')}-${tgl.replace(/-/g, '')}`;
    const [[{ n }]] = await conn.query('SELECT COUNT(*) n FROM stok_masuk WHERE kode_batch=? OR kode_batch LIKE ?', [base, base + '-%']);
    const kode = n ? `${base}-${n + 1}` : base;

    await conn.query(
      `INSERT INTO stok_masuk (id_bahan,id_pemasok,id_user,kode_batch,tanggal_masuk,jumlah_satuan_beli,jumlah_masuk,sisa_stok,tanggal_kedaluwarsa,catatan)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [b.id_bahan, d.id_pemasok || b.id_pemasok, d.id_user, kode, tgl, beli, masuk, masuk, exp, d.catatan || null]
    );
    await conn.query('UPDATE bahan_baku SET stok_saat_ini = stok_saat_ini + ? WHERE id_bahan=?', [masuk, b.id_bahan]);
    await conn.commit();
    return { kode, masuk, stok_akhir: round2(b.stok_saat_ini + masuk), bahan: b };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** UC-09 + UC-10: catat stok keluar; ambil dari batch kedaluwarsa paling awal (FEFO). */
async function stokKeluar(d) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[b]] = await conn.query('SELECT * FROM bahan_baku WHERE id_bahan=? FOR UPDATE', [d.id_bahan]);
    if (!b) throw new AppError('Bahan baku tidak ditemukan.');

    const jumlah = round2(d.jumlah_keluar);
    if (!(jumlah > 0)) throw new AppError('Jumlah harus lebih dari 0.');
    if (jumlah > b.stok_saat_ini) throw new AppError(`Stok tidak mencukupi. Tersedia ${b.stok_saat_ini} ${b.satuan_pakai}.`);

    const [batches] = await conn.query(
      `SELECT id_stok_masuk, sisa_stok FROM stok_masuk
       WHERE id_bahan=? AND sisa_stok>0
       ORDER BY tanggal_kedaluwarsa ASC, id_stok_masuk ASC FOR UPDATE`, [b.id_bahan]);

    const [r] = await conn.query(
      'INSERT INTO stok_keluar (id_bahan,id_user,tanggal_keluar,jumlah_keluar,jenis_keluar,keterangan) VALUES (?,?,?,?,?,?)',
      [b.id_bahan, d.id_user, d.tanggal_keluar || isoDate(), jumlah, d.jenis_keluar || 'pemakaian', d.keterangan || null]);

    let sisa = jumlah;
    for (const bt of batches) {
      if (sisa <= 0) break;
      const ambil = round2(Math.min(sisa, bt.sisa_stok));
      await conn.query('UPDATE stok_masuk SET sisa_stok = sisa_stok - ? WHERE id_stok_masuk=?', [ambil, bt.id_stok_masuk]);
      await conn.query('INSERT INTO detail_stok_keluar (id_stok_keluar,id_stok_masuk,jumlah_diambil) VALUES (?,?,?)', [r.insertId, bt.id_stok_masuk, ambil]);
      sisa = round2(sisa - ambil);
    }
    if (sisa > 0) throw new AppError('Saldo batch tidak konsisten dengan stok bahan. Hubungi Pengelola.');

    await conn.query('UPDATE bahan_baku SET stok_saat_ini = stok_saat_ini - ? WHERE id_bahan=?', [jumlah, b.id_bahan]);
    await conn.commit();
    const akhir = round2(b.stok_saat_ini - jumlah);
    return { id: r.insertId, stok_akhir: akhir, di_bawah_minimum: akhir <= b.stok_minimum, bahan: b };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// status stok (UC-04): habis / menipis (<= minimum) / aman
const STATUS_SQL = `CASE WHEN b.stok_saat_ini<=0 THEN 'habis' WHEN b.stok_saat_ini<=b.stok_minimum THEN 'menipis' ELSE 'aman' END`;

module.exports = { stokMasuk, stokKeluar, STATUS_SQL };
