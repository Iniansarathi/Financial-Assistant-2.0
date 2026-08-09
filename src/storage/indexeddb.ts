import Dexie, { type Table } from 'dexie';

// -------------------------------------------------------------
// Interfaces representing database schemas
// -------------------------------------------------------------

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  currency: string;
  country: string;
  salaryDate: number; // Day of month (1-31)
  theme: 'dark' | 'light';
  language: string;
  createdAt: number;
  updatedAt: number;
  lastSync?: number;
  googleDriveFileId?: string;
}

export interface Wallet {
  walletId: string;
  walletName: string;
  type: 'Cash' | 'Bank' | 'Credit Card' | 'UPI';
  openingBalance: number;
  currentBalance: number;
  currency: string;
  bankName?: string;
  color: string;
  icon: string;
  status: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
}

export interface Income {
  id: string;
  walletId: string;
  category: string; // salary, bonus, freelance, investment, gift, refund, other
  amount: number;
  date: number; // timestamp
  notes?: string;
  attachments?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Expense {
  id: string;
  walletId: string;
  merchantId?: string;
  categoryId: string; // category id
  amount: number;
  currency: string;
  paymentMethod: string; // Cash, UPI, Credit Card, etc.
  merchantName: string;
  date: number; // timestamp of transaction
  location?: {
    latitude?: number;
    longitude?: number;
    city?: string;
  };
  receiptImage?: string;
  note?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: number; // 0 = active, 1 = soft deleted
  syncStatus: 'synced' | 'pending' | 'error';
  tags: string[];
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
  icon: string;
  isCustom: number; // 0 = default, 1 = custom
  createdAt: number;
  updatedAt: number;
}

export interface Merchant {
  merchantId: string;
  merchantName: string;
  upiId?: string;
  defaultCategory?: string; // Category ID
  lastUsed: number;
  frequency: number;
  averageSpend: number;
  location?: { latitude: number; longitude: number };
  favorite: number; // 0 = no, 1 = yes
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  renewalDate: number; // timestamp
  cycle: 'weekly' | 'monthly' | 'yearly';
  paymentMethod: string;
  autoRenew: number; // 0 = no, 1 = yes
  notificationDays: number;
  createdAt: number;
  updatedAt: number;
}

export interface Bill {
  id: string;
  title: string;
  amount: number;
  dueDate: number; // timestamp
  paid: number; // 0 = unpaid, 1 = paid
  wallet?: string;
  repeat: 'none' | 'monthly' | 'yearly';
  reminder: number; // 0 = no, 1 = yes
  createdAt: number;
  updatedAt: number;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  deadline: number;
  priority: 'low' | 'medium' | 'high';
  icon: string;
  color: string;
  completed: number; // 0 = active, 1 = completed
  createdAt: number;
  updatedAt: number;
}

export interface Budget {
  id: string;
  category: string; // category id or "all"
  monthlyBudget: number;
  spent: number;
  remaining: number;
  warningPercentage: number; // e.g. 75
  criticalPercentage: number; // e.g. 90
  createdAt: number;
  updatedAt: number;
}

export interface AIInsight {
  id: string;
  type: 'savings' | 'overspending' | 'prediction' | 'goal_progress' | 'budget' | 'subscription' | 'bill' | 'cash_flow' | 'warning' | 'tip';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  description: string;
  action?: string;
  dismissed: number; // 0 = active, 1 = dismissed
  createdAt: number;
}

export interface SyncQueueItem {
  id: string;
  table: string; // e.g. "expenses", "wallets"
  recordId: string;
  action: 'insert' | 'update' | 'delete';
  payload: string; // serialized JSON
  timestamp: number;
  retryCount: number;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface WishlistItem {
  id: string;
  name: string;
  targetPrice: number;
  addedDate: number; // timestamp
  notes?: string;
  status: 'wish' | 'bought' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

// -------------------------------------------------------------
// Dexie Database Class Definition
// -------------------------------------------------------------

class MoneyPilotDatabase extends Dexie {
  users!: Table<UserSession, string>;
  wallets!: Table<Wallet, string>;
  income!: Table<Income, string>;
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;
  merchants!: Table<Merchant, string>;
  subscriptions!: Table<Subscription, string>;
  bills!: Table<Bill, string>;
  goals!: Table<SavingsGoal, string>;
  budgets!: Table<Budget, string>;
  insights!: Table<AIInsight, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  settings!: Table<AppSetting, string>;
  wishlist!: Table<WishlistItem, string>;

  constructor() {
    super('MoneyPilotDB');
    
    this.version(1).stores({
      users: 'id, email, updatedAt',
      wallets: 'walletId, walletName, type, status, updatedAt',
      income: 'id, walletId, category, date, updatedAt',
      expenses: 'id, walletId, categoryId, amount, date, isDeleted, syncStatus, updatedAt',
      categories: 'id, name, type, isCustom, updatedAt',
      merchants: 'merchantId, merchantName, upiId, lastUsed, favorite',
      subscriptions: 'id, name, renewalDate, cycle, updatedAt',
      bills: 'id, title, dueDate, paid, updatedAt',
      goals: 'id, title, deadline, priority, completed, updatedAt',
      budgets: 'id, category, updatedAt',
      insights: 'id, type, severity, dismissed, createdAt',
      syncQueue: 'id, table, recordId, action, timestamp',
      settings: 'key'
    });

    this.version(2).stores({
      users: 'id, email, updatedAt',
      wallets: 'walletId, walletName, type, status, updatedAt',
      income: 'id, walletId, category, date, updatedAt',
      expenses: 'id, walletId, categoryId, amount, date, isDeleted, syncStatus, updatedAt',
      categories: 'id, name, type, isCustom, updatedAt',
      merchants: 'merchantId, merchantName, upiId, lastUsed, favorite',
      subscriptions: 'id, name, renewalDate, cycle, updatedAt',
      bills: 'id, title, dueDate, paid, updatedAt',
      goals: 'id, title, deadline, priority, completed, updatedAt',
      budgets: 'id, category, updatedAt',
      insights: 'id, type, severity, dismissed, createdAt',
      syncQueue: 'id, table, recordId, action, timestamp',
      settings: 'key',
      wishlist: 'id, name, addedDate, status, updatedAt'
    });
  }
}

export const db = new MoneyPilotDatabase();

// -------------------------------------------------------------
// Seeding & Initialization Helpers
// -------------------------------------------------------------

export const DEFAULT_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat-food', name: 'Food', type: 'expense', color: '#ff9500', icon: 'Utensils', isCustom: 0 },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', color: '#34c759', icon: 'ShoppingBag', isCustom: 0 },
  { id: 'cat-transport', name: 'Transport', type: 'expense', color: '#5ac8fa', icon: 'Car', isCustom: 0 },
  { id: 'cat-fuel', name: 'Fuel', type: 'expense', color: '#ffcc00', icon: 'Flame', isCustom: 0 },
  { id: 'cat-shopping', name: 'Shopping', type: 'expense', color: '#ff2d55', icon: 'ShoppingBag', isCustom: 0 },
  { id: 'cat-health', name: 'Health', type: 'expense', color: '#af52de', icon: 'Heart', isCustom: 0 },
  { id: 'cat-rent', name: 'Rent', type: 'expense', color: '#5856d6', icon: 'Home', isCustom: 0 },
  { id: 'cat-utilities', name: 'Utilities', type: 'expense', color: '#007aff', icon: 'Zap', isCustom: 0 },
  { id: 'cat-entertainment', name: 'Entertainment', type: 'expense', color: '#ff5b00', icon: 'Film', isCustom: 0 },
  { id: 'cat-travel', name: 'Travel', type: 'expense', color: '#ff9500', icon: 'Compass', isCustom: 0 },
  { id: 'cat-education', name: 'Education', type: 'expense', color: '#34c759', icon: 'BookOpen', isCustom: 0 },
  { id: 'cat-investment', name: 'Investment', type: 'expense', color: '#af52de', icon: 'TrendingUp', isCustom: 0 },
  { id: 'cat-insurance', name: 'Insurance', type: 'expense', color: '#5856d6', icon: 'Shield', isCustom: 0 },
  { id: 'cat-emi', name: 'EMI', type: 'expense', color: '#ff2d55', icon: 'CreditCard', isCustom: 0 },
  { id: 'cat-tax', name: 'Tax', type: 'expense', color: '#8e8e93', icon: 'Percent', isCustom: 0 },
  { id: 'cat-charity', name: 'Charity', type: 'expense', color: '#4cd964', icon: 'HeartHandshake', isCustom: 0 },
  { id: 'cat-pets', name: 'Pets', type: 'expense', color: '#ff9500', icon: 'PawPrint', isCustom: 0 },
  { id: 'cat-kids', name: 'Kids', type: 'expense', color: '#34c759', icon: 'Smile', isCustom: 0 },
  { id: 'cat-sports', name: 'Sports', type: 'expense', color: '#5ac8fa', icon: 'Dribbble', isCustom: 0 },
  { id: 'cat-dining', name: 'Dining', type: 'expense', color: '#ff2d55', icon: 'Coffee', isCustom: 0 },
  { id: 'cat-coffee', name: 'Coffee', type: 'expense', color: '#a2845e', icon: 'CupSoda', isCustom: 0 },
  { id: 'cat-subscriptions', name: 'Subscriptions', type: 'expense', color: '#5856d6', icon: 'Tv', isCustom: 0 },
  { id: 'cat-electronics', name: 'Electronics', type: 'expense', color: '#007aff', icon: 'Laptop', isCustom: 0 },
  { id: 'cat-miscellaneous', name: 'Miscellaneous', type: 'expense', color: '#8e8e93', icon: 'HelpCircle', isCustom: 0 },
  
  // Income default categories
  { id: 'cat-salary', name: 'Salary', type: 'income', color: '#34c759', icon: 'Briefcase', isCustom: 0 },
  { id: 'cat-bonus', name: 'Bonus', type: 'income', color: '#ffcc00', icon: 'Award', isCustom: 0 },
  { id: 'cat-freelance', name: 'Freelance', type: 'income', color: '#007aff', icon: 'Terminal', isCustom: 0 },
  { id: 'cat-gift', name: 'Gift', type: 'income', color: '#ff2d55', icon: 'Gift', isCustom: 0 },
  { id: 'cat-refund', name: 'Refund', type: 'income', color: '#5ac8fa', icon: 'RotateCcw', isCustom: 0 },
  { id: 'cat-investment-inc', name: 'Investment Income', type: 'income', color: '#af52de', icon: 'TrendingUp', isCustom: 0 },
  { id: 'cat-other-inc', name: 'Other Income', type: 'income', color: '#8e8e93', icon: 'CircleDollarSign', isCustom: 0 }
];

export async function seedDatabase() {
  const count = await db.categories.count();
  if (count === 0) {
    const now = Date.now();
    const categoriesToInsert = DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      createdAt: now,
      updatedAt: now
    })) as Category[];
    await db.categories.bulkAdd(categoriesToInsert);
  }
}
