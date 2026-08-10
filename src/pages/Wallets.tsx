import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'react-router-dom';
import { db, type Wallet } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Plus, Wallet as WalletIcon, Edit2, Trash2, ShieldCheck, CreditCard, Landmark, Coins } from 'lucide-react';

const WALLET_TYPE_ICONS = {
  Cash: Coins,
  Bank: Landmark,
  'Credit Card': CreditCard,
  UPI: ShieldCheck,
};

export const Wallets: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Wallet states
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletName, setWalletName] = useState('');
  const [walletType, setWalletType] = useState<'Cash' | 'Bank' | 'Credit Card' | 'UPI'>('Bank');
  const [openingBalance, setOpeningBalance] = useState('');
  const [bankName, setBankName] = useState('');
  const [walletColor, setWalletColor] = useState('#007aff');

  // Preferences (currency context)
  const currency = user?.currency || 'INR';

  // Queries
  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];

  // Auto-open wallet form if requested via route state transition (from onboarding redirects)
  useEffect(() => {
    if (location.state?.openWalletForm) {
      setShowWalletForm(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletName || !openingBalance) return;
    const balanceNum = parseFloat(openingBalance);
    if (isNaN(balanceNum)) return;

    if (editingWalletId) {
      const existing = wallets.find(w => w.walletId === editingWalletId);
      if (!existing) return;

      const delta = balanceNum - existing.openingBalance;
      const updatedWallet: Wallet = {
        ...existing,
        walletName,
        type: walletType,
        openingBalance: balanceNum,
        currentBalance: existing.currentBalance + delta,
        bankName: walletType === 'Bank' ? bankName : undefined,
        color: walletColor,
        updatedAt: Date.now()
      };

      await db.wallets.put(updatedWallet);
      setEditingWalletId(null);
    } else {
      const newWallet: Wallet = {
        walletId: `wal-${Date.now()}`,
        walletName,
        type: walletType,
        openingBalance: balanceNum,
        currentBalance: balanceNum,
        currency: currency,
        bankName: walletType === 'Bank' ? bankName : undefined,
        color: walletColor,
        icon: 'Wallet',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.wallets.add(newWallet);
    }

    // Reset Form
    setWalletName('');
    setOpeningBalance('');
    setBankName('');
    setEditingWalletId(null);
    setShowWalletForm(false);
  };

  const handleEditWalletClick = (w: Wallet) => {
    setEditingWalletId(w.walletId);
    setWalletName(w.walletName);
    setWalletType(w.type);
    setOpeningBalance(w.openingBalance.toString());
    setBankName(w.bankName || '');
    setWalletColor(w.color || '#007aff');
    setShowWalletForm(true);
  };

  const handleDeleteWallet = async (walletId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the wallet "${name}"? This will remove the ledger and clear its reference on associated transactions.`)) {
      return;
    }

    try {
      await db.wallets.delete(walletId);
      
      // Clear references in expenses
      const expensesList = await db.expenses.where('walletId').equals(walletId).toArray();
      for (const exp of expensesList) {
        exp.walletId = '';
        await db.expenses.put(exp);
      }

      // Clear references in income
      const incomeList = await db.income.where('walletId').equals(walletId).toArray();
      for (const inc of incomeList) {
        inc.walletId = '';
        await db.income.put(inc);
      }
    } catch (err) {
      console.error('Failed to delete wallet:', err);
      alert('Failed to delete wallet.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-white flex items-center gap-3">
            <WalletIcon className="w-8 h-8 text-blue-500" />
            Ledger Wallets
          </h1>
          <p className="text-body text-gray-400">Manage savings accounts, bank ledgers, credit cards, and UPI apps.</p>
        </div>
        <button
          onClick={() => {
            setEditingWalletId(null);
            setWalletName('');
            setWalletType('Bank');
            setOpeningBalance('');
            setBankName('');
            setWalletColor('#007aff');
            setShowWalletForm(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          Create Wallet
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wallets.length === 0 ? (
          <div className="col-span-full py-16 text-center glass-panel rounded-3xl border-white/5 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-400">
              <WalletIcon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-title font-bold text-white">No Wallets Configured</h3>
              <p className="text-body text-gray-400 max-w-sm mx-auto">Create a wallet account above to start tracking transaction ledgers and balances.</p>
            </div>
          </div>
        ) : (
          wallets.map(w => {
            const TypeIcon = WALLET_TYPE_ICONS[w.type] || WalletIcon;
            return (
              <div
                key={w.walletId}
                className="relative overflow-hidden glass-card p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent hover:from-white/10 transition-all flex flex-col justify-between h-48 group shadow-lg"
              >
                {/* Visual Background Accent Glow */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] opacity-20 pointer-events-none group-hover:opacity-35 transition-opacity"
                  style={{ backgroundColor: w.color || '#007aff' }}
                />

                {/* Top Section */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white border border-white/10 shadow-md"
                      style={{ backgroundColor: w.color || '#333' }}
                    >
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-caption font-black text-white leading-tight">{w.walletName}</h3>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {w.type} {w.bankName ? `• ${w.bankName}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions overlay */}
                  <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1 border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditWalletClick(w)}
                      className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400 cursor-pointer active:scale-90 transition-all"
                      title="Edit Wallet"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteWallet(w.walletId, w.walletName)}
                      className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-500 cursor-pointer active:scale-90 transition-all"
                      title="Delete Wallet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Bottom Balance Section */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Current Balance</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[16px] font-bold text-gray-400">{currency === 'INR' ? '₹' : '$'}</span>
                    <span className="text-3xl font-black text-white leading-none">
                      {w.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    Opening: {currency === 'INR' ? '₹' : '$'}{w.openingBalance.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Wallet dialog modal form */}
      {showWalletForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleAddWallet} className="w-full max-w-sm bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 rounded-3xl space-y-4 text-left shadow-2xl">
            <h3 className="text-title font-bold text-slate-900 dark:text-white mb-4">
              {editingWalletId ? 'Edit Ledger Wallet' : 'Create Ledger Wallet'}
            </h3>
            
            <div>
              <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Wallet Name</label>
              <input
                type="text"
                placeholder="HDFC Savings, Cash Wallet..."
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Wallet Type</label>
                <select
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value as any)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="Bank" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">Bank Account</option>
                  <option value="Cash" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">Cash Wallet</option>
                  <option value="Credit Card" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">Credit Card</option>
                  <option value="UPI" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">UPI Wallet</option>
                </select>
              </div>

              <div>
                <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Opening Balance</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
                  required
                />
              </div>
            </div>

            {walletType === 'Bank' && (
              <div>
                <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, ICICI..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Card Theme Color</label>
                <input
                  type="color"
                  value={walletColor}
                  onChange={(e) => setWalletColor(e.target.value)}
                  className="w-full bg-transparent border-0 h-10 p-0 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWalletForm(false);
                  setEditingWalletId(null);
                }}
                className="flex-1 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-700 dark:text-gray-300 font-semibold text-caption cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption cursor-pointer"
              >
                {editingWalletId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
