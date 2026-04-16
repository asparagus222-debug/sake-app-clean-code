export type NoteDraftSummary = {
  id: string;
  brandName: string;
  savedAt: string;
};

export type NoteDraftPayload = NoteDraftSummary & {
  formData: Record<string, unknown>;
  images: string[];
  originals: string[];
  zooms: number[];
  offsets: Array<{ x: number; y: number }>;
  splitRatio: number;
  imgRatios: number[];
};

const DRAFT_INDEX_KEY = 'sake_note_drafts';
const LEGACY_SINGLE_DRAFT_KEY = 'sake_note_draft';
const DRAFT_DB_NAME = 'sake-note-drafts-db';
const DRAFT_STORE_NAME = 'drafts';
const DRAFT_DB_VERSION = 1;

function canUseBrowserStorage() {
  return typeof window !== 'undefined';
}

function readDraftIndex(): NoteDraftSummary[] {
  if (!canUseBrowserStorage()) return [];

  try {
    const raw = window.localStorage.getItem(DRAFT_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is Partial<NoteDraftSummary> => !!item && typeof item === 'object')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : '',
        brandName: typeof item.brandName === 'string' && item.brandName.trim() ? item.brandName : '未命名草稿',
        savedAt: typeof item.savedAt === 'string' ? item.savedAt : '',
      }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

function writeDraftIndex(index: NoteDraftSummary[]) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(index));
}

function updateDraftIndex(summary: NoteDraftSummary) {
  const next = [summary, ...readDraftIndex().filter((item) => item.id !== summary.id)]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  writeDraftIndex(next);
}

function removeFromLegacyLocalStorage(id: string) {
  if (!canUseBrowserStorage()) return;

  try {
    const raw = window.localStorage.getItem(DRAFT_INDEX_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const hasLegacyPayload = parsed.some((item) => item?.id === id && (item?.formData || item?.images || item?.originals));
    if (!hasLegacyPayload) return;

    const summaries = parsed
      .filter((item) => item?.id !== id)
      .map((item) => ({
        id: item.id,
        brandName: item.brandName || '未命名草稿',
        savedAt: item.savedAt || '',
      }));

    writeDraftIndex(summaries);
  } catch {
    // Ignore legacy cleanup failures.
  }
}

function openDraftDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        db.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runRequest<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withDraftStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T | null> {
  const db = await openDraftDb();
  if (!db) return null;

  const transaction = db.transaction(DRAFT_STORE_NAME, mode);
  const store = transaction.objectStore(DRAFT_STORE_NAME);

  try {
    const result = await run(store);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return result;
  } finally {
    db.close();
  }
}

function normalizeLegacyDraft(input: Record<string, unknown>): NoteDraftPayload {
  return {
    id: typeof input.id === 'string' ? input.id : Date.now().toString(),
    brandName: typeof input.brandName === 'string' && input.brandName.trim() ? input.brandName : '未命名草稿',
    formData: (input.formData as Record<string, unknown>) || {},
    images: Array.isArray(input.images) ? (input.images as string[]) : [],
    originals: Array.isArray(input.originals) ? (input.originals as string[]) : [],
    zooms: Array.isArray(input.zooms) ? (input.zooms as number[]) : [1, 1],
    offsets: Array.isArray(input.offsets) ? (input.offsets as Array<{ x: number; y: number }>) : [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    splitRatio: typeof input.splitRatio === 'number' ? input.splitRatio : 50,
    imgRatios: Array.isArray(input.imgRatios) ? (input.imgRatios as number[]) : [1, 1],
    savedAt: typeof input.savedAt === 'string' ? input.savedAt : new Date().toISOString(),
  };
}

export async function migrateLegacyDraftStorage(): Promise<NoteDraftSummary[]> {
  if (!canUseBrowserStorage()) return [];

  const migrated: NoteDraftSummary[] = [];

  try {
    const oldSingleRaw = window.localStorage.getItem(LEGACY_SINGLE_DRAFT_KEY);
    if (oldSingleRaw) {
      const single = normalizeLegacyDraft(JSON.parse(oldSingleRaw) as Record<string, unknown>);
      await saveNoteDraft(single);
      migrated.push({ id: single.id, brandName: single.brandName, savedAt: single.savedAt });
      window.localStorage.removeItem(LEGACY_SINGLE_DRAFT_KEY);
    }
  } catch {
    // Ignore malformed legacy single draft.
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_INDEX_KEY);
    if (!raw) return readDraftIndex();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return readDraftIndex();

    const legacyPayloads = parsed.filter((item) => item?.formData || item?.images || item?.originals);
    if (legacyPayloads.length === 0) return readDraftIndex();

    for (const item of legacyPayloads) {
      const draft = normalizeLegacyDraft(item as Record<string, unknown>);
      await saveNoteDraft(draft);
      migrated.push({ id: draft.id, brandName: draft.brandName, savedAt: draft.savedAt });
    }

    return readDraftIndex();
  } catch {
    return readDraftIndex();
  }
}

export async function listNoteDrafts(): Promise<NoteDraftSummary[]> {
  await migrateLegacyDraftStorage();
  return readDraftIndex();
}

export async function getNoteDraft(id: string): Promise<NoteDraftPayload | null> {
  await migrateLegacyDraftStorage();

  const stored = await withDraftStore('readonly', async (store) => {
    const result = await runRequest<NoteDraftPayload | undefined>(store.get(id));
    return result ?? null;
  });
  if (stored) return stored;

  if (!canUseBrowserStorage()) return null;

  try {
    const raw = window.localStorage.getItem(DRAFT_INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const legacy = parsed.find((item) => item?.id === id && (item?.formData || item?.images || item?.originals));
    return legacy ? normalizeLegacyDraft(legacy as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function saveNoteDraft(draft: NoteDraftPayload): Promise<void> {
  await withDraftStore('readwrite', async (store) => {
    await runRequest(store.put(draft));
    return null;
  });

  updateDraftIndex({ id: draft.id, brandName: draft.brandName, savedAt: draft.savedAt });
  removeFromLegacyLocalStorage(draft.id);
}

export async function deleteNoteDraft(id: string): Promise<void> {
  await withDraftStore('readwrite', async (store) => {
    await runRequest(store.delete(id));
    return null;
  });

  writeDraftIndex(readDraftIndex().filter((item) => item.id !== id));
  removeFromLegacyLocalStorage(id);
}