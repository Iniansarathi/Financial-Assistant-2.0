import { db, type SyncQueueItem } from './indexeddb';

export async function addToQueue(
  table: string,
  recordId: string,
  action: 'insert' | 'update' | 'delete',
  payload: any
): Promise<string> {
  const id = `${table}-${recordId}-${action}-${Date.now()}`;
  const queueItem: SyncQueueItem = {
    id,
    table,
    recordId,
    action,
    payload: JSON.stringify(payload),
    timestamp: Date.now(),
    retryCount: 0
  };
  await db.syncQueue.put(queueItem);
  return id;
}

export async function getQueue(): Promise<SyncQueueItem[]> {
  return await db.syncQueue.orderBy('timestamp').toArray();
}

export async function removeFromQueue(id: string): Promise<void> {
  await db.syncQueue.delete(id);
}

export async function incrementRetry(id: string): Promise<void> {
  const item = await db.syncQueue.get(id);
  if (item) {
    item.retryCount += 1;
    await db.syncQueue.put(item);
  }
}

export async function clearQueue(): Promise<void> {
  await db.syncQueue.clear();
}
