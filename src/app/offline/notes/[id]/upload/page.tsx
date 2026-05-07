'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Loader2,
  Upload,
  CheckCircle,
  LogIn,
  Mail,
  Lock,
  Globe,
} from 'lucide-react';
import { getNoteById, getAllImages, markNoteUploaded, OfflineNote } from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';
import { initializeFirebase } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';

type Step = 'auth' | 'uploading' | 'done';

export default function OfflineUploadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [note, setNote] = useState<OfflineNote | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('auth');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Email 表單狀態
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [uploadedNoteId, setUploadedNoteId] = useState<string | null>(null);

  const { auth, firestore } = initializeFirebase();

  useEffect(() => {
    const n = getNoteById(id);
    if (!n) { router.replace('/offline'); return; }
    if (n.uploadedFirestoreId) {
      setUploadedNoteId(n.uploadedFirestoreId);
      setStep('done');
    }
    setNote(n);
    getAllImages(n.imageIds).then(setImages);
  }, [id, router]);

  useEffect(() => {
    if (!auth) { setAuthLoading(false); return; }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u && !u.isAnonymous ? u : null);
      setAuthLoading(false);
    });
    return unsub;
  }, [auth]);

  // 已登入後自動進行上傳
  useEffect(() => {
    if (user && note && step === 'auth') {
      handleUpload(user);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onAuthStateChanged 會觸發上傳
    } catch (e: any) {
      setAuthError(e.message || '登入失敗');
    }
  };

  const handleEmailAuth = async () => {
    if (!auth || !email || !password) return;
    setAuthError('');
    setIsAuthSubmitting(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      const msg: Record<string, string> = {
        'auth/wrong-password': '密碼錯誤',
        'auth/user-not-found': '帳號不存在',
        'auth/email-already-in-use': '此 Email 已被使用',
        'auth/weak-password': '密碼至少 6 個字元',
        'auth/invalid-email': 'Email 格式不正確',
      };
      setAuthError(msg[e.code] || e.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleUpload = async (uploadUser: User) => {
    if (!note || !firestore) {
      toast({ variant: 'destructive', title: '上傳失敗', description: '無法連接服務' });
      return;
    }
    setStep('uploading');

    try {
      // 上傳圖片到 Firebase Storage
      const storage = getStorage();
      const uploadedUrls: string[] = [];

      for (const [i, dataUrl] of images.entries()) {
        const path = `sakeTastingNotes/${uploadUser.uid}/${Date.now()}_${i}.jpg`;
        const imgRef = storageRef(storage, path);
        await uploadString(imgRef, dataUrl, 'data_url');
        const url = await getDownloadURL(imgRef);
        uploadedUrls.push(url);
      }

      // 建立 Firestore 文件
      const docRef = await addDoc(collection(firestore, 'sakeTastingNotes'), {
        userId: uploadUser.uid,
        username: uploadUser.displayName || uploadUser.email?.split('@')[0] || '品飲愛好者',
        brandName: note.brandName,
        subBrand: note.subBrand || '',
        brewery: note.brewery,
        origin: note.origin || '',
        imageUrls: uploadedUrls,
        sweetnessRating: note.sweetnessRating,
        acidityRating: note.acidityRating,
        bitternessRating: note.bitternessRating,
        umamiRating: note.umamiRating,
        astringencyRating: note.astringencyRating,
        overallRating: note.overallRating,
        styleTags: note.styleTags || [],
        description: note.description,
        tastingDate: note.tastingDate,
        visibility: 'public',
        publicationStatus: 'published',
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        likesCount: 0,
        likedByUserIds: [],
        source: 'offline',
      });

      // 標記為已上傳
      markNoteUploaded(note.id, docRef.id);
      setUploadedNoteId(docRef.id);
      setStep('done');
      toast({ title: '上傳成功！筆記已發佈至社群' });
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: '上傳失敗', description: err.message });
      setStep('auth');
    }
  };

  if (!note) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-body">
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-sm font-bold text-white">上傳分享</h1>
      </nav>

      <div className="max-w-md mx-auto px-4 py-10 space-y-8">
        {/* 筆記摘要 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h2 className="font-bold text-white">{note.brandName}</h2>
          {note.subBrand && <p className="text-[#f97316]/70 text-sm">{note.subBrand}</p>}
          <p className="text-white/40 text-xs mt-1">{note.brewery} · {note.tastingDate}</p>
        </div>

        {/* Step: 已完成 */}
        {step === 'done' && (
          <div className="text-center space-y-6 py-10">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
            <div>
              <p className="text-white font-bold text-xl">上傳成功！</p>
              <p className="text-white/40 text-sm mt-2">筆記已發佈至社群，可在完整版中查看</p>
            </div>
            <div className="flex flex-col gap-3">
              {uploadedNoteId && (
                <a href={`/notes/${uploadedNoteId}`}>
                  <Button className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold">
                    <Globe className="w-4 h-4 mr-2" /> 查看發佈頁面
                  </Button>
                </a>
              )}
              <Button variant="outline" onClick={() => router.replace('/offline')} className="w-full border-white/20 text-white/60 hover:text-white">
                回到離線版
              </Button>
            </div>
          </div>
        )}

        {/* Step: 上傳中 */}
        {step === 'uploading' && (
          <div className="text-center space-y-6 py-10">
            <Loader2 className="w-12 h-12 text-[#f97316] animate-spin mx-auto" />
            <div>
              <p className="text-white font-bold">上傳中...</p>
              <p className="text-white/40 text-sm mt-1">正在上傳圖片與筆記資料</p>
            </div>
          </div>
        )}

        {/* Step: 登入 */}
        {step === 'auth' && (
          <div className="space-y-6">
            {authLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-[#f97316]" />
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <LogIn className="w-10 h-10 text-[#f97316] mx-auto" />
                  <p className="text-white font-bold">需要登入才能分享</p>
                  <p className="text-white/40 text-sm">上傳後筆記將發佈至社群，加入排名</p>
                </div>

                {/* Google 登入 */}
                <Button
                  onClick={handleGoogleSignIn}
                  className="w-full h-12 bg-white text-black hover:bg-white/90 font-bold rounded-xl gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  使用 Google 登入
                </Button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-xs">或</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Email 登入 */}
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type="password"
                      placeholder="密碼"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  {authError && <p className="text-red-400 text-xs">{authError}</p>}
                  <Button
                    onClick={handleEmailAuth}
                    disabled={isAuthSubmitting || !email || !password}
                    className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold h-11"
                  >
                    {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isSignUp ? '註冊並上傳' : '登入並上傳'}
                  </Button>
                  <button
                    onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
                    className="w-full text-center text-white/30 text-xs hover:text-white/60 transition-colors"
                  >
                    {isSignUp ? '已有帳號？登入' : '沒有帳號？註冊'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
