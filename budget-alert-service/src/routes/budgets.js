const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

router.use(authenticateToken);

// Helper for current Month-Year "YYYY-MM"
function getCurrentMonthYear() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// GET /budgets
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const monthYear = req.query.month_year || getCurrentMonthYear();

    const result = await db.query(
      `SELECT id, category, monthly_limit, month_year, created_at, updated_at
       FROM budgets
       WHERE user_id = $1 AND month_year = $2
       ORDER BY category ASC`,
      [userId, monthYear]
    );

    // Fetch live category spending from transaction-service
    let spendingMap = {};
    try {
      const summaryRes = await fetch(`${config.transactionServiceUrl}/api/transactions/summary`, {
        headers: { Authorization: req.headers['authorization'] },
      }).catch(() => null);

      if (summaryRes && summaryRes.ok) {
        const summaryData = await summaryRes.json();
        for (const item of summaryData.category_breakdown || []) {
          spendingMap[item.category] = Number(item.total);
        }
      }
    } catch {
      // Non-blocking fallback
    }

    const budgetsWithProgress = result.rows.map((b) => {
      const spent = spendingMap[b.category] || 0.0;
      const limit = Number(b.monthly_limit);
      const percent = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 999) : 0;
      return {
        id: b.id,
        category: b.category,
        monthlyLimit: limit,
        monthYear: b.month_year,
        currentSpent: spent,
        percentageUsed: percent,
        isExceeded: spent >= limit,
        isWarning: spent >= limit * 0.8 && spent < limit,
        createdAt: b.created_at,
      };
    });

    return res.json({
      monthYear,
      budgets: budgetsWithProgress,
    });
  } catch (err) {
    next(err);
  }
});

// POST /budgets - set/upsert monthly budget
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { category, monthly_limit, month_year } = req.body || {};

    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ error: 'ValidationError', message: 'Category is required.' });
    }

    const limit = Number(monthly_limit);
    if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({ error: 'ValidationError', message: 'Monthly limit must be a positive number.' });
    }

    const cleanCategory = category.trim();
    const targetMonthYear = month_year ? String(month_year).trim() : getCurrentMonthYear();

    const result = await db.query(
      `INSERT INTO budgets (user_id, category, monthly_limit, month_year, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, category, month_year)
       DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit, updated_at = CURRENT_TIMESTAMP
       RETURNING id, category, monthly_limit, month_year, created_at, updated_at`,
      [userId, cleanCategory, limit, targetMonthYear]
    );

    const saved = result.rows[0];
    return res.status(201).json({
      message: 'Budget saved successfully.',
      budget: {
        id: saved.id,
        category: saved.category,
        monthlyLimit: Number(saved.monthly_limit),
        monthYear: saved.month_year,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /budgets/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFoundError', message: 'Budget not found.' });
    }

    return res.json({ message: 'Budget deleted successfully.', id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
