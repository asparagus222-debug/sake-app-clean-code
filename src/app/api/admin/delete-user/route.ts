import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { RequestAuthError, requireAdminUser } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const { targetUid } = await request.json();

    if (!targetUid) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    await requireAdminUser(request);

    const adminApp = getAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

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
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || '伺服器錯誤' }, { status: 500 });
  }
}
