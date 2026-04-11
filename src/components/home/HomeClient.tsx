"use client"

import React, { useState, useEffect, useRef } from 'react';
import { SakeNote } from '@/lib/types';
import { SakeNoteCard } from '@/components/SakeNoteCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, User, Trophy, Flame, Loader2, KeyRound, Users, ChevronRight, ChevronLeft, FileText, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCollection, useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { AuthBootstrapSnapshot } from '@/lib/auth-bootstrap';
import { formatSakeDisplayName } from '@/lib/utils';

type Top3Group = {
  brandName: string;
  subBrand?: string;
  brewery: string;
  avgRating: number;
  noteCount: number;
  imageUrl?: string;
};

export function HomeClient({
  initialAuthBootstrap,
  initialLatestNotes,
  initialTop3Groups,
}: {
  initialAuthBootstrap: AuthBootstrapSnapshot | null;
  initialLatestNotes: SakeNote[];
  initialTop3Groups: Top3Group[];
}) {
  const { user, isUserLoading, authBootstrap } = useUser();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState("latest");
  const PAGE_SIZE = 10;
  const INITIAL_NOTES_LIMIT = 20;
  const INITIAL_RANKING_LIMIT = 24;
  const [latestPage, setLatestPage] = useState(0);
  const [followingPage, setFollowingPage] = useState(0);
  const router = useRouter();
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [drafts, setDrafts] = useState<Array<{id: string; brandName: string; savedAt: string}>>([]);

  const [cachedAvatar, setCachedAvatar] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('cached_avatar') || initialAuthBootstrap?.avatarUrl || null : initialAuthBootstrap?.avatarUrl || null
  );
  const [cachedUsername, setCachedUsername] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('cached_username') || initialAuthBootstrap?.username || null : initialAuthBootstrap?.username || null
  );
  const [cachedLatestNotes, setCachedLatestNotes] = useState<SakeNote[] | null>(() => {
    if (initialLatestNotes.length > 0) return initialLatestNotes;
    if (typeof window === 'undefined') return initialLatestNotes;
    try {
      return JSON.parse(localStorage.getItem('home_latest_notes_snapshot') || 'null') || initialLatestNotes;
    } catch {
      return initialLatestNotes;
    }
  });
  const [cachedTop3Groups, setCachedTop3Groups] = useState<Top3Group[]>(() => {
    if (initialTop3Groups.length > 0) return initialTop3Groups;
    if (typeof window === 'undefined') return initialTop3Groups;
    try {
      const stored = JSON.parse(localStorage.getItem('home_top3_snapshot') || '[]');
      return stored.length ? stored : initialTop3Groups;
    } catch {
      return initialTop3Groups;
    }
  });

  const loadDrafts = React.useCallback(() => {
    try {
      const oldRaw = localStorage.getItem('sake_note_draft');
      if (oldRaw) {
        const old = JSON.parse(oldRaw);
        const existing: Record<string, unknown>[] = JSON.parse(localStorage.getItem('sake_note_drafts') || '[]');
        existing.unshift({ ...old, id: old.id || Date.now().toString() });
        localStorage.setItem('sake_note_drafts', JSON.stringify(existing));
        localStorage.removeItem('sake_note_draft');
      }
      const raw = localStorage.getItem('sake_note_drafts');
      if (raw) {
        const arr = JSON.parse(raw);
        setDrafts(arr.map((d: Record<string, unknown>) => ({ id: d.id as string, brandName: (d.brandName as string) || '未命名草稿', savedAt: (d.savedAt as string) || '' })));
      } else {
        setDrafts([]);
      }
    } catch {
      setDrafts([]);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
    window.addEventListener('focus', loadDrafts);
    return () => window.removeEventListener('focus', loadDrafts);
  }, [loadDrafts]);

  const deleteDraft = (id: string) => {
    try {
      const raw = localStorage.getItem('sake_note_drafts');
      const arr: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
      const updated = arr.filter(d => d.id !== id);
      localStorage.setItem('sake_note_drafts', JSON.stringify(updated));
      setDrafts(prev => {
        const next = prev.filter(d => d.id !== id);
        if (next.length === 0) setShowDraftPicker(false);
        return next;
      });
    } catch {}
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const reminders: Array<{ noteId: string; brandName: string; subBrand?: string; nextReminderAt: string; intervalHours: number }> =
        JSON.parse(localStorage.getItem('sake_reminders') || '[]');
      if (reminders.length === 0) return;
      const now = Date.now();
      const remaining = reminders.filter(r => {
        if (new Date(r.nextReminderAt).getTime() <= now) {
          if (Notification.permission === 'granted') {
            const n = new Notification(`🍶 品飲提醒：${formatSakeDisplayName(r.brandName, r.subBrand)}`, {
              body: '是時候再次品飲並記錄風味變化了！',
              icon: '/favicon.ico',
            });
            n.onclick = () => {
              window.focus();
              window.location.href = `/notes/${r.noteId}/edit`;
            };
          }
          return false;
        }
        return true;
      });
      localStorage.setItem('sake_reminders', JSON.stringify(remaining));
    } catch {}
  }, []);

  const formatDraftAge = (iso: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '剛剛';
    if (mins < 60) return `${mins} 分鐘前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} 小時前`;
    return `${Math.floor(hrs / 24)} 天前`;
  };

  const handleNewNoteClick = () => {
    if (drafts.length > 0) {
      setShowDraftPicker(true);
    } else {
      router.push('/notes/new');
    }
  };

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile } = useDoc(userDocRef);

  React.useEffect(() => {
    if (profile?.avatarUrl) {
      localStorage.setItem('cached_avatar', profile.avatarUrl);
      setCachedAvatar(profile.avatarUrl);
    }
    if (profile?.username) {
      localStorage.setItem('cached_username', profile.username);
      setCachedUsername(profile.username);
    }
  }, [profile?.avatarUrl, profile?.username]);

  React.useEffect(() => {
    if (isUserLoading) return;

    const shouldClearCachedIdentity = !!user?.isAnonymous
      || (!user && !!authBootstrap?.isAnonymous)
      || (!user && !authBootstrap && !!initialAuthBootstrap?.isAnonymous)
      || (!user && !authBootstrap && !initialAuthBootstrap);

    if (!shouldClearCachedIdentity) return;

    setCachedAvatar(null);
    setCachedUsername(null);
    try {
      localStorage.removeItem('cached_avatar');
      localStorage.removeItem('cached_username');
    } catch {
      // ignore storage cleanup failures
    }
  }, [authBootstrap?.isAnonymous, initialAuthBootstrap?.isAnonymous, isUserLoading, user]);

  const latestNotesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sakeTastingNotes'), orderBy('tastingDate', 'desc'), limit(INITIAL_NOTES_LIMIT));
  }, [firestore]);
  const { data: latestNotes, metadata: latestNotesMetadata } = useCollection<SakeNote>(latestNotesQuery);
  const shouldHoldSsrLatestNotes = initialLatestNotes.length > 0 && !!latestNotesMetadata?.fromCache;
  const displayedLatestNotes = shouldHoldSsrLatestNotes
    ? initialLatestNotes
    : (latestNotes ?? cachedLatestNotes ?? initialLatestNotes);

  useEffect(() => {
    if (!latestNotes || (initialLatestNotes.length > 0 && latestNotesMetadata?.fromCache)) return;
    setCachedLatestNotes(latestNotes);
    try {
      localStorage.setItem('home_latest_notes_snapshot', JSON.stringify(latestNotes));
    } catch {}
  }, [initialLatestNotes.length, latestNotes, latestNotesMetadata?.fromCache]);

  const followingQuery = useMemoFirebase(() => {
    if (!firestore || !user || activeTab !== 'following') return null;
    return collection(firestore, 'users', user.uid, 'following');
  }, [firestore, user, activeTab]);
  const { data: followingDocs } = useCollection(followingQuery);
  const followingIds = followingDocs?.map(d => d.id) || [];

  const followingNotes = React.useMemo(() => {
    if (!displayedLatestNotes || followingIds.length === 0) return [];
    return displayedLatestNotes.filter(note => followingIds.includes(note.userId));
  }, [displayedLatestNotes, followingIds]);

  const top3CacheRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'meta', 'top3');
  }, [firestore]);
  const { data: top3Cache } = useDoc(top3CacheRef);
  const top3Written = useRef(false);

  const rankingQuery = useMemoFirebase(() => {
    if (!firestore || (top3Cache?.groups?.length || cachedTop3Groups.length > 0 || initialTop3Groups.length > 0)) return null;
    return query(collection(firestore, 'sakeTastingNotes'), orderBy('overallRating', 'desc'), limit(INITIAL_RANKING_LIMIT));
  }, [firestore, top3Cache?.groups?.length, cachedTop3Groups.length, initialTop3Groups.length]);
  const { data: rankingNotes } = useCollection<SakeNote>(rankingQuery);

  const top3Groups = React.useMemo(() => {
    if (rankingNotes) {
      const map = new Map<string, { brandName: string; subBrand?: string; brewery: string; notes: SakeNote[] }>();
      for (const note of rankingNotes) {
        if (!note.brandName) continue;
        const key = `${note.brandName}|||${note.subBrand || ''}|||${note.brewery}`;
        if (!map.has(key)) map.set(key, { brandName: note.brandName, subBrand: note.subBrand || '', brewery: note.brewery, notes: [] });
        map.get(key)!.notes.push(note);
      }
      return [...map.values()]
        .map(g => {
          const bestRatings = g.notes.map(n => {
            const sessionMax = n.sessions?.length ? Math.max(...n.sessions.map(s => s.overallRating)) : 0;
            return Math.max(n.overallRating, sessionMax);
          });
          const avgRating = bestRatings.reduce((s, r) => s + r, 0) / g.notes.length;
          const byLikes = [...g.notes].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
          const byDate = [...g.notes].sort((a, b) => (b.tastingDate || '').localeCompare(a.tastingDate || ''));
          const imageUrl = (byLikes.find(n => n.imageUrls?.[0]) || byDate.find(n => n.imageUrls?.[0]))?.imageUrls?.[0];
          return { brandName: g.brandName, subBrand: g.subBrand || '', brewery: g.brewery, avgRating, noteCount: g.notes.length, imageUrl };
        })
        .sort((a, b) => b.avgRating - a.avgRating)
        .slice(0, 3);
    }
    if (top3Cache?.groups?.length) return top3Cache.groups as Top3Group[];
    return [];
  }, [rankingNotes, top3Cache]);
  const displayedTop3Groups = top3Groups.length > 0 ? top3Groups : (cachedTop3Groups.length > 0 ? cachedTop3Groups : initialTop3Groups);

  useEffect(() => {
    if (!top3Groups.length) return;
    setCachedTop3Groups(top3Groups);
    try {
      localStorage.setItem('home_top3_snapshot', JSON.stringify(top3Groups));
    } catch {}
  }, [top3Groups]);

  const effectiveBootstrap = authBootstrap ?? initialAuthBootstrap;
  const isFormalUser = user ? !user.isAnonymous : !!effectiveBootstrap && !effectiveBootstrap.isAnonymous;
  const displayUsername = profile?.username
    || (isFormalUser ? cachedUsername : null)
    || (effectiveBootstrap?.isAnonymous ? null : effectiveBootstrap?.username)
    || null;
  const displayAvatar = profile?.avatarUrl || cachedAvatar || effectiveBootstrap?.avatarUrl || (user?.uid || effectiveBootstrap?.uid ? `https://picsum.photos/seed/${user?.uid || effectiveBootstrap?.uid}/100/100` : undefined);
  const isResolvingIdentity = isUserLoading && !!effectiveBootstrap;

  return (
    <div className="min-h-screen notebook-texture pb-32 font-body">
      <nav className="sticky top-0 z-50 dark-glass border-b border-white/5 px-6 py-4 flex justify-between items-center gap-4">
        <h1 className="text-base sm:text-xl font-headline font-bold text-primary gold-glow tracking-widest break-words flex-1 leading-tight">
          {displayUsername ? `${displayUsername} 的品飲筆記` : "品飲筆記"}
        </h1>
        <div className="flex items-center gap-3 shrink-0">
          {!isFormalUser && !displayUsername && !isResolvingIdentity && !isUserLoading && (
             <Link href="/recover">
               <Button variant="ghost" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary border border-white/10 h-10 px-4">
                 <KeyRound className="w-3 h-3 mr-1" /> 找回帳戶
               </Button>
             </Link>
          )}
          <Link href="/profile" className="flex items-center gap-4 group">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                {displayUsername || (isResolvingIdentity || isUserLoading ? "恢復身分中..." : isFormalUser ? "已登入" : "愛好者")}
              </p>
              <p className="text-[10px] text-primary/60 group-hover:text-primary transition-colors tracking-widest uppercase font-bold">
                個人資料
              </p>
            </div>
            <Avatar className="w-10 h-10 border-2 border-primary/20 group-hover:border-primary transition-all shadow-lg">
              <AvatarImage src={displayAvatar} />
              <AvatarFallback className="bg-muted"><User className="w-5 h-5" /></AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        {displayedTop3Groups.length > 0 ? (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent">
                <Trophy className="w-5 h-5" />
                <h2 className="text-base sm:text-lg font-headline font-bold uppercase tracking-widest">銘柄殿堂 Top 3</h2>
              </div>
              <Link href="/rankings" className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">
                更多 <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-6">
              {displayedTop3Groups.map((group, idx) => {
                const displayName = formatSakeDisplayName(group.brandName, group.subBrand);

                return <Link key={`${group.brandName}-${group.subBrand || ''}-${group.brewery}`} href={`/sake?brand=${encodeURIComponent(group.brandName)}&brewery=${encodeURIComponent(group.brewery)}`}>
                  <div className="relative group overflow-hidden rounded-xl sm:rounded-2xl aspect-[4/5] dark-glass border border-white/10 hover:border-primary/50 transition-all">
                    <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 bg-accent text-accent-foreground font-bold rounded-full w-5 h-5 sm:w-8 sm:h-8 flex items-center justify-center shadow-lg text-[10px] sm:text-sm">
                      {idx + 1}
                    </div>
                    {group.imageUrl && (
                      <img src={group.imageUrl} alt={displayName} loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-6 bg-gradient-to-t from-black via-black/60 to-transparent">
                      <p className="text-white/70 font-bold text-[10px] sm:text-xs uppercase mb-1 break-words leading-tight">{group.brewery}</p>
                      <h3 className="text-white text-xs sm:text-xl font-headline font-bold mb-1 break-words leading-tight">{displayName}</h3>
                      <div className="flex items-center gap-1 text-amber-400">
                        <span className="text-sm sm:text-2xl font-bold">{group.avgRating.toFixed(1)}</span>
                        <span className="text-[10px] opacity-60">/ 10</span>
                      </div>
                      <div className="text-[9px] text-white/50 mt-0.5">{group.noteCount ?? 0} 篇</div>
                    </div>
                  </div>
                </Link>;
              })}
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <Trophy className="w-5 h-5" />
              <h2 className="text-base sm:text-lg font-headline font-bold uppercase tracking-widest">銘柄殿堂 Top 3</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-6">
              {[0, 1, 2].map(i => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}
            </div>
          </section>
        )}

        <section className="space-y-6">
          <Tabs defaultValue="latest" className="w-full" onValueChange={setActiveTab}>
            <div className="flex items-center justify-between mb-6">
              <TabsList className="bg-white/5 border border-white/10 rounded-full p-1 h-12">
                <TabsTrigger value="latest" className="rounded-full px-6 text-[10px] font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                  <Flame className="w-3 h-3 mr-2" /> 最新動態
                </TabsTrigger>
                <TabsTrigger value="following" className="rounded-full px-6 text-[10px] font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                  <Users className="w-3 h-3 mr-2" /> 追蹤中
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="latest" className="mt-0">
              {displayedLatestNotes && displayedLatestNotes.length > 0 ? (() => {
                const total = displayedLatestNotes.length;
                const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
                const pageNotes = displayedLatestNotes.slice(latestPage * PAGE_SIZE, (latestPage + 1) * PAGE_SIZE);
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {pageNotes.map(note => (
                        <SakeNoteCard key={note.id} note={note} />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-4 pt-6">
                        <Button variant="ghost" size="sm" onClick={() => setLatestPage(p => Math.max(0, p - 1))} disabled={latestPage === 0} className="rounded-full border border-white/10 text-[11px] font-bold uppercase tracking-widest h-9 px-5 disabled:opacity-30">
                          <ChevronLeft className="w-3.5 h-3.5 mr-1" /> 上一頁
                        </Button>
                        <span className="text-[11px] text-muted-foreground font-bold tabular-nums">{latestPage + 1} / {totalPages}</span>
                        <Button variant="ghost" size="sm" onClick={() => setLatestPage(p => Math.min(totalPages - 1, p + 1))} disabled={latestPage >= totalPages - 1} className="rounded-full border border-white/10 text-[11px] font-bold uppercase tracking-widest h-9 px-5 disabled:opacity-30">
                          下一頁 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </div>
                    )}
                  </>
                );
              })() : (
                <div className="grid grid-cols-2 gap-3">
                  {[0,1,2,3].map(i => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="following" className="mt-0">
              {isUserLoading ? (
                <div className="text-center py-32 dark-glass rounded-3xl border border-dashed border-white/10 space-y-4">
                  <Loader2 className="w-10 h-10 text-primary/30 mx-auto animate-spin" />
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">正在確認追蹤清單...</p>
                </div>
              ) : followingIds.length === 0 ? (
                <div className="text-center py-32 dark-glass rounded-3xl border border-dashed border-white/10 space-y-4">
                  <Users className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">目前尚未追蹤任何作者</p>
                </div>
              ) : (() => {
                const total = followingNotes.length;
                const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
                const pageNotes = followingNotes.slice(followingPage * PAGE_SIZE, (followingPage + 1) * PAGE_SIZE);
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {pageNotes.map(note => (
                        <SakeNoteCard key={note.id} note={note} />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-4 pt-6">
                        <Button variant="ghost" size="sm" onClick={() => setFollowingPage(p => Math.max(0, p - 1))} disabled={followingPage === 0} className="rounded-full border border-white/10 text-[11px] font-bold uppercase tracking-widest h-9 px-5 disabled:opacity-30">
                          <ChevronLeft className="w-3.5 h-3.5 mr-1" /> 上一頁
                        </Button>
                        <span className="text-[11px] text-muted-foreground font-bold tabular-nums">{followingPage + 1} / {totalPages}</span>
                        <Button variant="ghost" size="sm" onClick={() => setFollowingPage(p => Math.min(totalPages - 1, p + 1))} disabled={followingPage >= totalPages - 1} className="rounded-full border border-white/10 text-[11px] font-bold uppercase tracking-widest h-9 px-5 disabled:opacity-30">
                          下一頁 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <Button size="lg" onClick={handleNewNoteClick} className="h-16 w-16 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] hover:scale-110 transition-all p-0">
          <Plus className="w-8 h-8" />
        </Button>
      </div>

      {showDraftPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowDraftPicker(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#18181b] border border-white/10 rounded-t-[2rem] p-6 pb-12 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">新增筆記</p>
            <button type="button" onClick={() => { setShowDraftPicker(false); router.push('/notes/new'); }} className="w-full flex items-center gap-3 p-4 rounded-[1.2rem] bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all mb-4">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">新增空白筆記</div>
                <div className="text-[9px] text-white/50">建立新的品飲筆記</div>
              </div>
            </button>
            {drafts.length > 0 && (
              <>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2 ml-1">草稿列表 ({drafts.length})</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {drafts.map(d => (
                    <div key={d.id} className="flex items-center gap-2 p-3 rounded-[1rem] bg-white/5 border border-white/10 hover:border-primary/30 transition-all">
                      <button type="button" onClick={() => { setShowDraftPicker(false); router.push(`/notes/new?draft=${d.id}`); }} className="flex-1 flex items-center gap-3 text-left min-w-0">
                        <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{d.brandName}</div>
                          <div className="text-[9px] text-white/40">{formatDraftAge(d.savedAt)}</div>
                        </div>
                      </button>
                      <button type="button" onClick={() => deleteDraft(d.id)} className="p-1.5 rounded-full text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}