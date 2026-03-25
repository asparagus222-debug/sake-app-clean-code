
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

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

    // Only initialize Firestore if app is ready
    let firestore: Firestore | null = null;
    try {
      firestore = getFirestore(firebaseApp);
    } catch (firestoreError) {
      console.warn("Firestore initialization failed - database may not be enabled in Firebase Console:", firestoreError);
    }

    return {
      firebaseApp,
      auth: getAuth(firebaseApp),
      firestore: firestore
    };
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    // 返回 null 或預設對象，讓 Provider 處理
    return {
      firebaseApp: null as any,
      auth: null as any,
      firestore: null as any
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
