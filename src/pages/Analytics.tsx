import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

export const Analytics: React.FC = () => {
  const { user } = useAuth();

  // Queries
  const expenses = useLiveQuery(() => db.expenses.where('isDeleted').equals(0).toArray()) || [];
  const income = useLiveQuery(() => db.income.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // Group spends by category
  const categorySpends = categories
    .filter(cat => cat.type === 'expense')
    .map(cat => {
      const amount = expenses
        .filter(exp => exp.categoryId === cat.id)
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        name: cat.name,
        value: amount,
        color: cat.color || '#3b82f6',
      };
    })
    .filter(c => c.value > 0);

  // Group items by month for Income vs Expenses chart
  const monthlyDataMap = new Map<string, { month: string; income: number; expenses: number }>();
  
  // Initialize last 6 months
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    monthlyDataMap.set(label, { month: label, income: 0, expenses: 0 });
  }

  // Populate expenses
  expenses.forEach(exp => {
    const expDate = new Date(exp.date || exp.createdAt);
    const label = expDate.toLocaleString('default', { month: 'short', year: '2-digit' });
    if (monthlyDataMap.has(label)) {
      const data = monthlyDataMap.get(label)!;
      data.expenses += exp.amount;
    }
  });

  // Populate income
  income.forEach(inc => {
    const incDate = new Date(inc.date);
    const label = incDate.toLocaleString('default', { month: 'short', year: '2-digit' });
    if (monthlyDataMap.has(label)) {
      const data = monthlyDataMap.get(label)!;
      data.income += inc.amount;
    }
  });

  const chartData = Array.from(monthlyDataMap.values());

  // Running cash flow analysis
  let runningSavings = 0;
  const cashFlowData = chartData.map(d => {
    const savings = d.income - d.expenses;
    runningSavings += savings;
    return {
      month: d.month,
      savings,
      runningSavings,
    };
  });

  const currencySymbol = user?.currency === 'INR' ? '₹' : '$';

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-heading font-extrabold tracking-tight text-white">Financial Analytics</h1>
        <p className="text-body text-gray-400">Deep visual insights into your cash flow trends.</p>
      </div>

      {/* Grid Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Income vs Expenses Chart */}
        <div className="glass-card p-6 rounded-2xl border-white/5 space-y-4">
          <h3 className="text-title font-bold text-white text-left">Cash Credits vs Debits</h3>
          <p className="text-micro text-gray-500 text-left">Comparison of income credits and spends over the past 6 months.</p>
          <div className="h-72 w-full text-caption">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#888" tickLine={false} />
                <YAxis stroke="#888" tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20, 20, 22, 0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    color: '#fff',
                  }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" name="Income Credits" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses Spends" fill="#ff2d55" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category distribution */}
        <div className="glass-card p-6 rounded-2xl border-white/5 space-y-4">
          <h3 className="text-title font-bold text-white text-left">Category Breakdown</h3>
          <p className="text-micro text-gray-500 text-left">Distribution of overall historical spends by category.</p>
          <div className="h-72 w-full text-caption flex justify-center items-center">
            {categorySpends.length === 0 ? (
              <p className="text-caption text-gray-400">Record expenses to display category distribution.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySpends}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categorySpends.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => `${currencySymbol}${value.toLocaleString()}`}
                    contentStyle={{
                      background: 'rgba(20, 20, 22, 0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '16px',
                    }}
                  />
                  <Legend iconType="circle" layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Net Wealth & Cash Flow Trend Area chart */}
        <div className="glass-card p-6 rounded-2xl border-white/5 space-y-4 lg:col-span-2">
          <h3 className="text-title font-bold text-white text-left">Net Wealth Accumulation</h3>
          <p className="text-micro text-gray-500 text-left">Accumulative net savings trajectory after subtracting expenses from income.</p>
          <div className="h-80 w-full text-caption">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007aff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#007aff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#888" tickLine={false} />
                <YAxis stroke="#888" tickLine={false} />
                <Tooltip
                  formatter={(value: any) => `${currencySymbol}${value.toLocaleString()}`}
                  contentStyle={{
                    background: 'rgba(20, 20, 22, 0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="runningSavings"
                  name="Cumulative Savings Balance"
                  stroke="#007aff"
                  fillOpacity={1}
                  fill="url(#colorSavings)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
