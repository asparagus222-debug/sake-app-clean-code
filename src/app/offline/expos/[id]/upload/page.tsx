'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Loader2,
  Upload,
  CheckCircle,
  LogIn,
  Mail,
  Lock,
  Globe,
  Check,
  X,
} from 'lucide-react';
import {
  getExpoById,
  getNotesByExpo,
  getAllImages,
  markNoteUploaded,
  OfflineNote,
  OfflineExpo,
} from '@/lib/offline-storage';
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

export default function OfflineExpoBatchUploadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [expo, setExpo] = useState<OfflineExpo | null>(null);
  const [pendingNotes, setPendingNotes] = useState<OfflineNote[]>([]);
  const [step, setStep] = useState<Step>('auth');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const [uploadProgress, setUploadProgress] = useState<{ id: string; status: 'pending' | 'done' | 'error' }[]>([]);

  const { auth, firestore } = initializeFirebase();

  useEffect(() => {
    const e = getExpoById(id);
    if (!e) { router.replace('/offline'); return; }
    setExpo(e);
    const notes = getNotesByExpo(id).filter(n => !n.uploadedFirestoreId);
    setPendingNotes(notes);
    setUploadProgress(notes.map(n => ({ id: n.id, status: 'pending' })));
  }, [id, router]);

  useEffect(() => {
    if (!auth) { setAuthLoading(false); return; }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u && !u.isAnonymous ? u : null);
      setAuthLoading(false);
    });
    return unsub;
  }, [auth]);

  useEffect(() => {
    if (user && pendingNotes.length > 0 && step === 'auth') {
      handleBatchUpload(user);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
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

  const handleBatchUpload = async (uploadUser: User) => {
    if (!firestore) return;
    setStep('uploading');
    const storage = getStorage();

    for (const note of pendingNotes) {
      try {
        const images = await getAllImages(note.imageIds);
        const uploadedUrls: string[] = [];

        for (const [i, dataUrl] of images.entries()) {
          const path = `sakeTastingNotes/${uploadUser.uid}/${Date.now()}_${i}.jpg`;
          const imgRef = storageRef(storage, path);
          await uploadString(imgRef, dataUrl, 'data_url');
          uploadedUrls.push(await getDownloadURL(imgRef));
        }

        const docRef = await addDoc(collection(firestore, 'sakeTastingNotes'), {
          userId: uploadUser.uid,
          username: uploadUser.displayName || uploadUser.email?.split('@')[0] || '品飲愛好者',
          brandName: note.brandName,
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
          expoId: id,
        });

        markNoteUploaded(note.id, docRef.id);
        setUploadProgress(prev => prev.map(p => p.id === note.id ? { ...p, status: 'done' } : p));
      } catch (err) {
        console.error(err);
        setUploadProgress(prev => prev.map(p => p.id === note.id ? { ...p, status: 'error' } : p));
      }
    }

    setStep('done');
    toast({ title: '批次上傳完成' });
  };

  if (!expo) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-body">
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-sm font-bold text-white">批次上傳</h1>
          <p className="text-[10px] text-white/30">{expo.title}</p>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 py-8 space-y-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-white/60 text-sm">{pendingNotes.length} 筆待上傳筆記</p>
        </div>

        {/* 上傳中進度 */}
        {(step === 'uploading' || step === 'done') && (
          <div className="space-y-3">
            {pendingNotes.map((note, i) => {
              const prog = uploadProgress.find(p => p.id === note.id);
              return (
                <div key={note.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="w-5 h-5 shrink-0">
                    {prog?.status === 'done' && <Check className="w-5 h-5 text-green-400" />}
                    {prog?.status === 'error' && <X className="w-5 h-5 text-red-400" />}
                    {prog?.status === 'pending' && step === 'uploading' && i === uploadProgress.findIndex(p => p.status === 'pending') && (
                      <Loader2 className="w-5 h-5 animate-spin text-[#f97316]" />
                    )}
                    {prog?.status === 'pending' && !(step === 'uploading' && i === uploadProgress.findIndex(p => p.status === 'pending')) && (
                      <div className="w-3 h-3 rounded-full bg-white/20 mx-auto" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{note.brandName}</p>
                    <p className="text-white/30 text-xs truncate">{note.brewery}</p>
                  </div>
                  {prog?.status === 'done' && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[9px]">完成</Badge>}
                  {prog?.status === 'error' && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px]">失敗</Badge>}
                </div>
              );
            })}
          </div>
        )}

        {/* 完成 */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-white font-bold">上傳完成！</p>
              <p className="text-white/40 text-sm">
                {uploadProgress.filter(p => p.status === 'done').length} 筆成功，{uploadProgress.filter(p => p.status === 'error').length} 筆失敗
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.replace(`/offline/expos/${id}`)} className="flex-1 border-white/20 text-white/60 hover:text-white">
                回活動頁
              </Button>
              <a href="/" className="flex-1">
                <Button className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold">
                  <Globe className="w-4 h-4 mr-2" /> 查看完整版
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* 登入 */}
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
                  <p className="text-white/40 text-sm">登入後將批次上傳所有待分享筆記</p>
                </div>

                <Button onClick={handleGoogleSignIn} className="w-full h-12 bg-white text-black hover:bg-white/90 font-bold rounded-xl gap-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  使用 Google 登入
                </Button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-xs">或</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input type="password" placeholder="密碼" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailAuth()} className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
                  </div>
                  {authError && <p className="text-red-400 text-xs">{authError}</p>}
                  <Button onClick={handleEmailAuth} disabled={isAuthSubmitting || !email || !password} className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold h-11">
                    {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isSignUp ? '註冊並上傳' : '登入並上傳'}
                  </Button>
                  <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} className="w-full text-center text-white/30 text-xs hover:text-white/60 transition-colors">
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
