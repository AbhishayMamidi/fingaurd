const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /alerts
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { unread_only, type } = req.query;

    let queryText = 'SELECT * FROM alerts WHERE user_id = $1';
    const params = [userId];

    if (unread_only === 'true') {
      params.push(false);
      queryText += ` AND is_read = $${params.length}`;
    }

    if (type) {
      params.push(type);
      queryText += ` AND type = $${params.length}`;
    }

    queryText += ' ORDER BY created_at DESC LIMIT 50';

    const result = await db.query(queryText, params);

    const alerts = result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      category: row.category,
      currentSpent: Number(row.current_spent),
      budgetLimit: Number(row.budget_limit),
      isRead: row.is_read,
      createdAt: row.created_at,
    }));

    return res.json({
      total: alerts.length,
      unreadCount: alerts.filter((a) => !a.isRead).length,
      alerts,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /alerts/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await db.query(
      'UPDATE alerts SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id, is_read',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFoundError', message: 'Alert not found.' });
    }

    return res.json({ message: 'Alert marked as read.', id });
  } catch (err) {
    next(err);
  }
});

// DELETE /alerts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM alerts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFoundError', message: 'Alert not found.' });
    }

    return res.json({ message: 'Alert dismissed.', id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
