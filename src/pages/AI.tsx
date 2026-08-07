import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Award, TrendingUp, Compass, AlertTriangle } from 'lucide-react';

export const AICopilot: React.FC = () => {
  const { user } = useAuth();
  
  // Goal Simulator state
  const [extraMonthlySavings, setExtraMonthlySavings] = useState('2000');

  // Queries
  const expenses = useLiveQuery(() => db.expenses.where('isDeleted').equals(0).toArray()) || [];
  const income = useLiveQuery(() => db.income.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const bills = useLiveQuery(() => db.bills.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.where('completed').equals(0).toArray()) || [];
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray()) || [];

  // 1. Calculate Financial Health Score (0-100)
  let healthScore = 50; // baseline
  const auditLogs: { check: string; impact: number; positive: boolean }[] = [];

  // Factor A: Budget discipline
  if (budgets.length > 0) {
    const exceededBudgets = budgets.filter(b => b.spent > b.monthlyBudget);
    if (exceededBudgets.length === 0) {
      healthScore += 15;
      auditLogs.push({ check: 'All active budgets are within limits', impact: 15, positive: true });
    } else {
      healthScore -= 10 * exceededBudgets.length;
      auditLogs.push({ check: `${exceededBudgets.length} budget limits exceeded`, impact: -10 * exceededBudgets.length, positive: false });
    }
  } else {
    auditLogs.push({ check: 'No budget ceilings configured', impact: 0, positive: false });
  }

  // Factor B: Bill payment punctuality
  const unpaidBills = bills.filter(b => b.paid === 0);
  if (unpaidBills.length === 0 && bills.length > 0) {
    healthScore += 20;
    auditLogs.push({ check: 'No pending utility dues or loan EMIs', impact: 20, positive: true });
  } else if (unpaidBills.length > 0) {
    healthScore -= 8 * unpaidBills.length;
    auditLogs.push({ check: `${unpaidBills.length} outstanding bills due`, impact: -8 * unpaidBills.length, positive: false });
  }

  // Factor C: Savings goals active
  if (goals.length > 0) {
    healthScore += 10;
    auditLogs.push({ check: 'Active long-term savings goals established', impact: 10, positive: true });
  }

  // Factor D: Subscription load
  const totalSubMonthly = subscriptions.reduce((sum, s) => {
    return sum + (s.cycle === 'yearly' ? s.amount / 12 : s.cycle === 'weekly' ? s.amount * 4.33 : s.amount);
  }, 0);
  const monthlyIncomeSum = income.reduce((sum, i) => sum + i.amount, 0) || 50000;
  
  const subRatio = totalSubMonthly / monthlyIncomeSum;
  if (subRatio > 0.15) {
    healthScore -= 12;
    auditLogs.push({ check: 'Subscription load exceeds 15% of income', impact: -12, positive: false });
  } else if (subRatio > 0 && subRatio <= 0.05) {
    healthScore += 8;
    auditLogs.push({ check: 'Highly optimized subscription footprint', impact: 8, positive: true });
  }

  healthScore = Math.max(0, Math.min(100, healthScore));

  const getHealthBadge = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (score >= 60) return { label: 'Good', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    if (score >= 40) return { label: 'Average', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
    return { label: 'Needs Action', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
  };

  // 2. Rolling burn rate over past 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const expenses30Days = expenses.filter(e => e.date && e.date >= thirtyDaysAgo);
  const totalSpent30Days = expenses30Days.reduce((sum, e) => sum + e.amount, 0);
  const dailyBurnRate = Math.round(totalSpent30Days / 30);

  // 3. Unusual Spending Detection (any transaction > 2x the category average)
  const unusualTransactions = expenses.filter(exp => {
    const categoryExpenses = expenses.filter(e => e.categoryId === exp.categoryId);
    if (categoryExpenses.length < 3) return false;
    const avg = categoryExpenses.reduce((sum, e) => sum + e.amount, 0) / categoryExpenses.length;
    return exp.amount > avg * 2.5;
  }).slice(0, 3);

  const currencySymbol = user?.currency === 'INR' ? '₹' : '$';

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-heading font-extrabold tracking-tight text-white">AI Financial Copilot</h1>
        <p className="text-body text-gray-400">Autonomous insights calculated locally using your private data.</p>
      </div>

      {/* Financial health evaluation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Score display */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between items-center text-center">
          <span className="text-micro font-bold text-gray-400 uppercase tracking-wider">Financial Health Index</span>
          
          <div className="my-6 relative flex items-center justify-center">
            {/* Circle score indicator */}
            <div className="w-28 h-28 rounded-full border-4 border-white/5 flex flex-col items-center justify-center bg-white/2">
              <span className="text-display font-black text-white">{healthScore}</span>
              <span className="text-[10px] text-gray-500">/ 100</span>
            </div>
          </div>

          <span className={`px-4 py-1.5 rounded-full border text-micro font-bold uppercase tracking-wider ${getHealthBadge(healthScore).color}`}>
            {getHealthBadge(healthScore).label}
          </span>
        </div>

        {/* Audit checklist list */}
        <div className="glass-card p-6 rounded-2xl md:col-span-2 space-y-4 text-left">
          <h3 className="text-title font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-400" />
            Health Index Breakdown
          </h3>
          <div className="space-y-3">
            {auditLogs.map((log, idx) => (
              <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-white/5 border border-white/2">
                <span className="text-caption text-gray-300 font-medium">{log.check}</span>
                <span className={`text-caption font-bold ${log.positive ? 'text-emerald-400' : log.impact === 0 ? 'text-gray-400' : 'text-red-400'}`}>
                  {log.positive ? `+${log.impact}` : log.impact === 0 ? '--' : log.impact}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Goal simulator & rolling burn rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Goal Simulator */}
        <div className="glass-card p-6 rounded-2xl space-y-4 text-left">
          <h3 className="text-title font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Savings Goal Simulator
          </h3>
          <p className="text-caption text-gray-400">
            Simulate how increasing your monthly contributions speeds up your timelines.
          </p>

          <div>
            <label className="text-micro text-gray-500 font-bold block mb-1">Simulated Monthly Boost</label>
            <input
              type="number"
              value={extraMonthlySavings}
              onChange={(e) => setExtraMonthlySavings(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none w-full"
              placeholder="e.g. 2000"
            />
          </div>

          <div className="space-y-3 pt-2">
            {goals.length === 0 ? (
              <p className="text-micro text-gray-500">Configure a savings goal first to run simulations.</p>
            ) : (
              goals.map(g => {
                const boost = parseFloat(extraMonthlySavings) || 0;
                
                // standard rate (hypothetically 5000/mo baseline)
                const currentMonthlyContrib = 5000;
                const remainingAmt = Math.max(g.targetAmount - g.savedAmount, 0);
                
                const origMonths = Math.max(remainingAmt / currentMonthlyContrib, 1);
                const simMonths = Math.max(remainingAmt / (currentMonthlyContrib + boost), 1);
                const difference = Math.max(origMonths - simMonths, 0);

                return (
                  <div key={g.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-caption font-bold text-white">{g.title}</p>
                      <p className="text-micro text-gray-400">Saves {difference.toFixed(1)} months of work</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 block">Simulated ETA</span>
                      <span className="text-caption font-bold text-emerald-400">{simMonths.toFixed(1)} Mos</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Burn Rate & Spikes */}
        <div className="glass-card p-6 rounded-2xl space-y-4 text-left">
          <h3 className="text-title font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-400" />
            Burn Rate & Anomalies
          </h3>
          
          <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
            <div>
              <p className="text-caption font-bold text-white">Rolling Burn Rate</p>
              <p className="text-micro text-gray-400">Average spending velocity per day</p>
            </div>
            <span className="text-title font-extrabold text-white">
              {currencySymbol}{dailyBurnRate.toLocaleString()}/day
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <span className="text-micro font-bold text-gray-400 uppercase tracking-wider block">Spike Anomalies Detected</span>
            {unusualTransactions.length === 0 ? (
              <p className="text-micro text-gray-500">No unusual transaction spikes detected in recent cycles.</p>
            ) : (
              unusualTransactions.map(ut => (
                <div key={ut.id} className="flex justify-between items-center p-2.5 bg-red-950/10 border border-red-900/20 text-red-400 rounded-xl">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <div className="text-left">
                      <p className="text-caption font-bold text-white">{ut.merchantName}</p>
                      <p className="text-micro text-gray-400">Exceeds category average</p>
                    </div>
                  </div>
                  <span className="text-caption font-bold text-white">
                    {currencySymbol}{ut.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
