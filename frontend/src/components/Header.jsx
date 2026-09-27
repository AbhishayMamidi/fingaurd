import React from 'react';

export function Header({ title, onAddTransaction, onSeedDemo, isSeeding }) {
  return (
    <header className="top-header">
      <h2 className="header-title">{title}</h2>
      <div className="header-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={onSeedDemo}
          disabled={isSeeding}
          title="Populate realistic synthetic transactions for demo"
        >
          <span>⚡</span>
          <span>{isSeeding ? 'Seeding...' : 'Load Demo Data'}</span>
        </button>

        <button className="btn btn-primary" onClick={onAddTransaction}>
          <span>+</span>
          <span>Add Transaction</span>
        </button>
      </div>
    </header>
  );
}
