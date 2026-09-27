import React, { useState, useEffect, useCallback } from 'react';
import { api, tokenStorage } from './api/client';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { BudgetsView } from './components/BudgetsView';
import { FraudAlertsView } from './components/FraudAlertsView';
import { AuthModal } from './components/AuthModal';
import { TransactionModal } from './components/TransactionModal';
import { BudgetModal } from './components/BudgetModal';

export default function App() {
  const [user, setUser] = useState(tokenStorage.getUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data state
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [budgets, setBudgets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [modelInfo, setModelInfo] = useState(null);

  // Filter state for transactions
  const [txFilters, setTxFilters] = useState({
    search: '',
    category: '',
    type: '',
    is_fraud: undefined,
  });

  // Modal states
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Global unauthorized event listener
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Fetch all core user data
  const loadData = useCallback(async () => {
    if (!tokenStorage.getToken()) return;

    try {
      // Parallel fetches for speed
      const [sumRes, txRes, bgtRes, alrtRes, mdlRes] = await Promise.allSettled([
        api.getSummary(),
        api.getTransactions(txFilters),
        api.getBudgets(),
        api.getAlerts(),
        api.getFraudModelInfo(),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value.items || []);
        setTotalTransactions(txRes.value.total || 0);
      }
      if (bgtRes.status === 'fulfilled') setBudgets(bgtRes.value.budgets || []);
      if (alrtRes.status === 'fulfilled') {
        setAlerts(alrtRes.value.alerts || []);
        setUnreadAlertsCount(alrtRes.value.unreadCount || 0);
      }
      if (mdlRes.status === 'fulfilled') setModelInfo(mdlRes.value);
    } catch (err) {
      console.error('Error fetching FinGuard data:', err);
    }
  }, [txFilters]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Periodic polling for async events (RabbitMQ processing updates)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadData();
    }, 6000);
    return () => clearInterval(interval);
  }, [user, loadData]);

  const handleLogout = () => {
    tokenStorage.clear();
    setUser(null);
  };

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setActiveTab('dashboard');
  };

  // Transaction CRUD handlers
  const handleOpenAddTx = () => {
    setEditingTransaction(null);
    setIsTxModalOpen(true);
  };

  const handleOpenEditTx = (tx) => {
    setEditingTransaction(tx);
    setIsTxModalOpen(true);
  };

  const handleSaveTx = async (payload, id) => {
    if (id) {
      await api.updateTransaction(id, payload);
    } else {
      await api.createTransaction(payload);
    }
    await loadData();
  };

  const handleDeleteTx = async (id) => {
    await api.deleteTransaction(id);
    await loadData();
  };

  // Budget Handlers
  const handleOpenBudgetModal = (budget = null) => {
    setEditingBudget(budget);
    setIsBudgetModalOpen(true);
  };

  const handleSaveBudget = async (payload) => {
    await api.setBudget(payload);
    await loadData();
  };

  const handleDeleteBudget = async (id) => {
    await api.deleteBudget(id);
    await loadData();
  };

  // Alert Handlers
  const handleDismissAlert = async (id) => {
    await api.deleteAlert(id);
    await loadData();
  };

  // Seed Demo Data
  const handleSeedDemo = async () => {
    setIsSeeding(true);
    try {
      const res = await api.seedDemoData();
      alert(`Success! ${res.seeded_count} synthetic demo transactions loaded.`);
      await loadData();
    } catch (err) {
      alert(`Failed to seed demo data: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  if (!user) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} />;
  }

  const flaggedTransactions = transactions.filter((t) => t.is_fraud_flagged);

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        unreadAlertsCount={unreadAlertsCount}
      />

      <div className="main-wrapper">
        <Header
          title={
            activeTab === 'dashboard'
              ? 'Financial Overview'
              : activeTab === 'transactions'
              ? 'Transactions & History'
              : activeTab === 'budgets'
              ? 'Monthly Budgets & Allowances'
              : 'Fraud Detection & Anomaly Alerts'
          }
          onAddTransaction={handleOpenAddTx}
          onSeedDemo={handleSeedDemo}
          isSeeding={isSeeding}
        />

        <main className="content-body">
          {activeTab === 'dashboard' && (
            <DashboardView
              summary={summary}
              budgets={budgets}
              recentTransactions={transactions}
              onAddTransaction={handleOpenAddTx}
              onSeedDemo={handleSeedDemo}
              onViewAllTransactions={() => setActiveTab('transactions')}
              onSetBudget={() => handleOpenBudgetModal()}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              totalCount={totalTransactions}
              onAddTransaction={handleOpenAddTx}
              onEditTransaction={handleOpenEditTx}
              onDeleteTransaction={handleDeleteTx}
              filters={txFilters}
              setFilters={setTxFilters}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetsView
              budgets={budgets}
              onOpenBudgetModal={handleOpenBudgetModal}
              onDeleteBudget={handleDeleteBudget}
            />
          )}

          {activeTab === 'fraud' && (
            <FraudAlertsView
              flaggedTransactions={flaggedTransactions}
              alerts={alerts}
              modelInfo={modelInfo}
              onDismissAlert={handleDismissAlert}
              onInspectTransaction={handleOpenEditTx}
            />
          )}
        </main>
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSave={handleSaveTx}
        editingTransaction={editingTransaction}
      />

      {/* Budget Modal */}
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        onSave={handleSaveBudget}
        editingBudget={editingBudget}
      />
    </div>
  );
}
