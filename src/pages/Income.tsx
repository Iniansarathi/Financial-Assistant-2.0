import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Income } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Trash2, Plus, Search, DollarSign } from 'lucide-react';

export const IncomePage: React.FC = () => {
  const { user } = useAuth();
  
  // States
  const [showAddForm, setShowAddForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const wallets = useLiveQuery(() => db.wallets.where('status').equals('active').toArray()) || [];
  const categories = useLiveQuery(() => db.categories.where('type').equals('income').toArray()) || [];
  const incomeRecords = useLiveQuery(() => db.income.reverse().sortBy('date')) || [];

  // Filtered List
  const filteredIncome = incomeRecords.filter(inc => {
    const matchesSearch = 
      inc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !walletId || !category) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const wallet = wallets.find(w => w.walletId === walletId);
    if (!wallet) return;

    const newIncome: Income = {
      id: `inc-${Date.now()}`,
      walletId,
      category,
      amount: amountNum,
      date: Date.now(),
      notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Update wallet balance
    wallet.currentBalance += amountNum;
    wallet.updatedAt = Date.now();

    await db.income.add(newIncome);
    await db.wallets.put(wallet);

    // Reset Form
    setAmount('');
    setNotes('');
    setShowAddForm(false);
  };

  const handleDeleteIncome = async (inc: Income) => {
    if (!confirm('Are you sure you want to delete this income record?')) return;

    // Revert wallet balance
    const wallet = await db.wallets.get(inc.walletId);
    if (wallet) {
      wallet.currentBalance = Math.max(wallet.currentBalance - inc.amount, 0);
      wallet.updatedAt = Date.now();
      await db.wallets.put(wallet);
    }

    await db.income.delete(inc.id);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-white">Income</h1>
          <p className="text-body text-gray-400">Manage salary deposits, bonuses, and freelance credits.</p>
        </div>
        <button
          onClick={() => {
            if (wallets.length > 0 && categories.length > 0) {
              setWalletId(wallets[0].walletId);
              setCategory(categories[0].id);
              setShowAddForm(true);
            } else {
              alert('Please create a wallet first in Settings.');
            }
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Record Income
        </button>
      </div>

      {/* Filter and Search Panel */}
      <div className="flex gap-4 glass-card p-4 rounded-2xl border-white/5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by category, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-caption text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Form Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleAddIncome} className="w-full max-w-md glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="text-title font-bold text-white mb-4">Record Income Credit</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Deposit Wallet</label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                >
                  {wallets.map(w => (
                    <option key={w.walletId} value={w.walletId} className="bg-black text-white">
                      {w.walletName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Source Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id} className="bg-black text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Amount Credit</label>
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
              <label className="text-micro text-gray-400 font-semibold block mb-1">Description / Notes</label>
              <textarea
                placeholder="Salary for August, design milestone payout..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none h-20"
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
                Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Income List */}
      <div className="space-y-4">
        {filteredIncome.length === 0 ? (
          <div className="glass-card p-12 text-center text-gray-400 rounded-2xl">
            No income entries recorded.
          </div>
        ) : (
          filteredIncome.map((inc) => {
            const cat = categories.find(c => c.id === inc.category);
            const wal = wallets.find(w => w.walletId === inc.walletId);
            return (
              <div
                key={inc.id}
                className="glass-card p-5 rounded-2xl border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 font-bold"
                    style={{ backgroundColor: cat?.color || '#10b981' }}
                  >
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-title font-bold text-white leading-tight">
                      {cat?.name || 'Income Payout'}
                    </p>
                    <p className="text-caption text-gray-400 mt-1 max-w-sm truncate">
                      {inc.notes || 'No description provided'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-0 border-white/5 pt-3 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-title font-black text-emerald-400">
                      +{user?.currency === 'INR' ? '₹' : '$'}{inc.amount.toLocaleString()}
                    </p>
                    <p className="text-micro text-gray-500 mt-0.5">
                      {new Date(inc.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="hidden sm:inline-block text-micro text-gray-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md h-fit">
                      {wal?.walletName || 'Active Account'}
                    </span>
                    <button
                      onClick={() => handleDeleteIncome(inc)}
                      className="p-2.5 rounded-xl bg-red-950/20 border border-red-900/20 text-red-400 hover:bg-red-950/40 cursor-pointer active:scale-95 transition-all"
                      aria-label="Delete income"
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
