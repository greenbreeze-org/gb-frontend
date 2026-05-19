import type { ApplianceType, WallType } from '@/services/profileSetup'

export interface DailyImpactSnapshot {
  dateKey: string
  date: string
  house_profile: {
    house_material: WallType
    appliances: ApplianceType[]
  }
  impact: {
    avoided_kwh: number
    avoided_emissions_kg_co2: number
    peak_reduction_pct: number
    estimated_savings_aud: number
  }
}

const DB_NAME = 'greenbreeze_impact_history_db'
const DB_VERSION = 1
const STORE_NAME = 'daily_impact_snapshots'
const MAX_HISTORY = 7

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'dateKey' })
      }
    }
  })
}

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    request.onsuccess = () => resolve(request.result)
  })

const withTransaction = async <T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>,
): Promise<T> => {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const result = await callback(store)

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    })

    return result
  } finally {
    db.close()
  }
}

export const listDailyImpactSnapshots = async (): Promise<DailyImpactSnapshot[]> => {
  return withTransaction('readonly', async (store) => {
    const rows = await requestToPromise(store.getAll())
    return (rows as DailyImpactSnapshot[]).sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  })
}

export const upsertDailyImpactSnapshot = async (
  snapshot: DailyImpactSnapshot,
): Promise<DailyImpactSnapshot[]> => {
  return withTransaction('readwrite', async (store) => {
    await requestToPromise(store.put(snapshot))

    const rows = (await requestToPromise(store.getAll())) as DailyImpactSnapshot[]
    const sorted = rows.sort((a, b) => a.dateKey.localeCompare(b.dateKey))

    if (sorted.length > MAX_HISTORY) {
      const pruneCount = sorted.length - MAX_HISTORY
      for (let i = 0; i < pruneCount; i += 1) {
        const stale = sorted[i]
        if (!stale) continue
        await requestToPromise(store.delete(stale.dateKey))
      }
    }

    const refreshed = (await requestToPromise(store.getAll())) as DailyImpactSnapshot[]
    return refreshed.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  })
}
