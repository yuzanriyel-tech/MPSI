require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-ubah-di-env',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
  // NOTE: MemoryStore hanya untuk prototype. Pakai express-mysql-session saat hosting.
}));

// helper tampilan
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
app.locals.num = (n) => nf.format(n ?? 0);
app.locals.rp = (n) => 'Rp ' + nf.format(Math.round(n ?? 0));
app.locals.tgl = (s) => {
  if (!s) return '-';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return `${+d} ${BLN[+m - 1]} ${y}`;
};
app.locals.waktu = (ts) => {
  if (!ts) return '';
  const d = new Date(String(ts).replace(' ', 'T'));
  return isNaN(d) ? '' : `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')} WIB`;
};
app.locals.inisial = (s) => (s || '?').trim().charAt(0).toUpperCase();
app.locals.badge = (st) => {
  const map = { aman: ['ok', 'Aman'], menipis: ['bad', 'Stok Menipis'], habis: ['bad', 'Stok Habis'] };
  const [c, t] = map[st] || ['ok', st];
  return `<span class="pill ${c}"><i></i>${t}</span>`;
};

app.use((req, res, next) => {
  const s = req.session;
  res.locals.user = s.user || null;
  res.locals.flash = s.flash || null;
  const old = s.old || {};
  res.locals.v = (k, d = '') => (old[k] !== undefined ? old[k] : d ?? '');
  res.locals.active = '';
  res.locals.q = req.query.q || '';
  delete s.flash; delete s.old;
  next();
});

app.use(require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/bahan', require('./routes/bahan'));
app.use('/transaksi', require('./routes/transaksi'));
app.use('/laporan', require('./routes/laporan'));
app.use('/pemantauan', require('./routes/pemantauan'));
app.use('/akun', require('./routes/akun'));

app.use((req, res) => res.status(404).render('error', { title: 'Tidak ditemukan', code: 404, message: 'Halaman yang Anda cari tidak ada.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Kesalahan server', code: 500, message: 'Terjadi kesalahan. Coba lagi atau hubungi pengelola sistem.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Radjo Inventory berjalan di http://localhost:${port}`));
