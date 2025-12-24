const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all activity logs
const getAll = async (req, res) => {
    try {
        const { table_name, action, record_id, limit = 100 } = req.query;

        let query = 'SELECT * FROM activity_logs WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (table_name) {
            query += ` AND table_name = $${paramIndex++}`;
            params.push(table_name);
        }
        if (action) {
            query += ` AND action = $${paramIndex++}`;
            params.push(action);
        }
        if (record_id) {
            query += ` AND record_id = $${paramIndex++}`;
            params.push(record_id);
        }

        query += ` ORDER BY changed_at DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get all activity logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get activity logs by record ID
const getByRecordId = async (req, res) => {
    try {
        const { recordId } = req.params;
        const result = await db.query(
            'SELECT * FROM activity_logs WHERE record_id = $1 ORDER BY changed_at DESC',
            [recordId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get activity logs by record ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create activity log
const create = async (req, res) => {
    try {
        const {
            table_name,
            record_id,
            record_number,
            action,
            field_changed,
            old_value,
            new_value
        } = req.body;

        const result = await db.query(
            `INSERT INTO activity_logs 
       (id, table_name, record_id, record_number, action, field_changed, 
        old_value, new_value, changed_by, changed_by_name, changed_at, 
        ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)
       RETURNING *`,
            [
                uuidv4(),
                table_name,
                record_id,
                record_number,
                action,
                field_changed,
                old_value,
                new_value,
                req.user?.id,
                req.user?.name,
                req.ip,
                req.get('User-Agent')
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create activity log error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Helper function to log activity (for internal use by other controllers)
const logActivity = async (data, user, req) => {
    try {
        await db.query(
            `INSERT INTO activity_logs 
       (id, table_name, record_id, record_number, action, field_changed, 
        old_value, new_value, changed_by, changed_by_name, changed_at, 
        ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)`,
            [
                uuidv4(),
                data.table_name,
                data.record_id,
                data.record_number,
                data.action,
                data.field_changed || null,
                data.old_value || null,
                data.new_value || null,
                user?.id || null,
                user?.name || null,
                req?.ip || null,
                req?.get?.('User-Agent') || null
            ]
        );
    } catch (error) {
        console.error('Log activity error:', error);
        // Don't throw - logging should not break main operation
    }
};

module.exports = {
    getAll,
    getByRecordId,
    create,
    logActivity
};
