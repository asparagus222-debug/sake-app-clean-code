'use client'

import React from 'react';
import { useRouter } from 'next/navigation';
import { SakeNote } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Trophy, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export default function RankingsPage() {
  const router = useRouter();
  const firestore = useFirestore();

  const rankingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sakeTastingNotes'), orderBy('overallRating', 'desc'), limit(500));
  }, [firestore]);
  const { data: notes, isLoading } = useCollection<SakeNote>(rankingQuery);

  const brandGroups = React.useMemo(() => {
    if (!notes) return [];
    const map = new Map<string, { brandName: string; brewery: string; notes: SakeNote[] }>();
    for (const note of notes) {
      const key = `${note.brandName}|||${note.brewery}`;
      if (!map.has(key)) map.set(key, { brandName: note.brandName, brewery: note.brewery, notes: [] });
      map.get(key)!.notes.push(note);
    }
    return [...map.values()]
      .map(g => ({
        ...g,
        avgRating: g.notes.reduce((s, n) => s + n.overallRating, 0) / g.notes.length,
        imageUrl: [...g.notes]
          .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
          .find(n => n.imageUrls?.[0])?.imageUrls?.[0],
      }))
      .sort((a, b) => b.avgRating - a.avgRating);
  }, [notes]);

  const breweryGroups = React.useMemo(() => {
    if (!notes) return [];
    const map = new Map<string, { brewery: string; brandSet: Set<string>; notes: SakeNote[] }>();
    for (const note of notes) {
      if (!map.has(note.brewery)) map.set(note.brewery, { brewery: note.brewery, brandSet: new Set(), notes: [] });
      const g = map.get(note.brewery)!;
      g.brandSet.add(note.brandName);
      g.notes.push(note);
    }
    return [...map.values()]
      .map(g => {
        const avgRating = g.notes.reduce((s, n) => s + n.overallRating, 0) / g.notes.length;
        // 找評分最高的代表銘柄
        const brandAvg = new Map<string, number[]>();
        for (const n of g.notes) {
          if (!brandAvg.has(n.brandName)) brandAvg.set(n.brandName, []);
          brandAvg.get(n.brandName)!.push(n.overallRating);
        }
        let topBrand = '', topAvg = 0;
        brandAvg.forEach((ratings, brand) => {
          const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
          if (avg > topAvg) { topAvg = avg; topBrand = brand; }
        });
        const imageUrl = [...g.notes]
          .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
          .find(n => n.imageUrls?.[0])?.imageUrls?.[0];
        return { ...g, avgRating, topBrand, imageUrl, brandCount: g.brandSet.size };
      })
      .sort((a, b) => b.avgRating - a.avgRating);
  }, [notes]);

  return (
    <div className="min-h-screen notebook-texture pb-32 font-body">
      <nav className="sticky top-0 z-50 dark-glass border-b border-white/5 px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-primary/10 text-primary shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-sm font-headline font-bold text-primary gold-glow tracking-widest">排行榜</h1>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Tabs defaultValue="brand">
          <TabsList className="bg-white/5 border border-white/10 rounded-full p-1 h-12 mb-8 w-full">
            <TabsTrigger value="brand" className="rounded-full flex-1 text-[10px] font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <Trophy className="w-3 h-3 mr-2" /> 銘柄排名
            </TabsTrigger>
            <TabsTrigger value="brewery" className="rounded-full flex-1 text-[10px] font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              <Building2 className="w-3 h-3 mr-2" /> 酒造排名
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="brand" className="mt-0 space-y-2">
                {brandGroups.map((g, idx) => (
                  <Link key={`${g.brandName}-${g.brewery}`} href={`/sake?brand=${encodeURIComponent(g.brandName)}&brewery=${encodeURIComponent(g.brewery)}`}>
                    <RankRow
                      rank={idx + 1}
                      imageUrl={g.imageUrl}
                      title={g.brandName}
                      subtitle={g.brewery}
                      avgRating={g.avgRating}
                      noteCount={g.notes.length}
                    />
                  </Link>
                ))}
              </TabsContent>

              <TabsContent value="brewery" className="mt-0 space-y-2">
                {breweryGroups.map((g, idx) => (
                  <Link key={g.brewery} href={`/sake?brand=${encodeURIComponent(g.topBrand)}&brewery=${encodeURIComponent(g.brewery)}`}>
                    <RankRow
                      rank={idx + 1}
                      imageUrl={g.imageUrl}
                      title={g.brewery}
                      subtitle={`${g.brandCount} 款銘柄`}
                      avgRating={g.avgRating}
                      noteCount={g.notes.length}
                    />
                  </Link>
                ))}
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
}

function RankRow({ rank, imageUrl, title, subtitle, avgRating, noteCount }: {
  rank: number;
  imageUrl?: string;
  title: string;
  subtitle: string;
  avgRating: number;
  noteCount: number;
}) {
  return (
    <div className="flex items-center gap-3 dark-glass border border-white/10 hover:border-primary/40 rounded-2xl p-3 transition-all group cursor-pointer">
      <div className={cn(
        "w-8 h-8 shrink-0 flex items-center justify-center rounded-full font-bold text-xs",
        rank === 1 ? "bg-amber-400/20 text-amber-400 border border-amber-400/30" :
        rank === 2 ? "bg-slate-400/20 text-slate-300 border border-slate-400/30" :
        rank === 3 ? "bg-amber-700/20 text-amber-600 border border-amber-700/30" :
        "bg-white/5 text-muted-foreground border border-white/10"
      )}>
        {rank}
      </div>
      {imageUrl ? (
        <div className="w-10 h-10 shrink-0 rounded-xl overflow-hidden">
          <img src={imageUrl} className="w-full h-full object-cover" alt={title} />
        </div>
      ) : (
        <div className="w-10 h-10 shrink-0 rounded-xl bg-white/5 border border-white/10" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">{title}</p>
        <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-primary font-bold text-sm">{avgRating.toFixed(1)}</div>
        <div className="text-[9px] text-muted-foreground">{noteCount} 篇</div>
      </div>
    </div>
  );
}
