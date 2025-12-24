const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ==========================================
// Recurring Transactions
// ==========================================

// Get all transactions
const getAllTransactions = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM recurring_transactions ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Get all recurring transactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create transaction
const createTransaction = async (req, res) => {
    try {
        const {
            name, type, frequency, day_of_week, day_of_month,
            template_data, next_run_date, is_active, created_by
        } = req.body;

        const result = await db.query(
            `INSERT INTO recurring_transactions 
            (id, name, type, frequency, day_of_week, day_of_month, 
             template_data, next_run_date, is_active, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            RETURNING *`,
            [uuidv4(), name, type, frequency, day_of_week, day_of_month,
                template_data, next_run_date, is_active, created_by]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create recurring transaction error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update transaction
const updateTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, type, frequency, day_of_week, day_of_month,
            template_data, next_run_date, is_active, last_run_date
        } = req.body;

        // Dynamic update query builder
        let query = 'UPDATE recurring_transactions SET updated_at = NOW()';
        const params = [id];
        let paramIndex = 2;

        if (name !== undefined) { query += `, name = $${paramIndex++}`; params.push(name); }
        if (type !== undefined) { query += `, type = $${paramIndex++}`; params.push(type); }
        if (frequency !== undefined) { query += `, frequency = $${paramIndex++}`; params.push(frequency); }
        if (day_of_week !== undefined) { query += `, day_of_week = $${paramIndex++}`; params.push(day_of_week); }
        if (day_of_month !== undefined) { query += `, day_of_month = $${paramIndex++}`; params.push(day_of_month); }
        if (template_data !== undefined) { query += `, template_data = $${paramIndex++}`; params.push(template_data); }
        if (next_run_date !== undefined) { query += `, next_run_date = $${paramIndex++}`; params.push(next_run_date); }
        if (is_active !== undefined) { query += `, is_active = $${paramIndex++}`; params.push(is_active); }
        if (last_run_date !== undefined) { query += `, last_run_date = $${paramIndex++}`; params.push(last_run_date); }

        query += ` WHERE id = $1 RETURNING *`;

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update recurring transaction error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete transaction
const deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM recurring_transactions WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({ message: 'Deleted successfully', data: result.rows[0] });
    } catch (error) {
        console.error('Delete recurring transaction error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ==========================================
// Recurring Instances
// ==========================================

// Get all instances
const getAllInstances = async (req, res) => {
    try {
        const { recurring_id, scheduled_date } = req.query;
        let query = 'SELECT * FROM recurring_instances WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (recurring_id) {
            query += ` AND recurring_id = $${paramIndex++}`;
            params.push(recurring_id);
        }
        if (scheduled_date) {
            query += ` AND scheduled_date = $${paramIndex++}`;
            params.push(scheduled_date);
        }

        query += ' ORDER BY scheduled_date ASC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get all instances error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create instance
const createInstance = async (req, res) => {
    try {
        const { recurring_id, scheduled_date, status, notes } = req.body;

        const result = await db.query(
            `INSERT INTO recurring_instances 
            (id, recurring_id, scheduled_date, status, notes, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *`,
            [uuidv4(), recurring_id, scheduled_date, status || 'pending', notes]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create instance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update instance
const updateInstance = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            status, bukti_transfer, transferred_at, transferred_by,
            transferred_by_name, notes
        } = req.body;

        let query = 'UPDATE recurring_instances SET updated_at = NOW()';
        const params = [id];
        let paramIndex = 2;

        if (status !== undefined) { query += `, status = $${paramIndex++}`; params.push(status); }
        if (bukti_transfer !== undefined) { query += `, bukti_transfer = $${paramIndex++}`; params.push(bukti_transfer); }
        if (transferred_at !== undefined) { query += `, transferred_at = $${paramIndex++}`; params.push(transferred_at); }
        if (transferred_by !== undefined) { query += `, transferred_by = $${paramIndex++}`; params.push(transferred_by); }
        if (transferred_by_name !== undefined) { query += `, transferred_by_name = $${paramIndex++}`; params.push(transferred_by_name); }
        if (notes !== undefined) { query += `, notes = $${paramIndex++}`; params.push(notes); }

        query += ` WHERE id = $1 RETURNING *`;

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update instance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getAllTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getAllInstances,
    createInstance,
    updateInstance
};
