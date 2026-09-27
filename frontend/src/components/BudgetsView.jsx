import React from 'react';
import { ProgressBar } from './Charts';

export function BudgetsView({ budgets = [], onOpenBudgetModal, onDeleteBudget }) {
  const handleDelete = async (id, category) => {
    if (window.confirm(`Delete monthly budget for '${category}'?`)) {
      await onDeleteBudget(id);
    }
  };

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.currentSpent, 0);

  return (
    <div>
      {/* Overview Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Monthly Budget</span>
          <span className="metric-value">${totalBudgeted.toFixed(2)}</span>
          <span className="metric-subtitle">Across {budgets.length} configured categories</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Total Spent In Budgets</span>
          <span className={`metric-value ${totalSpent > totalBudgeted ? 'expense' : 'income'}`}>
            ${totalSpent.toFixed(2)}
          </span>
          <span className="metric-subtitle">
            {totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}% of total allowance` : 'No limits set'}
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Remaining Allowance</span>
          <span className="metric-value">
            ${Math.max(totalBudgeted - totalSpent, 0).toFixed(2)}
          </span>
          <span className="metric-subtitle">
            {totalSpent > totalBudgeted ? 'Budget Exceeded!' : 'Available to spend'}
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Category Spending Budgets</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Set monthly spending thresholds to receive 80% warning and 100% exceeded alerts.
            </span>
          </div>
          <button className="btn btn-primary" onClick={() => onOpenBudgetModal()}>
            + Set Category Budget
          </button>
        </div>

        {budgets.length === 0 ? (
          <div className="empty-state">
            <h3>No Monthly Budgets Configured</h3>
            <p>Setting budgets helps you automatically monitor expenses and prevent overspending.</p>
            <button className="btn btn-primary" onClick={() => onOpenBudgetModal()}>
              Create Your First Budget
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {budgets.map((b) => (
              <div
                key={b.id}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid ${b.isExceeded ? 'var(--danger)' : b.isWarning ? 'var(--warning)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{b.category}</span>
                  {b.isExceeded ? (
                    <span className="pill pill-fraud">⚠️ Exceeded</span>
                  ) : b.isWarning ? (
                    <span className="pill" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
                      80% Warning
                    </span>
                  ) : (
                    <span className="pill pill-safe">On Track</span>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Spent: ${b.currentSpent.toFixed(2)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      Limit: ${b.monthlyLimit.toFixed(2)}
                    </span>
                  </div>
                  <ProgressBar percent={b.percentageUsed} isExceeded={b.isExceeded} isWarning={b.isWarning} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    <span>{b.percentageUsed}% used</span>
                    <span>
                      {b.monthlyLimit - b.currentSpent >= 0
                        ? `$${(b.monthlyLimit - b.currentSpent).toFixed(2)} remaining`
                        : `Exceeded by $${Math.abs(b.monthlyLimit - b.currentSpent).toFixed(2)}`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenBudgetModal(b)}
                  >
                    Adjust
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(b.id, b.category)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
