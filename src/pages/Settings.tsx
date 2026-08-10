import React, { useState } from 'react';
import { db } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Download, Upload, Settings as ConfigIcon } from 'lucide-react';
import { exportLocalDatabase } from '../storage/mergeEngine';

export const Settings: React.FC = () => {
  const { user, logout, requestAccountDeletion } = useAuth();

  // Preferences states
  const [currency, setCurrency] = useState(user?.currency || 'INR');
  const [salaryDate, setSalaryDate] = useState(user?.salaryDate?.toString() || '1');
  const [theme, setTheme] = useState(user?.theme || 'dark');

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
  </div>
  );
};
