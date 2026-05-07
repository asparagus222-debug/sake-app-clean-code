'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Star, Upload, Trash2, ChevronRight, WifiOff } from 'lucide-react';
import { getExpoById, getNotesByExpo, deleteExpo, deleteNote, OfflineExpo, OfflineNote } from '@/lib/offline-storage';
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

export default function OfflineExpoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [expo, setExpo] = useState<OfflineExpo | null>(null);
  const [notes, setNotes] = useState<OfflineNote[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  const refresh = useCallback(() => {
    const e = getExpoById(id);
    if (!e) { router.replace('/offline'); return; }
    setExpo(e);
    setNotes(getNotesByExpo(id));
  }, [id, router]);

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

  const handleDeleteNote = (noteId: string) => {
    deleteNote(noteId);
    refresh();
    toast({ title: '筆記已刪除' });
  };

  const handleDeleteExpo = () => {
    deleteExpo(id);
    toast({ title: '活動已刪除' });
    router.replace('/offline');
  };

  if (!expo) return null;

  const pendingCount = notes.filter(n => !n.uploadedFirestoreId).length;

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-32 font-body">
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center justify-between gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/60 hover:text-white shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{expo.title}</h1>
          {expo.location && <p className="text-[10px] text-white/30">{expo.location}</p>}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white/20 hover:text-red-400 shrink-0">
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-[#0f0f11] border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle>確認刪除活動？</AlertDialogTitle>
              <AlertDialogDescription>活動及所有相關筆記將從裝置上永久移除。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExpo} className="bg-red-500 hover:bg-red-600">刪除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* 活動資訊 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-xs">{expo.startDate}{expo.endDate ? ` — ${expo.endDate}` : ''}</p>
            </div>
            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="text-[#f97316] font-bold text-lg">{notes.length}</p>
                <p className="text-[9px] text-white/30 uppercase tracking-widest">筆記</p>
              </div>
              {pendingCount > 0 && (
                <div>
                  <p className="text-yellow-400 font-bold text-lg">{pendingCount}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest">待上傳</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 批次上傳提示 */}
        {pendingCount > 0 && isOnline && (
          <div className="bg-[#f97316]/10 border border-[#f97316]/30 rounded-2xl p-4 flex items-center justify-between gap-4">
            <p className="text-white/70 text-sm">{pendingCount} 筆筆記可上傳分享</p>
            <Link href={`/offline/expos/${id}/upload`}>
              <Button size="sm" className="bg-[#f97316] hover:bg-[#ea580c] text-white rounded-full font-bold text-xs shrink-0">
                <Upload className="w-3 h-3 mr-1" /> 全部上傳
              </Button>
            </Link>
          </div>
        )}
        {pendingCount > 0 && !isOnline && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
            <WifiOff className="w-4 h-4 text-white/30 shrink-0" />
            <p className="text-white/30 text-sm">{pendingCount} 筆待上傳，連線後可分享</p>
          </div>
        )}

        {/* 筆記列表 */}
        {notes.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl space-y-4">
            <p className="text-white/30 text-xs font-bold uppercase tracking-widest">尚無筆記</p>
            <Link href={`/offline/notes/new?expoId=${id}&expoTitle=${encodeURIComponent(expo.title)}`}>
              <Button size="sm" className="bg-[#f97316] hover:bg-[#ea580c] text-white rounded-full px-6">
                <Plus className="w-3 h-3 mr-1" /> 新增筆記
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-sm truncate">{note.brandName}</h3>
                      {note.uploadedFirestoreId ? (
                        <Badge variant="outline" className="text-[9px] border-green-400/40 text-green-400">已上傳</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-yellow-400/40 text-yellow-400">本地</Badge>
                      )}
                    </div>
                    <p className="text-white/40 text-[11px]">{note.brewery}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="w-3 h-3 text-[#f97316]" />
                    <span className="text-sm font-bold text-[#f97316]">{note.overallRating}</span>
                  </div>
                </div>
                {note.description && (
                  <p className="text-white/40 text-xs line-clamp-2">{note.description}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-white/20">{note.tastingDate}</p>
                  <div className="flex items-center gap-2">
                    {!note.uploadedFirestoreId && isOnline && (
                      <Link href={`/offline/notes/${note.id}/upload`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-[#f97316] hover:bg-[#f97316]/10 rounded-full">
                          <Upload className="w-3 h-3 mr-1" /> 分享
                        </Button>
                      </Link>
                    )}
                    <Link href={`/offline/notes/${note.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-white/40 hover:text-white rounded-full">
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
                          <AlertDialogDescription>此筆記將從裝置上永久移除。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteNote(note.id)} className="bg-red-500 hover:bg-red-600">刪除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <Link href={`/offline/notes/new?expoId=${id}&expoTitle=${encodeURIComponent(expo.title)}`}>
          <Button size="lg" className="h-14 px-6 rounded-full bg-[#f97316] hover:bg-[#ea580c] shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:scale-105 transition-all text-sm font-bold">
            <Plus className="w-5 h-5 mr-2" /> 新增筆記
          </Button>
        </Link>
      </div>
    </div>
  );
}
