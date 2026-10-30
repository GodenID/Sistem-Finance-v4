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

const assertWritable = (req, table) => {
    if (ADMIN_WRITE_TABLES.has(table) && req.user.role !== 'administrator') {
        throw httpError(403, 'Hanya administrator yang boleh mengubah data ini');
    }
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
        const values = [];
        const tuples = clean.map((row) => {
            const placeholders = columns.map((column) => {
                values.push(row[column] === undefined ? null : row[column]);
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
        assertWritable(req, table);
        const patch = req.body?.updates || req.body?.row || req.body;
        if (!patch || typeof patch !== 'object') throw httpError(400, 'Body kosong');
        const columns = Object.keys(patch);
        if (!columns.length) throw httpError(400, 'Tidak ada kolom yang diubah');
        const values = columns.map((column) => {
            ident(column);
            return patch[column] === undefined ? null : patch[column];
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
        const columns = Object.keys(patch);
        if (!columns.length) throw httpError(400, 'Tidak ada kolom yang diubah');
        const values = columns.map((column) => {
            ident(column);
            return patch[column] === undefined ? null : patch[column];
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
