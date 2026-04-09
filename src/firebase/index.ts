
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, Firestore, getFirestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

let appCheckInstance: import('firebase/app-check').AppCheck | null = null;
let appCheckInitPromise: Promise<void> | null = null;

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
      try {
        firestore = getFirestore(firebaseApp);
      } catch {
        console.warn("Firestore initialization failed - database may not be enabled in Firebase Console:", firestoreError);
      }
    }

    let storage: FirebaseStorage | null = null;
    try {
      storage = getStorage(firebaseApp);
    } catch (storageError) {
      console.warn("Storage initialization failed:", storageError);
    }

    if (typeof window !== 'undefined' && !appCheckInstance && !appCheckInitPromise) {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
      if (siteKey) {
        appCheckInitPromise = import('firebase/app-check')
          .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
            appCheckInstance = initializeAppCheck(firebaseApp, {
              provider: new ReCaptchaV3Provider(siteKey),
              isTokenAutoRefreshEnabled: true,
            });
          })
          .catch((error) => {
            console.warn('App Check initialization failed:', error);
          })
          .finally(() => {
            appCheckInitPromise = null;
          });
      }
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

export async function getFirebaseAppCheckToken(): Promise<string | null> {
  if (appCheckInitPromise) {
    await appCheckInitPromise;
  }
  if (!appCheckInstance) {
    return null;
  }

  try {
    const { getToken } = await import('firebase/app-check');
    const result = await getToken(appCheckInstance, false);
    return result.token;
  } catch (error) {
    console.warn('Unable to fetch App Check token:', error);
    return null;
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
