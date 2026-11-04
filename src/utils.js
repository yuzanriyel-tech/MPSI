class AppError extends Error {}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// simpan pesan + input lama ke session lalu kembali ke halaman sebelumnya
function fail(req, res, msg, to) {
  req.session.flash = { type: 'error', msg };
  req.session.old = req.body || {};
  res.redirect(to || req.get('referer') || '/');
}
function ok(req, res, msg, to) {
  req.session.flash = { type: 'ok', msg };
  res.redirect(to);
}

const pad = (n) => String(n).padStart(2, '0');
function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

module.exports = { AppError, wrap, fail, ok, isoDate, addDays, round2 };
