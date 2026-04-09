'use client';

import { Auth, getIdToken } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '@/firebase';

export async function authorizedJsonFetch(
  auth: Auth | null,
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  if (!auth?.currentUser) {
    throw new Error('請先登入');
  }

  const idToken = await getIdToken(auth.currentUser);
  const appCheckToken = await getFirebaseAppCheckToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  if (appCheckToken) {
    headers.set('X-Firebase-AppCheck', appCheckToken);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers,
  });
}