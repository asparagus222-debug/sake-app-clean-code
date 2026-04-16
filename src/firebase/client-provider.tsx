
'use client';

import React, { useMemo, useEffect, useRef, type ReactNode } from 'react';
import { FirebaseProvider, useFirebase, useMemoFirebase } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { DailyAnnouncementDialog } from '@/components/DailyAnnouncementDialog';
import { FloatingChatWidget } from '@/components/FloatingChatWidget';
import { clearAuthBootstrap, createAuthBootstrapSnapshot, writeAuthBootstrap } from '@/lib/auth-bootstrap';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

function UserProfileBootstrapper() {
  const { user, firestore } = useFirebase();
  const bootstrappedUsersRef = useRef<Set<string>>(new Set());
  const userRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: liveProfile } = useDoc(userRef);

  useEffect(() => {
    if (!user) {
      clearAuthBootstrap();
      return;
    }

    writeAuthBootstrap(createAuthBootstrapSnapshot(user, {
      username: liveProfile?.username,
      avatarUrl: liveProfile?.avatarUrl,
    }));
  }, [user, liveProfile?.username, liveProfile?.avatarUrl]);

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

        const emptyAuthorStats = {
          noteCount: 0,
          likesReceivedCount: 0,
          updatedAt: new Date().toISOString(),
        };

        if (!existing) {
          payload.id = user.uid;
          payload.accountType = user.isAnonymous ? 'anonymous' : 'registered';
          payload.avatarUrl = `https://picsum.photos/seed/${user.uid}/100/100`;
          payload.bio = '';
          payload.qualifications = [];
          payload.authorStats = emptyAuthorStats;
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
          if (existing.accountType !== (user.isAnonymous ? 'anonymous' : 'registered')) {
            payload.accountType = user.isAnonymous ? 'anonymous' : 'registered';
          }
          if (!existing.themeSettings) {
            payload.themeSettings = {
              mode: 'dark',
              fontSize: 'base',
              customBg: '#0a0a0c',
              customPrimary: '#f97316',
            };
          }
          if (!existing.authorStats) {
            payload.authorStats = emptyAuthorStats;
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
      <UserProfileBootstrapper />
      <DailyAnnouncementDialog />
      <FloatingChatWidget />
      {children}
    </FirebaseProvider>
  );
}
