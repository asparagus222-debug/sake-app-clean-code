'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where } from 'firebase/firestore';
import {
  ArrowLeft, BookOpen, Star, Calendar, Edit2, Globe, Lock,
  Plus, Loader2, FileText, TrendingUp, Award, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { SakeNote } from '@/lib/types';
import { cn, formatSakeDisplayName } from '@/lib/utils';
import { isPublicPublishedNote } from '@/lib/note-lifecycle';

type SortMode = 'score' | 'date';

function NoteStatusChip({ note }: { note: SakeNote }) {
  const isPublished = isPublicPublishedNote(note);
  const isExpo = note.entryMode === 'expo-quick';
  const isDraft = note.publicationStatus === 'draft';
  const isPrivate = note.visibility === 'private';

  if (isExpo) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-300">
        酒展
      </span>
    );
  }
  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
        <Globe className="h-2 w-2" /> 已發布
      </span>
    );
  }
  if (isDraft) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
        <FileText className="h-2 w-2" /> 草稿
      </span>
    );
  }
  if (isPrivate) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/50">
        <Lock className="h-2 w-2" /> 私人
      </span>
    );
  }
  return null;
}

export default function MyTastingPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [sortMode, setSortMode] = useState<SortMode>('score');

  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'sakeTastingNotes'),
      where('userId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: rawNotes, isLoading } = useCollection<SakeNote>(notesQuery);

  const sortedNotes = useMemo(() => {
    if (!rawNotes) return [];
    const notes = [...rawNotes];
    if (sortMode === 'score') {
      return notes.sort((a, b) => {
        const aMax = a.sessions?.length
          ? Math.max(a.overallRating, ...a.sessions.map(s => s.overallRating))
          : a.overallRating;
        const bMax = b.sessions?.length
          ? Math.max(b.overallRating, ...b.sessions.map(s => s.overallRating))
          : b.overallRating;
        return bMax - aMax || (b.tastingDate || '').localeCompare(a.tastingDate || '');
      });
    }
    return notes.sort((a, b) =>
      (b.tastingDate || b.createdAt || '').localeCompare(a.tastingDate || a.createdAt || '')
    );
  }, [rawNotes, sortMode]);

  const stats = useMemo(() => {
    if (!rawNotes || rawNotes.length === 0) return { total: 0, avgRating: 0, publishedCount: 0 };
    const total = rawNotes.length;
    const avg = rawNotes.reduce((s, n) => s + n.overallRating, 0) / total;
    const publishedCount = rawNotes.filter(isPublicPublishedNote).length;
    return { total, avgRating: avg, publishedCount };
  }, [rawNotes]);

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(241,146,69,0.15),transparent_30%),linear-gradient(180deg,#1a1108_0%,#0d0a07_100%)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_top,rgba(241,146,69,0.15),transparent_30%),linear-gradient(180deg,#1a1108_0%,#0d0a07_100%)] px-6 text-center">
        <BookOpen className="h-12 w-12 text-primary/40" />
        <p className="text-sm text-white/50">請先登入才能查看個人品飲紀錄</p>
        <Button onClick={() => router.push('/')} variant="outline" className="rounded-full border-white/10 text-white/70">
          返回首頁
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(241,146,69,0.18),transparent_30%),linear-gradient(180deg,#1c1208_0%,#0d0a06_46%,#080705_100%)] pb-28 font-body text-white">
      {/* header */}
      <nav className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/5 bg-black/30 px-4 py-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-headline font-bold tracking-widest text-[#fff4e5] uppercase">個人品飲紀錄</h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#d8b09a]/50">My Tasting Journal</p>
        </div>
        <Link href="/notes/new">
          <Button className="h-9 rounded-full bg-[#ffd166] px-4 text-[10px] font-bold uppercase tracking-widest text-[#21150d] shadow-[0_6px_18px_rgba(255,209,102,0.22)] hover:bg-[#ffe08f]">
            <Plus className="mr-1 h-3.5 w-3.5" /> 新增
          </Button>
        </Link>
      </nav>

      <div className="mx-auto max-w-2xl px-4 pt-6">
        {/* stats strip */}
        <div className="mb-6 grid grid-cols-3 gap-2">
          {[
            { icon: BookOpen, label: '品飲總數', value: stats.total, unit: '筆' },
            { icon: Star, label: '平均評分', value: stats.avgRating.toFixed(1), unit: '/ 10' },
            { icon: Globe, label: '已發布', value: stats.publishedCount, unit: '篇' },
          ].map(({ icon: Icon, label, value, unit }) => (
            <div key={label} className="rounded-[1.2rem] border border-white/8 bg-white/4 px-3 py-3 text-center">
              <Icon className="mx-auto mb-1 h-3.5 w-3.5 text-[#ffb06a]" />
              <div className="text-[18px] font-headline font-bold leading-none text-[#fff4e5]">
                {value}
                <span className="ml-0.5 text-[9px] font-normal text-white/40">{unit}</span>
              </div>
              <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-white/35">{label}</div>
            </div>
          ))}
        </div>

        {/* sort tabs */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/30">排序</span>
          {([
            { id: 'score', label: '評分排名', icon: Award },
            { id: 'date', label: '最新紀錄', icon: Calendar },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSortMode(id)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all',
                sortMode === id
                  ? 'border-[#ffd166] bg-[#ffd166]/12 text-[#ffd166]'
                  : 'border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:text-white/70'
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* notes list */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-[1.2rem] bg-white/5" />
            ))}
          </div>
        ) : sortedNotes.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-5 text-center">
            <BookOpen className="h-14 w-14 text-white/10" />
            <p className="text-sm font-bold text-white/30">還沒有任何品飲紀錄</p>
            <Link href="/notes/new">
              <Button className="rounded-full bg-[#ffd166] px-6 text-[11px] font-bold uppercase tracking-widest text-[#21150d]">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> 開始記錄第一杯
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sortedNotes.map((note, i) => {
              const displayName = formatSakeDisplayName(note.brandName, note.subBrand);
              const bestRating = note.sessions?.length
                ? Math.max(note.overallRating, ...note.sessions.map(s => s.overallRating))
                : note.overallRating;
              const imageUrl = note.imageUrls?.[0];
              const isPublished = isPublicPublishedNote(note);
              const isExpo = note.entryMode === 'expo-quick';
              const showPublishCta = !isPublished && !isExpo;

              return (
                <div
                  key={note.id}
                  className="group flex items-center gap-3 overflow-hidden rounded-[1.2rem] border border-white/8 bg-white/4 px-3 py-2.5 transition-all hover:border-white/15 hover:bg-white/6"
                >
                  {/* rank / image */}
                  {sortMode === 'score' ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[0.75rem]">
                      {imageUrl ? (
                        <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/8 text-[9px] font-bold text-white/30">無圖</div>
                      )}
                      <div className={cn(
                        'absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-headline font-bold leading-none',
                        i === 0 ? 'bg-[#d4a840] text-[#241800]' :
                        i === 1 ? 'bg-[#c8b890] text-[#2a2010]' :
                        i === 2 ? 'bg-[#c08060] text-[#2a1808]' :
                        'bg-white/15 text-white/70'
                      )}>
                        {i + 1}
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[0.75rem]">
                      {imageUrl ? (
                        <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/8 text-[9px] font-bold text-white/30">無圖</div>
                      )}
                    </div>
                  )}

                  {/* text */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate text-[12px] font-bold text-[#fff4e5]">{displayName}</span>
                      <NoteStatusChip note={note} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[10px] text-white/40">{note.brewery}</span>
                      {note.tastingDate && (
                        <span className="text-[9px] text-white/25">{note.tastingDate.slice(0, 10)}</span>
                      )}
                    </div>
                    {isExpo && note.expoMeta?.eventName && (
                      <div className="mt-0.5 text-[9px] text-sky-400/70">{note.expoMeta.eventName}</div>
                    )}
                  </div>

                  {/* rating */}
                  <div className="shrink-0 text-right">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[18px] font-headline font-bold text-[#ffd166]">{bestRating.toFixed(1)}</span>
                      <span className="text-[8px] text-white/30">/10</span>
                    </div>
                    {note.sessions && note.sessions.length > 0 && (
                      <div className="text-[8px] text-white/30">{note.sessions.length + 1}次品飲</div>
                    )}
                  </div>

                  {/* actions */}
                  <div className="flex shrink-0 flex-col gap-1">
                    <Link href={isExpo ? `/expo/${note.expoMeta?.eventId}` : `/notes/${note.id}`}>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 hover:bg-white/12 hover:text-white transition-colors"
                        title="查看"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </Link>
                    {!isExpo && (
                      <Link href={`/notes/${note.id}/edit`}>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 hover:bg-white/12 hover:text-white transition-colors"
                          title="編輯"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </Link>
                    )}
                    {showPublishCta && (
                      <Link href={`/notes/${note.id}/edit?publish=1`}>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                          title="發布"
                        >
                          <TrendingUp className="h-3 w-3" />
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-8 right-6 z-50">
        <Link href="/notes/new">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full p-0 shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] hover:scale-110 transition-all"
          >
            <Plus className="h-7 w-7" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
