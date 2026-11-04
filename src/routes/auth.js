const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { wrap, fail } = require('../utils');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Masuk' });
});

// UC-01 + UC-02: verifikasi username/password terenkripsi, tentukan peran
router.post('/login', wrap(async (req, res) => {
  const { username = '', password = '', remember } = req.body;
  const [[u]] = await pool.query('SELECT * FROM users WHERE username=?', [username.trim()]);
  const valid = u && u.status_aktif && (await bcrypt.compare(password, u.password));
  if (!valid) {
    req.session.flash = { type: 'error', msg: 'Username atau password salah' };
    req.session.old = { username };
    return res.redirect('/login');
  }
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.user = { id: u.id_user, nama: u.nama, username: u.username, role: u.role };
    if (remember) req.session.cookie.maxAge = 7 * 24 * 3600 * 1000;
    res.redirect('/');
  });
}));

// UC-13
router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

module.exports = router;
