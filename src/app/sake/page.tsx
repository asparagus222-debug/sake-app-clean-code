'use client'

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SakeNote } from '@/lib/types';
import { SakeNoteCard } from '@/components/SakeNoteCard';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Sparkles, Clock, Star, Info } from 'lucide-react';
import { isPublicPublishedNote } from '@/lib/note-lifecycle';
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, getDoc, query, where } from 'firebase/firestore';
import { authorizedJsonFetch } from '@/lib/authorized-fetch';
import { cn } from '@/lib/utils';

function SakeDetailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const brand = params.get('brand') || '';
  const brewery = params.get('brewery') || '';
  const firestore = useFirestore();
  const auth = useAuth();

  const [sortMode, setSortMode] = useState<'newest' | 'score'>('newest');
  const [intro, setIntro] = useState('');
  const [isIntroLoading, setIsIntroLoading] = useState(false);
  const [introFetched, setIntroFetched] = useState(false);
  const [introRequested, setIntroRequested] = useState(false);

  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !brand) return null;
    return query(
      collection(firestore, 'sakeTastingNotes'),
      where('brandName', '==', brand)
    );
  }, [firestore, brand]);

  const { data: allNotes, isLoading } = useCollection<SakeNote>(notesQuery);

  const filteredNotes = React.useMemo(() => {
    if (!allNotes) return [];
    return allNotes.filter(n => n.brewery === brewery && isPublicPublishedNote(n));
  }, [allNotes, brewery]);

  const sortedNotes = React.useMemo(() => {
    const arr = [...filteredNotes];
    if (sortMode === 'newest') {
      return arr.sort((a, b) => (b.tastingDate || b.createdAt || '').localeCompare(a.tastingDate || a.createdAt || ''));
    }
    return arr.sort((a, b) => b.overallRating - a.overallRating);
  }, [filteredNotes, sortMode]);

  const avgRating = filteredNotes.length > 0
    ? filteredNotes.reduce((s, n) => s + n.overallRating, 0) / filteredNotes.length
    : 0;

  useEffect(() => {
    if (introFetched || !brewery || !firestore) return;
    setIntroFetched(true);
    setIsIntroLoading(true);

    // key: sanitise brewery name for use as Firestore document ID
    const breweryKey = brewery.replace(/[/\\#%?]/g, '_').slice(0, 200);
    const introRef = doc(firestore, 'breweryIntros', breweryKey);

    (async () => {
      try {
        const snap = await getDoc(introRef);
        if (snap.exists()) {
          setIntro(snap.data().intro as string);
        } else if (auth?.currentUser) {
          const res = await authorizedJsonFetch(auth, '/api/brewery-intros/request', {
            method: 'POST',
            body: JSON.stringify({ brewery }),
          });
          if (res.ok) {
            const data = await res.json();
            setIntroRequested(data.requested === true);
          }
        }
      } catch {
        // silent fail
      } finally {
        setIsIntroLoading(false);
      }
    })();
  }, [brewery, firestore, introFetched]);

  return (
    <div className="min-h-screen notebook-texture pb-32 font-body">
      <nav className="sticky top-0 z-50 dark-glass border-b border-white/5 px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-primary/10 text-primary shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-headline font-bold text-primary gold-glow tracking-widest truncate">{brand}</h1>
          <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest truncate">{brewery}</p>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Stats + AI summary card */}
        <section className="dark-glass rounded-2xl border border-primary/20 p-5 space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <div className="text-4xl font-bold text-accent font-headline">
                {avgRating.toFixed(1)}
                <span className="text-sm text-muted-foreground font-normal"> / 10</span>
              </div>
              <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
                {filteredNotes.length} 篇品飲・綜合平均
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">酒造介紹</span>
            </div>
            {isIntroLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-[10px] text-muted-foreground">讀取酒造資料中...</span>
              </div>
            ) : intro ? (
              <p className="text-xs leading-relaxed text-foreground/90">{intro}</p>
            ) : !isIntroLoading ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-3 text-[10px] text-muted-foreground">
                <div className="mb-1 flex items-center gap-1.5 text-foreground/80">
                  <Info className="h-3 w-3 text-primary" />
                  <span className="font-bold">尚無酒造介紹</span>
                </div>
                <p>{introRequested ? '已記錄此酒造的補充需求，待管理員確認後補齊。' : '此酒造尚未建立介紹資料，待管理員確認後補齊。'}</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* Notes list */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {filteredNotes.length} 篇品飲筆記
            </h2>
            <div className="flex gap-1.5">
              <Button
                type="button" size="sm"
                variant={sortMode === 'newest' ? 'default' : 'ghost'}
                onClick={() => setSortMode('newest')}
                className={cn('h-7 px-3 rounded-full text-[9px] font-bold')}
              >
                <Clock className="w-2.5 h-2.5 mr-1" /> 最新
              </Button>
              <Button
                type="button" size="sm"
                variant={sortMode === 'score' ? 'default' : 'ghost'}
                onClick={() => setSortMode('score')}
                className={cn('h-7 px-3 rounded-full text-[9px] font-bold')}
              >
                <Star className="w-2.5 h-2.5 mr-1" /> 高分
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : sortedNotes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-xs">查無筆記</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedNotes.map(note => <SakeNoteCard key={note.id} note={note} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function SakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center notebook-texture font-body">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <SakeDetailInner />
    </Suspense>
  );
}
