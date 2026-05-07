'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  BookOpen,
  CalendarDays,
  Wifi,
  Star,
  Trash2,
  Upload,
  ChevronRight,
  WifiOff,
  Globe,
  Edit,
} from 'lucide-react';
import { getAllNotes, getAllExpos, deleteNote, deleteExpo, OfflineNote, OfflineExpo } from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function OfflinePage() {
  const { toast } = useToast();
  const [notes, setNotes] = useState<OfflineNote[]>([]);
  const [expos, setExpos] = useState<OfflineExpo[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  const refresh = useCallback(() => {
    setNotes(getAllNotes());
    setExpos(getAllExpos());
  }, []);

  useEffect(() => {
    refresh();
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh]);

  const handleDeleteNote = (id: string) => {
    deleteNote(id);
    refresh();
    toast({ title: '筆記已刪除' });
  };

  const handleDeleteExpo = (id: string) => {
    deleteExpo(id);
    refresh();
    toast({ title: '活動已刪除' });
  };

  const standAloneNotes = notes.filter(n => !n.expoId);

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-32 font-body">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/5 px-5 py-4 flex justify-between items-center gap-4">
        <div>
          <h1 className="text-base font-bold text-[#f97316] tracking-widest">品飲筆記</h1>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">離線版</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full border ${isOnline ? 'text-green-400 border-green-400/30 bg-green-400/10' : 'text-white/40 border-white/10 bg-white/5'}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? '連線中' : '離線'}
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="rounded-full text-[10px] font-bold text-white/40 hover:text-[#f97316] border border-white/10 h-8 px-3">
              <Globe className="w-3 h-3 mr-1" /> 完整版
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 統計區 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
            <p className="text-2xl font-bold text-[#f97316]">{notes.length}</p>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">筆記總數</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
            <p className="text-2xl font-bold text-[#f97316]">{notes.filter(n => !n.uploadedFirestoreId).length}</p>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">待上傳</p>
          </div>
        </div>

        {/* 分頁 */}
        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 rounded-full p-1 h-11 w-full">
            <TabsTrigger value="notes" className="flex-1 rounded-full text-[10px] font-bold data-[state=active]:bg-[#f97316] data-[state=active]:text-white">
              <BookOpen className="w-3 h-3 mr-1" /> 品飲筆記
            </TabsTrigger>
            <TabsTrigger value="expos" className="flex-1 rounded-full text-[10px] font-bold data-[state=active]:bg-[#f97316] data-[state=active]:text-white">
              <CalendarDays className="w-3 h-3 mr-1" /> 活動
            </TabsTrigger>
          </TabsList>

          {/* 品飲筆記列表 */}
          <TabsContent value="notes" className="mt-4 space-y-3">
            {standAloneNotes.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-white/10 rounded-3xl space-y-4">
                <BookOpen className="w-10 h-10 text-white/20 mx-auto" />
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest">尚無品飲筆記</p>
                <Link href="/offline/notes/new">
                  <Button size="sm" className="mt-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-full px-6">
                    <Plus className="w-3 h-3 mr-1" /> 新增第一筆
                  </Button>
                </Link>
              </div>
            ) : (
              standAloneNotes.map(note => (
                <NoteCard key={note.id} note={note} onDelete={handleDeleteNote} isOnline={isOnline} />
              ))
            )}
          </TabsContent>

          {/* 活動列表 */}
          <TabsContent value="expos" className="mt-4 space-y-3">
            {expos.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-white/10 rounded-3xl space-y-4">
                <CalendarDays className="w-10 h-10 text-white/20 mx-auto" />
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest">尚無活動</p>
                <Link href="/offline/expos/new">
                  <Button size="sm" className="mt-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-full px-6">
                    <Plus className="w-3 h-3 mr-1" /> 建立活動
                  </Button>
                </Link>
              </div>
            ) : (
              expos.map(expo => (
                <ExpoCard key={expo.id} expo={expo} noteCount={notes.filter(n => n.expoId === expo.id).length} onDelete={handleDeleteExpo} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* FAB */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex gap-3">
        <Link href="/offline/notes/new">
          <Button size="lg" className="h-14 px-6 rounded-full bg-[#f97316] hover:bg-[#ea580c] shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] hover:scale-105 transition-all text-sm font-bold">
            <Plus className="w-5 h-5 mr-2" /> 新增筆記
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── 筆記卡片 ─────────────────────────────────────────────

function NoteCard({ note, onDelete, isOnline }: { note: OfflineNote; onDelete: (id: string) => void; isOnline: boolean }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 hover:border-[#f97316]/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white text-sm truncate">{note.brandName}</h3>
            {note.uploadedFirestoreId ? (
              <Badge variant="outline" className="text-[9px] border-green-400/40 text-green-400 bg-green-400/10">已上傳</Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] border-yellow-400/40 text-yellow-400 bg-yellow-400/10">本地</Badge>
            )}
          </div>
          <p className="text-white/40 text-[11px] truncate">{note.brewery}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Star className="w-3 h-3 text-[#f97316]" />
          <span className="text-sm font-bold text-[#f97316]">{note.overallRating}</span>
        </div>
      </div>

      <p className="text-white/50 text-xs line-clamp-2">{note.description}</p>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-white/30">{note.tastingDate}</p>
        <div className="flex items-center gap-2">
          {!note.uploadedFirestoreId && isOnline && (
            <Link href={`/offline/notes/${note.id}/upload`}>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-[#f97316] hover:bg-[#f97316]/10 rounded-full">
                <Upload className="w-3 h-3 mr-1" /> 分享
              </Button>
            </Link>
          )}
          <Link href={`/offline/notes/${note.id}/edit`}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/40 hover:text-white rounded-full">
              <Edit className="w-3 h-3" />
            </Button>
          </Link>
          <Link href={`/offline/notes/${note.id}`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-white/50 hover:text-white rounded-full">
              查看 <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/20 hover:text-red-400 rounded-full">
                <Trash2 className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#0f0f11] border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>確認刪除？</AlertDialogTitle>
                <AlertDialogDescription>此筆記將從裝置上永久移除，無法復原。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(note.id)} className="bg-red-500 hover:bg-red-600">刪除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ─── 活動卡片 ─────────────────────────────────────────────

function ExpoCard({ expo, noteCount, onDelete }: { expo: OfflineExpo; noteCount: number; onDelete: (id: string) => void }) {
  return (
    <Link href={`/offline/expos/${expo.id}`}>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-[#f97316]/30 transition-colors cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-sm">{expo.title}</h3>
            {expo.location && <p className="text-white/40 text-[11px]">{expo.location}</p>}
            <p className="text-white/30 text-[10px] mt-1">{expo.startDate}{expo.endDate ? ` — ${expo.endDate}` : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold text-[#f97316]">{noteCount}</p>
              <p className="text-[9px] text-white/30 uppercase tracking-widest">筆記</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20" />
          </div>
        </div>
      </div>
    </Link>
  );
}
