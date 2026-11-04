const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { wrap, fail, ok } = require('../utils');

router.use(requireRole('pengelola'));

// UC-05
router.get('/', wrap(async (req, res) => {
  const [users] = await pool.query('SELECT id_user,nama,username,role,status_aktif FROM users ORDER BY status_aktif DESC, role, nama');
  res.render('akun/index', { title: 'Manajemen Akun Pengguna', active: 'akun', users });
}));

router.post('/', wrap(async (req, res) => {
  const { nama = '', username = '', password = '', role = 'karyawan' } = req.body;
  if (!nama.trim() || !username.trim() || !password) return fail(req, res, 'Nama, username, dan password wajib diisi.', '/akun');
  if (password.length < 6) return fail(req, res, 'Password minimal 6 karakter.', '/akun');
  if (!['pengelola', 'karyawan'].includes(role)) return fail(req, res, 'Peran tidak valid.', '/akun');
  try {
    await pool.query('INSERT INTO users (nama,username,password,role) VALUES (?,?,?,?)', [nama.trim(), username.trim(), await bcrypt.hash(password, 10), role]);
    ok(req, res, 'Akun berhasil ditambahkan.', '/akun');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return fail(req, res, 'Username sudah digunakan.', '/akun');
    throw e;
  }
}));

router.post('/:id', wrap(async (req, res) => {
  const { nama = '', role = 'karyawan', password = '' } = req.body;
  if (!nama.trim()) return fail(req, res, 'Nama wajib diisi.', '/akun');
  if (+req.params.id === req.session.user.id && role !== 'pengelola') return fail(req, res, 'Anda tidak dapat menurunkan peran akun sendiri.', '/akun');
  if (password && password.length < 6) return fail(req, res, 'Password minimal 6 karakter.', '/akun');
  const sets = ['nama=?', 'role=?'], p = [nama.trim(), role];
  if (password) { sets.push('password=?'); p.push(await bcrypt.hash(password, 10)); }
  await pool.query(`UPDATE users SET ${sets.join(',')} WHERE id_user=?`, [...p, req.params.id]);
  ok(req, res, 'Akun diperbarui.', '/akun');
}));

router.post('/:id/status', wrap(async (req, res) => {
  if (+req.params.id === req.session.user.id) return fail(req, res, 'Anda tidak dapat menonaktifkan akun sendiri.', '/akun');
  await pool.query('UPDATE users SET status_aktif = NOT status_aktif WHERE id_user=?', [req.params.id]);
  ok(req, res, 'Status akun diperbarui.', '/akun');
}));

module.exports = router;
