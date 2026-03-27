'use client'

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SakeNote } from '@/lib/types';
import { SakeNoteCard } from '@/components/SakeNoteCard';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Sparkles, Clock, Star } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';

function SakeDetailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const brand = params.get('brand') || '';
  const brewery = params.get('brewery') || '';
  const firestore = useFirestore();

  const [sortMode, setSortMode] = useState<'newest' | 'score'>('newest');
  const [summary, setSummary] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryFetched, setSummaryFetched] = useState(false);

  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !brand) return null;
    return query(collection(firestore, 'sakeTastingNotes'), where('brandName', '==', brand));
  }, [firestore, brand]);

  const { data: allNotes, isLoading } = useCollection<SakeNote>(notesQuery);

  const filteredNotes = React.useMemo(() => {
    if (!allNotes) return [];
    return allNotes.filter(n => n.brewery === brewery);
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
    if (summaryFetched || filteredNotes.length === 0) return;
    setSummaryFetched(true);
    setIsSummaryLoading(true);
    fetch('/api/ai/sake-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: brand,
        brewery,
        notes: filteredNotes.map(n => ({
          overallRating: n.overallRating,
          description: n.description || n.aiResultNote || '',
          tags: n.styleTags || [],
        })),
      }),
    })
      .then(r => r.json())
      .then(data => { if (data.text) setSummary(data.text); })
      .catch(() => {})
      .finally(() => setIsSummaryLoading(false));
  }, [filteredNotes, summaryFetched, brand, brewery]);

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
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">AI 綜合評語</span>
            </div>
            {isSummaryLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-[10px] text-muted-foreground">生成中...</span>
              </div>
            ) : summary ? (
              <p className="text-xs leading-relaxed text-foreground/90">{summary}</p>
            ) : !isLoading && filteredNotes.length > 0 ? (
              <p className="text-[10px] text-muted-foreground">尚無評語</p>
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
