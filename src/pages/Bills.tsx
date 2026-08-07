import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Bill, type Expense } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import { Plus, Trash2, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

export const Bills: React.FC = () => {
  const { user } = useAuth();
  
  // States
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [walletId, setWalletId] = useState('');
  const [repeat, setRepeat] = useState<'none' | 'monthly' | 'yearly'>('monthly');

  // Queries
  const wallets = useLiveQuery(() => db.wallets.where('status').equals('active').toArray()) || [];
  const bills = useLiveQuery(() => db.bills.orderBy('dueDate').toArray()) || [];

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !dueDate) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const newBill: Bill = {
      id: `bill-${Date.now()}`,
      title,
      amount: amountNum,
      dueDate: new Date(dueDate).getTime(),
      paid: 0,
      wallet: walletId,
      repeat,
      reminder: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.bills.add(newBill);

    // Reset Form
    setTitle('');
    setAmount('');
    setDueDate('');
    setShowAddForm(false);
  };

  const handleMarkPaid = async (bill: Bill, selectWalletId: string) => {
    const targetWalletId = selectWalletId || bill.wallet || (wallets.length > 0 ? wallets[0].walletId : null);
    if (!targetWalletId) {
      alert('Please select or configure a wallet to pay this bill.');
      return;
    }

    const wallet = wallets.find(w => w.walletId === targetWalletId);
    if (!wallet) return;

    // Deduct wallet balance
    wallet.currentBalance -= bill.amount;
    wallet.updatedAt = Date.now();
    await db.wallets.put(wallet);

    // Create corresponding Expense entry
    const newExpense: Expense = {
      id: `exp-bill-${Date.now()}`,
      walletId: targetWalletId,
      categoryId: 'cat-utilities', // Default Category for bills
      amount: bill.amount,
      currency: wallet.currency || 'INR',
      paymentMethod: wallet.type === 'UPI' ? 'UPI' : 'Cash',
      merchantName: bill.title,
      note: 'Paid utility/EMI bill scheduler',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: 0,
      syncStatus: 'pending',
      tags: ['bill-payment'],
      createdBy: user?.id || 'local-user',
      date: Date.now(),
    };
    await db.expenses.add(newExpense);

    // Update Bill state
    bill.paid = 1;
    bill.updatedAt = Date.now();
    await db.bills.put(bill);
  };

  const handlePostpone = async (bill: Bill) => {
    // Postpone due date by 7 days
    bill.dueDate += 7 * 24 * 60 * 60 * 1000;
    bill.updatedAt = Date.now();
    await db.bills.put(bill);
  };

  const handleDeleteBill = async (id: string) => {
    if (!confirm('Are you sure you want to stop tracking this bill schedule?')) return;
    await db.bills.delete(id);
  };

  const unpaidBills = bills.filter(b => b.paid === 0);
  const paidBills = bills.filter(b => b.paid === 1);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-white">Bills & EMIs</h1>
          <p className="text-body text-gray-400">Schedule utility dues and recurring credit bills.</p>
        </div>
        <button
          onClick={() => {
            if (wallets.length > 0) setWalletId(wallets[0].walletId);
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Bill
        </button>
      </div>

      {/* Form overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleCreateBill} className="w-full max-w-sm glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="text-title font-bold text-white mb-4">Add Bill Reminder</h3>
            
            <div>
              <label className="text-micro text-gray-400 font-semibold block mb-1">Bill Title</label>
              <input
                type="text"
                placeholder="Electricity Bill, Home EMI, Car Loan..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Amount Due</label>
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
                <label className="text-micro text-gray-400 font-semibold block mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-micro text-gray-400 font-semibold block mb-1">Wallet Link</label>
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
                <label className="text-micro text-gray-400 font-semibold block mb-1">Repeat Cycle</label>
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-caption text-white focus:outline-none"
                >
                  <option value="none" className="bg-black text-white">One Time</option>
                  <option value="monthly" className="bg-black text-white">Monthly</option>
                  <option value="yearly" className="bg-black text-white">Yearly</option>
                </select>
              </div>
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

      {/* Bill Lists: Unpaid First */}
      <div className="space-y-6">
        <div>
          <h2 className="text-title font-bold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Upcoming Dues ({unpaidBills.length})
          </h2>
          
          <div className="space-y-4">
            {unpaidBills.length === 0 ? (
              <div className="glass-card p-6 text-center text-gray-400 rounded-2xl">
                No pending bills. Excellent!
              </div>
            ) : (
              unpaidBills.map((bill) => {
                const timeDiff = bill.dueDate - Date.now();
                const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                const linkedWallet = wallets.find(w => w.walletId === bill.wallet);

                return (
                  <div
                    key={bill.id}
                    className="glass-card p-5 rounded-2xl border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-amber-400">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-title font-bold text-white leading-tight">{bill.title}</p>
                        <p className="text-micro text-gray-500 mt-1">
                          Source wallet: {linkedWallet?.walletName || 'Any active account'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-0 border-white/5 pt-3 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="text-title font-black text-white">
                          {user?.currency === 'INR' ? '₹' : '$'}{bill.amount.toLocaleString()}
                        </p>
                        <p className="text-micro text-gray-500 mt-0.5">
                          Due: {new Date(bill.dueDate).toLocaleDateString()} ({daysLeft <= 0 ? 'Overdue' : `${daysLeft}d left`})
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMarkPaid(bill, bill.wallet || '')}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-micro cursor-pointer active:scale-95 transition-all"
                        >
                          Pay Now
                        </button>
                        <button
                          onClick={() => handlePostpone(bill)}
                          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-white font-semibold text-micro cursor-pointer active:scale-95 transition-all"
                        >
                          Postpone
                        </button>
                        <button
                          onClick={() => handleDeleteBill(bill.id)}
                          className="p-2.5 rounded-xl bg-red-950/20 border border-red-900/20 text-red-400 hover:bg-red-950/40 cursor-pointer active:scale-95 transition-all"
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

        {/* Paid Bills Section */}
        {paidBills.length > 0 && (
          <div className="pt-6 border-t border-white/5">
            <h2 className="text-title font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Settled Bills History
            </h2>
            
            <div className="space-y-3 opacity-60">
              {paidBills.map((bill) => (
                <div
                  key={bill.id}
                  className="glass-card p-4 rounded-xl border-white/5 flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span className="text-caption font-bold text-white">{bill.title}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-caption font-bold text-emerald-400 block">
                      {user?.currency === 'INR' ? '₹' : '$'}{bill.amount.toLocaleString()}
                    </span>
                    <span className="text-micro text-gray-500">Paid and logged as transaction</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
