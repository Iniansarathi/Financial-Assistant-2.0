import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Expense } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { motion } from 'framer-motion';
import {
  Wallet as WalletIcon,
  TrendingDown,
  TrendingUp,
  BrainCircuit,
  AlertCircle,
  Plus,
  QrCode,
  ArrowRight,
  Clock,
  Sliders,
  Check,
  ArrowLeft,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ScrollWheelPicker } from '../components/ui/ScrollWheelPicker';

interface WidgetDef {
  id: string;
  name: string;
  className: string;
}

const WIDGET_DEFS: WidgetDef[] = [
  { id: 'safe_to_spend', name: 'Safe to Spend Card', className: 'col-span-1' },
  { id: 'net_balance', name: 'Net Balance Card', className: 'col-span-1' },
  { id: 'earned', name: 'Earned Income Card', className: 'col-span-1' },
  { id: 'spent', name: 'Monthly Spend Card', className: 'col-span-1' },
  { id: 'obligations_load', name: 'Obligations Load Meter', className: 'col-span-1' },
  { id: 'forecast_balance', name: 'Forecast Balance Card', className: 'col-span-1' },
  { id: 'cashflow_health', name: 'Budget Health Meter', className: 'col-span-2 lg:col-span-6' },
  { id: 'category_budgets', name: 'Category Budgets Grid', className: 'col-span-2 lg:col-span-6' },
  { id: 'ai_copilot', name: 'Copilot AI Insights', className: 'col-span-2 lg:col-span-4' },
  { id: 'wallets_breakdown', name: 'Wallets list', className: 'col-span-2 lg:col-span-2' },
  { id: 'upcoming_bills', name: 'Timeline Warnings', className: 'col-span-2 lg:col-span-2' },
];

const DEFAULT_WIDGETS = [
  'safe_to_spend',
  'net_balance',
  'earned',
  'spent',
  'obligations_load',
  'forecast_balance',
  'cashflow_health',
  'category_budgets',
  'ai_copilot',
  'wallets_breakdown',
  'upcoming_bills'
];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [quickAddWallet, setQuickAddWallet] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Layout editing states
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => {
    const saved = localStorage.getItem('mp_dashboard_widgets_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    return DEFAULT_WIDGETS;
  });

  // Get current date boundaries (this month)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = Math.max(daysInMonth - currentDay + 1, 1);

  // Dexie Queries
  const wallets = useLiveQuery(() => db.wallets.where('status').equals('active').toArray()) || [];
  const expensesThisMonth = useLiveQuery(() => 
    db.expenses
      .where('date')
      .between(startOfMonth, endOfMonth)
      .filter(exp => exp.isDeleted === 0)
      .toArray()
  ) || [];
  const incomeThisMonth = useLiveQuery(() =>
    db.income.where('date').between(startOfMonth, endOfMonth).toArray()
  ) || [];
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray()) || [];
  const upcomingBills = useLiveQuery(() =>
    db.bills.where('paid').equals(0).limit(3).toArray()
  ) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  // Live queries for obligations
  const unpaidBills = useLiveQuery(() => db.bills.where('paid').equals(0).toArray()) || [];
  const allBills = useLiveQuery(() => db.bills.toArray()) || [];
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray()) || [];

  // Calculations
  const totalBalance = wallets.reduce((sum, w) => sum + w.currentBalance, 0);
  const totalExpenses = expensesThisMonth.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = incomeThisMonth.reduce((sum, i) => sum + i.amount, 0);
  const currencySymbol = user?.currency === 'USD' ? '$' : '₹';

  // Dynamic Safe-to-Spend & Alerts
  const remainingObligations = unpaidBills.reduce((sum, b) => sum + b.amount, 0) + subscriptions.reduce((sum, s) => sum + s.amount, 0);
  const totalObligations = allBills.reduce((sum, b) => sum + b.amount, 0) + subscriptions.reduce((sum, s) => sum + s.amount, 0);
  
  const safeToSpendDaily = Math.max(0, Math.round((totalBalance - remainingObligations) / remainingDays));
  const safeToSpendWeekly = Math.max(0, Math.round(Math.min(totalBalance - remainingObligations, safeToSpendDaily * 7)));
  const safeToSpendMonthly = Math.max(0, Math.round(totalBalance - remainingObligations));

  const salaryIncome = user?.salaryDate ? (totalIncome || 50000) : 50000;
  const baselineDailyAllowance = Math.max(0, Math.round((salaryIncome - totalObligations) / 30));

  // Determine mode specific values
  const [safeToSpendMode, setSafeToSpendMode] = useState<'daily' | 'weekly' | 'monthly'>(() => {
    return (localStorage.getItem('mp_safe_to_spend_mode') as 'daily' | 'weekly' | 'monthly') || 'daily';
  });

  const handleSetSafeToSpendMode = (mode: 'daily' | 'weekly' | 'monthly') => {
    setSafeToSpendMode(mode);
    localStorage.setItem('mp_safe_to_spend_mode', mode);
  };

  const getSafeToSpendVal = () => {
    if (safeToSpendMode === 'weekly') return safeToSpendWeekly;
    if (safeToSpendMode === 'monthly') return safeToSpendMonthly;
    return safeToSpendDaily;
  };

  const getIsOnTrackMode = () => {
    if (safeToSpendMode === 'weekly') {
      return safeToSpendWeekly >= baselineDailyAllowance * 7;
    }
    if (safeToSpendMode === 'monthly') {
      return safeToSpendMonthly >= baselineDailyAllowance * remainingDays;
    }
    return safeToSpendDaily >= baselineDailyAllowance;
  };

  const currentSafeToSpendVal = getSafeToSpendVal();
  const isOnTrack = getIsOnTrackMode();

  // Predictive Payday Forecast
  const fixedCategoryIds = ['cat-rent', 'cat-utilities'];
  const discretionaryExpenses = expensesThisMonth.filter(e => !fixedCategoryIds.includes(e.categoryId));
  const totalDiscretionaryAmount = discretionaryExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  const todayDate = new Date();
  const daysPassed = Math.max(1, todayDate.getDate());
  const discretionaryBurnRate = totalDiscretionaryAmount / daysPassed;
  
  const forecastPaydayBalance = Math.round(totalBalance - remainingObligations - (discretionaryBurnRate * remainingDays));

  // Mobile Liability Battery Percent
  const liabilityPercent = totalObligations > 0 ? Math.round((remainingObligations / totalObligations) * 100) : 0;

  // Compile active budgets with current dynamic spends for dashboard battery cards
  const budgetStats = budgets.map((b) => {
    const matchingExpenses = expensesThisMonth.filter(e => e.categoryId === b.category);
    const spent = matchingExpenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = Math.max(b.monthlyBudget - spent, 0);
    const categoryInfo = categories.find(c => c.id === b.category);
    const categoryName = categoryInfo ? categoryInfo.name : 'Other';
    const remainingPercent = b.monthlyBudget > 0 ? Math.max(0, Math.round((remaining / b.monthlyBudget) * 100)) : 0;
    const consumedPercent = b.monthlyBudget > 0 ? Math.round((spent / b.monthlyBudget) * 100) : 0;

    return {
      ...b,
      categoryName,
      spent,
      remaining,
      remainingPercent,
      consumedPercent,
    };
  });

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddAmount || !quickAddWallet) return;
    if (!quickAddCategory) {
      alert('Please select a category first.');
      return;
    }
    const amountNum = parseFloat(quickAddAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const wallet = wallets.find(w => w.walletId === quickAddWallet);
    if (!wallet) return;

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      walletId: quickAddWallet,
      categoryId: quickAddCategory,
      amount: amountNum,
      currency: wallet.currency || 'INR',
      paymentMethod: wallet.type === 'UPI' ? 'UPI' : 'Cash',
      merchantName: 'Quick Add Transaction',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: 0,
      syncStatus: 'pending',
      tags: ['QuickAdd'],
      createdBy: user?.id || 'local-user',
      date: Date.now(),
    };

    // Update wallet balance
    wallet.currentBalance -= amountNum;
    wallet.updatedAt = Date.now();

    await db.expenses.add(newExpense);
    await db.wallets.put(wallet);

    setQuickAddAmount('');
    setQuickAddCategory('');
    setShowQuickAdd(false);
  };

  // Reorder / edit layouts handlers
  const handleMoveWidget = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= activeWidgets.length) return;

    const newWidgets = [...activeWidgets];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[nextIndex];
    newWidgets[nextIndex] = temp;

    setActiveWidgets(newWidgets);
    localStorage.setItem('mp_dashboard_widgets_v1', JSON.stringify(newWidgets));
  };

  const handleRemoveWidget = (widgetId: string) => {
    const newWidgets = activeWidgets.filter(id => id !== widgetId);
    setActiveWidgets(newWidgets);
    localStorage.setItem('mp_dashboard_widgets_v1', JSON.stringify(newWidgets));
  };

  const handleAddWidget = (widgetId: string) => {
    if (activeWidgets.includes(widgetId)) return;
    const newWidgets = [...activeWidgets, widgetId];
    setActiveWidgets(newWidgets);
    localStorage.setItem('mp_dashboard_widgets_v1', JSON.stringify(newWidgets));
  };

  const inactiveWidgets = WIDGET_DEFS.filter(def => !activeWidgets.includes(def.id));

  // Switch renderer for modular widgets
  const renderWidget = (id: string) => {
    switch (id) {
      case 'safe_to_spend':
        return (
          <div className="glass-card p-4 rounded-2xl flex flex-col justify-between border-blue-500/20 bg-blue-950/5 relative overflow-hidden text-left h-full group">
            <div className="absolute top-[-30px] right-[-30px] w-20 h-20 rounded-full bg-blue-500/10 blur-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-micro font-bold text-blue-400 uppercase tracking-wider">
                {safeToSpendMode === 'daily' ? 'Safe to Spend' : safeToSpendMode === 'weekly' ? 'Weekly Allowance' : 'Monthly Allowance'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wide ${
                isOnTrack 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}>
                {isOnTrack ? 'On Track' : 'Conserve'}
              </span>
            </div>
            <div>
              <h2 className="text-title font-black text-slate-900 dark:text-white truncate">
                {currencySymbol}{currentSafeToSpendVal.toLocaleString()}
              </h2>
              <p className="text-[10px] sm:text-micro text-gray-500 mt-1">
                {safeToSpendMode === 'daily' ? 'Daily budget' : safeToSpendMode === 'weekly' ? 'Allowance for 7 days' : 'Rest of this month'}
              </p>
              
              {/* Segmented Period Selector */}
              <div className="mt-3 flex items-center bg-slate-100 dark:bg-black/40 p-0.5 rounded-lg border border-slate-200 dark:border-white/5 w-fit relative z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetSafeToSpendMode('daily');
                  }}
                  className={`px-2.5 py-1 text-[8px] font-bold rounded-md uppercase cursor-pointer transition-all ${
                    safeToSpendMode === 'daily'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetSafeToSpendMode('weekly');
                  }}
                  className={`px-2.5 py-1 text-[8px] font-bold rounded-md uppercase cursor-pointer transition-all ${
                    safeToSpendMode === 'weekly'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetSafeToSpendMode('monthly');
                  }}
                  className={`px-2.5 py-1 text-[8px] font-bold rounded-md uppercase cursor-pointer transition-all ${
                    safeToSpendMode === 'monthly'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Month
                </button>
              </div>
            </div>
          </div>
        );

      case 'net_balance':
        return (
          <div className="glass-card p-4 rounded-2xl flex flex-col justify-between text-left h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-micro font-bold text-gray-400 uppercase tracking-wider">Net Balance</span>
              <WalletIcon className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <h2 className="text-title font-black text-slate-900 dark:text-white truncate">
                {currencySymbol}{totalBalance.toLocaleString()}
              </h2>
              <p className="text-[10px] sm:text-micro text-gray-500 mt-1">All accounts</p>
            </div>
          </div>
        );

      case 'earned':
        return (
          <div className="glass-card p-4 rounded-2xl flex flex-col justify-between text-left h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-micro font-bold text-emerald-400 uppercase tracking-wider">Earned</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-title font-black text-slate-900 dark:text-white truncate">
                {currencySymbol}{totalIncome.toLocaleString()}
              </h2>
              <p className="text-[10px] sm:text-micro text-gray-500 mt-1">This month</p>
            </div>
          </div>
        );

      case 'spent':
        return (
          <div className="glass-card p-4 rounded-2xl flex flex-col justify-between text-left h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-micro font-bold text-red-400 uppercase tracking-wider">Spent</span>
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-title font-black text-slate-900 dark:text-white truncate">
                {currencySymbol}{totalExpenses.toLocaleString()}
              </h2>
              <p className="text-[10px] sm:text-micro text-gray-500 mt-1">This month</p>
            </div>
          </div>
        );

      case 'obligations_load':
        return (
          <div className="glass-card p-4 rounded-2xl flex flex-col justify-between text-left relative overflow-hidden h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-micro font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Obligations Load</span>
              <span className={`w-2 h-2 rounded-full ${
                liabilityPercent > 70 ? 'bg-red-500 animate-pulse' : liabilityPercent > 30 ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-1 w-full h-4 border border-slate-300 dark:border-white/10 rounded p-0.5 relative bg-slate-100 dark:bg-black/20 mt-1">
                <div
                  className={`h-full rounded-sm transition-all duration-700 ${
                    liabilityPercent > 70
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                      : liabilityPercent > 30
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                      : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                  }`}
                  style={{ width: `${liabilityPercent}%` }}
                />
              </div>
              <p className="text-[10px] sm:text-micro text-gray-500 mt-2 truncate font-semibold uppercase">{liabilityPercent}% remaining</p>
            </div>
          </div>
        );

      case 'forecast_balance':
        return (
          <div className="glass-card p-4 rounded-2xl flex flex-col justify-between text-left border-indigo-500/10 bg-indigo-950/2 h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-micro font-bold text-indigo-400 uppercase tracking-wider">Forecast Balance</span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className={`text-title font-black truncate ${forecastPaydayBalance < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                {currencySymbol}{forecastPaydayBalance.toLocaleString()}
              </h2>
              <p className="text-[10px] sm:text-micro text-gray-500 mt-1">Projected payday</p>
            </div>
          </div>
        );

      case 'cashflow_health':
        return (
          <div className="glass-card p-4 sm:p-5 rounded-2xl border-white/5 space-y-3 bg-gradient-to-r from-blue-950/5 to-transparent text-left">
            <div className="flex justify-between items-center text-caption font-bold">
              <span className="text-gray-600 dark:text-gray-400">Budget Health Meter</span>
              <span className="text-blue-500 font-extrabold text-[12px] sm:text-caption">
                {totalIncome > 0 ? `${Math.round((totalExpenses / totalIncome) * 100)}% Spent` : 'No Income Logged'}
              </span>
            </div>
            <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden border border-white/5 relative">
              {totalIncome > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((totalExpenses / totalIncome) * 100, 100)}%` }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${
                    (totalExpenses / totalIncome) * 100 >= 90
                      ? 'bg-red-500'
                      : (totalExpenses / totalIncome) * 100 >= 75
                      ? 'bg-amber-500'
                      : 'bg-gradient-to-r from-blue-500 to-emerald-500'
                  }`}
                />
              )}
            </div>
            <div className="flex justify-between text-micro text-gray-500 font-semibold pt-1">
              <span>Spent: {currencySymbol}{totalExpenses.toLocaleString()}</span>
              <span>Earned: {currencySymbol}{totalIncome.toLocaleString()}</span>
            </div>
          </div>
        );

      case 'category_budgets':
        return (
          <div className="space-y-4 pt-2 text-left">
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-micro font-extrabold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Category Budgets</span>
              <Link to="/budgets" className="text-micro font-semibold text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1">
                Manage Ceilings <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {budgetStats.length === 0 ? (
              <div className="glass-card p-6 rounded-2xl text-center text-gray-400 border border-white/5">
                No active category budgets defined. Tap 'Manage Ceilings' to set one.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
                {budgetStats.map((b) => (
                  <div key={b.id} className="glass-card p-4 rounded-2xl flex flex-col justify-between text-left relative overflow-hidden border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] sm:text-micro font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider truncate max-w-[80%]" title={b.categoryName}>
                        {b.categoryName}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${
                        b.remainingPercent < 15 ? 'bg-red-500 animate-pulse' : b.remainingPercent < 30 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 w-full h-4 border border-slate-300 dark:border-white/10 rounded p-0.5 relative bg-slate-100 dark:bg-black/20 mt-1">
                        <div
                          className={`h-full rounded-sm transition-all duration-700 ${
                            b.remainingPercent < 15
                              ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                              : b.remainingPercent < 30
                              ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                              : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                          }`}
                          style={{ width: `${b.remainingPercent}%` }}
                        />
                      </div>
                      <p className="text-[10px] sm:text-micro text-gray-500 mt-2 truncate font-semibold uppercase">{b.remainingPercent}% remaining</p>
                      <p className="text-[9px] text-gray-400 mt-0.5 truncate font-medium">
                        {currencySymbol}{Math.round(b.spent).toLocaleString()} / {currencySymbol}{b.monthlyBudget.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'ai_copilot':
        return (
          <div className="glass-panel p-6 rounded-2xl border-white/5 bg-gradient-to-r from-blue-950/10 to-transparent text-left h-full flex items-center">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 shrink-0">
                <BrainCircuit className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-title font-semibold text-slate-900 dark:text-white mb-1">Financial Copilot Insight</h3>
                <p className="text-body text-gray-700 dark:text-gray-300 leading-relaxed">
                  {totalExpenses > totalIncome * 0.8
                    ? 'Caution: You have spent over 80% of your recorded income. Consider deferring subscriptions or shopping to maintain a safe savings gap.'
                    : 'Brilliant! Your current burn rate is low. You are projected to save a substantial portion of your salary this month.'}
                </p>
              </div>
            </div>
          </div>
        );

      case 'wallets_breakdown':
        return (
          <div className="space-y-4 text-left h-full">
            <div className="flex justify-between items-center">
              <h3 className="text-title font-semibold text-slate-900 dark:text-white">Your Wallets</h3>
              <Link to="/settings" className="text-caption text-blue-400 flex items-center gap-1 hover:underline">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {wallets.length === 0 ? (
              <div className="glass-card p-6 rounded-2xl text-center text-gray-400 border border-white/5">
                No active wallets found. Click Manage to add one.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {wallets.map((w) => (
                  <div key={w.walletId} className="glass-card p-5 rounded-xl border-white/5 flex justify-between items-center bg-[#f8f9fa] dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: w.color || '#3b82f6' }}
                      >
                        <WalletIcon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-caption font-bold text-slate-900 dark:text-white">{w.walletName}</p>
                        <p className="text-micro text-gray-500">{w.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-caption font-bold text-slate-900 dark:text-white">
                        {currencySymbol}{w.currentBalance.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'upcoming_bills':
        return (
          <div className="glass-card p-6 rounded-2xl border-white/5 h-full space-y-6 text-left">
            <h3 className="text-title font-semibold text-slate-900 dark:text-white">Timeline Warnings</h3>
            
            <div className="space-y-4">
              {upcomingBills.length === 0 ? (
                <p className="text-caption text-gray-400">No pending bills for the next 7 days.</p>
              ) : (
                upcomingBills.map(bill => (
                  <div key={bill.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="text-left">
                        <p className="text-caption font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">{bill.title}</p>
                        <p className="text-micro text-gray-500">Due: {new Date(bill.dueDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="text-caption font-bold text-slate-900 dark:text-white">
                      {currencySymbol}{bill.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
            
            <Link
              to="/bills"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 text-gray-300 hover:text-white font-medium text-caption cursor-pointer transition-all border border-white/5 active:scale-98"
            >
              Open Bills Schedule
            </Link>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 1. Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-slate-900 dark:text-white">
            Hello, {user?.displayName || 'Investor'}
          </h1>
          <p className="text-body text-gray-600 dark:text-gray-400">Here is your financial status today.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsEditingLayout(!isEditingLayout)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer ${
              isEditingLayout 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
            }`}
          >
            {isEditingLayout ? (
              <>
                <Check className="w-4 h-4" />
                Done Customizing
              </>
            ) : (
              <>
                <Sliders className="w-4 h-4" />
                Edit Layout
              </>
            )}
          </button>
          <button
            onClick={() => navigate('/qr')}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-black font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            Scan UPI QR
          </button>
          <button
            onClick={() => {
              if (wallets.length > 0) {
                setQuickAddWallet(wallets[0].walletId);
                setQuickAddCategory('');
                setShowQuickAdd(true);
              } else {
                alert('Please create a wallet first in Settings or Wallet sections.');
              }
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Quick Add
          </button>
        </div>
      </div>

      {/* 2. Unified Grid Dashboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-6 items-stretch">
        {activeWidgets.map((widgetId, index) => {
          const def = WIDGET_DEFS.find((w) => w.id === widgetId);
          if (!def) return null;

          return (
            <div
              key={widgetId}
              className={`${def.className} relative transition-all duration-300 ${
                isEditingLayout
                  ? 'ring-2 ring-dashed ring-blue-500/50 rounded-3xl p-1 bg-blue-600/5 min-h-[140px]'
                  : ''
              }`}
            >
              {isEditingLayout && (
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-black/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 shadow-xl">
                  <span className="text-[9px] font-extrabold text-blue-400 uppercase tracking-wide truncate max-w-[80px]">
                    {def.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleMoveWidget(index, 'up')}
                    disabled={index === 0}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveWidget(index, 'down')}
                    disabled={index === activeWidgets.length - 1}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveWidget(widgetId)}
                    className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 cursor-pointer"
                    title="Remove Widget"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              {renderWidget(widgetId)}
            </div>
          );
        })}
      </div>

      {/* 3. Inactive Widgets Drawer (Visible when in Edit Layout mode) */}
      {isEditingLayout && (
        <div className="glass-panel p-6 rounded-3xl border border-blue-500/20 bg-blue-950/10 space-y-4 text-left">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-title font-extrabold text-white">Add Widgets</h3>
              <p className="text-micro text-gray-400">Click to place hidden widgets back onto your dashboard.</p>
            </div>
            {activeWidgets.length !== DEFAULT_WIDGETS.length && (
              <button
                onClick={() => {
                  setActiveWidgets(DEFAULT_WIDGETS);
                  localStorage.setItem('mp_dashboard_widgets_v1', JSON.stringify(DEFAULT_WIDGETS));
                }}
                className="flex items-center gap-1 text-micro font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Layout
              </button>
            )}
          </div>
          {inactiveWidgets.length === 0 ? (
            <p className="text-caption text-gray-500 font-semibold uppercase tracking-wider">All widgets are active on your dashboard.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {inactiveWidgets.map((widget) => (
                <button
                  key={widget.id}
                  onClick={() => handleAddWidget(widget.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 text-caption font-bold cursor-pointer active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {widget.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Quick Add Dialog Modal overlay */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm glass-panel p-6 rounded-3xl"
          >
            <h3 className="text-title font-bold text-white mb-4">Quick Add Expense</h3>
            <form onSubmit={handleQuickAdd} className="space-y-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Amount</label>
                <input
                  type="number"
                  placeholder="Enter spend amount..."
                  value={quickAddAmount}
                  onChange={(e) => setQuickAddAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Select Wallet</label>
                <select
                  value={quickAddWallet}
                  onChange={(e) => setQuickAddWallet(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none focus:border-blue-500"
                >
                  {wallets.map(w => (
                    <option key={w.walletId} value={w.walletId} className="bg-black text-white">
                      {w.walletName} ({w.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1.5">Select Category</label>
                <ScrollWheelPicker
                  items={categories}
                  selectedValue={quickAddCategory}
                  onChange={setQuickAddCategory}
                  allowCustomAdd={true}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 hover:text-white font-semibold text-caption cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption cursor-pointer"
                >
                  Add Spend
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
