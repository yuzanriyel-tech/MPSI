// Kalkulasi langsung pada form stok keluar & stok masuk, serta interaksi kecil lainnya.
const $ = (s, r = document) => r.querySelector(s);
const fmt = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);

// ---- Stok keluar: sisa stok akhir + peringatan batas minimum ----
const fk = $('#form-keluar');
if (fk) {
  const sel = $('#bahan', fk), jml = $('#jumlah', fk), sisa = $('#sisa', fk), unit = $('#unit', fk), warn = $('#warn', fk), warnTxt = $('#warn-text', fk);
  const calc = () => {
    const o = sel.selectedOptions[0];
    if (!o || !o.value) { unit.textContent = '-'; sisa.value = ''; warn.hidden = true; return; }
    const stok = +o.dataset.stok, min = +o.dataset.min, sat = o.dataset.satuan, n = parseFloat(String(jml.value).replace(',', '.')) || 0;
    unit.textContent = sat;
    const akhir = Math.round((stok - n) * 100) / 100;
    if (akhir < 0) { sisa.value = 'Stok tidak mencukupi (tersedia ' + fmt(stok) + ' ' + sat + ')'; sisa.classList.add('bad'); warn.hidden = true; return; }
    sisa.value = fmt(akhir) + ' ' + sat + (n > 0 && akhir <= min ? ' (Perhatian: di bawah batas minimum ' + fmt(min) + ' ' + sat + ')' : '');
    sisa.classList.toggle('bad', n > 0 && akhir <= min);
    warn.hidden = !(n > 0 && akhir <= min);
    if (!warn.hidden) warnTxt.textContent = 'Pengeluaran ini menyebabkan stok ' + o.dataset.nama + ' tersisa ' + fmt(akhir) + ' ' + sat + ' (batas minimum ' + fmt(min) + ' ' + sat + '). Bahan akan ditandai di dashboard agar segera dipesan ulang.';
  };
  [sel, jml].forEach((e) => e.addEventListener('input', calc)); calc();
}

// ---- Stok masuk: konversi satuan beli -> satuan pakai ----
const fm = $('#form-masuk');
if (fm) {
  const sel = $('#bahan', fm), jml = $('#jumlah', fm), unit = $('#unit', fm), box = $('#calc', fm), pem = $('#pemasok', fm);
  const calc = () => {
    const o = sel.selectedOptions[0];
    if (!o || !o.value) { unit.textContent = '-'; box.hidden = true; return; }
    const n = parseFloat(String(jml.value).replace(',', '.')) || 0, isi = +o.dataset.isi, stok = +o.dataset.stok, masuk = n * isi, total = stok + masuk;
    unit.textContent = o.dataset.beli;
    if (o.dataset.pemasok && !pem.dataset.touched) pem.value = o.dataset.pemasok;
    box.hidden = false;
    $('#calc-text', box).textContent = 'Stok awal ' + fmt(stok) + ' ' + o.dataset.pakai + ' + masuk ' + fmt(masuk) + ' ' + o.dataset.pakai + (isi !== 1 ? ' (' + fmt(n) + ' ' + o.dataset.beli + ' x ' + fmt(isi) + ')' : '') + ' = total ' + fmt(total) + ' ' + o.dataset.pakai;
    $('#calc-val', box).textContent = '+Rp ' + fmt(Math.round(masuk * +o.dataset.harga));
  };
  pem.addEventListener('change', () => (pem.dataset.touched = 1));
  [sel, jml].forEach((e) => e.addEventListener('input', calc)); calc();

  // Tanggal diterima -> batas minimum tanggal kedaluwarsa + usulan dari masa simpan bahan (bisa diubah)
  const tgl = $('#tgl', fm), exp = $('#exp', fm), expHint = $('#exp-hint', fm);
  const p2 = (n) => String(n).padStart(2, '0');
  const plus = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  if (exp.value) exp.dataset.touched = 1; // nilai hasil submit sebelumnya tidak ditimpa
  const usul = () => {
    const o = sel.selectedOptions[0];
    if (tgl.value) exp.min = tgl.value;
    if (o && o.dataset.masa && tgl.value && !exp.dataset.touched) {
      exp.value = plus(tgl.value, +o.dataset.masa);
      expHint.textContent = 'Diusulkan dari masa simpan ' + o.dataset.masa + ' hari; ubah sesuai kemasan.';
    }
  };
  exp.addEventListener('input', () => (exp.dataset.touched = 1));
  [sel, tgl].forEach((e) => e.addEventListener('input', usul)); usul();
}

// ---- Login: tampilkan/sembunyikan password ----
const tp = $('#toggle-pass');
if (tp) tp.addEventListener('click', () => { const i = $('#password'); i.type = i.type === 'password' ? 'text' : 'password'; tp.textContent = i.type === 'password' ? 'Tampilkan' : 'Sembunyikan'; });

// ---- Akun: dialog tambah / ubah / nonaktifkan ----
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
  const d = document.getElementById(b.dataset.open);
  Object.entries(b.dataset).forEach(([k, v]) => { const el = d.querySelector('[data-fill="' + k + '"]'); if (el) { if (el.tagName === 'FORM') el.action = v; else if ('value' in el) el.value = v; else el.textContent = v; } });
  if (d.id === 'dlg-form') {
    const edit = b.dataset.mode === 'edit';
    const u = d.querySelector('[name="username"]'), pw = d.querySelector('[name="password"]');
    u.readOnly = edit; pw.required = !edit;
    pw.placeholder = edit ? 'Kosongkan jika tidak diganti' : 'Minimal 6 karakter';
    d.querySelector('#hint-username').hidden = !edit;
  }
  d.showModal();
}));
document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

// ---- Konfirmasi hapus ----
document.querySelectorAll('form[data-confirm]').forEach((f) => f.addEventListener('submit', (e) => { if (!confirm(f.dataset.confirm)) e.preventDefault(); }));
