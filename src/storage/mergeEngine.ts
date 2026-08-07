import { db } from './indexeddb';
import type { DriveFileContent } from '../services/drive/driveService';

/**
 * Merges a single table's records between local IndexedDB and cloud array.
 * Newest updatedAt wins. Updates local DB and returns the merged list for the cloud.
 */
async function mergeTableRecords<T extends { updatedAt?: number; createdAt?: number }>(
  table: any,
  keyField: keyof T,
  cloudRecords: T[]
): Promise<T[]> {
  const localRecords = (await table.toArray()) as T[];
  const localMap = new Map<string | number, T>();
  
  localRecords.forEach((rec) => {
    const key = rec[keyField] as unknown as string | number;
    localMap.set(key, rec);
  });

  const cloudMap = new Map<string | number, T>();
  cloudRecords.forEach((rec) => {
    const key = rec[keyField] as unknown as string | number;
    cloudMap.set(key, rec);
  });

  const finalRecords: T[] = [];
  const toWriteLocally: T[] = [];

  // 1. Process all cloud records
  for (const cloudRec of cloudRecords) {
    const key = cloudRec[keyField] as unknown as string | number;
    const localRec = localMap.get(key);

    if (!localRec) {
      // Cloud has it, local doesn't -> write locally
      toWriteLocally.push(cloudRec);
      finalRecords.push(cloudRec);
    } else {
      // Both have it, compare timestamps
      const cloudTime = cloudRec.updatedAt || cloudRec.createdAt || 0;
      const localTime = localRec.updatedAt || localRec.createdAt || 0;

      if (cloudTime >= localTime) {
        // Cloud is newer or equal -> write cloud version locally
        toWriteLocally.push(cloudRec);
        finalRecords.push(cloudRec);
      } else {
        // Local is newer -> keep local, will upload
        finalRecords.push(localRec);
      }
    }
  }

  // 2. Process local records that are not in cloud map
  for (const localRec of localRecords) {
    const key = localRec[keyField] as unknown as string | number;
    if (!cloudMap.has(key)) {
      // Local has it, cloud doesn't -> keep local, will upload
      finalRecords.push(localRec);
    }
  }

  // 3. Perform bulk operations on local table
  if (toWriteLocally.length > 0) {
    await table.bulkPut(toWriteLocally);
  }

  return finalRecords;
}

/**
 * Merges setting key-values which use "key" as keyField.
 */
async function mergeSettings(cloudSettings: any[]): Promise<any[]> {
  const localSettings = await db.settings.toArray();
  const localMap = new Map<string, string>();
  localSettings.forEach(s => localMap.set(s.key, s.value));

  const cloudMap = new Map<string, string>();
  cloudSettings.forEach(s => cloudMap.set(s.key, s.value));

  const finalSettings: any[] = [];
  const toWriteLocally: any[] = [];

  // Cloud items
  for (const cloudItem of cloudSettings) {
    const localVal = localMap.get(cloudItem.key);
    if (localVal === undefined || localVal !== cloudItem.value) {
      // We will prefer the cloud settings for simplicity, or local if newer (settings don't have timestamps by default, so cloud wins)
      toWriteLocally.push(cloudItem);
    }
    finalSettings.push(cloudItem);
  }

  // Local items not in cloud
  for (const localItem of localSettings) {
    if (!cloudMap.has(localItem.key)) {
      finalSettings.push(localItem);
    }
  }

  if (toWriteLocally.length > 0) {
    await db.settings.bulkPut(toWriteLocally);
  }

  return finalSettings;
}

/**
 * Executes a full bi-directional synchronization merge between IndexedDB and Google Drive structure.
 */
export async function mergeCloudDatabase(cloudData: Partial<DriveFileContent>): Promise<DriveFileContent> {
  const wallets = await mergeTableRecords(db.wallets, 'walletId', cloudData.wallets || []);
  const income = await mergeTableRecords(db.income, 'id', cloudData.income || []);
  const expenses = await mergeTableRecords(db.expenses, 'id', cloudData.expenses || []);
  const budgets = await mergeTableRecords(db.budgets, 'id', cloudData.budgets || []);
  const subscriptions = await mergeTableRecords(db.subscriptions, 'id', cloudData.subscriptions || []);
  const goals = await mergeTableRecords(db.goals, 'id', cloudData.goals || []);
  const categories = await mergeTableRecords(db.categories, 'id', cloudData.categories || []);
  const merchants = await mergeTableRecords(db.merchants, 'merchantId', cloudData.merchants || []);
  const bills = await mergeTableRecords(db.bills, 'id', cloudData.bills || []);
  
  // Merge settings
  const settings = await mergeSettings(cloudData.settings || []);

  // Sync users table - we keep local user but update drive file ID and sync timestamps
  const users = await db.users.toArray();
  const primaryUser = users[0] || null;

  return {
    schemaVersion: 1,
    appVersion: '1.0.0',
    updatedAt: Date.now(),
    user: primaryUser,
    wallets,
    income,
    expenses,
    budgets,
    subscriptions,
    goals,
    categories,
    merchants,
    bills,
    settings
  };
}

/**
 * Generates the full local database export matching the Google Drive JSON structure.
 */
export async function exportLocalDatabase(): Promise<DriveFileContent> {
  const users = await db.users.toArray();
  const primaryUser = users[0] || null;

  return {
    schemaVersion: 1,
    appVersion: '1.0.0',
    updatedAt: Date.now(),
    user: primaryUser,
    wallets: await db.wallets.toArray(),
    income: await db.income.toArray(),
    expenses: await db.expenses.toArray(),
    budgets: await db.budgets.toArray(),
    subscriptions: await db.subscriptions.toArray(),
    goals: await db.goals.toArray(),
    categories: await db.categories.toArray(),
    merchants: await db.merchants.toArray(),
    bills: await db.bills.toArray(),
    settings: await db.settings.toArray()
  };
}
