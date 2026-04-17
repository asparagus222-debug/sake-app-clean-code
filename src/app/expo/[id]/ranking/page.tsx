'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, orderBy, query, where } from 'firebase/firestore';
import { ArrowLeft, BadgeDollarSign, Building2, ChevronLeft, ChevronRight, ClipboardList, Download, Loader2, Medal, Share2, ShoppingBag, Sparkles, Star, Store, Ticket, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { ExpoEvent, SakeNote } from '@/lib/types';
import { getExpoBuyIntentClassName, getExpoBuyIntentLabel, getExpoBuyIntentRank, getExpoCpScore, getExpoNoteDisplayName, getSortableExpoCpScore, getSortableExpoPrice } from '@/lib/note-lifecycle';
import { cn } from '@/lib/utils';

type RankingSortMode = 'intent' | 'score' | 'price' | 'cp';

const PAGE_SIZE = 10;
const POSTER_BACKGROUND = '#110d0a';
const SORT_MODE_META: Record<RankingSortMode, { label: string; icon: typeof ShoppingBag; subtitle: string }> = {
  intent: { label: '想買程度', icon: ShoppingBag, subtitle: '先看這場最想回購與帶走的清單' },
  score: { label: '整體分數', icon: Star, subtitle: '把整體表現最亮眼的酒款排在前面' },
  price: { label: '價格', icon: BadgeDollarSign, subtitle: '按照現場價格快速比較出手順序' },
  cp: { label: 'CP 值', icon: Trophy, subtitle: '固定線性縮放到 0-10，排序高低不受公式改版影響' },
};

function formatExpoCpScore(score: number | null | undefined) {
  if (score === null || score === undefined) return '--';
  return score.toFixed(2);
}

export default function ExpoRankingPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const eventId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [sortMode, setSortMode] = useState<RankingSortMode>('intent');
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
  const topThreeNotes = currentPageNotes.slice(0, 3);
  const remainingNotes = currentPageNotes.slice(3);
  const currentSortMeta = SORT_MODE_META[sortMode];
  const averageScore = currentPageNotes.length > 0
    ? currentPageNotes.reduce((sum, note) => sum + note.overallRating, 0) / currentPageNotes.length
    : 0;
  const mustBuyCount = currentPageNotes.filter((note) => note.expoMeta?.buyIntent === 'must-buy').length;
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
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#f4dec5]/78">
              這頁現在是獨立可分享的海報式畫面。CP 值已改成固定線性縮放到 0-10，分數高低順序不會因為這次正規化而改變。
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-[#d8b89a]">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Ticket className="w-3 h-3 text-[#ffb86b]" /> {event.name}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><ClipboardList className="w-3 h-3 text-[#ffb86b]" /> 每頁 10 名</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Sparkles className="w-3 h-3 text-[#ffb86b]" /> {currentSortMeta.label} 模式</span>
            </div>
          </div>
          <div className="hidden shrink-0 md:flex md:items-center md:gap-2">
            <Link href={`/expo/${eventId}`}>
              <Button variant="outline" className="rounded-full h-10 border-white/15 bg-white/5 px-5 text-xs font-bold uppercase tracking-widest text-[#fff4e5] hover:bg-white/10">回工作台</Button>
            </Link>
            <Button onClick={handleExport} disabled={isExporting || currentPageNotes.length === 0} className="rounded-full h-10 bg-[#f19245] px-5 text-xs font-bold uppercase tracking-widest text-[#1a120d] hover:bg-[#ffab60]">
              {isExporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Share2 className="mr-1.5 h-4 w-4" />} 分享圖片
            </Button>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcf99]/70">Ranking Mode</p>
              <h2 className="mt-2 text-lg font-bold text-[#fff4e5]">切換這張打卡圖的榜單邏輯</h2>
              <p className="mt-2 text-sm leading-6 text-[#e4c4a5]/72">每切一次排序，都會重組這一頁的前十名並可直接匯出。</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
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
                  className={cn(
                    'rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest',
                    sortMode === option.value
                      ? 'bg-[#f19245] text-[#1a120d] hover:bg-[#ffab60]'
                      : 'border-white/15 bg-white/5 text-[#f6dfc5] hover:bg-white/10'
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
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d9b495]">必買數</div>
                <div className="mt-2 text-2xl font-headline text-[#fff4e5]">{mustBuyCount}</div>
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
              className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,215,175,0.16),_transparent_28%),linear-gradient(180deg,_rgba(42,26,21,0.98)_0%,_rgba(18,13,11,0.98)_100%)] p-5 shadow-[0_40px_120px_rgba(0,0,0,0.35)]"
            >
              <div className="pointer-events-none absolute inset-0 opacity-80">
                <div className="absolute left-6 top-6 h-28 w-28 rounded-full bg-[#f19245]/18 blur-3xl" />
                <div className="absolute right-8 top-20 h-40 w-40 rounded-full bg-[#fff0cf]/8 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-[#d26f37]/12 blur-3xl" />
              </div>

              {isNotesLoading ? (
                <div className="relative flex min-h-[560px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/10">
                  <Loader2 className="h-8 w-8 animate-spin text-[#ffcf99]" />
                </div>
              ) : currentPageNotes.length === 0 ? (
                <div className="relative flex min-h-[560px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-black/10 px-6 text-center">
                  <Trophy className="mb-4 h-9 w-9 text-[#ffcf99]" />
                  <p className="text-lg font-bold text-[#fff4e5]">目前還沒有可排名的快記</p>
                  <p className="mt-2 text-sm leading-7 text-[#e4c4a5]/72">先回工作台新增幾杯，這裡就會變成可以直接截圖或匯出的打卡頁。</p>
                </div>
              ) : (
                <div className="relative space-y-5">
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcf99]">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Ticket className="h-3 w-3" /> Expo Check-in</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Medal className="h-3 w-3" /> Page {pageIndex + 1}</span>
                      </div>
                      <h2 className="mt-4 text-[28px] font-headline font-bold leading-tight tracking-[0.08em] text-[#fff4e5]">{event.name}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-[#e8cdb0]/76">{currentSortMeta.subtitle}</p>
                    </div>
                    <div className="shrink-0 rounded-[1.4rem] border border-[#f19245]/25 bg-[#f19245]/12 px-4 py-3 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcf99]">榜單模式</div>
                      <div className="mt-2 text-xl font-headline text-[#fff4e5]">{currentSortMeta.label}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d9b495]">本頁平均分</div>
                      <div className="mt-2 text-3xl font-headline text-[#fff4e5]">{averageScore.toFixed(1)}</div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d9b495]">必買杯數</div>
                      <div className="mt-2 text-3xl font-headline text-[#fff4e5]">{mustBuyCount}</div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d9b495]">平均 CP</div>
                      <div className="mt-2 text-3xl font-headline text-[#fff4e5]">{formatExpoCpScore(averageCpScore)}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1.08fr_0.92fr]">
                    <div className="grid gap-3">
                      {topThreeNotes.map((note, index) => {
                        const rank = pageIndex * PAGE_SIZE + index + 1;
                        const cpScore = getExpoCpScore(note);
                        return (
                          <div key={note.id} className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] border border-[#f19245]/30 bg-[#f19245]/12 text-xl font-headline font-bold text-[#ffcf99]">
                                {rank}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className={cn('h-5 px-2 text-[9px] font-bold tracking-widest', getExpoBuyIntentClassName(note.expoMeta?.buyIntent))}>
                                    {getExpoBuyIntentLabel(note.expoMeta?.buyIntent)}
                                  </Badge>
                                  <Badge variant="outline" className="h-5 border-[#f19245]/30 bg-[#f19245]/10 px-2 text-[9px] font-bold tracking-widest text-[#ffcf99]">
                                    TOP {rank}
                                  </Badge>
                                </div>
                                <p className="text-lg font-bold leading-snug text-[#fff4e5]">{getExpoNoteDisplayName(note)}</p>
                                <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-[#d8b89a]">
                                  {note.brewery && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3 text-[#ffb86b]" /> {note.brewery}</span>}
                                  <span className="inline-flex items-center gap-1"><Store className="h-3 w-3 text-[#ffb86b]" /> 攤位 {note.expoMeta?.booth || '-'}</span>
                                  <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-[#ffb86b]" /> {note.overallRating}/10</span>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
                                    <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#c7a78a]">價格</div>
                                    <div className="mt-1 text-sm font-bold text-[#fff4e5]">{typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '--'}</div>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
                                    <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#c7a78a]">CP 值</div>
                                    <div className="mt-1 text-sm font-bold text-[#fff4e5]">{formatExpoCpScore(cpScore)}</div>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2 sm:col-span-1 col-span-2">
                                    <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#c7a78a]">快速備註</div>
                                    <div className="mt-1 line-clamp-2 text-sm text-[#f1dcc6]/82">{note.expoMeta?.quickNote || '未填備註'}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-[1.6rem] border border-white/10 bg-black/15 p-4">
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d9b495]">4-10 名</div>
                          <div className="mt-1 text-lg font-bold text-[#fff4e5]">本頁延伸榜單</div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#ffcf99]">
                          Page {pageIndex + 1}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {remainingNotes.map((note, index) => {
                          const rank = pageIndex * PAGE_SIZE + index + 4;
                          return (
                            <div key={note.id} className="flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-headline font-bold text-[#fff4e5]">
                                {rank}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-[#fff4e5]">{getExpoNoteDisplayName(note)}</p>
                                <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-[#cfad90]">
                                  <span>{getExpoBuyIntentLabel(note.expoMeta?.buyIntent)}</span>
                                  <span>{note.overallRating}/10</span>
                                  <span>CP {formatExpoCpScore(getExpoCpScore(note))}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-[11px] text-[#c8a98e]">
                    <div>酒展快記排行榜</div>
                    <div>CP = 原始公式 ÷ 4，僅做固定比例縮放</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-2 md:hidden">
              <Link href={`/expo/${eventId}`}>
                <Button variant="outline" className="rounded-full h-10 border-white/15 bg-white/5 px-5 text-xs font-bold uppercase tracking-widest text-[#fff4e5] hover:bg-white/10">回工作台</Button>
              </Link>
              <div className="flex items-center gap-2">
                <Button onClick={handleExport} disabled={isExporting || currentPageNotes.length === 0} className="rounded-full h-10 bg-[#f19245] px-5 text-xs font-bold uppercase tracking-widest text-[#1a120d] hover:bg-[#ffab60]">
                  {isExporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Share2 className="mr-1.5 h-4 w-4" />} 分享
                </Button>
                <Button onClick={handleExport} disabled={isExporting || currentPageNotes.length === 0} variant="outline" className="rounded-full h-10 border-white/15 bg-white/5 px-4 text-xs font-bold uppercase tracking-widest text-[#fff4e5] hover:bg-white/10">
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