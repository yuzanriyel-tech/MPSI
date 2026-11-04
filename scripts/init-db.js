// Membuat database + semua tabel dari database/schema.sql
// Pakai:  npm run db:init           (aman, tidak menghapus data)
//         node scripts/init-db.js --drop   (hapus database lalu buat ulang)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const name = process.env.DB_NAME || 'radjo_inventory';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: +(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  if (process.argv.includes('--drop')) await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${name}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));
  console.log(`Database "${name}" siap.`);
  await conn.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
