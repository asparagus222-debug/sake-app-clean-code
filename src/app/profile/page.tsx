
"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { UserBadge } from '@/components/UserBadge';
import { NumericKeypad } from '@/components/NumericKeypad';
import { UserProfile, QUALIFICATION_OPTIONS, ThemeSettings } from '@/lib/types';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Loader2, 
  FileText, 
  Award,
  Trash2,
  ShieldCheck,
  Palette,
  LifeBuoy,
  Instagram,
  Twitter,
  Facebook,
  MessageCircle,
  Plus,
  Type,
  Lock
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  useFirestore, 
  useUser, 
  useAuth, 
  useDoc, 
  useMemoFirebase, 
  addDocumentNonBlocking,
  updateDocumentNonBlocking
} from '@/firebase';
import { collection, doc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { deleteUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const THEME_PRESETS = [
  { name: '橘黑', bg: '#0a0a0c', primary: '#f97316', mode: 'dark' },
  { name: '深藍', bg: '#0f172a', primary: '#38bdf8', mode: 'dark' },
  { name: '幽綠', bg: '#064e3b', primary: '#10b981', mode: 'dark' },
  { name: '紫金', bg: '#1e1b4b', primary: '#a855f7', mode: 'dark' },
  { name: '酒紅', bg: '#450a0a', primary: '#f43f5e', mode: 'dark' },
  { name: '岩石', bg: '#fafaf9', primary: '#44403c', mode: 'light' },
  { name: '櫻粉', bg: '#fff1f2', primary: '#fb7185', mode: 'light' },
  { name: '青瓷', bg: '#f0fdfa', primary: '#0d9488', mode: 'light' },
  { name: '天藍', bg: '#f0f9ff', primary: '#0284c7', mode: 'light' },
  { name: '紙白', bg: '#ffffff', primary: '#171717', mode: 'light' },
];

const FONT_SIZE_LEVELS = ['xs', 'sm', 'base', 'lg'] as const;
type FontSizeLevel = (typeof FONT_SIZE_LEVELS)[number];

const FONT_PREVIEW_MAP = {
  xs: '0.8rem',
  sm: '0.9rem',
  base: '1rem',
  lg: '1.1rem'
};

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedQuals, setSelectedQuals] = useState<string[]>([]);
  const [customQual, setCustomQual] = useState("");
  
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'custom'>('dark');
  const [themeFontSize, setThemeFontSize] = useState<FontSizeLevel>('base');
  const [customBg, setCustomBg] = useState('#0a0a0c');
  const [customPrimary, setCustomPrimary] = useState('#f97316');
  const [showThemeDialog, setShowThemeDialog] = useState(false);

  const [reportContent, setReportContent] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  
  // PIN 帳戶創建相關
  const [showCreateAccountDialog, setShowCreateAccountDialog] = useState(false);
  const [createAccountPin, setCreateAccountPin] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  
  // 表單數據暫存（用於匿名用戶）
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  
  // 修改密碼相關
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    if (profile?.qualifications) setSelectedQuals(profile.qualifications);
    if (profile?.themeSettings) {
      setThemeMode(profile.themeSettings.mode);
      const savedSize = profile.themeSettings.fontSize as any;
      setThemeFontSize(savedSize === 'xl' ? 'lg' : (savedSize || 'base'));
      if (profile.themeSettings.customBg) setCustomBg(profile.themeSettings.customBg);
      if (profile.themeSettings.customPrimary) setCustomPrimary(profile.themeSettings.customPrimary);
    }
  }, [profile]);

  const handleSaveTheme = () => {
    if (!user || !firestore) return;
    const themeSettings: ThemeSettings = { 
      mode: themeMode,
      fontSize: themeFontSize,
      customBg,
      customPrimary
    };
    updateDocumentNonBlocking(doc(firestore, 'users', user.uid), { themeSettings });
    toast({ title: "界面設定已更新" });
    setShowThemeDialog(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    // 如果已有名稱，則不允許修改，直接使用現有名稱
    const username = profile?.username ? profile.username : (formData.get('username') as string || '').trim();
    
    if (!username) {
      toast({ variant: "destructive", title: "請輸入使用者名稱" });
      return;
    }

    setIsSaving(true);
    try {
      // 只有在第一次設定名稱時才檢查重複
      if (!profile?.username) {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.docs.some(d => d.id !== user.uid)) {
          toast({ variant: "destructive", title: "名稱已被佔用" });
          setIsSaving(false);
          return;
        }
      }

      const updatedProfile: Partial<UserProfile> = {
        id: user.uid,
        username: username,
        bio: formData.get('bio') as string || '',
        facebook: formData.get('facebook') as string || '',
        twitter: formData.get('twitter') as string || '',
        threads: formData.get('threads') as string || '',
        instagram: formData.get('instagram') as string || '',
        qualifications: selectedQuals,
      };
      updateDocumentNonBlocking(doc(firestore, 'users', user.uid), updatedProfile);
      toast({ title: "資料已儲存" });
    } catch (err) {
      toast({ variant: "destructive", title: "儲存失敗" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !firestore || !auth) return;
    try {
      updateDocumentNonBlocking(doc(firestore, 'users', user.uid), { isAccountDeleted: true, deletedAt: new Date().toISOString() });
      try { await deleteUser(user); } catch (authErr) { await auth.signOut(); }
      router.push('/');
    } catch (err) {
      toast({ variant: "destructive", title: "刪除失敗" });
    }
  };

  const handleSubmitReport = async () => {
    if (!firestore || !user || !reportContent.trim()) return;
    setIsSubmittingReport(true);
    try {
      const reportsRef = collection(firestore, 'reports');
      await addDocumentNonBlocking(reportsRef, {
        userId: user.uid,
        username: profile?.username || "未知使用者",
        content: reportContent,
        createdAt: new Date().toISOString()
      });
      toast({ title: "回報已提交" });
      setReportContent("");
      setShowReportDialog(false);
    } catch (err) {
      toast({ variant: "destructive", title: "提交失敗" });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!auth || !user || !firestore || createAccountPin.length !== 6) return;
    
    // 驗證 pendingFormData 中的 username
    if (!pendingFormData?.username?.trim()) {
      toast({ variant: "destructive", title: "缺少使用者名稱", description: "請先輸入使用者名稱" });
      return;
    }
    
    setIsCreatingAccount(true);
    try {
      const sanitizedUsername = pendingFormData.username.replace(/\s+/g, '').toLowerCase();
      const email = `${sanitizedUsername}@sake-note.app`;
      
      // 創建正式帳戶
      const userCredential = await createUserWithEmailAndPassword(auth, email, createAccountPin);
      const newUser = userCredential.user;
      
      // 保存用戶資料（使用 setDoc 確保數據被保存）
      await setDoc(doc(firestore, 'users', newUser.uid), {
        id: newUser.uid,
        username: pendingFormData.username,
        bio: pendingFormData.bio || '',
        avatarUrl: `https://picsum.photos/seed/${newUser.uid}/100/100`,
        instagram: pendingFormData.instagram || '',
        twitter: pendingFormData.twitter || '',
        facebook: pendingFormData.facebook || '',
        threads: pendingFormData.threads || '',
        qualifications: pendingFormData.qualifications || [],
        themeSettings: {
          mode: 'dark',
          fontSize: 'base',
          customBg: '#0a0a0c',
          customPrimary: '#f97316'
        },
        createdAt: new Date().toISOString()
      });
      
      toast({ title: "帳戶創建成功", description: "現在可以修改個人資料了" });
      setShowCreateAccountDialog(false);
      setCreateAccountPin("");
      setPendingFormData(null);
      
      // 刷新頁面以重新加載數據
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      let message = "創建帳戶失敗";
      if (err.code === 'auth/email-already-in-use') message = "使用者名稱已被使用";
      if (err.code === 'auth/weak-password') message = "PIN 碼需至少 6 位數字";
      toast({ variant: "destructive", title: "創建失敗", description: message });
    } finally {
      setIsCreatingAccount(false);
    }
  };
  
  const handleChangePassword = async () => {
    if (!auth || !auth.currentUser || !newPassword.trim()) {
      toast({ variant: "destructive", title: "缺少必要資訊" });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "密碼不一致", description: "新密碼和確認密碼必須相同" });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "密碼過短", description: "新密碼至少需要 6 位字符" });
      return;
    }
    
    setIsChangingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast({ title: "密碼已更新", description: "您的密碼已成功更改" });
      setShowChangePasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      let message = "變更密碼失敗";
      if (err.code === 'auth/weak-password') message = "密碼強度不足";
      toast({ variant: "destructive", title: "失敗", description: message });
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  const handleCreateAccountClick = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const bio = formData.get('bio') as string;
    const instagram = formData.get('instagram') as string;
    const twitter = formData.get('twitter') as string;
    const facebook = formData.get('facebook') as string;
    const threads = formData.get('threads') as string;
    
    if (!username?.trim()) {
      toast({ variant: "destructive", title: "缺少使用者名稱", description: "請輸入使用者名稱" });
      return;
    }
    
    const qualifications = pendingFormData?.qualifications || selectedQuals || [];
    setPendingFormData({
      username,
      bio,
      instagram,
      twitter,
      facebook,
      threads,
      qualifications
    });
    setShowCreateAccountDialog(true);
  };

  const getBrightness = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length !== 6) return 128;
    const r = parseInt(cleanHex.slice(0, 2), 16), g = parseInt(cleanHex.slice(2, 4), 16), b = parseInt(cleanHex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center notebook-texture font-body">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse font-bold tracking-widest text-xs uppercase">載入中...</p>
      </div>
    );
  }

  const previewBg = themeMode === 'custom' ? customBg : (themeMode === 'light' ? '#ffffff' : '#0a0a0c');
  const previewPrimary = themeMode === 'custom' ? customPrimary : '#f97316';
  const isPreviewDark = getBrightness(previewBg) < 128;
  const fontSizeIndex = FONT_SIZE_LEVELS.indexOf(themeFontSize);

  return (
    <div className="min-h-screen notebook-texture p-4 md:p-8 pb-32 font-body">
      <div className="max-w-4xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="hover:bg-primary/10 text-primary"><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-sm font-headline font-bold text-primary gold-glow tracking-widest uppercase">帳戶中心</h1>
          <div className="w-10" />
        </header>

        <div className="flex items-center justify-center gap-2 px-1">
          <Link href="/profile/notes" className="flex-1">
            <Button variant="outline" className="w-full h-11 rounded-2xl border-primary/30 bg-primary/5 hover:bg-primary/10 shadow-lg p-2 flex items-center justify-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <p className="text-[9px] font-bold uppercase tracking-widest truncate">貼文管理</p>
            </Button>
          </Link>

          <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 h-11 rounded-2xl border-accent/30 bg-accent/5 hover:bg-accent/10 shadow-lg p-2 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <p className="text-[9px] font-bold uppercase tracking-widest truncate">修改密碼</p>
              </Button>
            </DialogTrigger>
            <DialogContent className="dark-glass border-primary/20 rounded-[2.5rem] p-8 max-sm">
              <DialogHeader><DialogTitle className="text-primary font-headline uppercase text-center">修改密碼</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-primary uppercase">新密碼</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="輸入新密碼" className="bg-white/5 border-primary/40 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-primary uppercase">確認密碼</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="確認新密碼" className="bg-white/5 border-primary/40 rounded-xl" />
                </div>
                <Button onClick={handleChangePassword} disabled={isChangingPassword || !newPassword.trim()} className="w-full rounded-full font-bold uppercase">
                  {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isChangingPassword ? '更新中...' : '確認修改'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 h-11 rounded-2xl border-primary/30 bg-primary/5 hover:bg-primary/10 shadow-lg p-2 flex items-center justify-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary" />
                <p className="text-[9px] font-bold uppercase tracking-widest truncate">界面設定</p>
              </Button>
            </DialogTrigger>
            <DialogContent className="dark-glass border-primary/20 rounded-[2.5rem] p-6 max-w-lg">
              <DialogHeader><DialogTitle className="text-primary font-headline text-sm uppercase flex items-center gap-2"><Palette className="w-4 h-4" /> 界面配置</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-primary uppercase">深色系列</Label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {THEME_PRESETS.filter(p => p.mode === 'dark').map((p, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8 text-[10px] font-bold rounded-xl border-white/10 px-0",
                            previewBg === p.bg ? "bg-primary text-white border-primary" : "bg-white/5 text-muted-foreground"
                          )}
                          onClick={() => { setThemeMode('custom'); setCustomBg(p.bg); setCustomPrimary(p.primary); }}
                        >
                          {p.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-primary uppercase">淺色系列</Label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {THEME_PRESETS.filter(p => p.mode === 'light').map((p, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8 text-[10px] font-bold rounded-xl border-white/10 px-0",
                            previewBg === p.bg ? "bg-primary text-white border-primary" : "bg-white/5 text-muted-foreground"
                          )}
                          onClick={() => { setThemeMode('custom'); setCustomBg(p.bg); setCustomPrimary(p.primary); }}
                        >
                          {p.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-primary uppercase flex items-center gap-2"><Type className="w-3.5 h-3.5" /> 字體比例</Label>
                  <Slider value={[fontSizeIndex]} max={3} step={1} onValueChange={(v) => setThemeFontSize(FONT_SIZE_LEVELS[(v?.[0] ?? 0) as 0 | 1 | 2 | 3])} className="py-2" />
                  <div className="flex justify-between text-[8px] font-bold text-muted-foreground/50 uppercase">
                    <span>特小</span><span>標</span><span>適中</span><span>大</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-primary/10 transition-colors duration-300" style={{ backgroundColor: previewBg }}>
                  <p className="text-[8px] text-muted-foreground font-bold mb-2 uppercase opacity-60">效果預覽</p>
                  <h3 className="text-sm font-bold mb-1" style={{ color: previewPrimary, fontSize: `calc(${FONT_PREVIEW_MAP[themeFontSize]} * 1.1)` }}>風味分析與筆記</h3>
                  <p className="leading-tight" style={{ 
                    color: isPreviewDark ? '#f8fafc' : '#1e293b',
                    fontSize: FONT_PREVIEW_MAP[themeFontSize]
                  }}>文字比例將完美同步縮放。</p>
                </div>
                <Button onClick={handleSaveTheme} className="w-full h-10 rounded-full font-bold uppercase text-[10px]">儲存設定</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* 匿名用戶創建帳戶流程 */}
        {user?.isAnonymous && (
        <form onSubmit={handleCreateAccountClick} className="space-y-4 dark-glass p-5 rounded-[2.5rem] border border-primary/20 shadow-2xl">
          <div className="flex flex-col items-center gap-1">
            <Avatar className="w-12 h-12 border-4 border-primary/20 shadow-xl">
              <AvatarImage src={profile?.avatarUrl || `https://picsum.photos/seed/${user?.uid}/100/100`} className="object-cover" />
              <AvatarFallback><User className="w-6 h-6 text-muted-foreground" /></AvatarFallback>
            </Avatar>
            <div className="flex items-center justify-center">{user && <UserBadge userId={user.uid} />}</div>
          </div>

          <section className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground uppercase text-[8px] font-bold tracking-widest">使用者名稱 （建立帳戶後無法修改）</Label>
                <Input 
                  name="username" 
                  className="bg-white/5 border-primary/40 h-10 rounded-xl text-xs" 
                  defaultValue=""
                  required 
                  placeholder="輸入您的使用者名稱"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground uppercase text-[8px] font-bold tracking-widest ml-1">個人簡介</Label>
                <Textarea name="bio" className="bg-white/5 border-primary/40 min-h-[60px] rounded-xl p-3 text-xs" defaultValue="" placeholder="介紹自己..." />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-[9px] font-bold text-primary uppercase tracking-widest border-b border-primary/10 pb-1">社群連結</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground"><Instagram className="w-2.5 h-2.5" /> IG</Label>
                <Input name="instagram" placeholder="@handle" className="bg-white/5 border-primary/30 h-9 rounded-xl text-[10px]" defaultValue="" />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground"><Twitter className="w-2.5 h-2.5" /> X</Label>
                <Input name="twitter" placeholder="@handle" className="bg-white/5 border-primary/30 h-9 rounded-xl text-[10px]" defaultValue="" />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground"><Facebook className="w-2.5 h-2.5" /> FB</Label>
                <Input name="facebook" placeholder="username" className="bg-white/5 border-primary/30 h-9 rounded-xl text-[10px]" defaultValue="" />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground"><MessageCircle className="w-2.5 h-2.5" /> Threads</Label>
                <Input name="threads" placeholder="@handle" className="bg-white/5 border-primary/30 h-9 rounded-xl text-[10px]" defaultValue="" />
              </div>
            </div>
          </section>
          
          <section className="space-y-2">
            <h2 className="text-[9px] font-bold text-primary uppercase tracking-widest border-b border-primary/10 pb-1">專業頭銜 (顯示於貼文旁)</h2>
            <div className="flex flex-wrap gap-1">
              {QUALIFICATION_OPTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    const updatedQuals = selectedQuals.includes(q)
                      ? selectedQuals.filter(v => v !== q)
                      : [...selectedQuals, q];
                    setPendingFormData((prev: any) => ({ ...prev, qualifications: updatedQuals }));
                  }}
                  className={cn("px-2.5 py-1 rounded-full border text-[8px] font-bold transition-colors",
                    pendingFormData?.qualifications?.includes(q)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white/5 border-primary/30 text-muted-foreground"
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
            {/* 自訂頭銜泡泡 */}
            {(pendingFormData?.qualifications || []).filter((q: string) => !QUALIFICATION_OPTIONS.includes(q)).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {(pendingFormData?.qualifications || []).filter((q: string) => !QUALIFICATION_OPTIONS.includes(q)).map((q: string) => (
                  <span key={q} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/40 text-[8px] font-bold text-primary">
                    {q}
                    <button type="button" onClick={() => setPendingFormData((prev: any) => ({ ...prev, qualifications: (prev.qualifications || []).filter((v: string) => v !== q) }))} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex gap-2">
                <Input
                  placeholder="自訂頭銜（最多 20 字元）"
                  value={customQual}
                  onChange={e => e.target.value.length <= 20 && setCustomQual(e.target.value)}
                  maxLength={20}
                  className="bg-white/5 h-9 text-[10px] rounded-xl flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (customQual.trim()) {
                        const newQuals = [...(pendingFormData?.qualifications || selectedQuals), customQual.trim()];
                        setPendingFormData((prev: any) => ({ ...prev, qualifications: newQuals }));
                        setCustomQual("");
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (customQual.trim()) {
                      const newQuals = [...(pendingFormData?.qualifications || selectedQuals), customQual.trim()];
                      setPendingFormData((prev: any) => ({ ...prev, qualifications: newQuals }));
                      setCustomQual("");
                    }
                  }}
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {customQual.length > 0 && <p className="text-[8px] text-muted-foreground text-right">{customQual.length} / 20</p>}
            </div>
          </section>

          <Button type="submit" className="w-full rounded-full h-11 text-xs font-bold shadow-lg bg-gradient-to-r from-primary to-primary/80 uppercase tracking-widest">
            <Save className="w-4 h-4 mr-2" /> 建立帳戶
          </Button>
          
          {/* PIN 設置對話框 */}
          <Dialog open={showCreateAccountDialog} onOpenChange={setShowCreateAccountDialog}>
            <DialogContent className="dark-glass border-primary/20 rounded-[2.5rem] p-8">
              <DialogHeader>
                <DialogTitle className="text-primary font-headline uppercase text-center text-lg">設定 PIN 碼</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground text-center">請輸入 6 位數 PIN 碼（用於登入與帳戶救援）</p>
              
              <div className="flex items-center justify-center gap-1 py-4 min-h-12">
                {[...Array(6)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-10 h-10 rounded-lg border-2 border-primary/40 bg-white/5 flex items-center justify-center text-lg font-bold"
                  >
                    {createAccountPin[i] ? '●' : ''}
                  </div>
                ))}
              </div>
              
              <NumericKeypad
                onNumberClick={(num) => {
                  if (createAccountPin.length < 6) setCreateAccountPin(createAccountPin + num);
                }}
                onDelete={() => setCreateAccountPin(createAccountPin.slice(0, -1))}
                onClear={() => setCreateAccountPin('')}
              />
              
              <Button 
                onClick={handleCreateAccount}
                disabled={createAccountPin.length !== 6 || isCreatingAccount}
                className="w-full h-11 rounded-full font-bold uppercase text-sm mt-4"
              >
                {isCreatingAccount ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isCreatingAccount ? '建立中...' : '確認建立'}
              </Button>
            </DialogContent>
          </Dialog>
        </form>
        )}
        
        {/* 已註冊用戶個人資料表單 */}
        {!user?.isAnonymous && (
        <form onSubmit={handleSave} className="space-y-4 dark-glass p-5 rounded-[2.5rem] border border-primary/20 shadow-2xl">
          <div className="flex flex-col items-center gap-1">
            <Avatar className="w-12 h-12 border-4 border-primary/20 shadow-xl">
              <AvatarImage src={profile?.avatarUrl || `https://picsum.photos/seed/${user?.uid}/100/100`} className="object-cover" />
              <AvatarFallback><User className="w-6 h-6 text-muted-foreground" /></AvatarFallback>
            </Avatar>
            <div className="flex items-center justify-center">{user && <UserBadge userId={user.uid} />}</div>
          </div>

          <section className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <Label className="text-muted-foreground uppercase text-[8px] font-bold tracking-widest">使用者名稱</Label>
                  {profile?.username && <span className="text-[7px] text-primary/50 font-bold uppercase flex items-center gap-0.5"><Lock className="w-2 h-2" /> 已鎖定</span>}
                </div>
                <Input 
                  name="username" 
                  className={cn("bg-white/5 border-primary/40 h-10 rounded-xl text-xs", profile?.username && "opacity-60 cursor-not-allowed")} 
                  defaultValue={profile?.username || ''} 
                  required 
                  disabled={!!profile?.username}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground uppercase text-[8px] font-bold tracking-widest ml-1">個人簡介</Label>
                <Textarea name="bio" className="bg-white/5 border-primary/40 min-h-[60px] rounded-xl p-3 text-xs" defaultValue={profile?.bio || ''} />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-[9px] font-bold text-primary uppercase tracking-widest border-b border-primary/10 pb-1">社群連結</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground"><Instagram className="w-2.5 h-2.5" /> IG</Label>
                <Input name="instagram" placeholder="@handle" className="bg-white/5 border-primary/30 h-9 rounded-xl text-[10px]" defaultValue={profile?.instagram || ''} />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground"><Twitter className="w-2.5 h-2.5" /> X</Label>
                <Input name="twitter" placeholder="@handle" className="bg-white/5 border-primary/30 h-9 rounded-xl text-[10px]" defaultValue={profile?.twitter || ''} />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground"><Facebook className="w-2.5 h-2.5" /> FB</Label>
                <Input name="facebook" placeholder="username" className="bg-white/5 border-primary/30 h-9 rounded-xl text-[10px]" defaultValue={profile?.facebook || ''} />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground"><MessageCircle className="w-2.5 h-2.5" /> Threads</Label>
                <Input name="threads" placeholder="@handle" className="bg-white/5 border-primary/30 h-9 rounded-xl text-[10px]" defaultValue={profile?.threads || ''} />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-[9px] font-bold text-primary uppercase tracking-widest border-b border-primary/10 pb-1">專業頭銜 (顯示於貼文旁)</h2>
            <div className="flex flex-wrap gap-1">
              {QUALIFICATION_OPTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSelectedQuals(prev => prev.includes(q) ? prev.filter(v => v !== q) : [...prev, q])}
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-[8px] font-bold transition-colors",
                    selectedQuals.includes(q)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white/5 border-primary/30 text-muted-foreground"
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
            {/* 自訂頭銜泡泡 */}
            {selectedQuals.filter(q => !QUALIFICATION_OPTIONS.includes(q)).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedQuals.filter(q => !QUALIFICATION_OPTIONS.includes(q)).map((q) => (
                  <span key={q} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/40 text-[8px] font-bold text-primary">
                    {q}
                    <button type="button" onClick={() => setSelectedQuals(prev => prev.filter(v => v !== q))} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex gap-2">
                <Input
                  placeholder="自訂頭銜（最多 20 字元）"
                  value={customQual}
                  onChange={e => e.target.value.length <= 20 && setCustomQual(e.target.value)}
                  maxLength={20}
                  className="bg-white/5 h-9 text-[10px] rounded-xl flex-1"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), customQual.trim() && (setSelectedQuals([...selectedQuals, customQual.trim()]), setCustomQual("")))}
                />
                <Button type="button" onClick={() => customQual.trim() && (setSelectedQuals([...selectedQuals, customQual.trim()]), setCustomQual(""))} size="icon" className="h-9 w-9 rounded-xl"><Plus className="w-4 h-4" /></Button>
              </div>
              {customQual.length > 0 && <p className="text-[8px] text-muted-foreground text-right">{customQual.length} / 20</p>}
            </div>
          </section>

          <Button type="submit" disabled={isSaving} className="w-full rounded-full h-11 text-xs font-bold shadow-lg bg-primary transition-opacity">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} 儲存資料
          </Button>

          <div className="pt-4 border-t border-primary/10 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                <DialogTrigger asChild>
                  <Button type="button" variant="ghost" className="h-11 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white">
                    <LifeBuoy className="w-3.5 h-3.5 mr-2" /> 問題回報
                  </Button>
                </DialogTrigger>
                <DialogContent className="dark-glass border-primary/20 rounded-[2.5rem] p-8 max-sm">
                  <DialogHeader><DialogTitle className="text-primary font-headline text-lg uppercase flex items-center justify-center gap-2"><LifeBuoy className="w-5 h-5" /> 問題回報</DialogTitle></DialogHeader>
                  <Textarea placeholder="描述問題..." value={reportContent} onChange={e => setReportContent(e.target.value)} className="bg-white/5 border-primary/40 min-h-[150px] rounded-xl p-4 text-xs mt-4" />
                  <Button onClick={handleSubmitReport} disabled={isSubmittingReport || !reportContent.trim()} className="w-full h-12 rounded-full font-bold uppercase text-xs mt-4">提交</Button>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="h-11 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest text-destructive/70 hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> 刪除帳戶
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="dark-glass border-primary/20 rounded-[2.5rem] p-8 shadow-2xl">
                  <AlertDialogHeader><AlertDialogTitle className="text-primary font-headline uppercase text-xl">確定要刪除嗎？</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogFooter className="mt-8">
                    <AlertDialogCancel className="rounded-full">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="rounded-full bg-destructive">確認刪除</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
            {user && (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 text-center pt-2">
                UID: ...{user.uid.slice(-5).toUpperCase()}
              </p>
            )}
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
