function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
// FR-1: hak akses pengelola vs karyawan
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== role) {
      return res.status(403).render('error', { title: 'Akses ditolak', code: 403, message: 'Halaman ini hanya untuk Pengelola.' });
    }
    next();
  };
}
module.exports = { requireLogin, requireRole };
