/**
 * Klien data pengganti @supabase/supabase-js.
 *
 * Aplikasi dulu bicara langsung ke Supabase (PostgREST) memakai anon key.
 * Sekarang semua query diteruskan ke backend Express (`/api/data`), yang
 * memegang kredensial database dan mewajibkan sesi JWT.
 *
 * Permukaan API sengaja dibuat mirip supabase-js supaya pemanggil lama
 * (`.from().select().eq().single()` dan seterusnya) tidak perlu diubah.
 */

const BACKEND_URL = (import.meta.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'authToken';

const authToken = () => {
    try {
        return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
        return '';
    }
};

const toError = (message, code = null) => ({ message, code });

const encodeFilters = (filters, orExprs) => {
    const parts = {};
    if (filters.length) parts.filters = JSON.stringify(filters);
    if (orExprs.length) parts.or = orExprs.join(',');
    return parts;
};

class QueryBuilder {
    constructor(table) {
        this.table = table;
        this.op = 'select';
        this.columns = '*';
        this.countMode = null;
        this.head = false;
        this.filters = [];
        this.orExprs = [];
        this.orderBy = null;
        this.ascending = true;
        this.limitValue = null;
        this.rangeValue = null;
        this.mode = 'many';
        this.payload = null;
    }

    select(columns = '*', options = {}) {
        this.columns = columns || '*';
        if (options.count) this.countMode = options.count;
        if (options.head) this.head = true;
        return this;
    }

    insert(payload) {
        this.op = 'insert';
        this.payload = payload;
        return this;
    }

    update(payload) {
        this.op = 'update';
        this.payload = payload;
        return this;
    }

    delete() {
        this.op = 'delete';
        return this;
    }

    eq(column, value) {
        this.filters.push({ col: column, op: 'eq', value });
        return this;
    }

    neq(column, value) {
        this.filters.push({ col: column, op: 'neq', value });
        return this;
    }

    in(column, values) {
        this.filters.push({ col: column, op: 'in', value: values });
        return this;
    }

    gte(column, value) {
        this.filters.push({ col: column, op: 'gte', value });
        return this;
    }

    lte(column, value) {
        this.filters.push({ col: column, op: 'lte', value });
        return this;
    }

    ilike(column, value) {
        this.filters.push({ col: column, op: 'ilike', value });
        return this;
    }

    or(expression) {
        this.orExprs.push(expression);
        return this;
    }

    order(column, options = {}) {
        this.orderBy = column;
        this.ascending = options.ascending !== false;
        return this;
    }

    limit(value) {
        this.limitValue = value;
        return this;
    }

    range(from, to) {
        this.rangeValue = [from, to];
        return this;
    }

    single() {
        this.mode = 'single';
        return this;
    }

    maybeSingle() {
        this.mode = 'maybe';
        return this;
    }

    async execute() {
        if (!BACKEND_URL) {
            return { data: null, count: null, error: toError('VITE_BACKEND_URL belum diset. Frontend tidak bisa mengakses data.') };
        }

        const params = new URLSearchParams();
        params.set('select', this.columns);
        Object.entries(encodeFilters(this.filters, this.orExprs)).forEach(([key, value]) => params.set(key, value));
        if (this.orderBy) {
            params.set('order', this.orderBy);
            params.set('asc', String(this.ascending));
        }
        if (this.rangeValue) params.set('range', this.rangeValue.join('-'));
        else if (this.limitValue !== null) params.set('limit', String(this.limitValue));
        if (this.countMode) params.set('count', this.countMode);
        if (this.head) params.set('head', 'true');

        const token = authToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const options = { method: 'GET', headers };
        let url = `${BACKEND_URL}/api/data/${this.table}`;

        if (this.op === 'insert') {
            options.method = 'POST';
            options.body = JSON.stringify({ rows: Array.isArray(this.payload) ? this.payload : [this.payload] });
        } else if (this.op === 'update') {
            options.method = 'PATCH';
            options.body = JSON.stringify({ updates: this.payload });
        } else if (this.op === 'delete') {
            options.method = 'DELETE';
        }

        if (this.op !== 'select') {
            const filterParams = encodeFilters(this.filters, this.orExprs);
            Object.entries(filterParams).forEach(([key, value]) => params.set(key, value));
        }

        url += `?${params.toString()}`;

        let response;
        try {
            response = await fetch(url, options);
        } catch (networkError) {
            return { data: null, count: null, error: toError(`Tidak bisa menghubungi server: ${networkError.message}`) };
        }

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = body?.error?.message || body?.error || `Request gagal (${response.status})`;
            return { data: null, count: null, error: toError(message, response.status) };
        }

        let data = body.data ?? null;
        const count = body.count ?? null;

        if (this.op === 'select' && this.head) data = null;

        if (Array.isArray(data)) {
            if (this.mode === 'single') {
                if (data.length !== 1) {
                    return { data: null, count, error: toError('Data tidak ditemukan', 'PGRST116') };
                }
                data = data[0];
            } else if (this.mode === 'maybe') {
                data = data.length ? data[0] : null;
            }
        }

        return { data, count, error: null };
    }

    then(onFulfilled, onRejected) {
        return this.execute().then(onFulfilled, onRejected);
    }
}

const channelStub = () => {
    const channel = {
        on: () => channel,
        subscribe: (callback) => {
            if (callback) callback('CLOSED');
            return channel;
        },
        unsubscribe: () => Promise.resolve('ok'),
    };
    return channel;
};

export const supabase = {
    from: (table) => new QueryBuilder(table),
    channel: () => channelStub(),
    removeChannel: () => Promise.resolve('ok'),
    removeAllChannels: () => Promise.resolve('ok'),
};

export default supabase;
