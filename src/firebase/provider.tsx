
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { AuthBootstrapSnapshot, clearAuthBootstrap, createAuthBootstrapSnapshot, readAuthBootstrapFromStorage, writeAuthBootstrap } from '@/lib/auth-bootstrap';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  authBootstrap: AuthBootstrapSnapshot | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  storage,
}) => {
  const initialBootstrap = readAuthBootstrapFromStorage();
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: auth?.currentUser ?? null,
    isUserLoading: !!auth && !auth?.currentUser,
    userError: null,
  });
  const [authBootstrap, setAuthBootstrap] = useState<AuthBootstrapSnapshot | null>(initialBootstrap);

  useEffect(() => {
    if (!auth) {
      setUserAuthState(prev => ({ ...prev, isUserLoading: false }));
      return;
    }

    if (auth.currentUser) {
      setUserAuthState({ user: auth.currentUser, isUserLoading: false, userError: null });
      setAuthBootstrap((prev) => {
        const next = createAuthBootstrapSnapshot(auth.currentUser!, undefined, prev);
        writeAuthBootstrap(next);
        return next;
      });
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
        if (firebaseUser) {
          setAuthBootstrap((prev) => {
            const next = createAuthBootstrapSnapshot(firebaseUser, undefined, prev);
            writeAuthBootstrap(next);
            return next;
          });
        } else {
          setAuthBootstrap(null);
          clearAuthBootstrap();
        }
      },
      (error) => {
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe();
  }, [auth]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp,
      firestore,
      auth,
      storage,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
      authBootstrap,
    };
  }, [firebaseApp, firestore, auth, storage, userAuthState, authBootstrap]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return context;
};

export const useFirestore = () => useFirebase().firestore;
export const useAuth = () => useFirebase().auth;
export const useStorage = () => useFirebase().storage;
export const useUser = () => {
  const { user, isUserLoading, userError, authBootstrap } = useFirebase();
  return { user, isUserLoading, userError, authBootstrap };
};

/**
 * Ensures that the result of the factory is properly marked with __memo.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  return useMemo(() => {
    const result = factory();
    if (result && typeof result === 'object') {
      try {
        (result as any).__memo = true;
      } catch (e) {
        // Handle immutable objects
      }
    }
    return result;
  }, deps);
}
