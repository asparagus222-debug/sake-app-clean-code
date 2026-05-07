'use client';

/**
 * @fileoverview 離線品飲筆記本地儲存層。
 * 文字資料 → localStorage
 * 圖片資料 → IndexedDB (idb)
 */

import { openDB, IDBPDatabase } from 'idb';

// ─── 型別定義 ─────────────────────────────────────────────

export type OfflineNote = {
  id: string;
  brandName: string;
  subBrand?: string;
  brewery: string;
  origin?: string;
  /** 圖片儲存於 IndexedDB，這裡只存 id refs */
  imageIds: string[];
  sweetnessRating: number;
  acidityRating: number;
  bitternessRating: number;
  umamiRating: number;
  astringencyRating: number;
  overallRating: number;
  styleTags?: string[];
  description: string;
  /** 作者個人品飲描述 */
  userDescription?: string;
  tastingDate: string;
  createdAt: string;
  /** 已上傳到 Firestore 的對應 id，null 代表尚未上傳 */
  uploadedFirestoreId?: string | null;
  /** 活動 id（若屬於某活動） */
  expoId?: string;
  expoTitle?: string;
};

export type OfflineExpo = {
  id: string;
  title: string;
  location?: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
  /** 活動自訂快速品鑑標籤 */
  quickTags?: string[];
};

// ─── IndexedDB 初始化 ────────────────────────────────────

const DB_NAME = 'sake-offline';
const DB_VERSION = 1;
const IMAGES_STORE = 'images';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(IMAGES_STORE)) {
          db.createObjectStore(IMAGES_STORE);
        }
      },
    });
  }
  return dbPromise;
}

// ─── 圖片 CRUD（IndexedDB）────────────────────────────────

export async function saveImage(id: string, dataUrl: string): Promise<void> {
  const db = await getDb();
  await db.put(IMAGES_STORE, dataUrl, id);
}

export async function getImage(id: string): Promise<string | undefined> {
  const db = await getDb();
  return db.get(IMAGES_STORE, id);
}

export async function deleteImages(ids: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(IMAGES_STORE, 'readwrite');
  await Promise.all(ids.map(id => tx.store.delete(id)));
  await tx.done;
}

export async function getAllImages(ids: string[]): Promise<string[]> {
  const db = await getDb();
  const results = await Promise.all(ids.map(id => db.get(IMAGES_STORE, id)));
  return results.filter((r): r is string => !!r);
}

// ─── 筆記 CRUD（localStorage）───────────────────────────

const NOTES_KEY = 'offline_sake_notes';
const EXPOS_KEY = 'offline_sake_expos';

function loadNotes(): OfflineNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: OfflineNote[]): void {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export function getAllNotes(): OfflineNote[] {
  return loadNotes();
}

export function getNoteById(id: string): OfflineNote | undefined {
  return loadNotes().find(n => n.id === id);
}

export function createNote(data: Omit<OfflineNote, 'id' | 'createdAt'>): OfflineNote {
  const note: OfflineNote = {
    ...data,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    uploadedFirestoreId: null,
  };
  const notes = loadNotes();
  notes.unshift(note);
  saveNotes(notes);
  return note;
}

export function updateNote(id: string, data: Partial<Omit<OfflineNote, 'id' | 'createdAt'>>): OfflineNote | null {
  const notes = loadNotes();
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return null;
  notes[idx] = { ...notes[idx], ...data };
  saveNotes(notes);
  return notes[idx];
}

export function deleteNote(id: string): void {
  const notes = loadNotes().filter(n => n.id !== id);
  saveNotes(notes);
}

export function markNoteUploaded(id: string, firestoreId: string): void {
  updateNote(id, { uploadedFirestoreId: firestoreId });
}

// ─── 活動 CRUD（localStorage）──────────────────────────

function loadExpos(): OfflineExpo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EXPOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExpos(expos: OfflineExpo[]): void {
  localStorage.setItem(EXPOS_KEY, JSON.stringify(expos));
}

export function getAllExpos(): OfflineExpo[] {
  return loadExpos();
}

export function getExpoById(id: string): OfflineExpo | undefined {
  return loadExpos().find(e => e.id === id);
}

export function createExpo(data: Omit<OfflineExpo, 'id' | 'createdAt'>): OfflineExpo {
  const expo: OfflineExpo = {
    ...data,
    id: `offline_expo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const expos = loadExpos();
  expos.unshift(expo);
  saveExpos(expos);
  return expo;
}

export function deleteExpo(id: string): void {
  saveExpos(loadExpos().filter(e => e.id !== id));
}

export function getNotesByExpo(expoId: string): OfflineNote[] {
  return loadNotes().filter(n => n.expoId === expoId);
}
