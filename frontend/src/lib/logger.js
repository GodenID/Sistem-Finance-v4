const isDev = import.meta.env.DEV;

const formatTimestamp = () => new Date().toISOString();

const formatMessage = (level, context, message, data) => {
    const timestamp = formatTimestamp();
    const prefix = `[${timestamp}] [${level}]${context ? ` [${context}]` : ''}`;
    return { prefix, message, data };
};

export const logger = {
    info: (context, message, data) => {
        if (!isDev) return; // production: tanpa spam console per request
        const { prefix, message: msg, data: d } = formatMessage('INFO', context, message, data);
        if (d !== undefined) {
            console.log(`${prefix} ${msg}`, d);
        } else {
            console.log(`${prefix} ${msg}`);
        }
    },

    warn: (context, message, data) => {
        const { prefix, message: msg, data: d } = formatMessage('WARN', context, message, data);
        if (d !== undefined) {
            console.warn(`${prefix} ${msg}`, d);
        } else {
            console.warn(`${prefix} ${msg}`);
        }
    },

    error: (context, message, error) => {
        const { prefix, message: msg } = formatMessage('ERROR', context, message);
        if (error instanceof Error) {
            console.error(`${prefix} ${msg}`, {
                message: error.message,
                stack: error.stack,
            });
        } else if (error !== undefined) {
            console.error(`${prefix} ${msg}`, error);
        } else {
            console.error(`${prefix} ${msg}`);
        }
    },

    api: (method, table, duration, success, data) => {
        if (!isDev) return; // production: tiap request log = serialization + spam console
        const status = success ? 'OK' : 'FAIL';
        const logFn = success ? console.log : console.error;
        logFn(`[API] ${method} ${table} - ${status} (${duration}ms)`, data || '');
    },

    auth: (action, user, data) => {
        if (!isDev) return;
        console.log(`[AUTH] ${action}`, user ? `user=${user}` : '', data || '');
    },

    realtime: (table, event, data) => {
        if (!isDev) return; // production: event realtime bisa sangat sering
        console.log(`[REALTIME] ${table} ${event}`, data || '');
    },
};

export default logger;
