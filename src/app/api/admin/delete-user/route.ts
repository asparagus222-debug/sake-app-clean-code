import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ADMIN_EMAILS = ["asparagus222@gmail.com", "admin@example.com"];

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  // Firebase App Hosting 環境使用 ADC（不需要明確憑證）
  // 本地開發需設定 GOOGLE_APPLICATION_CREDENTIALS 環境變數
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;
    return initializeApp({ credential: serviceAccount ? cert(serviceAccount) : undefined });
  }
  return initializeApp();
}

export async function POST(request: NextRequest) {
  try {
    const { targetUid, callerIdToken } = await request.json();

    if (!targetUid || !callerIdToken) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const adminApp = getAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

    // 驗證呼叫者身份，確認為管理員
    let callerRecord;
    try {
      callerRecord = await adminAuth.verifyIdToken(callerIdToken);
    } catch {
      return NextResponse.json({ error: '身份驗證失敗' }, { status: 401 });
    }

    if (!callerRecord.email || !ADMIN_EMAILS.includes(callerRecord.email)) {
      return NextResponse.json({ error: '無管理員權限' }, { status: 403 });
    }

    // 刪除 Firestore 用戶文件
    try {
      await adminDb.collection('users').doc(targetUid).delete();
    } catch {
      // Firestore 文件可能已不存在，忽略此錯誤
    }

    // 刪除 Firebase Auth 用戶
    try {
      await adminAuth.deleteUser(targetUid);
    } catch (authErr: any) {
      if (authErr.code !== 'auth/user-not-found') {
        return NextResponse.json({ error: `刪除 Auth 用戶失敗: ${authErr.message}` }, { status: 500 });
      }
      // 用戶不存在也視為成功
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
}
