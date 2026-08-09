import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WishlistItem } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import {
  ShoppingBag,
  Plus,
  Clock,
  Check,
  X,
  Sparkles,
  Heart,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';

export const Wishlist: React.FC = () => {
  const { user } = useAuth();
  const currencySymbol = user?.currency === 'USD' ? '$' : '₹';

  // Live query active/inactive wishlist items
  const activeWishes = useLiveQuery(() =>
    db.wishlist.where('status').equals('wish').reverse().toArray()
  ) || [];
  
  const acquiredWishes = useLiveQuery(() =>
    db.wishlist.where('status').equals('bought').reverse().toArray()
  ) || [];
  
  const avoidedWishes = useLiveQuery(() =>
    db.wishlist.where('status').equals('rejected').reverse().toArray()
  ) || [];

  const wallets = useLiveQuery(() => db.wallets.where('status').equals('active').toArray()) || [];

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [notes, setNotes] = useState('');

  // Purchase/Approval states
  const [purchasingItem, setPurchasingItem] = useState<WishlistItem | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'acquired' | 'avoided'>('active');

  // Submit new wishlist item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(targetPrice);
    if (!name || isNaN(priceNum) || priceNum <= 0) {
      alert('Please fill out a valid name and positive price.');
      return;
    }

    const now = Date.now();
    const newItem: WishlistItem = {
      id: 'wish-' + Math.random().toString(36).substr(2, 9),
      name,
      targetPrice: priceNum,
      addedDate: now,
      notes: notes || undefined,
      status: 'wish',
      createdAt: now,
      updatedAt: now
    };

    await db.wishlist.put(newItem);
    setName('');
    setTargetPrice('');
    setNotes('');
    setShowAddForm(false);
  };

  // Reject / Avoid impulse buy
  const handleRejectItem = async (id: string, name: string, price: number) => {
    if (window.confirm(`Impulse buy alert! Are you sure you want to discard "${name}"? This logs it as a successful self-control milestone!`)) {
      await db.wishlist.update(id, {
        status: 'rejected',
        updatedAt: Date.now()
      });
      alert(`Awesome! You successfully avoided an impulse buy and saved ${currencySymbol}${price.toLocaleString()}!`);
    }
  };

  // Delete wishlist history record permanently
  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Delete this item from history?')) {
      await db.wishlist.delete(id);
    }
  };

  // Start checkout/purchase sequence
  const startPurchase = (item: WishlistItem) => {
    setPurchasingItem(item);
    if (wallets.length > 0) {
      setSelectedWalletId(wallets[0].walletId);
    }
  };

  // Complete purchase & convert to expense
  const handleCompletePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchasingItem || !selectedWalletId) return;

    const wallet = wallets.find(w => w.walletId === selectedWalletId);
    if (!wallet) return;

    if (wallet.currentBalance < purchasingItem.targetPrice) {
      if (!window.confirm('Warning: Selected wallet has insufficient balance. Do you want to proceed anyway?')) {
        return;
      }
    }

    const now = Date.now();

    // 1. Create real expense transaction
    const newExpense = {
      id: 'exp-' + Math.random().toString(36).substr(2, 9),
      walletId: selectedWalletId,
      categoryId: 'cat-shopping', // default to Shopping category
      amount: purchasingItem.targetPrice,
      currency: user?.currency || 'INR',
      paymentMethod: wallet.type,
      merchantName: `Wishlist: ${purchasingItem.name}`,
      date: now,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: user?.id || 'local-user',
      syncStatus: 'pending' as const,
      tags: ['wishlist-buy']
    };

    await db.expenses.put(newExpense);

    // 2. Deduct from wallet balance
    await db.wallets.update(selectedWalletId, {
      currentBalance: wallet.currentBalance - purchasingItem.targetPrice,
      updatedAt: now
    });

    // 3. Mark wishlist item as bought
    await db.wishlist.update(purchasingItem.id, {
      status: 'bought',
      updatedAt: now
    });

    alert(`Responsibly Acquired! "${purchasingItem.name}" has been registered as an expense.`);
    setPurchasingItem(null);
  };

  // Calculate cooling stats (30-day period)
  const getCoolingDetails = (addedDate: number) => {
    const totalDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    const elapsed = Date.now() - addedDate;
    const remaining = Math.max(0, totalDuration - elapsed);
    const remainingDays = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    const percentComplete = Math.min(100, Math.round((elapsed / totalDuration) * 100));
    
    return {
      remainingDays,
      percentComplete,
      isComplete: remaining === 0
    };
  };

  // Calculate total saved amount (from rejected items)
  const totalSaved = avoidedWishes.reduce((sum, item) => sum + item.targetPrice, 0);

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-blue-500" />
            Impulse-Buy Guard
          </h1>
          <p className="text-body text-slate-500 dark:text-gray-400">
            A 30-day cooling-off reflection period to filter impulse shopping and build financial self-discipline.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption cursor-pointer active:scale-95 transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Wish Item
        </button>
      </div>

      {/* KPI Highlight Card */}
      {avoidedWishes.length > 0 && (
        <div className="glass-card p-6 rounded-3xl border-slate-200 dark:border-white/5 bg-gradient-to-r from-emerald-500/10 to-transparent flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="text-caption font-bold text-slate-500 dark:text-gray-400">Impulse Money Saved</h4>
            <p className="text-title font-extrabold text-emerald-500 leading-tight">
              {currencySymbol}{totalSaved.toLocaleString()}
            </p>
            <span className="text-[10px] text-gray-500 font-medium">Saved by discarding items after reflection</span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-caption font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Active Wishes ({activeWishes.length})
        </button>
        <button
          onClick={() => setActiveTab('acquired')}
          className={`px-4 py-2 text-caption font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'acquired'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Acquired ({acquiredWishes.length})
        </button>
        <button
          onClick={() => setActiveTab('avoided')}
          className={`px-4 py-2 text-caption font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'avoided'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Avoided Impulse ({avoidedWishes.length})
        </button>
      </div>

      {/* List content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Wishes Tab */}
        {activeTab === 'active' && (
          activeWishes.length === 0 ? (
            <div className="col-span-full glass-card p-12 text-center text-gray-500 rounded-3xl">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60 animate-bounce" />
              <p className="text-caption font-medium">No active wishes under reflection.</p>
              <p className="text-[10px] text-gray-400 mt-1">Add items you intend to buy to start their cooling period.</p>
            </div>
          ) : (
            activeWishes.map((item) => {
              const cooling = getCoolingDetails(item.addedDate);
              return (
                <div
                  key={item.id}
                  className="glass-card p-6 rounded-3xl border-slate-200 dark:border-white/5 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-title font-bold text-slate-900 dark:text-white leading-tight">{item.name}</h3>
                        <span className="text-[10px] text-gray-500 font-medium">
                          Added {new Date(item.addedDate).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-title font-extrabold text-blue-500">
                        {currencySymbol}{item.targetPrice.toLocaleString()}
                      </p>
                    </div>
                    {item.notes && (
                      <p className="text-caption text-slate-500 dark:text-gray-400 italic bg-white/2 p-3 rounded-xl">
                        "{item.notes}"
                      </p>
                    )}
                  </div>

                  {/* Reflection Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-micro font-bold uppercase tracking-wider">
                      <span className="text-slate-500 dark:text-gray-400">Cooling Period Progress</span>
                      <span className={cooling.isComplete ? 'text-emerald-500' : 'text-amber-500'}>
                        {cooling.isComplete ? 'Complete' : `${cooling.remainingDays} days left`}
                      </span>
                    </div>

                    {/* Progress Bar with Glow */}
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cooling.isComplete 
                            ? 'bg-gradient-to-r from-emerald-500 to-green-400 progress-glow-bar' 
                            : 'bg-gradient-to-r from-blue-500 to-indigo-400'
                        }`}
                        style={{ width: `${cooling.percentComplete}%` }}
                      />
                    </div>

                    <p className="text-micro text-gray-500 leading-normal flex items-start gap-1">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                      {cooling.isComplete 
                        ? "Cooling period complete. Approve only if you are confident this remains an important purchase."
                        : "Reflection prompt: Do I absolutely need this? Will purchasing this align with my current goals?"
                      }
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRejectItem(item.id, item.name, item.targetPrice)}
                      className="flex-1 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 font-bold text-caption cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" /> Discard (Saved)
                    </button>
                    {cooling.isComplete ? (
                      <button
                        onClick={() => startPurchase(item)}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-caption cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                      >
                        <Check className="w-4 h-4" /> Buy Now
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-gray-400 border border-slate-200 dark:border-white/5 font-bold text-caption text-center cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <Clock className="w-4 h-4" /> Refined ({cooling.remainingDays}d)
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}

        {/* Acquired Wishes Tab */}
        {activeTab === 'acquired' && (
          acquiredWishes.length === 0 ? (
            <div className="col-span-full glass-card p-12 text-center text-gray-500 rounded-3xl">
              <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-60 animate-pulse" />
              <p className="text-caption font-medium">No wishes acquired yet.</p>
              <p className="text-[10px] text-gray-400 mt-1">Items approved after the 30-day window appear here.</p>
            </div>
          ) : (
            acquiredWishes.map((item) => (
              <div
                key={item.id}
                className="glass-card p-5 rounded-3xl border-slate-200 dark:border-white/5 flex items-center justify-between gap-4"
              >
                <div>
                  <h4 className="text-caption font-bold text-slate-900 dark:text-white">{item.name}</h4>
                  <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider mt-0.5">
                    Acquired responsibly
                  </p>
                  <span className="text-[9px] text-gray-500">
                    Bought {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-caption font-extrabold text-emerald-500">
                    {currencySymbol}{item.targetPrice.toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="block text-micro text-gray-500 hover:text-red-400 cursor-pointer transition-colors text-right w-full"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {/* Avoided Wishes Tab */}
        {activeTab === 'avoided' && (
          avoidedWishes.length === 0 ? (
            <div className="col-span-full glass-card p-12 text-center text-gray-500 rounded-3xl">
              <Heart className="w-12 h-12 text-red-500 mx-auto mb-3 opacity-60" />
              <p className="text-caption font-medium">No impulse buys avoided yet.</p>
              <p className="text-[10px] text-gray-400 mt-1">Canceling wishes keeps cash and logs milestones here.</p>
            </div>
          ) : (
            avoidedWishes.map((item) => (
              <div
                key={item.id}
                className="glass-card p-5 rounded-3xl border-slate-200 dark:border-white/5 flex items-center justify-between gap-4"
              >
                <div>
                  <h4 className="text-caption font-bold text-slate-900 dark:text-white">{item.name}</h4>
                  <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Avoided impulse purchase
                  </p>
                  <span className="text-[9px] text-gray-500">
                    Discarded {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-caption font-extrabold text-red-400">
                    +{currencySymbol}{item.targetPrice.toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="block text-micro text-gray-500 hover:text-red-400 cursor-pointer transition-colors text-right w-full"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Add Wish modal dialog form */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleAddItem} className="w-full max-w-md bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 rounded-3xl space-y-4 text-left shadow-2xl">
            <div>
              <h3 className="text-title font-extrabold text-slate-900 dark:text-white">Track Shopping Wish</h3>
              <p className="text-micro text-gray-500 mt-0.5">Define your wish. The app will hold it in a 30-day reflection period.</p>
            </div>

            <div>
              <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Wish Name / Item</label>
              <input
                type="text"
                placeholder="MacBook Pro, Designer Shoes..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Target Price ({currencySymbol})</label>
              <input
                type="number"
                placeholder="0.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Notes / Why do you want this?</label>
              <textarea
                placeholder="Why do I need this? Is it a true obligation or dynamic reward?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-24 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-700 dark:text-gray-300 font-semibold text-caption cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption cursor-pointer"
              >
                Lock Cooling Timer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Complete checkout purchase modal */}
      {purchasingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleCompletePurchase} className="w-full max-w-sm bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 rounded-3xl space-y-4 text-left shadow-2xl">
            <div>
              <h3 className="text-title font-extrabold text-slate-900 dark:text-white">Responsible Checkout</h3>
              <p className="text-micro text-gray-500 mt-0.5">Select the funding ledger to pay for this item.</p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-caption space-y-1">
              <p className="text-gray-400 font-medium">Purchasing: <span className="font-bold text-slate-900 dark:text-white">{purchasingItem.name}</span></p>
              <p className="text-gray-400 font-medium">Price: <span className="font-bold text-blue-500">{currencySymbol}{purchasingItem.targetPrice.toLocaleString()}</span></p>
            </div>

            <div>
              <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Pay From Wallet</label>
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none"
              >
                {wallets.map(w => (
                  <option key={w.walletId} value={w.walletId} className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">
                    {w.walletName} ({currencySymbol}{w.currentBalance.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPurchasingItem(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-700 dark:text-gray-300 font-semibold text-caption cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-caption cursor-pointer"
              >
                Confirm Purchase
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
