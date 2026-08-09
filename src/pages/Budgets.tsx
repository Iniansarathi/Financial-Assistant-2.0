import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Budget } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Plus, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { Goals } from './Goals';

export const Budgets: React.FC = () => {
  const { user } = useAuth();
  
  // States
  const [activeTab, setActiveTab] = useState<'budgets' | 'goals'>('budgets');
  const [showAddForm, setShowAddForm] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');

  // Get current date boundaries (this month)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  // Queries
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const expensesThisMonth = useLiveQuery(() =>
    db.expenses.where('date').between(startOfMonth, endOfMonth).filter(e => e.isDeleted === 0).toArray()
  ) || [];

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !monthlyLimit) return;
    const limitNum = parseFloat(monthlyLimit);
    if (isNaN(limitNum) || limitNum <= 0) return;

    const existingBudget = budgets.find(b => b.category === categoryId);
    const budgetId = existingBudget ? existingBudget.id : `bud-${Date.now()}`;

    const newBudget: Budget = {
      id: budgetId,
      category: categoryId,
      monthlyBudget: limitNum,
      spent: 0, // calculated dynamically below
      remaining: limitNum,
      warningPercentage: 75,
      criticalPercentage: 90,
      createdAt: existingBudget?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await db.budgets.put(newBudget);
    
    // Reset
    setMonthlyLimit('');
    setShowAddForm(false);
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Are you sure you want to remove this budget ceiling?')) return;
    await db.budgets.delete(id);
  };

  // Compile active budgets with current dynamic spends
  const activeBudgets = budgets.map((b) => {
    const matchingExpenses = expensesThisMonth.filter(e => e.categoryId === b.category);
    const spent = matchingExpenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = Math.max(b.monthlyBudget - spent, 0);
    const categoryInfo = categories.find(c => c.id === b.category);
    const percentage = b.monthlyBudget > 0 ? (spent / b.monthlyBudget) * 100 : 0;

    return {
      ...b,
      spent,
      remaining,
      percentage,
      categoryName: categoryInfo?.name || 'Uncategorized',
      categoryColor: categoryInfo?.color || '#3b82f6',
    };
  });

  const getStatusInfo = (percentage: number) => {
    if (percentage >= 100) return { label: 'Limit Exceeded', color: 'text-red-400', barColor: 'bg-red-500', icon: ShieldAlert };
    if (percentage >= 90) return { label: 'Critical Threshold', color: 'text-amber-500', barColor: 'bg-amber-500', icon: AlertTriangle };
    if (percentage >= 75) return { label: 'Warning Threshold', color: 'text-yellow-400', barColor: 'bg-yellow-400', icon: AlertTriangle };
    return { label: 'Budget Healthy', color: 'text-emerald-400', barColor: 'bg-emerald-500', icon: CheckCircle };
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Sliding Pill Tab Switcher */}
      <div className="flex p-1 bg-white/5 border border-white/5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-6 py-2.5 rounded-xl text-caption font-bold transition-all cursor-pointer ${
            activeTab === 'budgets'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Category Budgets
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-6 py-2.5 rounded-xl text-caption font-bold transition-all cursor-pointer ${
            activeTab === 'goals'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Savings Goals
        </button>
      </div>

      {activeTab === 'budgets' ? (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-heading font-extrabold tracking-tight text-slate-900 dark:text-white">Budgets</h1>
              <p className="text-body text-gray-600 dark:text-gray-400">Establish and monitor monthly category budgets.</p>
            </div>
            <button
              onClick={() => {
                if (categories.length > 0) {
                  setCategoryId(categories[0].id);
                  setShowAddForm(true);
                } else {
                  alert('Loading categories...');
                }
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Setup Budget
            </button>
          </div>

          {/* Form Dialog */}
          {showAddForm && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
              <form onSubmit={handleSaveBudget} className="w-full max-w-sm glass-panel p-6 rounded-3xl space-y-4">
                <h3 className="text-title font-bold text-white mb-4">Set Category Ceiling</h3>
                
                <div>
                  <label className="text-micro text-gray-400 font-semibold block mb-1">Target Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id} className="bg-black text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-micro text-gray-400 font-semibold block mb-1">Monthly Ceiling Limit</label>
                  <input
                    type="number"
                    placeholder="Limit amount..."
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-gray-300 font-semibold text-caption hover:bg-white/10 active:scale-98 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-caption hover:bg-blue-500 active:scale-98 transition-all"
                  >
                    Activate
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Grid list of active budgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeBudgets.length === 0 ? (
              <div className="glass-card p-12 text-center rounded-2xl text-gray-400 col-span-full">
                No budget limits defined. Tap 'Setup Budget' to create your first monthly category filter limit.
              </div>
            ) : (
              activeBudgets.map((b) => {
                const status = getStatusInfo(b.percentage);
                const StatusIcon = status.icon;

                return (
                  <div key={b.id} className="glass-card p-6 rounded-2xl border-white/5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                        <h4 className="text-caption font-extrabold text-slate-900 dark:text-white">{b.categoryName}</h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteBudget(b.id)}
                          className="text-micro font-medium text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-caption font-bold">
                        <span className="text-gray-600 dark:text-gray-400">
                          Spent: {user?.currency === 'USD' ? '$' : '₹'}{Math.round(b.spent).toLocaleString()}
                        </span>
                        <span className="text-slate-900 dark:text-white">
                          Limit: {user?.currency === 'USD' ? '$' : '₹'}{b.monthlyBudget.toLocaleString()}
                        </span>
                      </div>
                      {/* Progress Bar Container */}
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${status.barColor}`}
                          style={{ width: `${Math.min(b.percentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-micro pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                        <span className={`font-semibold ${status.color}`}>{status.label}</span>
                      </div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        {Math.round(b.percentage)}% consumed
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <Goals />
      )}
    </div>
  );
};
