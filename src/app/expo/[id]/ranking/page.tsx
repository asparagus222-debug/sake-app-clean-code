'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, orderBy, query, where } from 'firebase/firestore';
import { ArrowLeft, BadgeDollarSign, ChevronLeft, ChevronRight, ClipboardList, Download, Loader2, Share2, Sparkles, Star, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { ExpoEvent, SakeNote } from '@/lib/types';
import { getExpoCpScore, getExpoNoteDisplayName, getSortableExpoCpScore, getSortableExpoPrice } from '@/lib/note-lifecycle';
import { cn } from '@/lib/utils';

type RankingSortMode = 'score' | 'price' | 'cp';

const PAGE_SIZE = 10;
const POSTER_BACKGROUND = '#110d0a';
const SORT_MODE_META: Record<RankingSortMode, { label: string; icon: typeof Star }> = {
  score: { label: '風味評分', icon: Star },
  price: { label: '價格', icon: BadgeDollarSign },
  cp: { label: 'CP 值', icon: Trophy },
};

function formatExpoCpScore(score: number | null | undefined) {
  if (score === null || score === undefined) return '--';
  return score.toFixed(1);
}

function formatFlavorRating(score: number) {
  return score.toFixed(1);
}

function getRankMedalStyle(rank: number) {
  if (rank === 1) {
    return {
      rowClassName: 'border-[#f3c86b]/45 bg-[#fef3cf]',
      rankClassName: 'border-[#e0b248] bg-[#f3c86b] text-[#24180d]',
    };
  }
  if (rank === 2) {
    return {
      rowClassName: 'border-[#d9dde6]/60 bg-[#f7f8fb]',
      rankClassName: 'border-[#bfc7d6] bg-[#dfe4ee] text-[#233042]',
    };
  }
  if (rank === 3) {
    return {
      rowClassName: 'border-[#dfb48d]/50 bg-[#fff6ef]',
      rankClassName: 'border-[#cd8f63] bg-[#e4b08b] text-[#2d1c14]',
    };
  }

  return {
    rowClassName: 'border-[#ece5dc] bg-white',
    rankClassName: 'border-[#ddd3c6] bg-[#f7f1ea] text-[#57463a]',
  };
}

export default function ExpoRankingPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const eventId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [sortMode, setSortMode] = useState<RankingSortMode>('score');
  const [pageIndex, setPageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

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
      if (sortMode === 'score') {
        return right.overallRating - left.overallRating
          || (right.createdAt || '').localeCompare(left.createdAt || '');
      }
      if (sortMode === 'price') {
        return getSortableExpoPrice(left) - getSortableExpoPrice(right)
          || right.overallRating - left.overallRating
          || (right.createdAt || '').localeCompare(left.createdAt || '');
      }
      return getSortableExpoCpScore(right) - getSortableExpoCpScore(left)
        || right.overallRating - left.overallRating
        || (right.createdAt || '').localeCompare(left.createdAt || '');
    });
  }, [rawNotes, sortMode]);

  const totalPages = Math.max(1, Math.ceil(rankedNotes.length / PAGE_SIZE));
  const currentPageNotes = useMemo(() => {
    const safePageIndex = Math.min(pageIndex, totalPages - 1);
    return rankedNotes.slice(safePageIndex * PAGE_SIZE, (safePageIndex + 1) * PAGE_SIZE);
  }, [pageIndex, rankedNotes, totalPages]);
  const currentSortMeta = SORT_MODE_META[sortMode];
  const averageScore = currentPageNotes.length > 0
    ? currentPageNotes.reduce((sum, note) => sum + note.overallRating, 0) / currentPageNotes.length
    : 0;
  const averageCpScore = (() => {
    const scoredNotes = currentPageNotes
      .map((note) => getExpoCpScore(note))
      .filter((score): score is number => score !== null);

    if (scoredNotes.length === 0) return null;
    return scoredNotes.reduce((sum, score) => sum + score, 0) / scoredNotes.length;
  })();

  React.useEffect(() => {
    setPageIndex(0);
  }, [sortMode]);

  React.useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  const handleExport = async () => {
    if (!shareCardRef.current) return;
    setIsExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(shareCardRef.current, {
        pixelRatio: 3,
        backgroundColor: POSTER_BACKGROUND,
        fetchRequestInit: { cache: 'force-cache' },
      });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const fileName = `${event?.name || 'expo'}-${currentSortMeta.label}-page-${pageIndex + 1}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${event?.name || '酒展'} ${currentSortMeta.label}打卡頁`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('酒展打卡頁匯出失敗', error);
    } finally {
      setIsExporting(false);
    }
  };

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
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(241,146,69,0.22),_transparent_28%),linear-gradient(180deg,_#201511_0%,_#130d0b_46%,_#0b0908_100%)] px-4 py-8 pb-24 font-body text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-[-8%] top-24 h-72 w-72 rounded-full bg-[#ffb06a]/20 blur-3xl" />
        <div className="absolute right-[-4%] top-48 h-80 w-80 rounded-full bg-[#d56d35]/15 blur-3xl" />
        <div className="absolute bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#fff0d0]/8 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button type="button" onClick={() => router.push(`/expo/${eventId}`)} className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcf99]/70 transition-colors hover:text-[#ffcf99]">
              <ArrowLeft className="w-3 h-3" /> 返回酒展工作台
            </button>
            <h1 className="mt-3 text-3xl font-headline font-bold tracking-[0.16em] text-[#fff4e5] uppercase break-words">酒展排名打卡頁</h1>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-[#d8b89a]">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Trophy className="w-3 h-3 text-[#ffb86b]" /> {event.name}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><ClipboardList className="w-3 h-3 text-[#ffb86b]" /> 每頁 10 名</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Sparkles className="w-3 h-3 text-[#ffb86b]" /> {currentSortMeta.label} 模式</span>
            </div>
          </div>
          <div className="hidden shrink-0 md:flex md:items-center md:gap-2">
            <Link href={`/expo/${eventId}`}>
              <Button variant="outline" className="rounded-full h-10 border-[#ffd08f]/35 bg-[#3b2418] px-5 text-xs font-bold uppercase tracking-widest text-[#fff4e5] hover:bg-[#563222]">回工作台</Button>
            </Link>
            <Button onClick={handleExport} disabled={isExporting || currentPageNotes.length === 0} className="rounded-full h-10 bg-[#ffd166] px-5 text-xs font-bold uppercase tracking-widest text-[#21150d] shadow-[0_10px_24px_rgba(255,209,102,0.28)] hover:bg-[#ffe08f]">
              {isExporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Share2 className="mr-1.5 h-4 w-4" />} 分享圖片
            </Button>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcf99]/70">Ranking Mode</p>
              <h2 className="mt-2 text-lg font-bold text-[#fff4e5]">切換這張打卡圖的榜單邏輯</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
            {[
              { value: 'score', label: '風味評分', icon: Star },
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
                  className={cn(
                    'rounded-full h-10 px-4 text-[10px] font-bold uppercase tracking-widest transition-all',
                    sortMode === option.value
                      ? 'bg-[#ffd166] text-[#21150d] shadow-[0_10px_24px_rgba(255,209,102,0.25)] hover:bg-[#ffe08f]'
                      : 'border-[#ffd08f]/25 bg-[#2f1d15] text-[#f6dfc5] hover:bg-[#45281c]'
                  )}
                >
                  <Icon className="w-3 h-3 mr-1.5" /> {option.label}
                </Button>
              );
            })}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-[1.4rem] border border-white/10 bg-[#1a130f] px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d9b495]">本頁杯數</div>
                <div className="mt-2 text-2xl font-headline text-[#fff4e5]">{currentPageNotes.length}</div>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-[#1a130f] px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d9b495]">平均風味</div>
                <div className="mt-2 text-2xl font-headline text-[#fff4e5]">{averageScore.toFixed(1)}</div>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-[#1a130f] px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d9b495]">平均 CP</div>
                <div className="mt-2 text-2xl font-headline text-[#fff4e5]">{formatExpoCpScore(averageCpScore)}</div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-[11px] text-[#dcb89b]">第 {pageIndex + 1} / {totalPages} 頁</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                  className="rounded-full h-9 border-white/15 bg-white/5 px-4 text-[10px] font-bold uppercase tracking-widest text-[#fff4e5] hover:bg-white/10"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1.5" /> 上一頁
                </Button>
                <Button
                  type="button"
                  disabled={pageIndex >= totalPages - 1}
                  onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                  className="rounded-full h-9 bg-[#f19245] px-4 text-[10px] font-bold uppercase tracking-widest text-[#1a120d] hover:bg-[#ffab60]"
                >
                  下一頁 <ChevronRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <div
              ref={shareCardRef}
              className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[1.7rem] border border-[#e7dccf] bg-[#f8f3ec] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.14)]"
            >
              {isNotesLoading ? (
                <div className="flex min-h-[760px] items-center justify-center rounded-[1.4rem] border border-[#e7dccf] bg-white/70">
                  <Loader2 className="h-8 w-8 animate-spin text-[#c17c45]" />
                </div>
              ) : currentPageNotes.length === 0 ? (
                <div className="flex min-h-[760px] flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-[#dccdbd] bg-white/70 px-6 text-center">
                  <Trophy className="mb-4 h-9 w-9 text-[#c17c45]" />
                  <p className="text-lg font-bold text-[#2f241c]">目前還沒有可排名的快記</p>
                  <p className="mt-2 text-sm leading-7 text-[#7d6758]">先回工作台新增幾杯，這裡就會變成可以直接截圖或匯出的打卡頁。</p>
                </div>
              ) : (
                <div className="flex min-h-[760px] flex-col rounded-[1.4rem] border border-[#e7dccf] bg-white px-3 py-3 text-[#2f241c]">
                  <div className="border-b border-[#efe5d8] pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9c7960]">Expo Check-in</div>
                        <h2 className="mt-2 line-clamp-2 text-[22px] font-headline font-bold leading-tight tracking-[0.03em] text-[#241912]">{event.name}</h2>
                      </div>
                      <div className="shrink-0 rounded-2xl border border-[#ebddcf] bg-[#f8f3ec] px-3 py-2 text-right">
                        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#9c7960]">第 {pageIndex + 1} 頁</div>
                        <div className="mt-1 text-sm font-bold text-[#241912]">{currentSortMeta.label}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-[#efe5d8] bg-[#fcfaf6] px-3 py-2.5">
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9c7960]">本頁杯數</div>
                        <div className="mt-1 text-lg font-headline text-[#241912]">{currentPageNotes.length}</div>
                      </div>
                      <div className="rounded-2xl border border-[#efe5d8] bg-[#fcfaf6] px-3 py-2.5">
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9c7960]">平均風味</div>
                        <div className="mt-1 text-lg font-headline text-[#241912]">{averageScore.toFixed(1)}</div>
                      </div>
                      <div className="rounded-2xl border border-[#efe5d8] bg-[#fcfaf6] px-3 py-2.5">
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9c7960]">平均 CP</div>
                        <div className="mt-1 text-lg font-headline text-[#241912]">{formatExpoCpScore(averageCpScore)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-[1.2rem] border border-[#efe5d8] bg-[#fcfaf6] p-2">
                    <div className="grid grid-cols-[42px_minmax(0,1fr)_58px_62px_56px] gap-2 px-2 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9c7960]">
                      <span>排名</span>
                      <span>酒款</span>
                      <span className="text-right">價格</span>
                      <span className="text-right">風味</span>
                      <span className="text-right">CP</span>
                    </div>
                    <div className="space-y-1.5">
                      {currentPageNotes.map((note, index) => {
                        const rank = pageIndex * PAGE_SIZE + index + 1;
                        const cpScore = getExpoCpScore(note);
                        const medalStyle = getRankMedalStyle(rank);

                        return (
                          <div key={note.id} className={cn('grid grid-cols-[42px_minmax(0,1fr)_58px_62px_56px] items-center gap-2 rounded-[1rem] border px-2 py-2', medalStyle.rowClassName)}>
                            <div className={cn('flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-headline font-bold', medalStyle.rankClassName)}>{rank}</div>
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-bold leading-5 text-[#241912]">{getExpoNoteDisplayName(note)}</p>
                              <p className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b6e5a]">{note.brewery || note.expoMeta?.booth || '未填酒造 / 攤位'}</p>
                            </div>
                            <div className="text-right text-[11px] font-bold text-[#4d3a2f]">{typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '--'}</div>
                            <div className="text-right text-[11px] font-bold text-[#4d3a2f]">{formatFlavorRating(note.overallRating)}</div>
                            <div className="text-right text-[11px] font-bold text-[#4d3a2f]">{formatExpoCpScore(cpScore)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#efe5d8] pt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[#9c7960]">
                    <div>酒展快記排行榜</div>
                    <div>CP = (風味評分^1.5 / 價格) x 3160</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-2 md:hidden">
              <Link href={`/expo/${eventId}`}>
                <Button variant="outline" className="rounded-full h-10 border-[#ffd08f]/35 bg-[#3b2418] px-5 text-xs font-bold uppercase tracking-widest text-[#fff4e5] hover:bg-[#563222]">回工作台</Button>
              </Link>
              <div className="flex items-center gap-2">
                <Button onClick={handleExport} disabled={isExporting || currentPageNotes.length === 0} className="rounded-full h-10 bg-[#ffd166] px-5 text-xs font-bold uppercase tracking-widest text-[#21150d] shadow-[0_10px_24px_rgba(255,209,102,0.28)] hover:bg-[#ffe08f]">
                  {isExporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Share2 className="mr-1.5 h-4 w-4" />} 分享
                </Button>
                <Button onClick={handleExport} disabled={isExporting || currentPageNotes.length === 0} variant="outline" className="rounded-full h-10 border-[#ffd08f]/35 bg-[#3b2418] px-4 text-xs font-bold uppercase tracking-widest text-[#fff4e5] hover:bg-[#563222]">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}