'use client';

import React, { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, orderBy, query, where } from 'firebase/firestore';
import { ArrowLeft, BadgeDollarSign, ChevronLeft, ChevronRight, ClipboardList, Download, Loader2, Share2, Sparkles, Star, Trophy, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { ExpoEvent, SakeNote } from '@/lib/types';
import { getExpoCpScore, getExpoNoteDisplayName, getSortableExpoCpScore, getSortableExpoPrice } from '@/lib/note-lifecycle';
import { cn } from '@/lib/utils';

type RankingSortMode = 'score' | 'price' | 'cp';
type ShareCardThemeId = 'plum-light' | 'moss-light' | 'midnight-dark' | 'charcoal-dark';

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
    label: '琅珀',
    exportBackground: '#f5eedf',
    shellClassName: 'border-[#d8c49a] bg-[linear-gradient(160deg,#faf4e6_0%,#ede0c4_100%)] shadow-[0_30px_80px_rgba(160,120,40,0.14)]',
    frameClassName: 'border-[#e0ccaa] bg-[#fdf9ee] text-[#2a1e08]',
    emptyClassName: 'border-[#d8c49a] bg-[#f5eedf] text-[#2a1e08]',
    dividerClassName: 'border-[#e4d0a8]',
    eyebrowClassName: 'text-[#a07828]',
    titleClassName: 'text-[#2a1e08]',
    modeChipClassName: 'border-[#e0ccaa] bg-[#f5eedc]',
    modeLabelClassName: 'text-[#a07828]',
    modeValueClassName: 'text-[#2a1e08]',
    tableClassName: 'border-[#e4d0a8] bg-[#fdf9ee]',
    tableHeaderClassName: 'text-[#a07828]',
    metaClassName: 'text-[#7a5820]',
    valueClassName: 'text-[#3e2c10]',
    footerClassName: 'border-[#e4d0a8] text-[#a07828]',
    rowBaseClassName: 'border-[#dcc8a0]',
    previewSwatchClassName: 'border-[#d8c49a] bg-[#ede0c4]',
  },
  'moss-light': {
    label: '薰衣草',
    exportBackground: '#ede8f5',
    shellClassName: 'border-[#cfc3e8] bg-[linear-gradient(160deg,#f0ecf8_0%,#e4daf2_100%)] shadow-[0_30px_80px_rgba(100,70,160,0.12)]',
    frameClassName: 'border-[#d8ccec] bg-[#faf8fd] text-[#1e1530]',
    emptyClassName: 'border-[#cfc3e8] bg-[#f2eef8] text-[#1e1530]',
    dividerClassName: 'border-[#ddd4f0]',
    eyebrowClassName: 'text-[#7860b0]',
    titleClassName: 'text-[#1e1530]',
    modeChipClassName: 'border-[#d8ccec] bg-[#f0eaf8]',
    modeLabelClassName: 'text-[#7860b0]',
    modeValueClassName: 'text-[#1e1530]',
    tableClassName: 'border-[#ddd4f0] bg-[#faf8fd]',
    tableHeaderClassName: 'text-[#7860b0]',
    metaClassName: 'text-[#5e4890]',
    valueClassName: 'text-[#2e2050]',
    footerClassName: 'border-[#ddd4f0] text-[#7860b0]',
    rowBaseClassName: 'border-[#d4c8e8]',
    previewSwatchClassName: 'border-[#cfc3e8] bg-[#e6dff5]',
  },
  'midnight-dark': {
    label: '酒紅',
    exportBackground: '#12080e',
    shellClassName: 'border-[#2e1020] bg-[linear-gradient(160deg,#1e0c18_0%,#0e0610_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.40)]',
    frameClassName: 'border-[#281018] bg-[#130810] text-[#f0e0e8]',
    emptyClassName: 'border-[#2e1020] bg-[#1a0c14] text-[#f0e0e8]',
    dividerClassName: 'border-[#2a1020]',
    eyebrowClassName: 'text-[#d47090]',
    titleClassName: 'text-[#f8eaee]',
    modeChipClassName: 'border-[#2e1020] bg-[#160a10]',
    modeLabelClassName: 'text-[#d47090]',
    modeValueClassName: 'text-[#f8eaee]',
    tableClassName: 'border-[#2a1020] bg-[#160a10]',
    tableHeaderClassName: 'text-[#c45878]',
    metaClassName: 'text-[#c08090]',
    valueClassName: 'text-[#f0d8e0]',
    footerClassName: 'border-[#2a1020] text-[#c45878]',
    rowBaseClassName: 'border-[#2e1020]',
    previewSwatchClassName: 'border-[#2e1020] bg-[#1e0c18]',
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
      gold: 'border-[#c8a840]/50 bg-[#fdf5d8]',
      goldRank: 'border-[#b89030] bg-[#d4a840] text-[#241800]',
      silver: 'border-[#c8bc9a]/55 bg-[#faf5e8]',
      silverRank: 'border-[#a09070] bg-[#c8b890] text-[#2a2010]',
      bronze: 'border-[#d4a870]/45 bg-[#f8f0e4]',
      bronzeRank: 'border-[#b47840] bg-[#d09060] text-[#2a1808]',
      base: 'bg-[#fdf9ee]',
      baseRank: 'border-[#dcc8a0] bg-[#f2e8d4] text-[#6a5020]',
    },
    'moss-light': {
      gold: 'border-[#d4c060]/45 bg-[#faf6e8]',
      goldRank: 'border-[#b8a030] bg-[#d8c048] text-[#201c08]',
      silver: 'border-[#c8b8e8]/55 bg-[#f4f0fc]',
      silverRank: 'border-[#9880d0] bg-[#c8b8e8] text-[#1a1030]',
      bronze: 'border-[#e0b8d0]/45 bg-[#f8eefc]',
      bronzeRank: 'border-[#b870a0] bg-[#d898c0] text-[#2e1028]',
      base: 'bg-[#faf8fd]',
      baseRank: 'border-[#d4c8e8] bg-[#ece8f8] text-[#4a3870]',
    },
    'midnight-dark': {
      gold: 'border-[#5a2818]/45 bg-[#1e0c08]',
      goldRank: 'border-[#d4a060] bg-[#e8b870] text-[#1c1008]',
      silver: 'border-[#3e1828]/55 bg-[#1a0c14]',
      silverRank: 'border-[#d090a8] bg-[#e8b8cc] text-[#180a12]',
      bronze: 'border-[#4a1828]/45 bg-[#1c0c10]',
      bronzeRank: 'border-[#c05870] bg-[#d88090] text-[#1c0a10]',
      base: 'bg-[#130810]',
      baseRank: 'border-[#2e1020] bg-[#1a0c14] text-[#f0d8e0]',
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

type ImageTransform = { scale: number; x: number; y: number };
const DEFAULT_TRANSFORM: ImageTransform = { scale: 1, x: 0, y: 0 };

function EditableImage({
  noteId, src, alt, transform, isEditing, isExporting, onToggleEdit, onTransformChange,
}: {
  noteId: string;
  src?: string;
  alt: string;
  transform: ImageTransform;
  isEditing?: boolean;
  isExporting: boolean;
  onToggleEdit: () => void;
  onTransformChange?: (t: ImageTransform) => void;
}) {
  if (!src) return null;
  const t = transform;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ cursor: isExporting ? 'default' : 'pointer' }}
      onClick={() => { if (!isExporting) onToggleEdit(); }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        draggable={false}
        style={{
          objectFit: 'contain',
          transform: `scale(${t.scale}) translate(${t.x / t.scale}px, ${t.y / t.scale}px)`,
          transformOrigin: 'center center',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
      {!isExporting && (
        <div className="pointer-events-none absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/50">
          <ZoomIn className="h-2.5 w-2.5 text-white/80" />
        </div>
      )}
    </div>
  );
}

export default function ExpoRankingPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const eventId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [sortMode, setSortMode] = useState<RankingSortMode>('score');
  const [shareCardTheme, setShareCardTheme] = useState<ShareCardThemeId>('plum-light');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(5);
  const [isExporting, setIsExporting] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const dialogDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [imgTransforms, setImgTransforms] = useState<Record<string, ImageTransform>>({});
  const [editingImg, setEditingImg] = useState<string | null>(null);
  const getImgTransform = (id: string): ImageTransform => imgTransforms[id] ?? DEFAULT_TRANSFORM;
  const setImgTransform = (id: string, t: ImageTransform) => setImgTransforms(prev => ({ ...prev, [id]: t }));
  const toggleEditImg = (id: string) => setEditingImg(id);

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

  const totalPages = Math.max(1, Math.ceil(rankedNotes.length / pageSize));
  const currentPageNotes = useMemo(() => {
    const safePageIndex = Math.min(pageIndex, totalPages - 1);
    return rankedNotes.slice(safePageIndex * pageSize, (safePageIndex + 1) * pageSize);
  }, [pageIndex, rankedNotes, totalPages, pageSize]);
  const currentSortMeta = SORT_MODE_META[sortMode];
  const currentShareCardTheme = SHARE_CARD_THEMES[shareCardTheme];
  const averageScore = useMemo(() => {
    if (currentPageNotes.length === 0) return 0;
    const sum = currentPageNotes.reduce((acc, note) => acc + (note.overallRating || 0), 0);
    return sum / currentPageNotes.length;
  }, [currentPageNotes]);


  React.useEffect(() => {
    setPageIndex(0);
  }, [sortMode]);

  React.useEffect(() => {
    setPageIndex(0);
  }, [pageSize]);

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
            <h1 className="mt-3 text-[2rem] font-headline font-bold tracking-[0.12em] text-[#fff4e5] uppercase break-words">活動排名打卡頁</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#d8b89a]">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><Trophy className="w-2.5 h-2.5 text-[#ffb86b]" /> {event.name}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><ClipboardList className="w-2.5 h-2.5 text-[#ffb86b]" /> 每頁 {pageSize} 名</span>
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

            {/* 顯示名數 */}
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-2 text-[7px] font-bold uppercase tracking-[0.14em] text-[#ffcf99]/45">顯示名數</p>
              <div className="grid grid-cols-6 gap-1">
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPageSize(n)}
                    className={cn(
                      'rounded-[0.85rem] border py-2 text-center transition-all',
                      pageSize === n
                        ? 'border-[#ffd166] bg-[#ffd166]/12 shadow-[0_0_0_1.5px_rgba(255,209,102,0.28)]'
                        : 'border-white/15 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    <p className="text-[9px] font-bold text-[#fff4e5]">{n}</p>
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
                  {/* ── LIST: 純文字清單，大排名數字 ── */}
                  <div className="mt-1 flex min-h-0 flex-1 flex-col gap-[3px] overflow-hidden">
                    {currentPageNotes.map((note, i) => {
                      const rank = pageIndex * pageSize + i + 1;
                      const cpScore = getExpoCpScore(note);
                      const authorNote = getRankingAuthorNote(note);
                      const medalStyle = getRankMedalStyle(rank, shareCardTheme);
                      return (
                        <div
                          key={note.id}
                          className={cn('flex min-h-0 flex-1 items-center overflow-hidden rounded-[0.85rem] border', currentShareCardTheme.rowBaseClassName, medalStyle.rowClassName)}
                        >
                          <div className="relative w-[28%] shrink-0 self-stretch overflow-hidden">
                            {note.imageUrls?.[0] ? (
                              <EditableImage
                                noteId={note.id}
                                src={note.imageUrls[0]}
                                alt={getExpoNoteDisplayName(note)}
                                transform={getImgTransform(note.id)}
                                isEditing={editingImg === note.id}
                                isExporting={isExporting}
                                onToggleEdit={() => toggleEditImg(note.id)}
                                onTransformChange={(t) => setImgTransform(note.id, t)}
                              />
                            ) : (
                              <div className={cn('flex h-full w-full items-center justify-center text-[6px] font-bold uppercase', currentShareCardTheme.modeLabelClassName)}>No Pic</div>
                            )}
                            <div className={cn('pointer-events-none absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border text-[8px] font-headline font-bold leading-none', medalStyle.rankClassName)}>
                              {rank}
                            </div>
                          </div>
                          <div className={cn('shrink-0 self-stretch border-l', currentShareCardTheme.dividerClassName)} />
                          <div className="min-w-0 flex-1 overflow-hidden px-2 py-1.5">
                            <div className={cn('text-[10px] font-bold leading-[1.1]', currentShareCardTheme.titleClassName)} style={clampText(1)}>
                              {getExpoNoteDisplayName(note)}
                            </div>
                            <div className={cn('mt-0.5 text-[6px] leading-[1.15]', currentShareCardTheme.metaClassName)} style={clampText(1)}>
                              {getRankingBrewery(note)} ・ {getRankingBooth(note)}
                            </div>
                            <div className={cn('mt-0.5 text-[6px] leading-[1.15]', currentShareCardTheme.valueClassName)} style={clampText(2)}>
                              {authorNote || '暫無描述'}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2.5 pr-2">
                            <div className="text-center">
                              <div className={cn('text-[5px] font-bold uppercase', currentShareCardTheme.tableHeaderClassName)}>價</div>
                              <div className={cn('mt-0.5 text-[8px] font-bold leading-none', currentShareCardTheme.valueClassName)}>{typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '--'}</div>
                            </div>
                            <div className="text-center">
                              <div className={cn('text-[5px] font-bold uppercase', currentShareCardTheme.tableHeaderClassName)}>味</div>
                              <div className={cn('mt-0.5 text-[8px] font-bold leading-none', currentShareCardTheme.valueClassName)}>{formatFlavorRating(note.overallRating)}</div>
                            </div>
                            <div className="text-center">
                              <div className={cn('text-[5px] font-bold uppercase', currentShareCardTheme.tableHeaderClassName)}>CP</div>
                              <div className={cn('mt-0.5 text-[8px] font-bold leading-none', currentShareCardTheme.valueClassName)}>{formatExpoCpScore(cpScore)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── FOOTER ── */}
                  <div className={cn('mt-1 flex shrink-0 items-center justify-between gap-2 border-t pt-1.5 text-[5.5px] font-bold uppercase tracking-[0.06em]', currentShareCardTheme.footerClassName)}>
                    <div className="whitespace-nowrap">酒展快記 TOP {pageSize} · Pg {pageIndex + 1}/{totalPages} · Avg {averageScore.toFixed(1)}</div>
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

        {/* Image Edit Dialog */}
        {editingImg && (() => {
          const dialogNote = currentPageNotes.find(n => n.id === editingImg);
          const dialogSrc = dialogNote?.imageUrls?.[0];
          const t = getImgTransform(editingImg);
          return (
            <Dialog open onOpenChange={(open) => { if (!open) setEditingImg(null); }}>
              <DialogContent className="max-w-[340px] rounded-2xl p-5">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold">調整圖片</DialogTitle>
                </DialogHeader>
                {/* Preview: drag to pan */}
                <div
                  className="relative w-full aspect-square rounded-xl overflow-hidden bg-black/10 cursor-grab active:cursor-grabbing touch-none select-none"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dialogDragRef.current = { startX: e.clientX, startY: e.clientY, origX: t.x, origY: t.y };
                  }}
                  onPointerMove={(e) => {
                    if (!dialogDragRef.current) return;
                    const dx = e.clientX - dialogDragRef.current.startX;
                    const dy = e.clientY - dialogDragRef.current.startY;
                    setImgTransform(editingImg, { ...t, x: dialogDragRef.current.origX + dx, y: dialogDragRef.current.origY + dy });
                  }}
                  onPointerUp={() => { dialogDragRef.current = null; }}
                  onPointerCancel={() => { dialogDragRef.current = null; }}
                >
                  {dialogSrc && (
                    <Image
                      src={dialogSrc}
                      alt={dialogNote ? getExpoNoteDisplayName(dialogNote) : ''}
                      fill
                      unoptimized
                      draggable={false}
                      style={{
                        objectFit: 'contain',
                        transform: `scale(${t.scale}) translate(${t.x / t.scale}px, ${t.y / t.scale}px)`,
                        transformOrigin: 'center center',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    />
                  )}
                  <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] text-white/80">拖曳移動圖片</div>
                </div>
                {/* Scale slider */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>縮放</span>
                    <span>{t.scale.toFixed(2)}×</span>
                  </div>
                  <Slider
                    min={0.5}
                    max={3}
                    step={0.05}
                    value={[t.scale]}
                    onValueChange={([val]) => setImgTransform(editingImg, { ...t, scale: val })}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/60">
                    <span>0.5×</span>
                    <span>3×</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setImgTransform(editingImg, DEFAULT_TRANSFORM)} className="flex-1 rounded-full text-xs">重置</Button>
                  <Button onClick={() => setEditingImg(null)} className="flex-1 rounded-full">完成</Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
      </div>
    </div>
  );
}