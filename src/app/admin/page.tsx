
"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ShieldCheck, 
  Trash2, 
  User, 
  FileText, 
  LogOut, 
  AlertTriangle,
  LogIn,
  Loader2,
  RefreshCw,
  AlertCircle,
  LifeBuoy,
  Eye,
  Fingerprint
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
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { 
  useUser, 
  useAuth,
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  deleteDocumentNonBlocking,
  initiateGoogleSignIn
} from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

// 管理員名單
const ADMIN_EMAILS = ["asparagus222@gmail.com", "admin@example.com"];

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [activeTab, setActiveTab] = useState("notes");
  const [authError, setAuthError] = useState<string | null>(null);

  // 權限檢查
  const isAdmin = user && user.email && ADMIN_EMAILS.includes(user.email);

  // 獲取所有貼文
  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'sakeTastingNotes');
  }, [firestore, isAdmin]);
  const { data: notes, isLoading: isNotesLoading } = useCollection(notesQuery);

  // 獲取所有使用者
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdmin]);
  const { data: users, isLoading: isUsersLoading } = useCollection(usersQuery);

  // 獲取所有問題回報
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'reports');
  }, [firestore, isAdmin]);
  const { data: reports, isLoading: isReportsLoading } = useCollection(reportsQuery);

  const handleLogin = () => {
    setAuthError(null);
    if (auth) {
      initiateGoogleSignIn(auth, (error) => {
        if (error.code === 'auth/unauthorized-domain') {
          setAuthError("此網域尚未在 Firebase 授權。請前往 Firebase 控制台將目前的網域加入 Authorized Domains。");
        } else {
          setAuthError(`登入失敗: ${error.message}`);
        }
      });
    }
  };

  const handleLogout = () => {
    if (auth) {
      signOut(auth);
      router.push('/');
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (!firestore) return;
    const noteRef = doc(firestore, 'sakeTastingNotes', noteId);
    deleteDocumentNonBlocking(noteRef);
    toast({ title: "貼文已刪除" });
  };

  const handleDeleteUserRecord = async (userId: string, username: string) => {
    if (!firestore) return;
    try {
      const userRef = doc(firestore, 'users', userId);
      await deleteDoc(userRef);
      toast({ title: `使用者「${username}」已刪除，名稱已釋放` });
    } catch (err) {
      toast({ variant: "destructive", title: "刪除失敗" });
    }
  };

  const handleDeleteReport = (reportId: string) => {
    if (!firestore) return;
    const reportRef = doc(firestore, 'reports', reportId);
    deleteDocumentNonBlocking(reportRef);
    toast({ title: "回報紀錄已清除" });
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center notebook-texture">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs">管理權限檢查中...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center notebook-texture p-6 text-center">
        <ShieldCheck className="w-16 h-16 text-primary/20 mb-6" />
        <h1 className="text-2xl font-headline font-bold text-primary gold-glow mb-4">管理員登入</h1>
        
        {authError && (
          <Alert variant="destructive" className="max-w-md mb-6 text-left">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>認證錯誤</AlertTitle>
            <AlertDescription className="text-xs">
              {authError}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-muted-foreground text-sm max-w-md mb-8">
          此區域僅限系統管理員訪問。請使用指定的 Google 帳戶進行身份驗證以執行維護操作。
        </p>
        <Button onClick={handleLogin} className="rounded-full h-14 px-10 shadow-xl bg-primary font-bold">
          <LogIn className="w-5 h-5 mr-2" /> 使用 Google 帳戶登入
        </Button>
        <Button variant="ghost" onClick={() => router.push('/')} className="mt-4 text-xs opacity-50">返回首頁</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen notebook-texture p-4 md:p-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-primary/5 p-6 rounded-[2.5rem] border border-primary/10 shadow-inner">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-3 rounded-2xl shadow-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-headline font-bold text-primary gold-glow tracking-widest uppercase">系統控制台</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">{user?.email} (ADMIN)</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="rounded-full text-destructive hover:bg-destructive/10 text-xs font-bold uppercase">
            <LogOut className="w-4 h-4 mr-2" /> 登出控制台
          </Button>
        </header>

        <Tabs defaultValue="notes" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border border-white/10 rounded-full p-1 h-12 flex overflow-x-auto whitespace-nowrap scrollbar-hide">
            <TabsTrigger value="notes" className="rounded-full px-6 text-[10px] font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <FileText className="w-3 h-3 mr-1.5" /> 貼文管理
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-full px-6 text-[10px] font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <User className="w-3 h-3 mr-1.5" /> 帳戶與名稱
            </TabsTrigger>
            <TabsTrigger value="reports" className="rounded-full px-6 text-[10px] font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <LifeBuoy className="w-3 h-3 mr-1.5" /> 問題回報
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="dark-glass rounded-[2.5rem] border border-white/10 p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="font-bold text-sm uppercase tracking-widest text-primary">所有品飲紀錄 ({notes?.length || 0})</h2>
            </div>
            {isNotesLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase font-bold">品牌</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">作者</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">日期</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notes?.map((note: any) => (
                      <TableRow key={note.id} className="border-white/5 hover:bg-white/[0.02]">
                        <TableCell className="text-xs font-bold">{note.brandName}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-bold">{note.username}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">{new Date(note.tastingDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="dark-glass border border-white/10 rounded-[2rem]">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-destructive uppercase tracking-widest font-bold">刪除貼文？</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs">
                                  確定要刪除「{note.brandName}」這篇貼文嗎？此操作不可復原。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-full text-[10px] font-bold uppercase">取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteNote(note.id)} className="rounded-full bg-destructive text-[10px] font-bold uppercase">確認刪除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="dark-glass rounded-[2.5rem] border border-white/10 p-6 shadow-2xl overflow-hidden">
             <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="font-bold text-sm uppercase tracking-widest text-primary">帳戶管理與名稱解鎖 ({users?.length || 0})</h2>
              <p className="text-[10px] text-muted-foreground italic font-bold">刪除紀錄即可釋放該名稱供他人申請</p>
            </div>
            {isUsersLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase font-bold">使用者名稱</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">狀態</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">UID</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-right">釋放名稱</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((u: any) => (
                      <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02]">
                        <TableCell className="text-xs font-bold text-primary">@{u.username}</TableCell>
                        <TableCell>
                          {u.isAccountDeleted ? (
                            <span className="text-[8px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full font-bold uppercase">已刪除並鎖定</span>
                          ) : (
                            <span className="text-[8px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-bold uppercase">使用中</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[8px] text-muted-foreground font-mono">{u.id}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full">
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="dark-glass border border-white/10 rounded-[2rem]">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-primary uppercase tracking-widest font-bold flex items-center gap-2">
                                  <AlertTriangle className="w-5 h-5" /> 釋放名稱？
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs leading-relaxed">
                                  刪除「{u.username}」的資料後，該名稱將不再被系統佔用，任何人（包含原主）皆可再次申請此名稱。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-full text-[10px] font-bold uppercase">取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUserRecord(u.id, u.username)} className="rounded-full bg-destructive text-[10px] font-bold uppercase">確認釋放名稱</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="dark-glass rounded-[2.5rem] border border-white/10 p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="font-bold text-sm uppercase tracking-widest text-primary">使用者問題回報 ({reports?.length || 0})</h2>
            </div>
            {isReportsLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase font-bold">回報人</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">內容摘要</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">時間</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-right">管理</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports?.map((report: any) => (
                      <TableRow key={report.id} className="border-white/5 hover:bg-white/[0.02]">
                        <TableCell className="text-[10px] font-bold">
                          <div className="flex flex-col">
                            <span>@{report.username}</span>
                            <span className="text-[8px] text-muted-foreground font-mono">ID: ...{report.userId?.slice(-5).toUpperCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-[10px]">{report.content}</TableCell>
                        <TableCell className="text-[8px] text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 rounded-full">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="dark-glass border border-white/10 rounded-[2rem] max-w-md">
                              <DialogHeader>
                                <DialogTitle className="text-primary font-headline uppercase tracking-widest text-sm font-bold flex items-center gap-2">
                                  <LifeBuoy className="w-4 h-4" /> 回報詳情
                                </DialogTitle>
                                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase pt-1 flex flex-col">
                                  <span>來自 @{report.username}</span>
                                  <span className="flex items-center gap-1"><Fingerprint className="w-2.5 h-2.5" /> UID: {report.userId}</span>
                                </DialogDescription>
                              </DialogHeader>
                              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mt-4">
                                <p className="text-xs leading-relaxed whitespace-pre-wrap">{report.content}</p>
                              </div>
                              <p className="text-[8px] text-right text-muted-foreground mt-2">{new Date(report.createdAt).toLocaleString()}</p>
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="dark-glass border border-white/10 rounded-[2rem]">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-destructive uppercase tracking-widest font-bold">刪除回報紀錄？</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs">
                                  確定要刪除這筆回報嗎？建議在處理完畢後再行刪除。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-full text-[10px] font-bold uppercase">取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteReport(report.id)} className="rounded-full bg-destructive text-[10px] font-bold uppercase">確認刪除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
