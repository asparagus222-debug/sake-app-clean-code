
"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericKeypad } from '@/components/NumericKeypad';
import { ArrowLeft, Loader2, KeyRound, User, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocsFromServer, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function isRegisteredProfileRecord(data: Record<string, unknown> | undefined) {
  if (!data || data.isAccountDeleted) return false;
  if (data.accountType === 'registered') return true;
  return typeof data.createdAt === 'string';
}

export default function RecoverPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) setPin(prev => prev + num);
  };

  const handleDelete = () => setPin(prev => prev.slice(0, -1));
  const handleClear = () => setPin("");

  const handleRecover = async () => {
    if (!auth || !username || pin.length !== 6) return;

    setIsRecovering(true);
    try {
      // 轉換成正式帳號信箱格式
      const sanitizedUsername = username.replace(/\s+/g, '').toLowerCase();
      const email = `${sanitizedUsername}@sake-note.app`;
      
      await signInWithEmailAndPassword(auth, email, pin);
      
      setIsSuccess(true);
      toast({ title: "帳戶已成功找回", description: `歡迎回來，${username}！` });
      
      // 使用 window.location.replace 強制整頁刷新到個人中心，確保狀態徹底同步
      setTimeout(() => {
        window.location.replace('/profile');
      }, 1500);
      
    } catch (err: any) {
      let message = "找回失敗，請檢查名稱或 PIN 碼。";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        if (firestore) {
          try {
            const usernameQuery = query(
              collection(firestore, 'users'),
              where('username', '==', username.trim())
            );
            const querySnapshot = await getDocsFromServer(usernameQuery);
            const hasRegisteredProfile = querySnapshot.docs.some((doc) => isRegisteredProfileRecord(doc.data()));
            const hasAnonymousProfileStub = querySnapshot.docs.some((doc) => !isRegisteredProfileRecord(doc.data()) && !doc.data().isAccountDeleted);
            if (hasAnonymousProfileStub && !hasRegisteredProfile) {
              message = '此名稱已有品飲資料，但尚未完成正式帳戶建立。請回原裝置到個人頁完成建帳。';
            } else if (hasRegisteredProfile) {
              message = '此名稱已有正式品飲帳戶資料，但登入帳戶不存在。請聯絡管理員協助處理。';
            } else {
              message = '找不到此使用者名稱。';
            }
          } catch {
            message = '找不到此使用者名稱。';
          }
        } else {
          message = '找不到此使用者名稱。';
        }
      }
      if (err.code === 'auth/wrong-password') message = "PIN 碼錯誤。";
      
      toast({ variant: "destructive", title: "認證失敗", description: message });
      setIsRecovering(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen notebook-texture p-6 flex flex-col items-center justify-center text-center space-y-6">
        <div className="bg-green-500/20 p-6 rounded-full border border-green-500/20 animate-bounce">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-headline font-bold text-primary gold-glow tracking-widest uppercase">驗證成功</h1>
        <p className="text-muted-foreground text-sm font-bold uppercase">正在同步您的品飲筆記，即將進入帳戶中心...</p>
        <Loader2 className="w-6 h-6 animate-spin text-primary/40 mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen notebook-texture px-4 py-6 flex flex-col items-center justify-center font-body">
      <div className="w-full max-w-sm space-y-4 text-center">
        <header className="flex items-center gap-3 justify-center">
          <div className="bg-primary/20 p-2.5 rounded-2xl border border-primary/20">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h1 className="text-base font-headline font-bold text-primary gold-glow tracking-widest uppercase">找回品飲帳戶</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">輸入名稱與救援 PIN 碼</p>
          </div>
        </header>

        <div className="dark-glass p-5 rounded-[2rem] border border-white/10 shadow-2xl space-y-4">
          <div className="space-y-1.5 text-left">
            <Label className="text-[10px] uppercase font-bold text-primary tracking-widest ml-1">使用者名稱</Label>
            <div className="relative">
              <Input 
                placeholder="例如：清酒大師" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="bg-white/5 border-white/10 h-10 rounded-xl pl-10 text-sm"
              />
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
             <Label className="text-[10px] uppercase font-bold text-primary tracking-widest">輸入 6 位數救援 PIN 碼</Label>
             <div className="flex justify-center gap-2">
               {[0, 1, 2, 3, 4, 5].map((i) => (
                 <div key={i} className={cn("w-3.5 h-3.5 rounded-full border-2 border-primary/20", pin.length > i ? 'bg-primary shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-transparent')} />
               ))}
             </div>
             <NumericKeypad onNumberClick={handleNumberClick} onDelete={handleDelete} onClear={handleClear} compact />
          </div>

          <Button onClick={handleRecover} disabled={isRecovering || !username || pin.length !== 6} className="w-full h-11 rounded-full text-sm font-bold shadow-xl">
            {isRecovering ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ShieldAlert className="w-5 h-5 mr-2" />} 驗證身份並找回
          </Button>
        </div>

        <Button variant="ghost" onClick={() => router.push('/')} className="text-muted-foreground text-[10px] uppercase font-bold">
          <ArrowLeft className="w-4 h-4 mr-2" /> 返回首頁
        </Button>
      </div>
    </div>
  );
}
