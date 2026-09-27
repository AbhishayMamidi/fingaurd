import React from 'react';
import { CategoryDonutChart, ProgressBar } from './Charts';

export function DashboardView({
  summary,
  budgets,
  recentTransactions,
  onAddTransaction,
  onSeedDemo,
  onViewAllTransactions,
  onSetBudget
}) {
  const formatCurrency = (val) =>
    `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const hasData = summary && summary.total_transactions > 0;

  return (
    <div>
      {/* Metric Cards Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Income</span>
          <span className="metric-value income">{formatCurrency(summary?.total_income)}</span>
          <span className="metric-subtitle">Deposits and earnings</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Total Expenses</span>
          <span className="metric-value expense">{formatCurrency(summary?.total_expenses)}</span>
          <span className="metric-subtitle">Across all categories</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Net Balance</span>
          <span className="metric-value balance">
            {formatCurrency(summary?.net_balance)}
          </span>
          <span className="metric-subtitle">
            {summary?.net_balance >= 0 ? 'Positive Cash Flow' : 'Deficit'}
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Fraud Flags</span>
          <span className="metric-value fraud">{summary?.fraud_flagged_count || 0}</span>
          <span className="metric-subtitle">Anomalous transactions flagged</span>
        </div>
      </div>

      {!hasData ? (
        <div className="panel empty-state">
          <h3>Welcome to FinGuard!</h3>
          <p>You don't have any financial transactions recorded yet.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={onAddTransaction}>
              + Add First Transaction
            </button>
            <button className="btn btn-secondary" onClick={onSeedDemo}>
              ⚡ Populate Demo Data
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Main Visuals: Category Breakdown & Monthly Budgets */}
          <div className="dashboard-grid">
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">Spending by Category</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Current Month</span>
              </div>
              <CategoryDonutChart data={summary?.category_breakdown || []} />
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title">Monthly Budget Status</h3>
                <button className="btn btn-secondary btn-sm" onClick={onSetBudget}>
                  Manage Budgets
                </button>
              </div>

              {budgets.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <p style={{ marginBottom: '12px' }}>No category budgets configured for this month.</p>
                  <button className="btn btn-secondary btn-sm" onClick={onSetBudget}>
                    Set a Monthly Budget
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {budgets.slice(0, 5).map((b) => (
                    <div key={b.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600 }}>{b.category}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: b.isExceeded ? 'var(--danger)' : 'var(--text-muted)' }}>
                          ${b.currentSpent.toFixed(2)} / ${b.monthlyLimit.toFixed(2)} ({b.percentageUsed}%)
                        </span>
                      </div>
                      <ProgressBar percent={b.percentageUsed} isExceeded={b.isExceeded} isWarning={b.isWarning} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Recent Transactions</h3>
              <button className="btn btn-secondary btn-sm" onClick={onViewAllTransactions}>
                View All →
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant & Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Fraud Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.slice(0, 6).map((tx) => (
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
                            ⚠️ Flagged ({Math.round(tx.fraud_score * 100)}%)
                          </span>
                        ) : (
                          <span className="pill pill-safe">Normal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
