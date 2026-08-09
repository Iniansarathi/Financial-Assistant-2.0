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
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ScrollWheelPicker } from '../components/ui/ScrollWheelPicker';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [quickAddWallet, setQuickAddWallet] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

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
  const goals = useLiveQuery(() => db.goals.where('completed').equals(0).toArray()) || [];

  // Calculations
  const totalBalance = wallets.reduce((sum, w) => sum + w.currentBalance, 0);
  const totalExpenses = expensesThisMonth.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = incomeThisMonth.reduce((sum, i) => sum + i.amount, 0);

  // Safe To Spend Algorithm:
  // Disposable Income = Salary/Monthly Income - Remaining Savings Targets - Unpaid Bills.
  // Safe Today = Remaining Disposable / Remaining Days in Month.
  const unpaidBillsSum = upcomingBills.reduce((sum, b) => sum + b.amount, 0);
  const savingsTargetRemaining = goals.reduce((sum, g) => sum + Math.max(g.targetAmount - g.savedAmount, 0), 0);
  
  // Calculate disposable pool (Salary baseline or total income this month)
  const baseSalary = user?.salaryDate ? totalIncome : 50000; // default baseline if no income added yet
  const disposablePool = Math.max(baseSalary - unpaidBillsSum - (savingsTargetRemaining / 12), 0);
  const remainingDisposable = Math.max(disposablePool - totalExpenses, 0);
  const safeToSpendToday = Math.round(remainingDisposable / remainingDays);

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
      tags: ['quick-add'],
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
        <div className="flex gap-3">
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
                setQuickAddCategory(''); // default to empty (Select Category placeholder)
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

      {/* 2. Grid Dashboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Safe To Spend Card */}
        <div className="glass-card p-4 sm:p-6 rounded-2xl flex flex-col justify-between border-blue-500/20 bg-blue-950/5 relative overflow-hidden">
          <div className="absolute top-[-30px] right-[-30px] w-20 h-20 rounded-full bg-blue-500/10 blur-xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-micro font-bold text-blue-400 uppercase tracking-wider">Safe to Spend</span>
            <BrainCircuit className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-title sm:text-display font-black text-slate-900 dark:text-white truncate">
              {user?.currency === 'USD' ? '$' : '₹'}{safeToSpendToday.toLocaleString()}
            </h2>
            <p className="text-[10px] sm:text-micro text-gray-500 mt-1">Daily budget</p>
          </div>
        </div>

        {/* Total Balance Card */}
        <div className="glass-card p-4 sm:p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-micro font-bold text-gray-400 uppercase tracking-wider">Net Balance</span>
            <WalletIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <h2 className="text-title sm:text-display font-black text-slate-900 dark:text-white truncate">
              {user?.currency === 'USD' ? '$' : '₹'}{totalBalance.toLocaleString()}
            </h2>
            <p className="text-[10px] sm:text-micro text-gray-500 mt-1">All accounts</p>
          </div>
        </div>

        {/* Income Card */}
        <div className="glass-card p-4 sm:p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-micro font-bold text-emerald-400 uppercase tracking-wider">Earned</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-title sm:text-display font-black text-slate-900 dark:text-white truncate">
              {user?.currency === 'USD' ? '$' : '₹'}{totalIncome.toLocaleString()}
            </h2>
            <p className="text-[10px] sm:text-micro text-gray-500 mt-1">This month</p>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="glass-card p-4 sm:p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-micro font-bold text-red-400 uppercase tracking-wider">Spent</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-title sm:text-display font-black text-slate-900 dark:text-white truncate">
              {user?.currency === 'USD' ? '$' : '₹'}{totalExpenses.toLocaleString()}
            </h2>
            <p className="text-[10px] sm:text-micro text-gray-500 mt-1">This month</p>
          </div>
        </div>

      </div>

      {/* 2.5. Animated Cashflow Health Bar */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border-white/5 space-y-3 bg-gradient-to-r from-blue-950/5 to-transparent">
        <div className="flex justify-between items-center text-caption font-bold">
          <span className="text-gray-600 dark:text-gray-400">Budget Health Meter</span>
          <span className="text-blue-500 font-extrabold text-[12px] sm:text-caption">
            {totalIncome > 0 ? `${Math.round((totalExpenses / totalIncome) * 100)}% Spent` : 'No Income Logged'}
          </span>
        </div>
        
        {/* Progress Bar Track */}
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
          <span>Spent: {user?.currency === 'USD' ? '$' : '₹'}{totalExpenses.toLocaleString()}</span>
          <span>Earned: {user?.currency === 'USD' ? '$' : '₹'}{totalIncome.toLocaleString()}</span>
        </div>
      </div>

      {/* 3. Secondary Layout (Copilot banner and transactions summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Wallet list & AI Insights Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* AI Insights Card */}
          <div className="glass-panel p-6 rounded-2xl border-white/5 bg-gradient-to-r from-blue-950/10 to-transparent">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
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

          {/* Wallets Breakdown */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-title font-semibold text-slate-900 dark:text-white">Your Wallets</h3>
              <Link to="/settings" className="text-caption text-blue-400 flex items-center gap-1 hover:underline">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {wallets.length === 0 ? (
              <div className="glass-card p-6 rounded-2xl text-center text-gray-400">
                No active wallets found. Click Manage to add one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {wallets.map((w) => (
                  <div key={w.walletId} className="glass-card p-5 rounded-xl border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: w.color || '#333' }}
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
                        {user?.currency === 'INR' ? '₹' : '$'}{w.currentBalance.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Upcoming bills / Actionable Alerts panel */}
        <div className="glass-card p-6 rounded-2xl border-white/5 h-fit space-y-6">
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
                    {user?.currency === 'INR' ? '₹' : '$'}{bill.amount}
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

      </div>

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
                />
              </div>
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Amount</label>
                <input
                  type="number"
                  placeholder="Enter spend amount..."
                  value={quickAddAmount}
                  onChange={(e) => setQuickAddAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none focus:border-blue-500"
                  required
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
