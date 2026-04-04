import { initializeApp, getApps, cert, App } from 'firebase-admin/app';

export function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;
    return initializeApp({ credential: serviceAccount ? cert(serviceAccount) : undefined });
  }
  return initializeApp();
}
