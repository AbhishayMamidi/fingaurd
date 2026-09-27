import React from 'react';

export function Sidebar({ activeTab, setActiveTab, user, onLogout, unreadAlertsCount }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">🛡️</div>
        <div>
          <h1 className="brand-title">FinGuard</h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
            INTELLIGENT FINTECH
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <div className="nav-item-left">
            <span>📊</span>
            <span>Dashboard</span>
          </div>
        </button>

        <button
          className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <div className="nav-item-left">
            <span>💳</span>
            <span>Transactions</span>
          </div>
        </button>

        <button
          className={`nav-item ${activeTab === 'budgets' ? 'active' : ''}`}
          onClick={() => setActiveTab('budgets')}
        >
          <div className="nav-item-left">
            <span>🎯</span>
            <span>Budgets</span>
          </div>
        </button>

        <button
          className={`nav-item ${activeTab === 'fraud' ? 'active' : ''}`}
          onClick={() => setActiveTab('fraud')}
        >
          <div className="nav-item-left">
            <span>🚨</span>
            <span>Fraud Alerts</span>
          </div>
          {unreadAlertsCount > 0 && (
            <span className="badge-alert">{unreadAlertsCount}</span>
          )}
        </button>
      </nav>

      {user && (
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user.fullName || 'User'}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <button className="btn-logout" onClick={onLogout} title="Log Out">
            Exit
          </button>
        </div>
      )}
    </aside>
  );
}
