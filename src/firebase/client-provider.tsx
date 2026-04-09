
'use client';

import React, { useMemo, useEffect, useRef, type ReactNode } from 'react';
import { FirebaseProvider, useFirebase } from '@/firebase/provider';
import { initializeFirebase, initiateAnonymousSignIn } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

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

function UserProfileBootstrapper() {
  const { user, firestore } = useFirebase();
  const bootstrappedUsersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !firestore) return;
    if (bootstrappedUsersRef.current.has(user.uid)) return;

    bootstrappedUsersRef.current.add(user.uid);
    const userRef = doc(firestore, 'users', user.uid);

    getDoc(userRef)
      .then(snapshot => {
        const existing = snapshot.exists() ? snapshot.data() : null;
        const payload: Record<string, unknown> = {
          updatedAt: new Date().toISOString(),
        };

        if (!existing) {
          payload.id = user.uid;
          payload.avatarUrl = `https://picsum.photos/seed/${user.uid}/100/100`;
          payload.bio = '';
          payload.qualifications = [];
          payload.themeSettings = {
            mode: 'dark',
            fontSize: 'base',
            customBg: '#0a0a0c',
            customPrimary: '#f97316',
          };
          if (!user.isAnonymous) {
            payload.createdAt = new Date().toISOString();
          }
        } else {
          if (!existing.id) payload.id = user.uid;
          if (!existing.themeSettings) {
            payload.themeSettings = {
              mode: 'dark',
              fontSize: 'base',
              customBg: '#0a0a0c',
              customPrimary: '#f97316',
            };
          }
          if (!existing.createdAt && !user.isAnonymous) {
            payload.createdAt = new Date().toISOString();
          }
        }

        if (Object.keys(payload).length > 1 || !existing) {
          setDocumentNonBlocking(userRef, payload, { merge: true });
        }
      })
      .catch(() => {
        bootstrappedUsersRef.current.delete(user.uid);
      });
  }, [user, firestore]);

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
      storage={firebaseServices.storage}
    >
      <AuthInitializer />
      <UserProfileBootstrapper />
      {children}
    </FirebaseProvider>
  );
}
