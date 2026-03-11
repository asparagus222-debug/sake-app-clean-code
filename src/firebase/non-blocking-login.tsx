'use client';
import { FirebaseError } from 'firebase/app';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';

/** 
 * 發起匿名登入（非阻塞）。
 */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance).catch((error) => {
    console.error("Firebase Auth Error:", error.code, error.message);
  });
}

/**
 * 發起 Google 登入（管理員專用）。
 */
export function initiateGoogleSignIn(authInstance: Auth, onError?: (error: FirebaseError) => void): void {
  const provider = new GoogleAuthProvider();
  signInWithPopup(authInstance, provider).catch(e => {
    console.error("Google Sign In Error:", e);
    if (onError && e instanceof FirebaseError) {
      onError(e);
    }
  });
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  createUserWithEmailAndPassword(authInstance, email, password).catch(e => console.error(e));
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password).catch(e => console.error(e));
}
