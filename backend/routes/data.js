/**
 * Data Gateway — pengganti akses langsung frontend ke Supabase (PostgREST).
 *
 * Semua query tabel lewat sini supaya:
 * - kredensial DB tidak pernah sampai ke browser,
 * - akses wajib sesi JWT (authenticateToken),
 * - nama tabel & kolom divalidasi ketat sebelum masuk SQL.
 *
 * Kontrak respons dibuat mirip supabase-js: { data, count, error }.
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const ALLOWED_TABLES = new Set([
    'users',
    'vendors',
    'payment_requests',
    'kasbon',
    'klaim',
    'penyelesaian',
    'activity_logs',
    'recurring_transactions',
    'recurring_instances',
    'recurring_logs',
    'changelog',
    'app_settings',
    'password_resets',
]);

// Tabel yang hanya boleh ditulis administrator.
const ADMIN_WRITE_TABLES = new Set(['users', 'app_settings', 'password_resets']);

const IDENT_RE = /^[a-z_][a-z0-9_]*$/i;
const COLUMN_OPS = {
    eq: '=',
    neq: '<>',
    gte: '>=',
    lte: '<=',
    like: 'LIKE',
    ilike: 'ILIKE',
};

router.use(authenticateToken);

const httpError = (status, message) => {
    const err = new Error(message);
    err.status = status;
    return err;
};

const ident = (name) => {
    const value = String(name || '').trim();
    if (!IDENT_RE.test(value)) throw httpError(400, `Nama kolom tidak valid: ${name}`);
    return `"${value}"`;
};

const tableOf = (req) => {
    const table = req.params.table;
    if (!ALLOWED_TABLES.has(table)) throw httpError(400, `Tabel tidak diizinkan: ${table}`);
    return table;
};

// Kolom profil yang boleh diubah user untuk akunnya sendiri.
const SELF_WRITE_USER_COLUMNS = new Set(['name', 'email', 'email_notifications_enabled']);

const assertWritable = (req, table, patch = null) => {
    if (!ADMIN_WRITE_TABLES.has(table) || req.user.role === 'administrator') return;
    if (table === 'users' && patch && req.user.id === req.params.id) {
        const forbidden = Object.keys(patch).filter((column) => !SELF_WRITE_USER_COLUMNS.has(column));
        if (!forbidden.length) return;
    }
    throw httpError(403, 'Hanya administrator yang boleh mengubah data ini');
};

const parseFilters = (req) => {
    const filters = [];
    if (req.query.filters) {
        let parsed;
        try {
            parsed = JSON.parse(req.query.filters);
        } catch {
            throw httpError(400, 'Parameter filters bukan JSON valid');
        }
        if (!Array.isArray(parsed)) throw httpError(400, 'Parameter filters harus array');
        for (const item of parsed) {
            const op = String(item?.op || 'eq');
            if (!COLUMN_OPS[op] && op !== 'in') throw httpError(400, `Operator tidak didukung: ${op}`);
            filters.push({ col: item?.col, op, value: item?.value });
        }
    }
    if (req.query.or) filters.push({ or: parseOr(String(req.query.or)) });
    return filters;
};

/** Format .or() PostgREST: "kolom.ilike.%cari%,kolom2.eq.nilai" */
const parseOr = (expr) => {
    return expr.split(',').map((part) => {
        const first = part.indexOf('.');
        const second = part.indexOf('.', first + 1);
        if (first < 1 || second < 0) throw httpError(400, `Ekspresi or tidak valid: ${part}`);
        const col = part.slice(0, first);
        const op = part.slice(first + 1, second);
        const value = part.slice(second + 1);
        if (!COLUMN_OPS[op]) throw httpError(400, `Operator or tidak didukung: ${op}`);
        return { col, op, value };
    });
};

const buildWhere = (filters, params) => {
    const clauses = [];
    for (const filter of filters) {
        if (filter.or) {
            const inner = filter.or.map((item) => {
                params.push(item.value);
                return `${ident(item.col)} ${COLUMN_OPS[item.op]} $${params.length}`;
            });
            clauses.push(`(${inner.join(' OR ')})`);
            continue;
        }
        if (filter.op === 'in') {
            const values = Array.isArray(filter.value) ? filter.value : [filter.value];
            if (!values.length) {
                clauses.push('FALSE');
                continue;
            }
            params.push(values);
            clauses.push(`${ident(filter.col)} = ANY($${params.length})`);
            continue;
        }
        params.push(filter.value);
        clauses.push(`${ident(filter.col)} ${COLUMN_OPS[filter.op]} $${params.length}`);
    }
    return clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
};

const selectClause = (req) => {
    const raw = String(req.query.select || '*').trim();
    if (raw === '*') return '*';
    const columns = raw.split(',').map((c) => ident(c)).join(', ');
    return columns || '*';
};

const orderClause = (req) => {
    if (!req.query.order) return '';
    let column = req.query.order;
    let ascending = req.query.asc !== 'false';
    const direct = String(column).match(/^([a-z_][a-z0-9_]*)\.(asc|desc)$/i);
    if (direct) {
        column = direct[1];
        ascending = direct[2].toLowerCase() === 'asc';
    }
    return ` ORDER BY ${ident(column)} ${ascending ? 'ASC' : 'DESC'}`;
};

const limitClause = (req) => {
    const params = [];
    let sql = '';
    if (req.query.range) {
        const [from, to] = String(req.query.range).split('-').map((n) => parseInt(n, 10));
        if (Number.isFinite(from) && Number.isFinite(to)) {
            sql += ` LIMIT ${Math.max(0, to - from + 1)} OFFSET ${Math.max(0, from)}`;
        }
    } else if (req.query.limit !== undefined) {
        const limit = parseInt(req.query.limit, 10);
        if (Number.isFinite(limit) && limit >= 0) sql += ` LIMIT ${limit}`;
    }
    return { sql, params };
};

/** Buang kolom password dari hasil users untuk selain administrator. */
const sanitizeRows = (req, table, rows) => {
    if (table !== 'users' || req.user.role === 'administrator') return rows;
    return rows.map((row) => {
        if (!row || !('password' in row)) return row;
        const { password, ...rest } = row;
        return rest;
    });
};

// node-postgres mengirim array/objek JS sebagai literal array Postgres, bukan
// JSON. Kolom json/jsonb harus di-stringify dulu. Tipe kolom diambil sekali
// per tabel lalu di-cache sampai proses restart (schema jarang berubah).
const jsonColumnsCache = new Map();

const jsonColumnsFor = async (table) => {
    const cached = jsonColumnsCache.get(table);
    if (cached) return cached;
    const result = await db.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
            AND data_type IN ('json', 'jsonb')`,
        [table]
    );
    const columns = new Set(result.rows.map((row) => row.column_name));
    jsonColumnsCache.set(table, columns);
    return columns;
};

const prepareWriteRow = (row, jsonColumns) => {
    if (!jsonColumns.size) return row;
    const prepared = { ...row };
    for (const column of jsonColumns) {
        const value = prepared[column];
        if (value !== null && value !== undefined && typeof value === 'object') {
            prepared[column] = JSON.stringify(value);
        }
    }
    return prepared;
};

// ---------------------------------------------------------------------------
// RPC pengganti get_dashboard_counts (tanpa bergantung pada fungsi SQL lama)
// ---------------------------------------------------------------------------
router.get('/rpc/dashboard-counts', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT jsonb_build_object(
                'payment_requests', (
                    SELECT jsonb_build_object(
                        'total', COUNT(*),
                        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
                        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
                        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
                    ) FROM payment_requests
                ),
                'kasbon', (
                    SELECT jsonb_build_object(
                        'total', COUNT(*),
                        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
                        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
                        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
                    ) FROM kasbon
                ),
                'klaim', (
                    SELECT jsonb_build_object(
                        'total', COUNT(*),
                        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
                        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
                        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
                    ) FROM klaim
                ),
                'penyelesaian', (
                    SELECT jsonb_build_object(
                        'total', COUNT(*),
                        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
                        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
                        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
                    ) FROM penyelesaian
                )
            ) AS data
        `);
        res.json({ data: result.rows[0].data, error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Dashboard counts error:', error);
        res.status(500).json({ data: null, error: { message: 'Gagal menghitung dashboard' } });
    }
});

// ---------------------------------------------------------------------------
// Revisi semua tabel sekaligus, untuk polling realtime 1 request per interval
// (sebelumnya 1 request per tabel).
// ---------------------------------------------------------------------------
router.get('/revisions', async (req, res) => {
    try {
        const tables = [...ALLOWED_TABLES];
        const result = await db.query(
            `SELECT relname,
                    COALESCE(n_tup_ins, 0) + COALESCE(n_tup_upd, 0) + COALESCE(n_tup_del, 0) AS revision
               FROM pg_stat_user_tables
              WHERE schemaname = 'public' AND relname = ANY($1::text[])`,
            [tables]
        );
        const data = Object.fromEntries(tables.map((table) => [table, '0']));
        for (const row of result.rows) data[row.relname] = String(row.revision);
        res.set('Cache-Control', 'no-store');
        res.json({ data, error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Table revisions error:', error);
        res.status(500).json({ data: null, error: { message: 'Gagal membaca revisi tabel' } });
    }
});

// ---------------------------------------------------------------------------
// Ringkasan Dashboard dalam 1 query: hitungan status + tren 7 hari.
// Menggantikan RPC counts + 3 query tren terpisah dari frontend.
// ---------------------------------------------------------------------------
const DASHBOARD_COUNT_TABLES = ['payment_requests', 'kasbon', 'klaim', 'penyelesaian'];
const DASHBOARD_TREND_TABLES = ['payment_requests', 'kasbon', 'klaim'];
const DASHBOARD_TREND_LIMIT = 2000;
const DASHBOARD_TREND_DAYS = 7;

const dashboardCountExpr = (table) => `(
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status_approval = 'Pending'),
        'approved', COUNT(*) FILTER (WHERE status_approval = 'Approved'),
        'rejected', COUNT(*) FILTER (WHERE status_approval = 'Rejected')
    ) FROM ${ident(table)}
)`;

const dashboardTrendExpr = (table) => `(
    SELECT COALESCE(
        jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at) ORDER BY created_at DESC),
        '[]'::jsonb
    )
      FROM (
        SELECT id, created_at
          FROM ${ident(table)}
         WHERE created_at >= $1::timestamptz
         ORDER BY created_at DESC
         LIMIT ${DASHBOARD_TREND_LIMIT}
      ) AS recent
)`;

router.get('/dashboard-summary', async (req, res) => {
    try {
        const rawSince = String(req.query.since || '').trim();
        const parsedSince = rawSince ? new Date(rawSince) : null;
        const sinceISO = parsedSince && !Number.isNaN(parsedSince.getTime())
            ? parsedSince.toISOString()
            : new Date(Date.now() - DASHBOARD_TREND_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const counts = DASHBOARD_COUNT_TABLES
            .map((table) => `'${table}', ${dashboardCountExpr(table)}`)
            .join(', ');
        const trends = DASHBOARD_TREND_TABLES
            .map((table) => `'${table}', ${dashboardTrendExpr(table)}`)
            .join(', ');

        const result = await db.query(
            `SELECT jsonb_build_object(
                'counts', jsonb_build_object(${counts}),
                'trends', jsonb_build_object(${trends})
            ) AS data`,
            [sinceISO]
        );
        res.set('Cache-Control', 'no-store');
        res.json({ data: result.rows[0].data, error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Dashboard summary error:', error);
        res.status(500).json({ data: null, error: { message: 'Gagal menghitung ringkasan dashboard' } });
    }
});

// ---------------------------------------------------------------------------
// Revisi tabel untuk polling realtime (pengganti Supabase Realtime)
// ---------------------------------------------------------------------------
router.get('/:table/changes', async (req, res) => {
    try {
        const table = tableOf(req);
        const result = await db.query(
            `SELECT COALESCE(n_tup_ins, 0) + COALESCE(n_tup_upd, 0) + COALESCE(n_tup_del, 0) AS revision,
                    COALESCE(n_tup_ins, 0) AS inserts,
                    COALESCE(n_tup_upd, 0) AS updates,
                    COALESCE(n_tup_del, 0) AS deletes
               FROM pg_stat_user_tables
              WHERE schemaname = 'public' AND relname = $1`,
            [table]
        );
        if (!result.rows.length) {
            return res.json({ data: { revision: '0' }, error: null });
        }
        const row = result.rows[0];
        res.json({
            data: {
                revision: String(row.revision),
                inserts: Number(row.inserts),
                updates: Number(row.updates),
                deletes: Number(row.deletes),
            },
            error: null,
        });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Table revision error:', error);
        res.status(error.status || 500).json({ data: null, error: { message: error.message } });
    }
});

// ---------------------------------------------------------------------------
// GET list
// ---------------------------------------------------------------------------
router.get('/:table', async (req, res) => {
    try {
        const table = tableOf(req);
        const filters = parseFilters(req);
        const params = [];
        const where = buildWhere(filters, params);
        const head = req.query.head === 'true';

        if (head || req.query.count === 'exact') {
            const counted = await db.query(
                `SELECT COUNT(*)::int AS count FROM ${ident(table)}${where}`,
                params
            );
            if (head) return res.json({ data: null, count: counted.rows[0].count, error: null });
            const { sql: limitSql } = limitClause(req);
            const rows = await db.query(
                `SELECT ${selectClause(req)} FROM ${ident(table)}${where}${orderClause(req)}${limitSql}`,
                params
            );
            const data = sanitizeRows(req, table, rows.rows);
            return res.json({ data, count: counted.rows[0].count, error: null });
        }

        const { sql: limitSql } = limitClause(req);
        const result = await db.query(
            `SELECT ${selectClause(req)} FROM ${ident(table)}${where}${orderClause(req)}${limitSql}`,
            params
        );
        res.json({ data: sanitizeRows(req, table, result.rows), count: null, error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Data select error:', error);
        res.status(error.status || 500).json({ data: null, error: { message: error.message } });
    }
});

// ---------------------------------------------------------------------------
// POST insert (bisa array)
// ---------------------------------------------------------------------------
router.post('/:table', async (req, res) => {
    try {
        const table = tableOf(req);
        assertWritable(req, table);
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [req.body?.row || req.body];
        const clean = rows.filter((row) => row && typeof row === 'object');
        if (!clean.length) throw httpError(400, 'Body kosong');

        const columns = [...new Set(clean.flatMap((row) => Object.keys(row)))];
        columns.forEach(ident);
        const returning = selectClause(req);
        const jsonColumns = await jsonColumnsFor(table);
        const values = [];
        const tuples = clean.map((row) => {
            const prepared = prepareWriteRow(row, jsonColumns);
            const placeholders = columns.map((column) => {
                const value = prepared[column];
                values.push(value === undefined ? null : value);
                return `$${values.length}`;
            });
            return `(${placeholders.join(', ')})`;
        });

        const sql = `INSERT INTO ${ident(table)} (${columns.map(ident).join(', ')})
                     VALUES ${tuples.join(', ')}
                     RETURNING ${returning}`;
        const result = await db.query(sql, values);
        res.status(201).json({ data: sanitizeRows(req, table, result.rows), error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Data insert error:', error);
        res.status(error.status || 500).json({ data: null, error: { message: error.message } });
    }
});

// ---------------------------------------------------------------------------
// PATCH update by id
// ---------------------------------------------------------------------------
const updateById = async (req, res) => {
    try {
        const table = tableOf(req);
        const patch = req.body?.updates || req.body?.row || req.body;
        assertWritable(req, table, patch);
        if (!patch || typeof patch !== 'object') throw httpError(400, 'Body kosong');
        const payload = prepareWriteRow(patch, await jsonColumnsFor(table));
        const columns = Object.keys(payload);
        if (!columns.length) throw httpError(400, 'Tidak ada kolom yang diubah');
        const values = columns.map((column) => {
            ident(column);
            return payload[column] === undefined ? null : payload[column];
        });
        values.push(req.params.id);
        const assignments = columns.map((column, index) => `${ident(column)} = $${index + 1}`).join(', ');
        const result = await db.query(
            `UPDATE ${ident(table)} SET ${assignments} WHERE id = $${values.length} RETURNING ${selectClause(req)}`,
            values
        );
        if (!result.rows.length) return res.status(404).json({ data: null, error: { message: 'Data tidak ditemukan' } });
        res.json({ data: sanitizeRows(req, table, result.rows), error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Data update error:', error);
        res.status(error.status || 500).json({ data: null, error: { message: error.message } });
    }
};

router.patch('/:table/:id', updateById);
router.put('/:table/:id', updateById);

const updateByFilter = async (req, res) => {
    try {
        const table = tableOf(req);
        assertWritable(req, table);
        const patch = req.body?.updates || req.body?.row || req.body;
        if (!patch || typeof patch !== 'object') throw httpError(400, 'Body kosong');
        const payload = prepareWriteRow(patch, await jsonColumnsFor(table));
        const columns = Object.keys(payload);
        if (!columns.length) throw httpError(400, 'Tidak ada kolom yang diubah');
        const values = columns.map((column) => {
            ident(column);
            return payload[column] === undefined ? null : payload[column];
        });
        const assignments = columns.map((column, index) => `${ident(column)} = $${index + 1}`).join(', ');
        const filters = parseFilters(req);
        if (!filters.length) throw httpError(400, 'Filter wajib diisi untuk update massal');
        const where = buildWhere(filters, values);
        const result = await db.query(
            `UPDATE ${ident(table)} SET ${assignments}${where} RETURNING ${selectClause(req)}`,
            values
        );
        res.json({ data: sanitizeRows(req, table, result.rows), error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Data update by filter error:', error);
        res.status(error.status || 500).json({ data: null, error: { message: error.message } });
    }
};

router.patch('/:table', updateByFilter);
router.put('/:table', updateByFilter);

// ---------------------------------------------------------------------------
// DELETE by id atau massal lewat filter
// ---------------------------------------------------------------------------
router.delete('/:table/:id', async (req, res) => {
    try {
        const table = tableOf(req);
        assertWritable(req, table);
        const result = await db.query(`DELETE FROM ${ident(table)} WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ data: null, error: { message: 'Data tidak ditemukan' } });
        res.json({ data: result.rows, error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Data delete error:', error);
        res.status(error.status || 500).json({ data: null, error: { message: error.message } });
    }
});

router.post('/:table/delete', async (req, res) => {
    try {
        const table = tableOf(req);
        assertWritable(req, table);
        const filters = parseFilters(req);
        if (!filters.length) throw httpError(400, 'Filter wajib diisi untuk hapus massal');
        const params = [];
        const where = buildWhere(filters, params);
        const result = await db.query(`DELETE FROM ${ident(table)}${where} RETURNING id`, params);
        res.json({ data: result.rows, error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Data bulk delete error:', error);
        res.status(error.status || 500).json({ data: null, error: { message: error.message } });
    }
});

// DELETE dengan filter (dipakai klien data untuk .delete().eq()/.in())
router.delete('/:table', async (req, res) => {
    try {
        const table = tableOf(req);
        assertWritable(req, table);
        const filters = parseFilters(req);
        if (!filters.length) throw httpError(400, 'Filter wajib diisi untuk hapus massal');
        const params = [];
        const where = buildWhere(filters, params);
        const result = await db.query(`DELETE FROM ${ident(table)}${where} RETURNING id`, params);
        res.json({ data: result.rows, error: null });
    } catch (error) {
        if (!error.status || error.status >= 500) console.error('Data bulk delete error:', error);
        res.status(error.status || 500).json({ data: null, error: { message: error.message } });
    }
});

module.exports = router;
