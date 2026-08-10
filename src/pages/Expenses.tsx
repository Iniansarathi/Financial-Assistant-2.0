import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, type Expense } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Trash2, Plus, Search, Tag } from 'lucide-react';

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // States
  const [showAddForm, setShowAddForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Queries
  const wallets = useLiveQuery(() => db.wallets.where('status').equals('active').toArray()) || [];
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray()) || [];
  
  // Fetch expenses, filter out soft-deleted ones (isDeleted === 1)
  const expenses = useLiveQuery(async () => {
    const list = await db.expenses.where('isDeleted').equals(0).reverse().sortBy('date');
    return list;
  }) || [];

  // Filtered List
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = 
      exp.merchantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exp.note || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = filterCategory === 'all' || exp.categoryId === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !walletId || !categoryId || !merchantName) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const wallet = wallets.find(w => w.walletId === walletId);
    if (!wallet) return;

    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      walletId,
      categoryId,
      amount: amountNum,
      currency: wallet.currency || 'INR',
      paymentMethod: wallet.type === 'UPI' ? 'UPI' : 'Cash',
      merchantName,
      note,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: 0,
      syncStatus: 'pending',
      tags,
      createdBy: user?.id || 'local-user',
      date: Date.now(),
    };

    // Update wallet balance
    wallet.currentBalance -= amountNum;
    wallet.updatedAt = Date.now();

    await db.expenses.add(newExpense);
    await db.wallets.put(wallet);

    // Save merchant profile statistics
    const existingMerchant = await db.merchants.get(merchantName);
    if (existingMerchant) {
      existingMerchant.frequency += 1;
      existingMerchant.lastUsed = Date.now();
      existingMerchant.averageSpend = (existingMerchant.averageSpend * (existingMerchant.frequency - 1) + amountNum) / existingMerchant.frequency;
      await db.merchants.put(existingMerchant);
    } else {
      await db.merchants.add({
        merchantId: `mer-${Date.now()}`,
        merchantName,
        defaultCategory: categoryId,
        lastUsed: Date.now(),
        frequency: 1,
        averageSpend: amountNum,
        favorite: 0,
      });
    }

    // Reset Form
    setAmount('');
    setMerchantName('');
    setNote('');
    setTagInput('');
    setShowAddForm(false);
  };

  const handleSoftDelete = async (exp: Expense) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    // Update wallet balance (revert)
    const wallet = await db.wallets.get(exp.walletId);
    if (wallet) {
      wallet.currentBalance += exp.amount;
      wallet.updatedAt = Date.now();
      await db.wallets.put(wallet);
    }

    // Soft delete record
    exp.isDeleted = 1;
    exp.syncStatus = 'pending';
    exp.updatedAt = Date.now();
    await db.expenses.put(exp);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-white">Expenses</h1>
          <p className="text-body text-gray-400">Track and manage your spending habits.</p>
        </div>
        <button
          onClick={() => {
            if (wallets.length > 0) {
              setWalletId(wallets[0].walletId);
              if (categories.length > 0) setCategoryId(categories[0].id);
              setShowAddForm(true);
            } else {
              navigate('/settings', { state: { openWalletForm: true } });
            }
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Filter and Search Panel */}
      <div className="flex flex-col sm:flex-row gap-4 glass-card p-4 rounded-2xl border-white/5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by merchant, note, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-caption text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-caption text-white focus:outline-none focus:border-blue-500 max-w-[200px]"
        >
          <option value="all" className="bg-black text-white">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id} className="bg-black text-white">{c.name}</option>
          ))}
        </select>
      </div>

      {/* Form Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleAddExpense} className="w-full max-w-md glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="text-title font-bold text-white mb-4">Record New Expense</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Wallet</label>
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
                <label className="text-micro text-gray-400 font-semibold block mb-1">Category</label>
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
            </div>

            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Merchant Name</label>
              <input
                type="text"
                placeholder="Amazon, Starbucks, Rent..."
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Amount</label>
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
                <label className="text-micro text-gray-400 font-semibold block mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="office, food"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Note (Optional)</label>
              <textarea
                placeholder="Details..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
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
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses List */}
      <div className="space-y-4">
        {filteredExpenses.length === 0 ? (
          <div className="glass-card p-12 text-center text-gray-400 rounded-2xl">
            No expense records found.
          </div>
        ) : (
          filteredExpenses.map((exp) => {
            const cat = categories.find(c => c.id === exp.categoryId);
            const wal = wallets.find(w => w.walletId === exp.walletId);
            return (
              <div
                key={exp.id}
                className="glass-card p-5 rounded-2xl border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 font-bold"
                    style={{ backgroundColor: cat?.color || '#555' }}
                  >
                    {cat?.name.charAt(0) || 'E'}
                  </div>
                  <div className="text-left">
                    <p className="text-title font-bold text-white leading-tight">{exp.merchantName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-micro bg-white/5 px-2 py-0.5 rounded-md text-gray-400">
                        {cat?.name || 'Uncategorized'}
                      </span>
                      <span className="text-micro text-gray-500 font-medium">
                        {wal?.walletName || 'Unknown Wallet'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-0 border-white/5 pt-3 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-title font-black text-red-400">
                      -{user?.currency === 'INR' ? '₹' : '$'}{exp.amount.toLocaleString()}
                    </p>
                    <p className="text-micro text-gray-500 mt-0.5">
                      {new Date(exp.date || exp.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {exp.tags.map((t) => (
                      <span key={t} className="hidden lg:flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/10">
                        <Tag className="w-2.5 h-2.5" />
                        {t}
                      </span>
                    ))}
                    <button
                      onClick={() => handleSoftDelete(exp)}
                      className="p-2.5 rounded-xl bg-red-950/20 border border-red-900/20 text-red-400 hover:bg-red-950/40 cursor-pointer active:scale-95 transition-all"
                      aria-label="Delete expense"
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
