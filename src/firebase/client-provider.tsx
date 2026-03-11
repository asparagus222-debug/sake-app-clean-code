
'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider, useFirebase } from '@/firebase/provider';
import { initializeFirebase, initiateAnonymousSignIn } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * 內部組件，負責在全域範圍內檢查並執行自動匿名登入。
 */
function AuthInitializer() {
  const { auth, user, isUserLoading } = useFirebase();

  useEffect(() => {
    // 如果讀取完成但沒有使用者，且 Auth 實例已就緒，則發起匿名登入
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  return null;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      <AuthInitializer />
      {children}
    </FirebaseProvider>
  );
}
