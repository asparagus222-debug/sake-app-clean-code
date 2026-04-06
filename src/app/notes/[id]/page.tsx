
"use client"

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SakeNote, SakeComment, RATING_LABELS, UserProfile } from '@/lib/types';
import { SakeRadarChart } from '@/components/SakeRadarChart';
import { UserBadge } from '@/components/UserBadge';
import { 
  ArrowLeft, 
  Trash2, 
  Share2, 
  Loader2, 
  MessageSquare, 
  User, 
  Calendar, 
  Clock,
  MapPin,
  Tag,
  FileText,
  Award,
  BrainCircuit,
  Palette,
  TrendingUp,
  Sparkles,
  Edit3,
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
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { useToast } from '@/hooks/use-toast';
import { useDoc, useFirestore, useUser, deleteDocumentNonBlocking, useMemoFirebase, useCollection, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

const RatingDots = ({ value }: { value: number }) => {
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= value ? 'bg-primary shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
};

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingEvolution, setIsGeneratingEvolution] = useState(false);
  const [evolutionNoteText, setEvolutionNoteText] = useState("");

  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const noteDocRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'sakeTastingNotes', id);
  }, [firestore, id]);
  const { data: note, isLoading } = useDoc<SakeNote>(noteDocRef);

  const authorRef = useMemoFirebase(() => {
    if (!firestore || !note?.userId) return null;
    return doc(firestore, 'users', note.userId);
  }, [firestore, note?.userId]);
  const { data: authorProfile } = useDoc<UserProfile>(authorRef);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile } = useDoc(userDocRef);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    const commentsRef = collection(firestore, 'sakeTastingNotes', id, 'comments');
    return query(commentsRef, orderBy('createdAt', 'desc'));
  }, [firestore, id]);
  const { data: comments } = useCollection<SakeComment>(commentsQuery);

  // Sync evolution note text when note loads
  React.useEffect(() => {
    if (note?.evolutionNote) setEvolutionNoteText(note.evolutionNote);
  }, [note?.evolutionNote]);

  const handleAddComment = async () => {
    if (!firestore || !user || !id || !commentText.trim()) return;
    if (!profile?.username) {
      toast({ variant: "destructive", title: "請先設定名稱" });
      router.push('/profile');
      return;
    }
    setIsSubmitting(true);
    try {
      const commentData = {
        userId: user.uid,
        username: profile.username,
        text: commentText,
        createdAt: new Date().toISOString()
      };
      const commentsRef = collection(firestore, 'sakeTastingNotes', id, 'comments');
      addDocumentNonBlocking(commentsRef, commentData);
      setCommentText("");
      toast({ title: "留言已成功發布" });
    } catch (err) {
      toast({ variant: "destructive", title: "留言失敗" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateEvolutionSummary = async () => {
    if (!note || isGeneratingEvolution) return;
    setIsGeneratingEvolution(true);
    try {
      const response = await fetch('/api/ai/evolution-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: note.brandName,
          session0: {
            sweetness: note.sweetnessRating,
            acidity: note.acidityRating,
            bitterness: note.bitternessRating,
            umami: note.umamiRating,
            astringency: note.astringencyRating,
            overallRating: note.overallRating,
            userDescription: note.userDescription || note.description || '',
            label: '開瓶品飲',
          },
          sessions: note.sessions || [],
        }),
      });
      const data = await response.json();
      if (data.text) {
        setEvolutionNoteText(data.text);
        toast({ title: 'AI 風味演變總結已生成' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'AI 生成失敗' });
    } finally {
      setIsGeneratingEvolution(false);
    }
  };

  const saveEvolutionNote = async () => {
    if (!firestore || !note) return;
    try {
      await updateDoc(doc(firestore, 'sakeTastingNotes', note.id), { evolutionNote: evolutionNoteText });
      toast({ title: '風味演變筆記已儲存' });
    } catch {
      toast({ variant: 'destructive', title: '儲存失敗' });
    }
  };

  const executeDelete = () => {
    if (!firestore || !note) return;
    const noteRef = doc(firestore, 'sakeTastingNotes', note.id);
    deleteDocumentNonBlocking(noteRef);
    toast({ title: "正在刪除筆記..." });
    router.replace('/');
  };

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center notebook-texture">
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground font-bold text-[10px] tracking-widest uppercase">載入中...</p>
    </div>
  );

  if (!note) return (
    <div className="min-h-screen flex flex-col items-center justify-center notebook-texture">
      <p className="text-muted-foreground text-xs uppercase font-bold">筆記不存在或已被刪除</p>
      <Button variant="link" onClick={() => router.push('/')} className="mt-4 text-primary text-xs">返回首頁</Button>
    </div>
  );

  return (
    <div className="min-h-screen notebook-texture pb-20">
      <div className="max-w-2xl auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-primary hover:bg-primary/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="hover:bg-primary/10" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast({ title: "連結已複製" });
            }}>
              <Share2 className="w-5 h-5" />
            </Button>
            {user?.uid === note.userId && (
              <Link href={`/notes/${note.id}/edit`}>
                <Button type="button" variant="ghost" size="icon" className="hover:bg-primary/10 text-primary"><Edit3 className="w-5 h-5" /></Button>
              </Link>
            )}
            {user?.uid === note.userId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"><Trash2 className="w-5 h-5" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="dark-glass border border-white/10 rounded-[2rem] p-8 shadow-2xl backdrop-blur-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-primary font-headline text-xl gold-glow tracking-widest uppercase">確定要刪除嗎？</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">此操作將永久刪除這篇品飲筆記及其所有評論。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-6 gap-3">
                    <AlertDialogCancel className="rounded-full">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDelete} className="rounded-full bg-destructive">確定刪除</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="dark-glass rounded-[2rem] overflow-hidden mb-6 border border-white/10 shadow-2xl">
          <div className="relative aspect-square bg-muted/10 overflow-hidden flex">
            {note.imageUrls && note.imageUrls.length === 2 ? (
              <>
                <div className="h-full relative" style={{ width: `${note.imageSplitRatio || 50}%` }}>
                  <Image src={note.imageUrls[0]} alt="img1" fill className="object-cover" />
                </div>
                <div className="h-full w-px bg-white/20 z-10" />
                <div className="h-full relative" style={{ width: `${100 - (note.imageSplitRatio || 50)}%` }}>
                  <Image src={note.imageUrls[1]} alt="img2" fill className="object-cover" />
                </div>
              </>
            ) : note.imageUrls && note.imageUrls[0] ? (
              <Image src={note.imageUrls[0]} alt="img1" fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-muted-foreground/30 text-[10px] font-bold">NO PHOTO</div>
            )}
          </div>
          
          <div className="p-6 md:p-8 relative">
            <div className="flex justify-between items-end mb-4">
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-primary font-bold text-[10px] tracking-[0.2em] uppercase mb-1">
                  <span>{note.brewery}</span>
                  {note.origin && (
                    <>
                      <span className="opacity-40">|</span>
                      <span className="flex items-center gap-0.5"><MapPin className="w-2 h-2" /> {note.origin}</span>
                    </>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-headline text-foreground gold-glow leading-tight break-words">{note.brandName}</h1>
                
                {/* 酒鑑資訊標籤 */}
                {note.sakeInfoTags && note.sakeInfoTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {note.sakeInfoTags.map((tag, idx) => (
                      <span key={idx} className="bg-sky-500/10 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full text-[9px] font-bold">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex flex-col gap-2 pt-3">
                  <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                    <Link href={`/users/${note.userId}`} className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 hover:bg-primary/10 transition-colors">
                      <User className="w-2.5 h-2.5 text-primary" />
                      <span className="text-xs font-bold text-foreground/80">{authorProfile?.username || note.username || "愛好者"}</span>
                      <UserBadge userId={note.userId} />
                    </Link>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold">
                      <Calendar className="w-2.5 h-2.5 opacity-50" />
                      {new Date(note.tastingDate).toLocaleDateString('zh-TW')}
                    </div>
                  </div>
                  
                  {/* 唎酒師頭銜 (最多3個) */}
                  {authorProfile?.qualifications && authorProfile.qualifications.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {authorProfile.qualifications.slice(0, 3).map((q, idx) => (
                        <Badge key={idx} variant="outline" className="text-[8px] py-0.5 border-primary/20 bg-primary/5 text-primary/80 font-bold uppercase flex items-center gap-1">
                          <Award className="w-2.5 h-2.5" /> {q}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-primary text-primary-foreground p-3 rounded-2xl text-center min-w-[60px] shadow-lg ml-4">
                <span className="text-[9px] block opacity-80 uppercase font-bold tracking-widest">SCORE</span>
                <span className="text-2xl font-headline font-bold">{note.overallRating}</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-center mb-6 border-t border-white/5 pt-6">
              <div className="flex items-center justify-center">
                <SakeRadarChart data={{ sweetness: note.sweetnessRating ?? (note as any).sweetness ?? 0, acidity: note.acidityRating ?? (note as any).acidity ?? 0, bitterness: note.bitternessRating ?? (note as any).bitterness ?? 0, umami: note.umamiRating ?? (note as any).umami ?? 0, astringency: note.astringencyRating ?? (note as any).astringency ?? 0 }} />
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-primary text-sm uppercase tracking-widest border-b border-primary/20 pb-1">風味分析</h3>
                <div className="space-y-2">
                   {(() => {
                    const sw = note.sweetnessRating ?? (note as any).sweetness ?? 0;
                    const ac = note.acidityRating ?? (note as any).acidity ?? 0;
                    const bi = note.bitternessRating ?? (note as any).bitterness ?? 0;
                    const um = note.umamiRating ?? (note as any).umami ?? 0;
                    const as_ = note.astringencyRating ?? (note as any).astringency ?? 0;
                    return [
                    { label: '甘', value: sw, text: RATING_LABELS.sweetness[sw-1] },
                    { label: '酸', value: ac, text: RATING_LABELS.acidity[ac-1] },
                    { label: '苦', value: bi, text: RATING_LABELS.bitterness[bi-1] },
                    { label: '旨', value: um, text: RATING_LABELS.umami[um-1] },
                    { label: '澀', value: as_, text: RATING_LABELS.astringency[as_-1] },
                   ];})().map((f, i) => (
                     <div key={i} className="flex items-center justify-between text-[11px] border-b border-white/5 pb-1">
                       <div className="flex items-center gap-2">
                         <span className="text-muted-foreground font-bold">{f.label}</span>
                         <RatingDots value={f.value} />
                       </div>
                       <span className="font-bold text-foreground text-right">{f.text}</span>
                     </div>
                   ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
  {/* 標題欄位 */}
  <div className="flex items-center gap-2 text-primary">
    <FileText className="w-4 h-4" />
    <h4 className="text-[10px] font-bold uppercase tracking-widest">品飲描述</h4>
  </div>

  {/* 1. 上方：AI 品鑑筆記 (特殊框架與字體) */}
  {note.aiResultNote && (
    <div className={cn(
      "relative p-6 rounded-[2rem] border transition-all shadow-xl overflow-hidden mb-4",
      note.activeBrain === 'left' 
        ? "bg-blue-500/10 border-blue-500/30" 
        : "bg-rose-500/10 border-rose-500/30"
    )}>
      {/* 裝飾性背光效果 */}
      <div className={cn(
        "absolute -top-10 -right-10 w-32 h-32 blur-[50px] rounded-full opacity-20",
        note.activeBrain === 'left' ? "bg-blue-500" : "bg-rose-500"
      )} />
      
      <div className="flex items-center gap-2 mb-3 relative z-10">
        {note.activeBrain === 'left' ? (
          <BrainCircuit size={14} className="text-blue-400" />
        ) : (
          <Palette size={14} className="text-rose-400" />
        )}
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70">
          AI {note.activeBrain === 'left' ? '理性分析' : '感性想像'}修飾
        </span>
      </div>
      
      {/* 使用 font-serif 增加專業評論感 */}
      <p className="text-[14px] leading-relaxed font-serif italic relative z-10 px-2 text-foreground">
        「{note.aiResultNote}」
      </p>
    </div>
  )}

  {/* 2. 下方：作者原始筆記 */}
  <div className="dark-glass rounded-[1.5rem] p-5">
    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">
      作者原始筆記
    </p>
    <p className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
      {/* 優先顯示新欄位，若無則顯示舊有的 description */}
      {note.userDescription || note.description || "未提供詳細描述"}
    </p>
  </div>

  {/* 風格標籤區塊 */}
  {note.styleTags && note.styleTags.length > 0 && (
    <div className="pt-4 border-t border-white/5">
      <div className="flex items-center gap-2 mb-2 text-primary">
        <Tag className="w-3 h-3" />
        <span className="text-[9px] font-bold uppercase tracking-widest">風格標籤</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {note.styleTags.map(tag => (
          <Badge key={tag} variant="secondary" className="text-[9px] h-5 px-2 bg-primary/10 text-primary border-primary/20 font-bold uppercase tracking-widest">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  )}

  {/* 餐搭資訊 */}
  {note.foodPairings && note.foodPairings.length > 0 && (
    <div className="pt-4 border-t border-white/5">
      <div className="flex items-center gap-2 mb-3 text-primary">
        <span className="text-sm">🍽</span>
        <span className="text-[9px] font-bold uppercase tracking-widest">餐搭建議</span>
      </div>
      <div className="flex flex-col gap-2">
        {note.foodPairings.map((fp, idx) => (
          <div key={idx} className="flex items-start gap-3 dark-glass rounded-xl px-3 py-2 border border-white/5">
            <span className={cn(
              "shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 mt-0.5",
              fp.pairing === 'yes'
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
            )}>
              {fp.pairing === 'yes' ? '搭配' : '不搭'}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-foreground leading-snug">{fp.food}</p>
              {fp.reason && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{fp.reason}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</div>

        {/* 風味演變 section — only shown if there are extra sessions */}
        {note.sessions && note.sessions.length > 0 ? (
          <section className="mt-6 space-y-4 border-t border-primary/10 pt-6">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="w-4 h-4" />
              <h2 className="text-sm font-headline font-bold uppercase tracking-widest gold-glow">風味演變</h2>
            </div>

            {/* Timeline of sessions */}
            {note.sessions && note.sessions.length > 0 && (
              <div className="space-y-3">
                {/* Session 0 = original */}
                <div className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                    <div className="w-px flex-1 bg-primary/20 mt-1" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-1">開瓶品飲</p>
                    <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      <span>甜 {note.sweetnessRating}</span>
                      <span>酸 {note.acidityRating}</span>
                      <span>苦 {note.bitternessRating}</span>
                      <span>旨 {note.umamiRating}</span>
                      <span>澀 {note.astringencyRating}</span>
                      <span className="text-primary font-bold">綜合 {note.overallRating}/10</span>
                    </div>
                    {note.userDescription && <p className="text-[10px] text-foreground/70 mt-1 line-clamp-2">{note.userDescription}</p>}
                  </div>
                </div>
                {note.sessions.map((s, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
                      {i < (note.sessions?.length ?? 0) - 1 && <div className="w-px flex-1 bg-primary/20 mt-1" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400">{s.label}</p>
                        <span className="text-[8px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2 h-2" />{new Date(s.timestamp).toLocaleDateString('zh-TW')}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        <span>甜 {s.sweetness}</span>
                        <span>酸 {s.acidity}</span>
                        <span>苦 {s.bitterness}</span>
                        <span>旨 {s.umami}</span>
                        <span>澀 {s.astringency}</span>
                        <span className="text-amber-400 font-bold">綜合 {s.overallRating}/10</span>
                      </div>
                      {s.userDescription && <p className="text-[10px] text-foreground/70 mt-1 line-clamp-2">{s.userDescription}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Evolution note — editable by author */}
            {user?.uid === note.userId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Edit3 className="w-3 h-3" /> 風味演變筆記
                  </p>
                  <div className="flex gap-2">
                    {note.sessions && note.sessions.length > 0 && (
                      <Button
                        variant="outline" size="sm"
                        onClick={generateEvolutionSummary}
                        disabled={isGeneratingEvolution}
                        className="h-7 rounded-full text-[9px] font-bold border-primary/40 text-primary bg-primary/5 hover:bg-primary/20"
                      >
                        {isGeneratingEvolution ? <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> : <Sparkles className="w-2.5 h-2.5 mr-1" />}
                        AI 生成總結
                      </Button>
                    )}
                    <Button
                      variant="outline" size="sm"
                      onClick={saveEvolutionNote}
                      className="h-7 rounded-full text-[9px] font-bold border-primary/40 text-primary bg-primary/5 hover:bg-primary/20"
                    >
                      儲存
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder="記錄這款酒開瓶後的風味變化歷程..."
                  value={evolutionNoteText}
                  onChange={e => setEvolutionNoteText(e.target.value)}
                  className="bg-white/5 border-primary/20 rounded-xl min-h-[80px] text-xs"
                />
              </div>
            )}

            {/* Show saved evolution note for non-authors */}
            {user?.uid !== note.userId && note.evolutionNote && (
              <div className="dark-glass rounded-[1.5rem] p-5 space-y-2">
                <p className="text-[8px] font-bold text-primary uppercase tracking-[0.2em]">作者風味演變分析</p>
                <p className="text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{note.evolutionNote}</p>
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-6 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <MessageSquare className="w-4 h-4" />
            <h2 className="text-sm font-headline font-bold uppercase tracking-widest gold-glow">社群交流 ({comments?.length || 0})</h2>
          </div>
          <div className="dark-glass p-4 rounded-2xl border border-white/10 space-y-3">
            {!profile?.username ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest italic">設定名稱後即可留言</p>
                <Button onClick={() => router.push('/profile')} variant="outline" size="sm" className="rounded-full h-8 text-[10px] uppercase font-bold">設定名稱</Button>
              </div>
            ) : (
              <>
                <Textarea placeholder="分享您的想法..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="bg-white/5 border-white/10 rounded-xl min-h-[60px] p-2 text-sm" />
                <div className="flex justify-end">
                  <Button onClick={handleAddComment} disabled={isSubmitting || !commentText.trim()} className="rounded-full px-4 h-8 text-[10px] uppercase font-bold">發布評論</Button>
                </div>
              </>
            )}
          </div>
          <div className="space-y-3">
            {comments?.map((comment) => (
              <div key={comment.id} className="dark-glass p-4 rounded-xl border border-white/5 space-y-2">
                <p className="text-foreground/90 text-sm leading-relaxed">{comment.text}</p>
                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <Link href={`/users/${comment.userId}`} className="flex items-center gap-1.5 text-primary font-bold text-xs hover:underline">
                    <span>@{comment.username}</span>
                    <UserBadge userId={comment.userId} />
                  </Link>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold">{new Date(comment.createdAt).toLocaleString('zh-TW')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  </div>
</div>
  );
}

