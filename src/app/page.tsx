
"use client"

import React, { useState } from 'react';
import { SakeNote } from '@/lib/types';
import { SakeNoteCard } from '@/components/SakeNoteCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, User, Trophy, Flame, Loader2, KeyRound, Users } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCollection, useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState("latest");

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const latestNotesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sakeTastingNotes'), orderBy('tastingDate', 'desc'), limit(10));
  }, [firestore]);
  const { data: latestNotes, isLoading: isNotesLoading } = useCollection<SakeNote>(latestNotesQuery);

  const followingQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'following');
  }, [firestore, user]);
  const { data: followingDocs } = useCollection(followingQuery);
  const followingIds = followingDocs?.map(d => d.id) || [];

  const followingNotes = React.useMemo(() => {
    if (!latestNotes || followingIds.length === 0) return [];
    return latestNotes.filter(note => followingIds.includes(note.userId));
  }, [latestNotes, followingIds]);

  const rankingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sakeTastingNotes'), orderBy('overallRating', 'desc'), limit(200));
  }, [firestore]);
  const { data: rankingNotes } = useCollection<SakeNote>(rankingQuery);

  const top3Groups = React.useMemo(() => {
    if (!rankingNotes) return [];
    const map = new Map<string, { brandName: string; brewery: string; notes: SakeNote[]; imageUrl?: string }>();
    for (const note of rankingNotes) {
      const key = `${note.brandName}|||${note.brewery}`;
      if (!map.has(key)) map.set(key, { brandName: note.brandName, brewery: note.brewery, notes: [] });
      const g = map.get(key)!;
      g.notes.push(note);
      if (!g.imageUrl && note.imageUrls?.[0]) g.imageUrl = note.imageUrls[0];
    }
    return [...map.values()]
      .map(g => ({ ...g, avgRating: g.notes.reduce((s, n) => s + n.overallRating, 0) / g.notes.length }))
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 3);
  }, [rankingNotes]);

  if (isUserLoading || isProfileLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center notebook-texture font-body">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse font-bold tracking-widest uppercase text-xs">載入中...</p>
      </div>
    );
  }

  const isFormalUser = user && !user.isAnonymous;

  return (
    <div className="min-h-screen notebook-texture pb-32 font-body">
      <nav className="sticky top-0 z-50 dark-glass border-b border-white/5 px-6 py-4 flex justify-between items-center gap-4">
        <h1 className="text-base sm:text-xl font-headline font-bold text-primary gold-glow tracking-widest break-words flex-1 leading-tight">
          {profile?.username ? `${profile.username} 的品飲筆記` : "品飲筆記"}
        </h1>
        <div className="flex items-center gap-3 shrink-0">
          {!isFormalUser && !profile?.username && (
             <Link href="/recover">
               <Button variant="ghost" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary border border-white/10 h-10 px-4">
                 <KeyRound className="w-3 h-3 mr-1" /> 找回帳戶
               </Button>
             </Link>
          )}
          <Link href="/profile" className="flex items-center gap-4 group">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                {profile?.username || (isFormalUser ? "恢復身分中..." : "愛好者")}
              </p>
              <p className="text-[10px] text-primary/60 group-hover:text-primary transition-colors tracking-widest uppercase font-bold">
                個人資料
              </p>
            </div>
            <Avatar className="w-10 h-10 border-2 border-primary/20 group-hover:border-primary transition-all shadow-lg">
              <AvatarImage src={profile?.avatarUrl || `https://picsum.photos/seed/${user?.uid}/100/100`} />
              <AvatarFallback className="bg-muted"><User className="w-5 h-5" /></AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        {top3Groups.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-accent">
              <Trophy className="w-5 h-5" />
              <h2 className="text-base sm:text-lg font-headline font-bold uppercase tracking-widest">銘柄殿堂 Top 3</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-6">
              {top3Groups.map((group, idx) => (
                <Link key={`${group.brandName}-${group.brewery}`} href={`/sake?brand=${encodeURIComponent(group.brandName)}&brewery=${encodeURIComponent(group.brewery)}`}>
                  <div className="relative group overflow-hidden rounded-xl sm:rounded-2xl aspect-[4/5] dark-glass border border-white/10 hover:border-primary/50 transition-all">
                    <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 bg-accent text-accent-foreground font-bold rounded-full w-5 h-5 sm:w-8 sm:h-8 flex items-center justify-center shadow-lg text-[10px] sm:text-sm">
                      {idx + 1}
                    </div>
                    {group.imageUrl && (
                      <img src={group.imageUrl} alt={group.brandName} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-6 bg-gradient-to-t from-black via-black/60 to-transparent">
                      <p className="text-primary font-bold text-[10px] sm:text-xs uppercase mb-1 break-words leading-tight">{group.brewery}</p>
                      <h3 className="text-xs sm:text-xl font-headline font-bold mb-1 break-words leading-tight">{group.brandName}</h3>
                      <div className="flex items-center gap-1 text-accent">
                        <span className="text-sm sm:text-2xl font-bold">{group.avgRating.toFixed(1)}</span>
                        <span className="text-[10px] opacity-60">/ 10</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{group.notes.length} 篇</div>
                    </div>
                  </div>
                </Link>
              ))}
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
              {isNotesLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {latestNotes?.map(note => (
                    <SakeNoteCard key={note.id} note={note} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="following" className="mt-0">
              {followingIds.length === 0 ? (
                <div className="text-center py-32 dark-glass rounded-3xl border border-dashed border-white/10 space-y-4">
                  <Users className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">目前尚未追蹤任何作者</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {followingNotes.map(note => (
                    <SakeNoteCard key={note.id} note={note} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <Link href="/notes/new">
          <Button size="lg" className="h-16 w-16 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] hover:scale-110 transition-all p-0">
            <Plus className="w-8 h-8" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
