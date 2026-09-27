import React, { useState } from 'react';

const CATEGORIES = [
  'All',
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

export function TransactionsView({
  transactions = [],
  totalCount = 0,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  filters,
  setFilters,
  onRefresh
}) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction record?')) {
      setDeletingId(id);
      try {
        await onDeleteTransaction(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="panel">
      {/* Search and Filters Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search merchant or description..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            style={{ minWidth: '220px' }}
          />

          <select
            className="form-select"
            value={filters.category || 'All'}
            onChange={(e) => setFilters({ ...filters, category: e.target.value === 'All' ? '' : e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="form-select"
            value={filters.type || ''}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">All Types</option>
            <option value="expense">Expenses Only</option>
            <option value="income">Income Only</option>
          </select>

          <select
            className="form-select"
            value={filters.is_fraud !== undefined ? String(filters.is_fraud) : ''}
            onChange={(e) => {
              const val = e.target.value;
              setFilters({
                ...filters,
                is_fraud: val === '' ? undefined : val === 'true'
              });
            }}
          >
            <option value="">All Fraud Statuses</option>
            <option value="true">🚨 Flagged Fraud Only</option>
            <option value="false">Normal Only</option>
          </select>
        </div>

        <button className="btn btn-primary" onClick={onAddTransaction}>
          + Add Transaction
        </button>
      </div>

      {/* Transactions Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant & Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Fraud Analysis</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                  No transactions match your active filters.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tx.merchant || tx.description}</div>
                    {tx.merchant && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {tx.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="pill pill-category">{tx.category}</span>
                  </td>
                  <td>
                    <span className={`amount-display ${tx.type === 'income' ? 'amount-income' : 'amount-expense'}`}>
                      {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                    </span>
                  </td>
                  <td>
                    {tx.is_fraud_flagged ? (
                      <span className="pill pill-fraud" title={tx.fraud_reason}>
                        🚨 Flagged ({Math.round(tx.fraud_score * 100)}%)
                      </span>
                    ) : (
                      <span className="pill pill-safe">Normal ({Math.round((tx.fraud_score || 0.05) * 100)}%)</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onEditTransaction(tx)}
                      style={{ marginRight: '6px' }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                    >
                      {deletingId === tx.id ? '...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
        <span>Showing {transactions.length} of {totalCount} transactions</span>
      </div>
    </div>
  );
}
