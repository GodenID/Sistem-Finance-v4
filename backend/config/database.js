const { Pool } = require('pg');

// DATABASE_SSL override: Postgres internal Coolify tidak pakai TLS, sedangkan
// Supabase/DB publik butuh TLS. Tanpa override, perilaku lama tetap dipakai.
const sslEnabled = process.env.DATABASE_SSL
    ? process.env.DATABASE_SSL === 'true'
    : process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
