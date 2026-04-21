'use client';

import React, { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
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
type ShareCardThemeId = 'plum-light' | 'moss-light' | 'midnight-dark' | 'charcoal-dark';
type ShareCardLayoutId = 'magazine' | 'rows' | 'cinematic';

const PAGE_SIZE = 5;
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
  'plum-light': {
    label: '白梅',
    exportBackground: '#f4edf0',
    shellClassName: 'border-[#ddd0d5] bg-[linear-gradient(160deg,#f9f4f6_0%,#ede4e8_100%)] shadow-[0_30px_80px_rgba(140,80,105,0.12)]',
    frameClassName: 'border-[#e4d8dc] bg-[#fdfbfc] text-[#2c1f25]',
    emptyClassName: 'border-[#ddd0d5] bg-[#f9f5f7] text-[#2c1f25]',
    dividerClassName: 'border-[#e8dce0]',
    eyebrowClassName: 'text-[#9b6e7f]',
    titleClassName: 'text-[#2c1f25]',
    modeChipClassName: 'border-[#e4d8dc] bg-[#f7f1f4]',
    modeLabelClassName: 'text-[#9b6e7f]',
    modeValueClassName: 'text-[#2c1f25]',
    tableClassName: 'border-[#e8dce0] bg-[#fefcfd]',
    tableHeaderClassName: 'text-[#9b6e7f]',
    metaClassName: 'text-[#7d5568]',
    valueClassName: 'text-[#4a3040]',
    footerClassName: 'border-[#e8dce0] text-[#9b6e7f]',
    rowBaseClassName: 'border-[#e2d5da]',
    previewSwatchClassName: 'border-[#ddd0d5] bg-[#f0e6ea]',
  },
  'moss-light': {
    label: '青苔',
    exportBackground: '#eaf1eb',
    shellClassName: 'border-[#c5d6c8] bg-[linear-gradient(160deg,#eef4ef_0%,#e0ebe2_100%)] shadow-[0_30px_80px_rgba(60,100,70,0.13)]',
    frameClassName: 'border-[#cdddd0] bg-[#f6fbf7] text-[#1b2d20]',
    emptyClassName: 'border-[#c8d9cb] bg-[#eef5ef] text-[#1b2d20]',
    dividerClassName: 'border-[#d4e2d7]',
    eyebrowClassName: 'text-[#5a8264]',
    titleClassName: 'text-[#1b2d20]',
    modeChipClassName: 'border-[#cdddd0] bg-[#ebf3ec]',
    modeLabelClassName: 'text-[#5a8264]',
    modeValueClassName: 'text-[#1b2d20]',
    tableClassName: 'border-[#d4e2d7] bg-[#f4faf5]',
    tableHeaderClassName: 'text-[#5a8264]',
    metaClassName: 'text-[#4e6e57]',
    valueClassName: 'text-[#283d2e]',
    footerClassName: 'border-[#d4e2d7] text-[#5a8264]',
    rowBaseClassName: 'border-[#cdddd0]',
    previewSwatchClassName: 'border-[#c5d6c8] bg-[#deeade]',
  },
  'midnight-dark': {
    label: '深夜',
    exportBackground: '#0c1220',
    shellClassName: 'border-[#1e2e47] bg-[linear-gradient(160deg,#111d30_0%,#090f1c_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.35)]',
    frameClassName: 'border-[#1c2d44] bg-[#0f1827] text-[#e8e2d6]',
    emptyClassName: 'border-[#1e2e47] bg-[#111d30] text-[#e8e2d6]',
    dividerClassName: 'border-[#1e2e44]',
    eyebrowClassName: 'text-[#c4a55a]',
    titleClassName: 'text-[#f2eddf]',
    modeChipClassName: 'border-[#1e2d42] bg-[#0e1928]',
    modeLabelClassName: 'text-[#c4a55a]',
    modeValueClassName: 'text-[#f2eddf]',
    tableClassName: 'border-[#1e2e44] bg-[#0f1a2b]',
    tableHeaderClassName: 'text-[#b8995a]',
    metaClassName: 'text-[#a89270]',
    valueClassName: 'text-[#e8dfc8]',
    footerClassName: 'border-[#1e2e44] text-[#b8995a]',
    rowBaseClassName: 'border-[#1e2d42]',
    previewSwatchClassName: 'border-[#1e2e47] bg-[#111d30]',
  },
  'charcoal-dark': {
    label: '煤炭',
    exportBackground: '#131316',
    shellClassName: 'border-[#2a2a32] bg-[linear-gradient(160deg,#1c1c22_0%,#0e0e12_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.36)]',
    frameClassName: 'border-[#252529] bg-[#161618] text-[#f0ece4]',
    emptyClassName: 'border-[#2e2e34] bg-[#1a1a1e] text-[#f0ece4]',
    dividerClassName: 'border-[#252529]',
    eyebrowClassName: 'text-[#b5985a]',
    titleClassName: 'text-[#f8f5ee]',
    modeChipClassName: 'border-[#2e2e36] bg-[#202024]',
    modeLabelClassName: 'text-[#b5985a]',
    modeValueClassName: 'text-[#f8f5ee]',
    tableClassName: 'border-[#252529] bg-[#1a1a1e]',
    tableHeaderClassName: 'text-[#a8904e]',
    metaClassName: 'text-[#9e8862]',
    valueClassName: 'text-[#ede5d4]',
    footerClassName: 'border-[#252529] text-[#a8904e]',
    rowBaseClassName: 'border-[#2e2e36]',
    previewSwatchClassName: 'border-[#2a2a32] bg-[#1c1c22]',
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
  return note.brewery?.trim() || '酒造';
}

function getRankingBooth(note: SakeNote) {
  return note.expoMeta?.booth?.trim() || '攤位';
}

function formatExpoQuickTagLabel(tag: string) {
  const separator = '::';
  const separatorIndex = tag.indexOf(separator);
  return separatorIndex >= 0 ? tag.slice(separatorIndex + separator.length) : tag;
}

function getRankingStyleTags(note: SakeNote) {
  return (note.expoMeta?.quickTags || []).slice(0, 3).map((tag) => formatExpoQuickTagLabel(tag));
}

function getRankingAuthorNote(note: SakeNote) {
  const noteText = note.expoMeta?.quickNote?.trim() || note.userDescription?.trim() || note.description?.trim() || '';
  return noteText;
}

function clampText(lines: number): React.CSSProperties {
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  };
}

function getRankMedalStyle(rank: number, themeId: ShareCardThemeId) {
  const themeAccentMap: Record<ShareCardThemeId, { gold: string; goldRank: string; silver: string; silverRank: string; bronze: string; bronzeRank: string; base: string; baseRank: string }> = {
    'plum-light': {
      gold: 'border-[#e8c97a]/45 bg-[#fff8e0]',
      goldRank: 'border-[#c9a040] bg-[#e8c060] text-[#2a1c08]',
      silver: 'border-[#e0d8de]/65 bg-[#faf8f9]',
      silverRank: 'border-[#c0b2ba] bg-[#e4d8de] text-[#382730]',
      bronze: 'border-[#e8b8a8]/55 bg-[#fff1ec]',
      bronzeRank: 'border-[#cc8870] bg-[#e4a890] text-[#3a2018]',
      base: 'bg-[#fdfbfc]',
      baseRank: 'border-[#e0d0d6] bg-[#f7f0f3] text-[#7a5060]',
    },
    'moss-light': {
      gold: 'border-[#d8c870]/45 bg-[#faf7d8]',
      goldRank: 'border-[#b0a030] bg-[#d4c040] text-[#242010]',
      silver: 'border-[#c0cfca]/55 bg-[#f4f9f5]',
      silverRank: 'border-[#7aaa86] bg-[#b8d4bc] text-[#1a2e1e]',
      bronze: 'border-[#d8c0a0]/45 bg-[#f9f2e8]',
      bronzeRank: 'border-[#b09060] bg-[#d4aa80] text-[#2e200c]',
      base: 'bg-[#f6fbf7]',
      baseRank: 'border-[#c4dac4] bg-[#e6f2e6] text-[#3a5840]',
    },
    'midnight-dark': {
      gold: 'border-[#4a3c18] bg-[#1e1a0e]',
      goldRank: 'border-[#c8a448] bg-[#e8c05a] text-[#1a1408]',
      silver: 'border-[#283a56] bg-[#141e34]',
      silverRank: 'border-[#6888b8] bg-[#b0c8dc] text-[#0c1a2c]',
      bronze: 'border-[#4a3020] bg-[#1a1410]',
      bronzeRank: 'border-[#c07a50] bg-[#d4a070] text-[#20140a]',
      base: 'bg-[#0f1827]',
      baseRank: 'border-[#1e2e42] bg-[#121e30] text-[#e0d8c0]',
    },
    'charcoal-dark': {
      gold: 'border-[#484230] bg-[#1e1c10]',
      goldRank: 'border-[#c4a040] bg-[#deba48] text-[#181408]',
      silver: 'border-[#38383e] bg-[#1a1a20]',
      silverRank: 'border-[#8890a0] bg-[#c8ccd8] text-[#14141e]',
      bronze: 'border-[#483020] bg-[#1c1410]',
      bronzeRank: 'border-[#b87848] bg-[#cc9464] text-[#1c1008]',
      base: 'bg-[#161618]',
      baseRank: 'border-[#2e2e36] bg-[#1e1e22] text-[#e8e0cc]',
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
  const [shareCardTheme, setShareCardTheme] = useState<ShareCardThemeId>('plum-light');
  const [layoutVariant, setLayoutVariant] = useState<ShareCardLayoutId>('rows');
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
  const heroNote = currentPageNotes[0] ?? null;
  const featuredNotes = currentPageNotes.slice(1, 3);
  const compactNotes = currentPageNotes.slice(3, 5);
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
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(241,146,69,0.22),_transparent_28%),linear-gradient(180deg,_#201511_0%,_#130d0b_46%,_#0b0908_100%)] px-4 py-6 pb-20 font-body text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-[-8%] top-24 h-72 w-72 rounded-full bg-[#ffb06a]/20 blur-3xl" />
        <div className="absolute right-[-4%] top-48 h-80 w-80 rounded-full bg-[#d56d35]/15 blur-3xl" />
        <div className="absolute bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#fff0d0]/8 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button type="button" onClick={() => router.push(`/expo/${eventId}`)} className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#ffcf99]/70 transition-colors hover:text-[#ffcf99]">
              <ArrowLeft className="w-3 h-3" /> 返回酒展工作台
            </button>
            <h1 className="mt-3 text-[2rem] font-headline font-bold tracking-[0.12em] text-[#fff4e5] uppercase break-words">酒展排名打卡頁</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#d8b89a]">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><Trophy className="w-2.5 h-2.5 text-[#ffb86b]" /> {event.name}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><ClipboardList className="w-2.5 h-2.5 text-[#ffb86b]" /> 每頁 5 名</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><Sparkles className="w-2.5 h-2.5 text-[#ffb86b]" /> {currentSortMeta.label} 模式</span>
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

        <section className="grid gap-4 lg:grid-cols-[0.76fr_1.24fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            {/* 排序切換 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[7px] font-bold uppercase tracking-[0.14em] text-[#ffcf99]/45 mr-0.5">排序</span>
              {[
                { value: 'score', label: '風味', icon: Star },
                { value: 'price', label: '價格', icon: BadgeDollarSign },
                { value: 'cp', label: 'CP 值', icon: Trophy },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    onClick={() => setSortMode(option.value as RankingSortMode)}
                    className={cn(
                      'rounded-full h-7 px-2.5 text-[8px] font-bold uppercase tracking-[0.1em] transition-all',
                      sortMode === option.value
                        ? 'bg-[#ffd166] text-[#21150d] shadow-[0_6px_14px_rgba(255,209,102,0.22)] hover:bg-[#ffe08f]'
                        : 'border border-[#ffd08f]/20 bg-[#2f1d15] text-[#f6dfc5] hover:bg-[#45281c]'
                    )}
                  >
                    <Icon className="w-2.5 h-2.5 mr-1" />{option.label}
                  </Button>
                );
              })}
            </div>

            {/* 統計 */}
            <div className="mt-2.5 flex divide-x divide-white/10 overflow-hidden rounded-[0.9rem] border border-white/10 bg-black/25">
              <div className="flex-1 px-2.5 py-2">
                <div className="text-[6.5px] font-bold uppercase tracking-[0.1em] text-[#d9b495]/70">本頁</div>
                <div className="mt-0.5 text-[1.45rem] font-headline leading-none text-[#fff4e5]">{currentPageNotes.length}</div>
              </div>
              <div className="flex-1 px-2.5 py-2">
                <div className="text-[6.5px] font-bold uppercase tracking-[0.1em] text-[#d9b495]/70">平均風味</div>
                <div className="mt-0.5 text-[1.45rem] font-headline leading-none text-[#fff4e5]">{averageScore.toFixed(1)}</div>
              </div>
              <div className="flex-1 px-2.5 py-2">
                <div className="text-[6.5px] font-bold uppercase tracking-[0.1em] text-[#d9b495]/70">平均 CP</div>
                <div className="mt-0.5 text-[1.45rem] font-headline leading-none text-[#fff4e5]">{formatExpoCpScore(averageCpScore)}</div>
              </div>
            </div>

            {/* 翻頁 */}
            <div className="mt-2.5 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                className="rounded-full h-7 w-7 border-white/15 bg-white/5 p-0 text-[#fff4e5] hover:bg-white/10"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <p className="flex-1 text-center text-[10px] text-[#dcb89b]">第 {pageIndex + 1} / {totalPages} 頁</p>
              <Button
                type="button"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                className="rounded-full h-7 w-7 bg-[#f19245] p-0 text-[#1a120d] hover:bg-[#ffab60]"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* 版型 */}
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-2 text-[7px] font-bold uppercase tracking-[0.14em] text-[#ffcf99]/45">版型編排</p>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { id: 'magazine', label: '雜誌', sub: '圖左字右' },
                  { id: 'rows', label: '直列', sub: '五行橫排' },
                  { id: 'cinematic', label: '電影', sub: '全圖覆蓋' },
                ] as const).map(({ id, label, sub }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLayoutVariant(id)}
                    className={cn(
                      'rounded-[0.85rem] border py-2 text-center transition-all',
                      layoutVariant === id
                        ? 'border-[#ffd166] bg-[#ffd166]/12 shadow-[0_0_0_1.5px_rgba(255,209,102,0.28)]'
                        : 'border-white/15 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    <p className="text-[9px] font-bold text-[#fff4e5]">{label}</p>
                    <p className="text-[7px] text-[#d8b09a]/70">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 配色 */}
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-2 text-[7px] font-bold uppercase tracking-[0.14em] text-[#ffcf99]/45">卡片配色</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.entries(SHARE_CARD_THEMES) as Array<[ShareCardThemeId, typeof SHARE_CARD_THEMES[ShareCardThemeId]]>).map(([themeId, theme]) => (
                  <button
                    key={themeId}
                    type="button"
                    onClick={() => setShareCardTheme(themeId)}
                    style={{ backgroundColor: theme.exportBackground }}
                    className={cn(
                      'rounded-[0.85rem] border py-2.5 text-center transition-all',
                      shareCardTheme === themeId
                        ? 'border-[#ffd166] shadow-[0_0_0_2px_rgba(255,209,102,0.35)]'
                        : 'border-white/15 hover:border-white/30'
                    )}
                  >
                    <p
                      className="text-[9px] font-bold"
                      style={{
                        color: themeId.endsWith('-dark') ? '#f0ece4' : '#2a1f25',
                        textShadow: '0 1px 3px rgba(0,0,0,0.18)',
                      }}
                    >
                      {theme.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-2.5 backdrop-blur-xl">
            <div
              ref={shareCardRef}
              className={cn('mx-auto aspect-[9/16] w-full max-w-[432px] overflow-hidden rounded-[1.5rem] border p-3', currentShareCardTheme.shellClassName)}
            >
              {isNotesLoading ? (
                <div className={cn('flex h-full items-center justify-center rounded-[1.4rem] border', currentShareCardTheme.emptyClassName)}>
                  <Loader2 className="h-8 w-8 animate-spin text-[#c17c45]" />
                </div>
              ) : currentPageNotes.length === 0 ? (
                <div className={cn('flex h-full flex-col items-center justify-center rounded-[1.4rem] border border-dashed px-6 text-center', currentShareCardTheme.emptyClassName)}>
                  <Trophy className="mb-4 h-9 w-9 text-[#c17c45]" />
                  <p className={cn('text-lg font-bold', currentShareCardTheme.titleClassName)}>目前還沒有可排名的快記</p>
                  <p className={cn('mt-2 text-sm leading-7', currentShareCardTheme.metaClassName)}>先回工作台新增幾杯，這裡就會變成可以直接截圖或匯出的打卡頁。</p>
                </div>
              ) : (
                <div className={cn('flex h-full flex-col rounded-[1.2rem] border px-2 py-2', currentShareCardTheme.frameClassName)}>
                  {/* ── HEADER: compact, no chip row ── */}
                  <div className={cn('shrink-0 border-b pb-1.5', currentShareCardTheme.dividerClassName)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className={cn('text-[7px] font-bold tracking-[0.18em]', currentShareCardTheme.eyebrowClassName)}>sakepath.com</div>
                        <h2 className={cn('mt-0.5 break-words text-[16px] font-headline font-bold leading-[1.0]', currentShareCardTheme.titleClassName)} style={clampText(1)}>{event.name}</h2>
                      </div>
                      <div className={cn('shrink-0 rounded-[0.9rem] border px-2 py-1.5 text-right', currentShareCardTheme.modeChipClassName)}>
                        <div className={cn('text-[5.5px] font-bold uppercase tracking-[0.16em]', currentShareCardTheme.modeLabelClassName)}>榜單模式</div>
                        <div className={cn('mt-0.5 text-[9px] font-bold', currentShareCardTheme.modeValueClassName)}>{currentSortMeta.label}</div>
                      </div>
                    </div>
                  </div>

                  {/* ── MAIN CONTENT ── */}
                  {layoutVariant === 'rows' ? (
                    /* ── ROWS: 5 平分卡片，圖左内容右 ── */
                    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-[3px] overflow-hidden">
                      {currentPageNotes.map((note) => {
                        const cpScore = getExpoCpScore(note);
                        const authorNote = getRankingAuthorNote(note);
                        return (
                          <div
                            key={note.id}
                            className={cn('flex min-h-0 flex-1 items-stretch overflow-hidden rounded-[0.85rem] border', currentShareCardTheme.rowBaseClassName)}
                          >
                            {/* 左側：圖片 object-cover 伸展充滿 */}
                            <div className="relative w-[34%] shrink-0 overflow-hidden">
                              {note.imageUrls?.[0] ? (
                                <Image src={note.imageUrls[0]} alt={getExpoNoteDisplayName(note)} fill unoptimized className="object-cover" />
                              ) : (
                                <div className={cn('flex h-full items-center justify-center text-[6px] font-bold uppercase', currentShareCardTheme.modeLabelClassName, currentShareCardTheme.modeChipClassName)}>No Pic</div>
                              )}
                            </div>
                            {/* 右側：標題 + 酒造 + 攤位 + 分隔 + 數字 + 分隔 + 描述 */}
                            <div className={cn('flex min-w-0 flex-1 flex-col justify-between overflow-hidden px-2 py-1.5', currentShareCardTheme.modeChipClassName)}>
                              <div className="min-h-0 overflow-hidden">
                                <div className={cn('text-[10px] font-bold leading-[1.1]', currentShareCardTheme.titleClassName)} style={clampText(2)}>
                                  {getExpoNoteDisplayName(note)}
                                </div>
                                <div className={cn('mt-0.5 text-[6.5px] leading-[1.2]', currentShareCardTheme.metaClassName)} style={clampText(1)}>
                                  {getRankingBrewery(note)}
                                </div>
                                <div className={cn('text-[6.5px] leading-[1.2]', currentShareCardTheme.metaClassName)} style={clampText(1)}>
                                  {getRankingBooth(note)}
                                </div>
                              </div>
                              <div className={cn('border-t my-1', currentShareCardTheme.dividerClassName)} />
                              <div className="grid grid-cols-3 gap-0.5">
                                <div>
                                  <div className={cn('text-[5.5px] font-bold uppercase tracking-[0.05em]', currentShareCardTheme.tableHeaderClassName)}>價格</div>
                                  <div className={cn('mt-0.5 text-[9px] font-bold leading-none', currentShareCardTheme.valueClassName)}>{typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '--'}</div>
                                </div>
                                <div>
                                  <div className={cn('text-[5.5px] font-bold uppercase tracking-[0.05em]', currentShareCardTheme.tableHeaderClassName)}>風味</div>
                                  <div className={cn('mt-0.5 text-[9px] font-bold leading-none', currentShareCardTheme.valueClassName)}>{formatFlavorRating(note.overallRating)}</div>
                                </div>
                                <div>
                                  <div className={cn('text-[5.5px] font-bold uppercase tracking-[0.05em]', currentShareCardTheme.tableHeaderClassName)}>CP</div>
                                  <div className={cn('mt-0.5 text-[9px] font-bold leading-none', currentShareCardTheme.valueClassName)}>{formatExpoCpScore(cpScore)}</div>
                                </div>
                              </div>
                              <div className={cn('border-t my-1', currentShareCardTheme.dividerClassName)} />
                              <div className="min-h-0 overflow-hidden">
                                <div className={cn('text-[5.5px] font-bold uppercase tracking-[0.1em]', currentShareCardTheme.tableHeaderClassName)}>作者描述</div>
                                <div className={cn('mt-0.5 text-[6.5px] leading-[1.2]', currentShareCardTheme.valueClassName)} style={clampText(2)}>
                                  {authorNote || '暫無描述'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : layoutVariant === 'cinematic' ? (
                    /* ── CINEMATIC: 全圖游標覆蓋 ── */
                    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                      {heroNote && (() => {
                        const heroScore = getExpoCpScore(heroNote);
                        const heroStyle = getRankMedalStyle(pageIndex * PAGE_SIZE + 1, shareCardTheme);
                        const heroAuthorNote = getRankingAuthorNote(heroNote);
                        return (
                          <div className={cn('relative min-h-0 flex-[3.2] overflow-hidden rounded-[1rem] border', heroStyle.rowClassName)}>
                            {heroNote.imageUrls?.[0] ? (
                              <Image src={heroNote.imageUrls[0]} alt={getExpoNoteDisplayName(heroNote)} fill unoptimized className="object-contain" />
                            ) : (
                              <div className={cn('h-full w-full', currentShareCardTheme.modeChipClassName)} />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-2.5">
                              <h3 className="break-words text-[18px] font-headline font-bold leading-[1.0] text-white" style={clampText(2)}>{getExpoNoteDisplayName(heroNote)}</h3>
                              <p className="mt-0.5 text-[7px] font-bold text-white/65" style={clampText(1)}>{getRankingBrewery(heroNote)} ・ {getRankingBooth(heroNote)}</p>
                              <div className="mt-1.5 flex items-end gap-3">
                                <div><div className="text-[5.5px] font-bold uppercase text-white/55">價格</div><div className="text-[11px] font-bold text-white">{typeof heroNote.expoMeta?.price === 'number' ? `$${heroNote.expoMeta.price}` : '--'}</div></div>
                                <div><div className="text-[5.5px] font-bold uppercase text-white/55">風味</div><div className="text-[11px] font-bold text-white">{formatFlavorRating(heroNote.overallRating)}</div></div>
                                <div><div className="text-[5.5px] font-bold uppercase text-white/55">CP</div><div className="text-[11px] font-bold text-white">{formatExpoCpScore(heroScore)}</div></div>
                              </div>
                              {heroAuthorNote ? <p className="mt-1 overflow-hidden text-[6.5px] leading-[1.2] text-white/75" style={clampText(2)}>{heroAuthorNote}</p> : null}
                            </div>
                          </div>
                        );
                      })()}
                      {featuredNotes.length > 0 && (
                        <div className="grid min-h-0 flex-[2.2] grid-cols-2 gap-1 overflow-hidden">
                          {featuredNotes.map((note, featuredIndex) => {
                            const rank = pageIndex * PAGE_SIZE + featuredIndex + 2;
                            const cpScore = getExpoCpScore(note);
                            const medalStyle = getRankMedalStyle(rank, shareCardTheme);
                            const authorNote = getRankingAuthorNote(note);
                            return (
                              <div key={note.id} className={cn('relative overflow-hidden rounded-[0.9rem] border', medalStyle.rowClassName)}>
                                {note.imageUrls?.[0] ? (
                                  <Image src={note.imageUrls[0]} alt={getExpoNoteDisplayName(note)} fill unoptimized className="object-contain" />
                                ) : (
                                  <div className={cn('h-full w-full', currentShareCardTheme.modeChipClassName)} />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-1.5">
                                  <div className="text-[9.5px] font-headline font-bold leading-[1.05] text-white" style={clampText(2)}>{getExpoNoteDisplayName(note)}</div>
                                  <div className="mt-0.5 text-[5.5px] text-white/60" style={clampText(1)}>{getRankingBrewery(note)} ・ {getRankingBooth(note)}</div>
                                  <div className="mt-1 flex items-end gap-2.5">
                                    <div><div className="text-[5px] uppercase text-white/55">價</div><div className="text-[7.5px] font-bold text-white">{typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '--'}</div></div>
                                    <div><div className="text-[5px] uppercase text-white/55">味</div><div className="text-[7.5px] font-bold text-white">{formatFlavorRating(note.overallRating)}</div></div>
                                    <div><div className="text-[5px] uppercase text-white/55">CP</div><div className="text-[7.5px] font-bold text-white">{formatExpoCpScore(cpScore)}</div></div>
                                  </div>
                                  {authorNote ? <div className="mt-0.5 overflow-hidden text-[5.5px] leading-[1.15] text-white/72" style={clampText(2)}>{authorNote}</div> : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {compactNotes.length > 0 && (
                        <div className="grid min-h-0 flex-[1.4] grid-rows-2 gap-1 overflow-hidden">
                          {compactNotes.map((note, compactIndex) => {
                            const rank = pageIndex * PAGE_SIZE + compactIndex + 4;
                            const cpScore = getExpoCpScore(note);
                            const medalStyle = getRankMedalStyle(rank, shareCardTheme);
                            const authorNote = getRankingAuthorNote(note);
                            return (
                              <div key={note.id} className={cn('flex h-full items-center gap-2 overflow-hidden rounded-[0.8rem] border px-2 py-1', currentShareCardTheme.rowBaseClassName, medalStyle.rowClassName)}>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <div className={cn('text-[8.5px] font-bold leading-[1.1]', currentShareCardTheme.titleClassName)} style={clampText(1)}>{getExpoNoteDisplayName(note)}</div>
                                  <div className={cn('mt-0.5 overflow-hidden text-[6px] leading-[1.1]', currentShareCardTheme.metaClassName)} style={clampText(1)}>{getRankingBrewery(note)}{authorNote ? ` ・ ${authorNote}` : ''}</div>
                                </div>
                                <div className={cn('shrink-0 rounded-[0.6rem] border px-2 py-1.5', currentShareCardTheme.modeChipClassName)}>
                                  <div className="flex gap-2.5">
                                    <div><div className={cn('text-[5px] uppercase', currentShareCardTheme.tableHeaderClassName)}>價</div><div className={cn('text-[7px] font-bold', currentShareCardTheme.valueClassName)}>{typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '--'}</div></div>
                                    <div><div className={cn('text-[5px] uppercase', currentShareCardTheme.tableHeaderClassName)}>味</div><div className={cn('text-[7px] font-bold', currentShareCardTheme.valueClassName)}>{formatFlavorRating(note.overallRating)}</div></div>
                                    <div><div className={cn('text-[5px] uppercase', currentShareCardTheme.tableHeaderClassName)}>CP</div><div className={cn('text-[7px] font-bold', currentShareCardTheme.valueClassName)}>{formatExpoCpScore(cpScore)}</div></div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── MAGAZINE (default): 左圖右字，2col featured ── */
                    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                      {heroNote && (() => {
                        const heroRank = pageIndex * PAGE_SIZE + 1;
                        const heroScore = getExpoCpScore(heroNote);
                        const heroStyle = getRankMedalStyle(heroRank, shareCardTheme);
                        const heroAuthorNote = getRankingAuthorNote(heroNote);
                        return (
                          <div className={cn('flex min-h-0 flex-[3.2] gap-1.5 overflow-hidden rounded-[1rem] border p-1.5', currentShareCardTheme.rowBaseClassName, heroStyle.rowClassName)}>
                            <div className={cn('relative w-[102px] shrink-0 overflow-hidden rounded-[0.85rem] border', currentShareCardTheme.modeChipClassName)}>
                              {heroNote.imageUrls?.[0] ? (
                                <Image src={heroNote.imageUrls[0]} alt={getExpoNoteDisplayName(heroNote)} fill unoptimized className="object-contain p-0.5" />
                              ) : (
                                <div className={cn('flex h-full items-center justify-center text-[7px] font-bold uppercase tracking-[0.16em]', currentShareCardTheme.modeLabelClassName)}>No Pic</div>
                              )}
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                              <h3 className={cn('shrink-0 break-words text-[18px] font-headline font-bold leading-[1.0]', currentShareCardTheme.titleClassName)} style={clampText(2)}>{getExpoNoteDisplayName(heroNote)}</h3>
                              <p className={cn('mt-0.5 shrink-0 text-[7.5px] font-bold leading-[1.1]', currentShareCardTheme.metaClassName)} style={clampText(1)}>{getRankingBrewery(heroNote)} ・ {getRankingBooth(heroNote)}</p>
                              <div className={cn('mt-1.5 shrink-0 grid grid-cols-3 border-y py-1.5', currentShareCardTheme.dividerClassName, currentShareCardTheme.valueClassName)}>
                                <div>
                                  <div className={cn('text-[6.5px] font-bold uppercase tracking-[0.1em]', currentShareCardTheme.tableHeaderClassName)}>價格</div>
                                  <div className="mt-0.5 text-[11px] font-bold">{typeof heroNote.expoMeta?.price === 'number' ? `$${heroNote.expoMeta.price}` : '--'}</div>
                                </div>
                                <div>
                                  <div className={cn('text-[6.5px] font-bold uppercase tracking-[0.1em]', currentShareCardTheme.tableHeaderClassName)}>風味</div>
                                  <div className="mt-0.5 text-[11px] font-bold">{formatFlavorRating(heroNote.overallRating)}</div>
                                </div>
                                <div>
                                  <div className={cn('text-[6.5px] font-bold uppercase tracking-[0.1em]', currentShareCardTheme.tableHeaderClassName)}>CP</div>
                                  <div className="mt-0.5 text-[11px] font-bold">{formatExpoCpScore(heroScore)}</div>
                                </div>
                              </div>
                              <div className="mt-1.5 min-h-0 flex-1 overflow-hidden">
                                <div className={cn('shrink-0 text-[6.5px] font-bold uppercase tracking-[0.1em]', currentShareCardTheme.tableHeaderClassName)}>作者描述</div>
                                <div className={cn('mt-0.5 overflow-hidden rounded-[0.75rem] border px-2 py-1.5 text-[7.5px] leading-[1.3]', currentShareCardTheme.modeChipClassName, currentShareCardTheme.valueClassName)} style={clampText(5)}>{heroAuthorNote || '暫無描述'}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {featuredNotes.length > 0 && (
                        <div className="grid min-h-0 flex-[2.5] grid-cols-2 gap-1 overflow-hidden">
                          {featuredNotes.map((note, featuredIndex) => {
                            const rank = pageIndex * PAGE_SIZE + featuredIndex + 2;
                            const cpScore = getExpoCpScore(note);
                            const medalStyle = getRankMedalStyle(rank, shareCardTheme);
                            const authorNote = getRankingAuthorNote(note);
                            return (
                              <div key={note.id} className={cn('flex h-full flex-col overflow-hidden rounded-[0.95rem] border p-1.5', currentShareCardTheme.rowBaseClassName, medalStyle.rowClassName)}>
                                <div className="flex min-h-0 flex-1 gap-1 overflow-hidden">
                                  <div className={cn('relative min-h-0 flex-1 overflow-hidden rounded-[0.75rem] border', currentShareCardTheme.modeChipClassName)}>
                                    {note.imageUrls?.[0] ? (
                                      <Image src={note.imageUrls[0]} alt={getExpoNoteDisplayName(note)} fill unoptimized className="object-contain p-0.5" />
                                    ) : (
                                      <div className={cn('flex h-full items-center justify-center text-[6.5px] font-bold uppercase', currentShareCardTheme.modeLabelClassName)}>No Pic</div>
                                    )}
                                  </div>
                                  <div className={cn('flex w-[40px] shrink-0 flex-col justify-around overflow-hidden rounded-[0.75rem] border px-1.5 py-1', currentShareCardTheme.modeChipClassName)}>
                                    <div>
                                      <div className={cn('text-[5.5px] font-bold uppercase', currentShareCardTheme.tableHeaderClassName)}>價</div>
                                      <div className={cn('mt-0.5 text-[7.5px] font-bold leading-none', currentShareCardTheme.valueClassName)}>{typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '--'}</div>
                                    </div>
                                    <div className={cn('border-t pt-1', currentShareCardTheme.dividerClassName)}>
                                      <div className={cn('text-[5.5px] font-bold uppercase', currentShareCardTheme.tableHeaderClassName)}>味</div>
                                      <div className={cn('mt-0.5 text-[7.5px] font-bold leading-none', currentShareCardTheme.valueClassName)}>{formatFlavorRating(note.overallRating)}</div>
                                    </div>
                                    <div className={cn('border-t pt-1', currentShareCardTheme.dividerClassName)}>
                                      <div className={cn('text-[5.5px] font-bold uppercase', currentShareCardTheme.tableHeaderClassName)}>CP</div>
                                      <div className={cn('mt-0.5 text-[7.5px] font-bold leading-none', currentShareCardTheme.valueClassName)}>{formatExpoCpScore(cpScore)}</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-1 shrink-0">
                                  <div className={cn('break-words text-[9.5px] font-bold leading-[1.1]', currentShareCardTheme.titleClassName)} style={clampText(2)}>{getExpoNoteDisplayName(note)}</div>
                                  <div className={cn('mt-0.5 text-[6px] font-bold leading-[1.05]', currentShareCardTheme.metaClassName)} style={clampText(1)}>{getRankingBrewery(note)} ・ {getRankingBooth(note)}</div>
                                  <div className={cn('mt-0.5 overflow-hidden text-[6.5px] leading-[1.2]', currentShareCardTheme.valueClassName)} style={clampText(2)}>{authorNote || '暫無描述'}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {compactNotes.length > 0 && (
                        <div className="grid min-h-0 flex-[1.6] grid-rows-2 gap-1 overflow-hidden">
                          {compactNotes.map((note, compactIndex) => {
                            const rank = pageIndex * PAGE_SIZE + compactIndex + 4;
                            const cpScore = getExpoCpScore(note);
                            const medalStyle = getRankMedalStyle(rank, shareCardTheme);
                            const authorNote = getRankingAuthorNote(note);
                            return (
                              <div key={note.id} className={cn('flex h-full items-center gap-1.5 overflow-hidden rounded-[0.85rem] border p-1.5', currentShareCardTheme.rowBaseClassName, medalStyle.rowClassName)}>
                                <div className={cn('relative h-full w-[52px] shrink-0 overflow-hidden rounded-[0.65rem] border', currentShareCardTheme.modeChipClassName)}>
                                  {note.imageUrls?.[0] ? (
                                    <Image src={note.imageUrls[0]} alt={getExpoNoteDisplayName(note)} fill unoptimized className="object-contain p-0.5" />
                                  ) : (
                                    <div className={cn('flex h-full items-center justify-center text-[5.5px] font-bold uppercase', currentShareCardTheme.modeLabelClassName)}>No Pic</div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <div className={cn('text-[8.5px] font-bold leading-[1.1]', currentShareCardTheme.titleClassName)} style={clampText(1)}>{getExpoNoteDisplayName(note)}</div>
                                  <div className={cn('mt-0.5 text-[6px] font-bold leading-[1.05]', currentShareCardTheme.metaClassName)} style={clampText(1)}>{getRankingBrewery(note)} ・ {getRankingBooth(note)}</div>
                                  <div className={cn('mt-0.5 overflow-hidden text-[6.5px] leading-[1.1]', currentShareCardTheme.valueClassName)} style={clampText(2)}>{authorNote || '暫無描述'}</div>
                                </div>
                                <div className={cn('shrink-0 rounded-[0.65rem] border px-1.5 py-1.5', currentShareCardTheme.modeChipClassName)}>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <div><div className={cn('text-[5.5px] uppercase', currentShareCardTheme.tableHeaderClassName)}>價</div><div className={cn('mt-0.5 text-[7px] font-bold', currentShareCardTheme.valueClassName)}>{typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '--'}</div></div>
                                    <div><div className={cn('text-[5.5px] uppercase', currentShareCardTheme.tableHeaderClassName)}>味</div><div className={cn('mt-0.5 text-[7px] font-bold', currentShareCardTheme.valueClassName)}>{formatFlavorRating(note.overallRating)}</div></div>
                                    <div><div className={cn('text-[5.5px] uppercase', currentShareCardTheme.tableHeaderClassName)}>CP</div><div className={cn('mt-0.5 text-[7px] font-bold', currentShareCardTheme.valueClassName)}>{formatExpoCpScore(cpScore)}</div></div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── FOOTER ── */}
                  <div className={cn('mt-1 flex shrink-0 items-center justify-between gap-2 border-t pt-1.5 text-[5.5px] font-bold uppercase tracking-[0.06em]', currentShareCardTheme.footerClassName)}>
                    <div className="whitespace-nowrap">酒展快記 TOP 5 · Pg {pageIndex + 1}/{totalPages} · Avg {averageScore.toFixed(1)}</div>
                    <div className="whitespace-nowrap">CP = (風味^1.5 / 價格) × 係數</div>
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