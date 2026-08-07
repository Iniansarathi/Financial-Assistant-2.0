import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Subscription } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Plus, Trash2, CreditCard, RefreshCw } from 'lucide-react';

export const Subscriptions: React.FC = () => {
  const { user } = useAuth();
  
  // States
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [renewalDate, setRenewalDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [autoRenew, setAutoRenew] = useState('1');

  // Queries
  const wallets = useLiveQuery(() => db.wallets.where('status').equals('active').toArray()) || [];
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray()) || [];

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !renewalDate || !paymentMethod) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const newSub: Subscription = {
      id: `sub-${Date.now()}`,
      name,
      amount: amountNum,
      renewalDate: new Date(renewalDate).getTime(),
      cycle,
      paymentMethod,
      autoRenew: parseInt(autoRenew),
      notificationDays: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.subscriptions.add(newSub);

    // Reset Form
    setName('');
    setAmount('');
    setRenewalDate('');
    setShowAddForm(false);
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!confirm('Are you sure you want to stop tracking this subscription?')) return;
    await db.subscriptions.delete(id);
  };

  // Calculations
  const calculateMonthlyEquivalent = (sub: Subscription) => {
    switch (sub.cycle) {
      case 'weekly':
        return sub.amount * 4.33;
      case 'yearly':
        return sub.amount / 12;
      case 'monthly':
      default:
        return sub.amount;
    }
  };

  const totalMonthlyCost = subscriptions.reduce((sum, s) => sum + calculateMonthlyEquivalent(s), 0);
  const totalAnnualCost = totalMonthlyCost * 12;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-white">Subscriptions</h1>
          <p className="text-body text-gray-400">Track and optimize your active recurring memberships.</p>
        </div>
        <button
          onClick={() => {
            if (wallets.length > 0) {
              setPaymentMethod(wallets[0].walletName);
            }
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Subscription
        </button>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl">
          <span className="text-micro font-bold text-gray-400 uppercase tracking-wider">Total Subscription Load / Month</span>
          <h2 className="text-display font-black text-white mt-2">
            {user?.currency === 'INR' ? '₹' : '$'}{Math.round(totalMonthlyCost).toLocaleString()}
          </h2>
          <p className="text-micro text-gray-500 mt-1">Sum of equivalent monthly recurring payments</p>
        </div>
        <div className="glass-card p-6 rounded-2xl">
          <span className="text-micro font-bold text-gray-400 uppercase tracking-wider">Projected Cost / Year</span>
          <h2 className="text-display font-black text-white mt-2">
            {user?.currency === 'INR' ? '₹' : '$'}{Math.round(totalAnnualCost).toLocaleString()}
          </h2>
          <p className="text-micro text-gray-500 mt-1">Annual budget footprint</p>
        </div>
      </div>

      {/* Form overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleAddSubscription} className="w-full max-w-sm glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="text-title font-bold text-white mb-4">Track Subscription</h3>
            
            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Service Name</label>
              <input
                type="text"
                placeholder="Netflix, Spotify, ChatGPT..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Billing Amount</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Billing Cycle</label>
                <select
                  value={cycle}
                  onChange={(e) => setCycle(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                >
                  <option value="weekly" className="bg-black text-white">Weekly</option>
                  <option value="monthly" className="bg-black text-white">Monthly</option>
                  <option value="yearly" className="bg-black text-white">Yearly</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Next Renewal</label>
                <input
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Pay Method</label>
                <input
                  type="text"
                  placeholder="HDFC Card, Cash"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Auto Renew?</label>
              <select
                value={autoRenew}
                onChange={(e) => setAutoRenew(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
              >
                <option value="1" className="bg-black text-white">Yes, automatic charge</option>
                <option value="0" className="bg-black text-white">No, manual payment required</option>
              </select>
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
                Track
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subscription List */}
      <div className="space-y-4">
        {subscriptions.length === 0 ? (
          <div className="glass-card p-12 text-center text-gray-400 rounded-2xl">
            No subscriptions tracked. Add one above.
          </div>
        ) : (
          subscriptions.map((sub) => {
            const timeDiff = sub.renewalDate - Date.now();
            const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            
            return (
              <div
                key={sub.id}
                className="glass-card p-5 rounded-2xl border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-blue-400">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-title font-bold text-white leading-tight">{sub.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-micro bg-white/5 px-2 py-0.5 rounded text-gray-400 capitalize">
                        {sub.cycle}
                      </span>
                      <span className="text-micro text-gray-500 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {sub.paymentMethod}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-0 border-white/5 pt-3 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-title font-black text-white">
                      {user?.currency === 'INR' ? '₹' : '$'}{sub.amount.toLocaleString()}
                    </p>
                    <p className="text-micro text-gray-500 mt-0.5">
                      Renews: {new Date(sub.renewalDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-micro px-2 py-1 rounded font-bold ${daysLeft <= 3 ? 'bg-red-500/10 text-red-400 border border-red-500/10' : 'bg-white/5 text-gray-400'}`}>
                      {daysLeft <= 0 ? 'Renewal Today' : `${daysLeft} days left`}
                    </span>
                    <button
                      onClick={() => handleDeleteSubscription(sub.id)}
                      className="p-2.5 rounded-xl bg-red-950/20 border border-red-900/20 text-red-400 hover:bg-red-950/40 cursor-pointer active:scale-95 transition-all animate-none"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
