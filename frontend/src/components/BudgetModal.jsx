import React, { useState, useEffect } from 'react';

const CATEGORIES = [
  'Food & Dining',
  'Utilities & Bills',
  'Housing & Rent',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Healthcare',
  'Travel',
  'Other'
];

export function BudgetModal({ isOpen, onClose, onSave, editingBudget }) {
  const [category, setCategory] = useState('Food & Dining');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingBudget) {
      setCategory(editingBudget.category);
      setMonthlyLimit(String(editingBudget.monthlyLimit));
    } else {
      setCategory('Food & Dining');
      setMonthlyLimit('');
    }
    setError('');
  }, [editingBudget, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const limit = parseFloat(monthlyLimit);
    if (isNaN(limit) || limit <= 0) {
      setError('Please provide a valid monthly budget limit amount.');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        category,
        monthly_limit: limit,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save budget.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">
            {editingBudget ? `Adjust ${editingBudget.category} Budget` : 'Set Monthly Budget'}
          </h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem'
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={Boolean(editingBudget)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Monthly Spending Limit ($ USD)</label>
              <input
                type="number"
                step="1"
                min="1"
                className="form-input"
                required
                placeholder="e.g. 500"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                You will receive warning alerts at 80% usage and an alert when exceeded.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
