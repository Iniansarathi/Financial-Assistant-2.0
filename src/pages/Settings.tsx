import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'react-router-dom';
import { db, type Wallet } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Plus, Download, Upload, Wallet as WalletIcon, Settings as ConfigIcon } from 'lucide-react';
import { exportLocalDatabase } from '../storage/mergeEngine';

export const Settings: React.FC = () => {
  const { user, logout, requestAccountDeletion } = useAuth();
  const location = useLocation();

  // Auto-open wallet form if requested via route state transition
  useEffect(() => {
    if (location.state?.openWalletForm) {
      setShowWalletForm(true);
      // Clean location state in history so it doesn't pop up on page refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);
  
  // Wallet states
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletName, setWalletName] = useState('');
  const [walletType, setWalletType] = useState<'Cash' | 'Bank' | 'Credit Card' | 'UPI'>('Bank');
  const [openingBalance, setOpeningBalance] = useState('');
  const [bankName, setBankName] = useState('');
  const [walletColor, setWalletColor] = useState('#007aff');

  // Preferences states
  const [currency, setCurrency] = useState(user?.currency || 'INR');
  const [salaryDate, setSalaryDate] = useState(user?.salaryDate?.toString() || '1');
  const [theme, setTheme] = useState(user?.theme || 'dark');

  // Queries
  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletName || !openingBalance) return;
    const balanceNum = parseFloat(openingBalance);
    if (isNaN(balanceNum)) return;

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

    // Reset
    setWalletName('');
    setOpeningBalance('');
    setBankName('');
    setShowWalletForm(false);
  };

  const handleUpdatePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const updated = {
      ...user,
      currency,
      salaryDate: parseInt(salaryDate) || 1,
      theme,
      updatedAt: Date.now(),
    };
    await db.users.put(updated);
    
    // Apply theme changes to DOM
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    
    alert('User preferences saved locally.');
  };

  const handleExportData = async () => {
    const fullDb = await exportLocalDatabase();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullDb, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "MoneyPilotBackup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target?.result as string);
        if (!parsedData.wallets || !parsedData.expenses) {
          alert('Invalid schema: Missing critical tables.');
          return;
        }

        // Bulk load tables
        if (parsedData.wallets) await db.wallets.bulkPut(parsedData.wallets);
        if (parsedData.expenses) await db.expenses.bulkPut(parsedData.expenses);
        if (parsedData.income) await db.income.bulkPut(parsedData.income);
        if (parsedData.budgets) await db.budgets.bulkPut(parsedData.budgets);
        if (parsedData.goals) await db.goals.bulkPut(parsedData.goals);
        if (parsedData.subscriptions) await db.subscriptions.bulkPut(parsedData.subscriptions);
        if (parsedData.bills) await db.bills.bulkPut(parsedData.bills);

        alert('Backup data imported successfully into IndexedDB.');
        window.location.reload();
      } catch (err) {
        alert('Failed to parse database file: ' + err);
      }
    };
    fileReader.readAsText(file);
  };

  const handleDeleteAccount = async () => {
    if (!confirm('CAUTION: This will delete ALL financial records, empty the Google Drive database file, and log you out. Are you sure?')) {
      return;
    }

    // Clear local Dexie tables
    await db.wallets.clear();
    await db.expenses.clear();
    await db.income.clear();
    await db.budgets.clear();
    await db.goals.clear();
    await db.subscriptions.clear();
    await db.bills.clear();
    await db.users.clear();

    alert('Local databases deleted. Revoking session...');
    await logout();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-left">
      <div>
        <h1 className="text-heading font-extrabold tracking-tight text-slate-900 dark:text-white">System Settings</h1>
        <p className="text-body text-slate-500 dark:text-gray-400">Configure wallets, baseline details, and local/cloud backups.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Preference Panel Column */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Main User Preferences form */}
          <form onSubmit={handleUpdatePreferences} className="glass-card p-6 rounded-2xl border-slate-200 dark:border-white/5 space-y-4">
            <h3 className="text-title font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ConfigIcon className="w-5 h-5 text-blue-400" />
              General Preferences
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Standard Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="INR" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">INR (₹)</option>
                  <option value="USD" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">USD ($)</option>
                  <option value="EUR" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">EUR (€)</option>
                  <option value="GBP" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">GBP (£)</option>
                </select>
              </div>
              <div>
                <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Salary Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={salaryDate}
                  onChange={(e) => setSalaryDate(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Visual Theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="dark" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">Dark Mode (Premium)</option>
                  <option value="light" className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">Light Mode (Classic)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption active:scale-95 transition-all shadow-md cursor-pointer"
            >
              Save Configuration
            </button>
          </form>

          {/* Wallets Manager list */}
          <div className="glass-card p-6 rounded-2xl border-slate-200 dark:border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-title font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <WalletIcon className="w-5 h-5 text-blue-400" />
                Ledger Wallets
              </h3>
              <button
                onClick={() => setShowWalletForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 text-micro font-semibold text-slate-700 dark:text-gray-300 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <div className="space-y-3">
              {wallets.map(w => (
                <div key={w.walletId} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: w.color || '#333' }}
                    >
                      <WalletIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-caption font-bold text-slate-900 dark:text-white leading-tight">{w.walletName}</p>
                      <span className="text-[10px] text-gray-500 uppercase">{w.type} {w.bankName ? `• ${w.bankName}` : ''}</span>
                    </div>
                  </div>
                  <span className="text-caption font-bold text-slate-900 dark:text-white">
                    {currency === 'INR' ? '₹' : '$'}{w.currentBalance.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Backups & Actions Column */}
        <div className="glass-card p-6 rounded-2xl border-slate-200 dark:border-white/5 h-fit space-y-6">
          <h3 className="text-title font-bold text-slate-900 dark:text-white">Data Maintenance</h3>
          
          <div className="space-y-3">
            <button
              onClick={handleExportData}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 font-semibold text-caption border border-slate-200 dark:border-white/5 cursor-pointer active:scale-98 transition-all"
            >
              <Download className="w-4 h-4" />
              Export JSON Backup
            </button>
            
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 font-semibold text-caption border border-slate-200 dark:border-white/5 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Import JSON Backup
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-white/5 space-y-3">
            <h4 className="text-caption font-bold text-red-400">Destructive Actions</h4>
            <p className="text-micro text-gray-500 leading-normal">
              Wipes all IndexedDB tables. Financial cloud records will be deleted if you confirm revocation keys.
            </p>
            <button
              onClick={handleDeleteAccount}
              className="w-full py-3 rounded-xl bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/20 font-semibold text-caption cursor-pointer active:scale-98 transition-all"
            >
              Wipe Device & Database (Local)
            </button>
            <button
              onClick={async () => {
                if (window.confirm("Are you sure you want to request complete account deletion? This will permanently wipe your Google Drive database and remove your entry from the database upon admin approval. This action is irreversible once approved.")) {
                  await requestAccountDeletion();
                }
              }}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-caption cursor-pointer active:scale-98 transition-all"
            >
              Request Account Deletion (Purge Cloud)
            </button>
          </div>
        </div>

      </div>

      {/* Wallet dialog modal form */}
      {showWalletForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleAddWallet} className="w-full max-w-sm bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 rounded-3xl space-y-4 text-left shadow-2xl">
            <h3 className="text-title font-bold text-slate-900 dark:text-white mb-4">Create Ledger Wallet</h3>
            
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
                  placeholder="HDFC Bank, ICICI..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
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
                onClick={() => setShowWalletForm(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-700 dark:text-gray-300 font-semibold text-caption cursor-pointer"
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
    </div>
  );
};
