
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

/**
 * 初始化 Firebase SDK。
 */
export function initializeFirebase() {
  let firebaseApp: FirebaseApp;
  
  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApp();
    }

    // Only initialize Firestore if app is ready (persistent local cache for offline/repeat visits)
    let firestore: Firestore | null = null;
    try {
      firestore = initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
    } catch (firestoreError) {
      console.warn("Firestore initialization failed - database may not be enabled in Firebase Console:", firestoreError);
    }

    let storage: FirebaseStorage | null = null;
    try {
      storage = getStorage(firebaseApp);
    } catch (storageError) {
      console.warn("Storage initialization failed:", storageError);
    }

    return {
      firebaseApp,
      auth: getAuth(firebaseApp),
      firestore,
      storage,
    };
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return {
      firebaseApp: null as any,
      auth: null as any,
      firestore: null as any,
      storage: null as any,
    };
  }
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
