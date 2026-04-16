'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, orderBy, query, where } from 'firebase/firestore';
import { ArrowLeft, BadgeDollarSign, Building2, ChevronLeft, ChevronRight, ClipboardList, Loader2, ShoppingBag, Star, Store, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { ExpoEvent, SakeNote } from '@/lib/types';
import { getExpoBuyIntentClassName, getExpoBuyIntentLabel, getExpoBuyIntentRank, getExpoCpScore, getExpoNoteDisplayName, getSortableExpoCpScore, getSortableExpoPrice } from '@/lib/note-lifecycle';
import { cn } from '@/lib/utils';

type RankingSortMode = 'intent' | 'score' | 'price' | 'cp';

const PAGE_SIZE = 10;

export default function ExpoRankingPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const eventId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [sortMode, setSortMode] = useState<RankingSortMode>('intent');
  const [pageIndex, setPageIndex] = useState(0);

  const eventRef = useMemoFirebase(() => {
    if (!firestore || !eventId) return null;
    return doc(firestore, 'expoEvents', eventId);
  }, [firestore, eventId]);
  const { data: event, isLoading: isEventLoading } = useDoc<ExpoEvent>(eventRef);

  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !eventId) return null;
    return query(
      collection(firestore, 'sakeTastingNotes'),
      where('userId', '==', user.uid),
      where('expoMeta.eventId', '==', eventId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user, eventId]);
  const { data: rawNotes, isLoading: isNotesLoading } = useCollection<SakeNote>(notesQuery);

  const rankedNotes = useMemo(() => {
    const notes = [...(rawNotes || [])];
    return notes.sort((left, right) => {
      if (sortMode === 'intent') {
        return getExpoBuyIntentRank(right.expoMeta?.buyIntent) - getExpoBuyIntentRank(left.expoMeta?.buyIntent)
          || right.overallRating - left.overallRating
          || (right.createdAt || '').localeCompare(left.createdAt || '');
      }
      if (sortMode === 'score') {
        return right.overallRating - left.overallRating
          || getExpoBuyIntentRank(right.expoMeta?.buyIntent) - getExpoBuyIntentRank(left.expoMeta?.buyIntent)
          || (right.createdAt || '').localeCompare(left.createdAt || '');
      }
      if (sortMode === 'price') {
        return getSortableExpoPrice(left) - getSortableExpoPrice(right)
          || right.overallRating - left.overallRating
          || (right.createdAt || '').localeCompare(left.createdAt || '');
      }
      return getSortableExpoCpScore(right) - getSortableExpoCpScore(left)
        || right.overallRating - left.overallRating
        || getExpoBuyIntentRank(right.expoMeta?.buyIntent) - getExpoBuyIntentRank(left.expoMeta?.buyIntent)
        || (right.createdAt || '').localeCompare(left.createdAt || '');
    });
  }, [rawNotes, sortMode]);

  const totalPages = Math.max(1, Math.ceil(rankedNotes.length / PAGE_SIZE));
  const currentPageNotes = useMemo(() => {
    const safePageIndex = Math.min(pageIndex, totalPages - 1);
    return rankedNotes.slice(safePageIndex * PAGE_SIZE, (safePageIndex + 1) * PAGE_SIZE);
  }, [pageIndex, rankedNotes, totalPages]);

  React.useEffect(() => {
    setPageIndex(0);
  }, [sortMode]);

  React.useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  if (isUserLoading || isEventLoading) {
    return (
      <div className="min-h-screen notebook-texture flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !event) {
    return (
      <div className="min-h-screen notebook-texture px-4 py-10">
        <div className="max-w-xl mx-auto dark-glass rounded-[2rem] border border-white/10 p-6 text-center space-y-4">
          <p className="text-sm text-muted-foreground">找不到這場酒展活動，或目前沒有讀取權限。</p>
          <Button onClick={() => router.push('/expo')} className="rounded-full h-10 px-5 text-xs font-bold uppercase tracking-widest">返回酒展列表</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen notebook-texture px-4 py-8 pb-24 font-body">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button type="button" onClick={() => router.push(`/expo/${eventId}`)} className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70 hover:text-primary transition-colors">
              <ArrowLeft className="w-3 h-3" /> 返回酒展工作台
            </button>
            <h1 className="mt-3 text-2xl font-headline font-bold text-primary tracking-widest uppercase break-words">個人排名打卡頁</h1>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Trophy className="w-3 h-3 text-primary/70" /> {event.name}</span>
              <span className="inline-flex items-center gap-1"><ClipboardList className="w-3 h-3 text-primary/70" /> 每頁 10 名</span>
            </div>
          </div>
          <Link href={`/expo/${eventId}`}>
            <Button variant="outline" className="rounded-full h-10 px-5 text-xs font-bold uppercase tracking-widest">回工作台</Button>
          </Link>
        </div>

        <section className="dark-glass rounded-[2rem] border border-white/10 p-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">Ranking Mode</p>
            <h2 className="text-lg font-bold text-foreground">這場酒展的個人榜單</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'intent', label: '想買程度', icon: ShoppingBag },
              { value: 'score', label: '整體分數', icon: Star },
              { value: 'price', label: '價格', icon: BadgeDollarSign },
              { value: 'cp', label: 'CP 值', icon: Trophy },
            ].map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={sortMode === option.value ? 'default' : 'outline'}
                  onClick={() => setSortMode(option.value as RankingSortMode)}
                  className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest"
                >
                  <Icon className="w-3 h-3 mr-1.5" /> {option.label}
                </Button>
              );
            })}
          </div>
        </section>

        {isNotesLoading ? (
          <div className="dark-glass rounded-[2rem] border border-white/10 p-10 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : currentPageNotes.length === 0 ? (
          <div className="dark-glass rounded-[2rem] border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
            目前還沒有可排名的快記，先回工作台新增幾杯。
          </div>
        ) : (
          <section className="space-y-4">
            <div className="space-y-3">
              {currentPageNotes.map((note, index) => {
                const rank = pageIndex * PAGE_SIZE + index + 1;
                const cpScore = getExpoCpScore(note);
                return (
                  <div key={note.id} className="dark-glass rounded-[1.8rem] border border-white/10 p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-lg font-headline font-bold text-primary">
                          {rank}
                        </div>
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn('text-[9px] h-5 px-2 font-bold tracking-widest', getExpoBuyIntentClassName(note.expoMeta?.buyIntent))}>
                              {getExpoBuyIntentLabel(note.expoMeta?.buyIntent)}
                            </Badge>
                          </div>
                          <p className="text-base font-bold text-foreground break-words leading-snug">{getExpoNoteDisplayName(note)}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {note.brewery && <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-primary/70" /> {note.brewery}</span>}
                            <span className="inline-flex items-center gap-1"><Store className="w-3 h-3 text-primary/70" /> 攤位 {note.expoMeta?.booth || '-'}</span>
                            <span className="inline-flex items-center gap-1"><BadgeDollarSign className="w-3 h-3 text-primary/70" /> {typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '未記價格'}</span>
                            <span className="inline-flex items-center gap-1"><Star className="w-3 h-3 text-primary/70" /> {note.overallRating}/10</span>
                            <span className="inline-flex items-center gap-1"><Trophy className="w-3 h-3 text-primary/70" /> CP {cpScore?.toFixed(2) ?? '--'}</span>
                          </div>
                        </div>
                      </div>
                      <Link href={`/notes/${note.id}`}>
                        <Button variant="outline" className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest">查看</Button>
                      </Link>
                    </div>

                    {note.expoMeta?.quickTags && note.expoMeta.quickTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {note.expoMeta.quickTags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[9px] h-5 px-2 border-primary/20 bg-primary/10 text-primary font-bold tracking-widest">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {note.expoMeta?.quickNote && <p className="text-sm text-foreground/75 whitespace-pre-wrap">{note.expoMeta.quickNote}</p>}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">第 {pageIndex + 1} / {totalPages} 頁</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                  className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1.5" /> 上一頁
                </Button>
                <Button
                  type="button"
                  disabled={pageIndex >= totalPages - 1}
                  onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                  className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest"
                >
                  下一頁 <ChevronRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}