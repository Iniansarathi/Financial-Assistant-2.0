import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SavingsGoal } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Plus, Target, Calendar, TrendingUp } from 'lucide-react';

export const Goals: React.FC = () => {
  const { user } = useAuth();
  
  // States
  const [showAddForm, setShowAddForm] = useState(false);
  const [showContributeForm, setShowContributeForm] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [contribution, setContribution] = useState('');
  const [contribWallet, setContribWallet] = useState('');

  // Emergency Fund Helper states
  const [monthlyExpenseEstimate, setMonthlyExpenseEstimate] = useState('30000');
  const [monthsCount, setMonthsCount] = useState('6');

  // Queries
  const wallets = useLiveQuery(() => db.wallets.where('status').equals('active').toArray()) || [];
  const goals = useLiveQuery(() => db.goals.where('completed').equals(0).toArray()) || [];

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetAmount || !deadline) return;
    const targetNum = parseFloat(targetAmount);
    if (isNaN(targetNum) || targetNum <= 0) return;

    const newGoal: SavingsGoal = {
      id: `goal-${Date.now()}`,
      title,
      targetAmount: targetNum,
      savedAmount: 0,
      deadline: new Date(deadline).getTime(),
      priority,
      icon: 'Target',
      color: priority === 'high' ? '#ff3b30' : priority === 'medium' ? '#007aff' : '#34c759',
      completed: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.goals.add(newGoal);
    
    // Reset Form
    setTitle('');
    setTargetAmount('');
    setDeadline('');
    setPriority('medium');
    setShowAddForm(false);
  };

  const handleContribute = async (e: React.FormEvent, goal: SavingsGoal) => {
    e.preventDefault();
    if (!contribution || !contribWallet) return;
    const amountNum = parseFloat(contribution);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const wallet = wallets.find(w => w.walletId === contribWallet);
    if (!wallet) return;

    if (wallet.currentBalance < amountNum) {
      alert('Insufficient funds in the selected wallet.');
      return;
    }

    // Deduct from wallet
    wallet.currentBalance -= amountNum;
    wallet.updatedAt = Date.now();
    await db.wallets.put(wallet);

    // Add to goal
    goal.savedAmount += amountNum;
    if (goal.savedAmount >= goal.targetAmount) {
      goal.completed = 1;
    }
    goal.updatedAt = Date.now();
    await db.goals.put(goal);

    // Create a special sync action or register transaction in historical audit if needed
    // For simplicity, we just save the updated goal and wallet.
    setContribution('');
    setShowContributeForm(null);
  };

  // Emergency Fund target calculation
  const emergencyFundTarget = parseFloat(monthlyExpenseEstimate) * parseFloat(monthsCount);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-white">Savings Goals</h1>
          <p className="text-body text-gray-400">Define targets, contribute money, and track timelines.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Goal
        </button>
      </div>

      {/* Emergency Fund Calculator Widget */}
      <div className="glass-panel p-6 rounded-3xl border-white/5 bg-gradient-to-r from-emerald-950/10 to-transparent">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 text-left">
            <h3 className="text-title font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Emergency Fund Assistant
            </h3>
            <p className="text-caption text-gray-400 max-w-xl leading-relaxed">
              Financial planners recommend holding 3 to 6 months of essential living expenses in a secure, liquid account for unexpected events.
            </p>
          </div>
          
          <div className="flex gap-4 items-center shrink-0">
            <div>
              <label className="text-[10px] text-gray-500 font-bold block mb-1">Monthly Spend</label>
              <input
                type="number"
                value={monthlyExpenseEstimate}
                onChange={(e) => setMonthlyExpenseEstimate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-caption text-white focus:outline-none w-28"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-bold block mb-1">Duration (Months)</label>
              <select
                value={monthsCount}
                onChange={(e) => setMonthsCount(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-caption text-white focus:outline-none w-24"
              >
                <option value="3" className="bg-black">3 Months</option>
                <option value="6" className="bg-black">6 Months</option>
                <option value="12" className="bg-black">12 Months</option>
              </select>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-emerald-400 font-bold block">Recommended Goal</span>
              <span className="text-title font-extrabold text-white">
                {user?.currency === 'INR' ? '₹' : '$'}{emergencyFundTarget.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Form overlays */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleCreateGoal} className="w-full max-w-sm glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="text-title font-bold text-white mb-4">Create Savings Target</h3>
            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Goal Title</label>
              <input
                type="text"
                placeholder="Tesla Model Y, Emergency Pool, Vacation..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Target Amount</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                >
                  <option value="low" className="bg-black">Low</option>
                  <option value="medium" className="bg-black">Medium</option>
                  <option value="high" className="bg-black">High</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Target Date</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 hover:text-white font-semibold text-caption cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goals Display List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.length === 0 ? (
          <div className="col-span-2 glass-card p-12 text-center text-gray-400 rounded-2xl">
            No savings goals established yet. Create one above.
          </div>
        ) : (
          goals.map((g) => {
            const percentage = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
                        // Forecast logic
            const timeDiff = g.deadline - Date.now();
            const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            const monthsLeft = Math.max(parseFloat((daysLeft / 30.4).toFixed(1)), 0.1);

            return (
              <div key={g.id} className="glass-card p-6 rounded-2xl border-white/5 flex flex-col justify-between space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: g.color || '#3b82f6' }}
                    >
                      <Target className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-caption font-bold text-white leading-tight">{g.title}</p>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                        Priority: {g.priority}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (wallets.length > 0) {
                        setContribWallet(wallets[0].walletId);
                        setShowContributeForm(g.id);
                      } else {
                        alert('Please create a wallet to contribute funds.');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-micro active:scale-95 cursor-pointer"
                  >
                    Add Savings
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-caption font-bold">
                    <span className="text-emerald-400">
                      Saved: {user?.currency === 'INR' ? '₹' : '$'}{Math.round(g.savedAmount).toLocaleString()}
                    </span>
                    <span className="text-gray-400">
                      Target: {user?.currency === 'INR' ? '₹' : '$'}{g.targetAmount.toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Progress Ring */}
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-micro pt-2 border-t border-white/5 text-gray-400">
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    Deadline: {new Date(g.deadline).toLocaleDateString()}
                  </span>
                  <span className="font-semibold text-blue-400">
                    {monthsLeft} months left
                  </span>
                </div>

                {/* Contribute Money Overlay Form */}
                {showContributeForm === g.id && (
                  <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <form onSubmit={(e) => handleContribute(e, g)} className="w-full max-w-sm glass-panel p-6 rounded-3xl space-y-4 text-left">
                      <h3 className="text-title font-bold text-white mb-2">Contribute Savings</h3>
                      <p className="text-caption text-gray-400 mb-4">Transfer funds from wallet to target savings.</p>
                      
                      <div>
                        <label className="text-micro text-gray-400 font-semibold block mb-1">Source Wallet</label>
                        <select
                          value={contribWallet}
                          onChange={(e) => setContribWallet(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                        >
                          {wallets.map(w => (
                            <option key={w.walletId} value={w.walletId} className="bg-black text-white">
                              {w.walletName} ({user?.currency === 'INR' ? '₹' : '$'}{w.currentBalance})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-micro text-gray-400 font-semibold block mb-1">Contribution Amount</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={contribution}
                          onChange={(e) => setContribution(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                          required
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowContributeForm(null)}
                          className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 hover:text-white font-semibold text-caption cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption cursor-pointer"
                        >
                          Transfer
                        </button>
                      </div>
                    </form>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
