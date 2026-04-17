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
type ShareCardThemeId = 'cream-light' | 'sand-light' | 'cocoa-dark' | 'graphite-dark';

const PAGE_SIZE = 10;
const SORT_MODE_META: Record<RankingSortMode, { label: string; icon: typeof Star }> = {
  score: { label: '風味評分', icon: Star },
  price: { label: '價格', icon: BadgeDollarSign },
  cp: { label: 'CP 值', icon: Trophy },
};

const SHARE_CARD_THEMES: Record<ShareCardThemeId, {
  label: string;
  exportBackground: string;
  shellClassName: string;
  frameClassName: string;
  emptyClassName: string;
  dividerClassName: string;
  eyebrowClassName: string;
  titleClassName: string;
  modeChipClassName: string;
  modeLabelClassName: string;
  modeValueClassName: string;
  tableClassName: string;
  tableHeaderClassName: string;
  metaClassName: string;
  valueClassName: string;
  footerClassName: string;
  rowBaseClassName: string;
  previewSwatchClassName: string;
}> = {
  'cream-light': {
    label: '奶白',
    exportBackground: '#f8f3ec',
    shellClassName: 'border-[#e7dccf] bg-[#f8f3ec] shadow-[0_30px_80px_rgba(0,0,0,0.14)]',
    frameClassName: 'border-[#e7dccf] bg-white text-[#2f241c]',
    emptyClassName: 'border-[#dccdbd] bg-white/70 text-[#2f241c]',
    dividerClassName: 'border-[#efe5d8]',
    eyebrowClassName: 'text-[#9c7960]',
    titleClassName: 'text-[#241912]',
    modeChipClassName: 'border-[#ebddcf] bg-[#f8f3ec]',
    modeLabelClassName: 'text-[#9c7960]',
    modeValueClassName: 'text-[#241912]',
    tableClassName: 'border-[#efe5d8] bg-[#fcfaf6]',
    tableHeaderClassName: 'text-[#9c7960]',
    metaClassName: 'text-[#8b6e5a]',
    valueClassName: 'text-[#4d3a2f]',
    footerClassName: 'border-[#efe5d8] text-[#9c7960]',
    rowBaseClassName: 'border-[#ece5dc]',
    previewSwatchClassName: 'border-[#e7dccf] bg-[#f8f3ec]',
  },
  'sand-light': {
    label: '杏沙',
    exportBackground: '#f7efe5',
    shellClassName: 'border-[#e6d5c6] bg-[linear-gradient(180deg,#f7efe5_0%,#f3e5d8_100%)] shadow-[0_30px_80px_rgba(120,88,58,0.12)]',
    frameClassName: 'border-[#e6d5c6] bg-[#fffaf4] text-[#34261d]',
    emptyClassName: 'border-[#ddcbbb] bg-[#fff7f0] text-[#34261d]',
    dividerClassName: 'border-[#efdfd2]',
    eyebrowClassName: 'text-[#a37c63]',
    titleClassName: 'text-[#34261d]',
    modeChipClassName: 'border-[#e6d5c6] bg-[#f8efe6]',
    modeLabelClassName: 'text-[#a37c63]',
    modeValueClassName: 'text-[#34261d]',
    tableClassName: 'border-[#efdfd2] bg-[#fffdfa]',
    tableHeaderClassName: 'text-[#a37c63]',
    metaClassName: 'text-[#8f6e59]',
    valueClassName: 'text-[#5a4336]',
    footerClassName: 'border-[#efdfd2] text-[#a37c63]',
    rowBaseClassName: 'border-[#eadcd1]',
    previewSwatchClassName: 'border-[#e6d5c6] bg-[#f3e5d8]',
  },
  'cocoa-dark': {
    label: '可可',
    exportBackground: '#1a1513',
    shellClassName: 'border-[#45362f] bg-[linear-gradient(180deg,#241d1a_0%,#171210_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.28)]',
    frameClassName: 'border-[#3f322c] bg-[#211b18] text-[#f7eee6]',
    emptyClassName: 'border-[#43362f] bg-[#27201d] text-[#f7eee6]',
    dividerClassName: 'border-[#382d28]',
    eyebrowClassName: 'text-[#d8b89c]',
    titleClassName: 'text-[#fff6ef]',
    modeChipClassName: 'border-[#43362f] bg-[#2b2320]',
    modeLabelClassName: 'text-[#d8b89c]',
    modeValueClassName: 'text-[#fff6ef]',
    tableClassName: 'border-[#382d28] bg-[#26201d]',
    tableHeaderClassName: 'text-[#cfae92]',
    metaClassName: 'text-[#c09e82]',
    valueClassName: 'text-[#f4e8dd]',
    footerClassName: 'border-[#382d28] text-[#cfae92]',
    rowBaseClassName: 'border-[#40342e]',
    previewSwatchClassName: 'border-[#45362f] bg-[#241d1a]',
  },
  'graphite-dark': {
    label: '石墨',
    exportBackground: '#151619',
    shellClassName: 'border-[#393d44] bg-[linear-gradient(180deg,#1d1f24_0%,#14161a_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.3)]',
    frameClassName: 'border-[#353941] bg-[#1c1f25] text-[#f4efe8]',
    emptyClassName: 'border-[#40444c] bg-[#23262d] text-[#f4efe8]',
    dividerClassName: 'border-[#31353d]',
    eyebrowClassName: 'text-[#c9bea8]',
    titleClassName: 'text-[#fbf7f0]',
    modeChipClassName: 'border-[#40444c] bg-[#252931]',
    modeLabelClassName: 'text-[#c9bea8]',
    modeValueClassName: 'text-[#fbf7f0]',
    tableClassName: 'border-[#31353d] bg-[#22262d]',
    tableHeaderClassName: 'text-[#c9bea8]',
    metaClassName: 'text-[#b9ad98]',
    valueClassName: 'text-[#efe7db]',
    footerClassName: 'border-[#31353d] text-[#c9bea8]',
    rowBaseClassName: 'border-[#3d424a]',
    previewSwatchClassName: 'border-[#393d44] bg-[#1d1f24]',
  },
};

function formatExpoCpScore(score: number | null | undefined) {
  if (score === null || score === undefined) return '--';
  return score.toFixed(1);
}

function formatFlavorRating(score: number) {
  return score.toFixed(1);
}

function getRankingBrewery(note: SakeNote) {
  return note.brewery?.trim() || '未填酒造';
}

function getRankingBooth(note: SakeNote) {
  return note.expoMeta?.booth?.trim() ? `攤位 ${note.expoMeta.booth.trim()}` : '未填攤位';
}

function getRankingAuthorNote(note: SakeNote) {
  const noteText = note.expoMeta?.quickNote?.trim() || note.userDescription?.trim() || note.description?.trim() || '';
  return noteText || '未填作者備註';
}

function getRankMedalStyle(rank: number, themeId: ShareCardThemeId) {
  const themeAccentMap: Record<ShareCardThemeId, { gold: string; goldRank: string; silver: string; silverRank: string; bronze: string; bronzeRank: string; base: string; baseRank: string }> = {
    'cream-light': {
      gold: 'border-[#f3c86b]/45 bg-[#fef3cf]',
      goldRank: 'border-[#e0b248] bg-[#f3c86b] text-[#24180d]',
      silver: 'border-[#d9dde6]/60 bg-[#f7f8fb]',
      silverRank: 'border-[#bfc7d6] bg-[#dfe4ee] text-[#233042]',
      bronze: 'border-[#dfb48d]/50 bg-[#fff6ef]',
      bronzeRank: 'border-[#cd8f63] bg-[#e4b08b] text-[#2d1c14]',
      base: 'bg-white',
      baseRank: 'border-[#ddd3c6] bg-[#f7f1ea] text-[#57463a]',
    },
    'sand-light': {
      gold: 'border-[#e8c57a]/45 bg-[#fff2d7]',
      goldRank: 'border-[#d9ac4a] bg-[#efc76c] text-[#2b1d11]',
      silver: 'border-[#d8dde3]/55 bg-[#f8fafc]',
      silverRank: 'border-[#bfc7d3] bg-[#dfe5ec] text-[#253241]',
      bronze: 'border-[#dfb896]/45 bg-[#fff3ea]',
      bronzeRank: 'border-[#cc9062] bg-[#e2b18d] text-[#2e1d15]',
      base: 'bg-[#fffaf4]',
      baseRank: 'border-[#dfd0c3] bg-[#f7ede3] text-[#624d40]',
    },
    'cocoa-dark': {
      gold: 'border-[#5b4a25] bg-[#2b2417]',
      goldRank: 'border-[#ba9651] bg-[#f0be5f] text-[#24180d]',
      silver: 'border-[#4b4e57] bg-[#262a31]',
      silverRank: 'border-[#8b96aa] bg-[#d7dce6] text-[#202936]',
      bronze: 'border-[#5b4032] bg-[#271d1a]',
      bronzeRank: 'border-[#c48b66] bg-[#d7a07a] text-[#2a1a14]',
      base: 'bg-[#211b18]',
      baseRank: 'border-[#4b3d35] bg-[#2a2320] text-[#f1e5d8]',
    },
    'graphite-dark': {
      gold: 'border-[#5c5432] bg-[#2b291f]',
      goldRank: 'border-[#c1a560] bg-[#e8c66d] text-[#252013]',
      silver: 'border-[#4a515a] bg-[#262b33]',
      silverRank: 'border-[#99a3b1] bg-[#dce1e7] text-[#1d2733]',
      bronze: 'border-[#605047] bg-[#2b221f]',
      bronzeRank: 'border-[#cb9170] bg-[#d8a184] text-[#291c16]',
      base: 'bg-[#1c1f25]',
      baseRank: 'border-[#4a515a] bg-[#262a31] text-[#ece3d8]',
    },
  };
  const themeAccent = themeAccentMap[themeId];

  if (rank === 1) {
    return {
      rowClassName: themeAccent.gold,
      rankClassName: themeAccent.goldRank,
    };
  }
  if (rank === 2) {
    return {
      rowClassName: themeAccent.silver,
      rankClassName: themeAccent.silverRank,
    };
  }
  if (rank === 3) {
    return {
      rowClassName: themeAccent.bronze,
      rankClassName: themeAccent.bronzeRank,
    };
  }

  return {
    rowClassName: `${themeAccent.base} ${SHARE_CARD_THEMES[themeId].rowBaseClassName}`,
    rankClassName: themeAccent.baseRank,
  };
}

export default function ExpoRankingPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const eventId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [sortMode, setSortMode] = useState<RankingSortMode>('score');
  const [shareCardTheme, setShareCardTheme] = useState<ShareCardThemeId>('cream-light');
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
  const currentShareCardTheme = SHARE_CARD_THEMES[shareCardTheme];
  const averageScore = useMemo(() => {
    if (currentPageNotes.length === 0) return 0;
    const sum = currentPageNotes.reduce((acc, note) => acc + (note.overallRating || 0), 0);
    return sum / currentPageNotes.length;
  }, [currentPageNotes]);

  const averageCpScore = useMemo(() => {
    if (currentPageNotes.length === 0) return 0;
    const validCpScores = currentPageNotes
      .map(note => getExpoCpScore(note))
      .filter((score): score is number => score !== null && score !== undefined);
    if (validCpScores.length === 0) return 0;
    const sum = validCpScores.reduce((acc, score) => acc + score, 0);
    return sum / validCpScores.length;
  }, [currentPageNotes]);


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
        backgroundColor: currentShareCardTheme.exportBackground,
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

            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcf99]/70">Share Card Colors</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(Object.entries(SHARE_CARD_THEMES) as Array<[ShareCardThemeId, typeof SHARE_CARD_THEMES[ShareCardThemeId]]>).map(([themeId, theme]) => (
                  <button
                    key={themeId}
                    type="button"
                    onClick={() => setShareCardTheme(themeId)}
                    className={cn(
                      'rounded-full border px-2.5 py-2 text-center transition-all',
                      shareCardTheme === themeId
                        ? 'border-[#ffd166] bg-[#ffd166]/12 shadow-[0_12px_24px_rgba(255,209,102,0.16)]'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex gap-1">
                        <span className={cn('h-2.5 w-2.5 rounded-full border', theme.previewSwatchClassName)} />
                        <span className={cn('h-2.5 w-2.5 rounded-full border', theme.modeChipClassName.split(' ').slice(0, 2).join(' '))} />
                      </div>
                      <p className="text-[11px] font-bold text-[#fff4e5]">{theme.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <div
              ref={shareCardRef}
              className={cn('mx-auto w-full max-w-[420px] overflow-hidden rounded-[1.7rem] border p-4', currentShareCardTheme.shellClassName)}
            >
              {isNotesLoading ? (
                <div className={cn('flex min-h-[760px] items-center justify-center rounded-[1.4rem] border', currentShareCardTheme.emptyClassName)}>
                  <Loader2 className="h-8 w-8 animate-spin text-[#c17c45]" />
                </div>
              ) : currentPageNotes.length === 0 ? (
                <div className={cn('flex min-h-[760px] flex-col items-center justify-center rounded-[1.4rem] border border-dashed px-6 text-center', currentShareCardTheme.emptyClassName)}>
                  <Trophy className="mb-4 h-9 w-9 text-[#c17c45]" />
                  <p className={cn('text-lg font-bold', currentShareCardTheme.titleClassName)}>目前還沒有可排名的快記</p>
                  <p className={cn('mt-2 text-sm leading-7', currentShareCardTheme.metaClassName)}>先回工作台新增幾杯，這裡就會變成可以直接截圖或匯出的打卡頁。</p>
                </div>
              ) : (
                <div className={cn('flex min-h-[760px] flex-col rounded-[1.4rem] border px-3 py-3', currentShareCardTheme.frameClassName)}>
                  <div className={cn('border-b pb-3', currentShareCardTheme.dividerClassName)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={cn('text-[10px] font-bold tracking-[0.18em]', currentShareCardTheme.eyebrowClassName)}>sakepath.com</div>
                        <h2 className={cn('mt-2 break-words text-[22px] font-headline font-bold leading-tight tracking-[0.03em]', currentShareCardTheme.titleClassName)}>{event.name}</h2>
                      </div>
                      <div className={cn('shrink-0 rounded-2xl border px-3 py-2 text-right', currentShareCardTheme.modeChipClassName)}>
                        <div className={cn('text-[9px] font-bold uppercase tracking-[0.22em]', currentShareCardTheme.modeLabelClassName)}>榜單模式</div>
                        <div className={cn('mt-1 text-sm font-bold', currentShareCardTheme.modeValueClassName)}>{currentSortMeta.label}</div>
                      </div>
                    </div>
                  </div>

                  <div className={cn('mt-3 rounded-[1.2rem] border p-2', currentShareCardTheme.tableClassName)}>
                    <div className="space-y-1.5">
                      {currentPageNotes.map((note, index) => {
                        const rank = pageIndex * PAGE_SIZE + index + 1;
                        const cpScore = getExpoCpScore(note);
                        const medalStyle = getRankMedalStyle(rank, shareCardTheme);

                        return (
                          <div key={note.id} className={cn('rounded-[0.95rem] border px-2 py-1.5', currentShareCardTheme.rowBaseClassName, medalStyle.rowClassName)}>
                            <div className="grid grid-cols-[30px_minmax(0,1fr)] items-start gap-2">
                              <div className={cn('mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-headline font-bold', medalStyle.rankClassName)}>{rank}</div>
                              <div className="min-w-0">
                                <p className={cn('break-words text-[10px] font-bold leading-3.5', currentShareCardTheme.titleClassName)}>{getExpoNoteDisplayName(note)}</p>
                                <p className={cn('mt-0.5 break-words text-[7px] font-bold leading-3 tracking-[0.05em]', currentShareCardTheme.metaClassName)}>{getRankingBrewery(note)}</p>
                                <p className={cn('break-words text-[7px] font-bold leading-3 tracking-[0.05em]', currentShareCardTheme.metaClassName)}>{getRankingBooth(note)}</p>
                              </div>
                            </div>
                            <div className={cn('mt-1 grid grid-cols-[48px_38px_42px_minmax(0,1fr)] items-start gap-2 border-t pt-1.5 text-[8px] font-bold', currentShareCardTheme.dividerClassName, currentShareCardTheme.valueClassName)}>
                              <div className="space-y-0.5">
                                <div className={cn('text-[7px] uppercase tracking-[0.12em]', currentShareCardTheme.tableHeaderClassName)}>價格</div>
                                <div>{typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '--'}</div>
                              </div>
                              <div className="space-y-0.5">
                                <div className={cn('text-[7px] uppercase tracking-[0.12em]', currentShareCardTheme.tableHeaderClassName)}>風味</div>
                                <div>{formatFlavorRating(note.overallRating)}</div>
                              </div>
                              <div className="space-y-0.5">
                                <div className={cn('text-[7px] uppercase tracking-[0.12em]', currentShareCardTheme.tableHeaderClassName)}>CP</div>
                                <div>{formatExpoCpScore(cpScore)}</div>
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <div className={cn('text-[7px] uppercase tracking-[0.12em] opacity-0', currentShareCardTheme.tableHeaderClassName)}>註</div>
                                <div className="break-words text-[7.5px] leading-3">{getRankingAuthorNote(note)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={cn('mt-auto flex items-center justify-between gap-3 border-t pt-3 text-[9px] font-bold uppercase tracking-[0.16em]', currentShareCardTheme.footerClassName)}>
                    <div>酒展快記排行榜</div>
                    <div>CP = (風味評分^1.5 / 價格) x 調整係數</div>
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