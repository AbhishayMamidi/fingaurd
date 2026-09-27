import React, { useState, useEffect } from 'react';

const CATEGORIES = [
  'Auto-Categorize',
  'Food & Dining',
  'Utilities & Bills',
  'Housing & Rent',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Healthcare',
  'Travel',
  'Income',
  'Other'
];

export function TransactionModal({ isOpen, onClose, onSave, editingTransaction }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Auto-Categorize');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingTransaction) {
      setAmount(String(editingTransaction.amount));
      setType(editingTransaction.type || 'expense');
      setMerchant(editingTransaction.merchant || '');
      setDescription(editingTransaction.description || '');
      setCategory(editingTransaction.category || 'Auto-Categorize');
      setDate(
        editingTransaction.date
          ? new Date(editingTransaction.date).toISOString().split('T')[0]
          : ''
      );
    } else {
      setAmount('');
      setType('expense');
      setMerchant('');
      setDescription('');
      setCategory('Auto-Categorize');
      setDate(new Date().toISOString().split('T')[0]);
    }
    setError('');
  }, [editingTransaction, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please provide a valid positive amount.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: numericAmount,
        type,
        merchant: merchant.trim(),
        description: description.trim(),
        category: category === 'Auto-Categorize' ? undefined : category,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
      };

      await onSave(payload, editingTransaction?.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">
            {editingTransaction ? 'Edit Transaction' : 'Record New Transaction'}
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

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Transaction Type</label>
                <select
                  className="form-select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="expense">Expense (-)</option>
                  <option value="income">Income (+)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Merchant / Payee</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Whole Foods, Netflix, Employer..."
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. Weekly organic groceries"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Analyzing & Saving...' : editingTransaction ? 'Update Transaction' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
