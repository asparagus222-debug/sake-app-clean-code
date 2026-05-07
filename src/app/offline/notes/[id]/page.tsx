'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SakeRadarChart } from '@/components/SakeRadarChart';
import { ArrowLeft, Edit, Star, Trash2, Upload, Wifi, WifiOff } from 'lucide-react';
import { getNoteById, getAllImages, deleteNote, OfflineNote } from '@/lib/offline-storage';
import { RATING_LABELS } from '@/lib/types';
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

export default function OfflineNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = useState<OfflineNote | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const n = getNoteById(id);
    if (!n) { router.replace('/offline'); return; }
    setNote(n);
    getAllImages(n.imageIds).then(setImages);
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [id, router]);

  const handleDelete = () => {
    if (!note) return;
    deleteNote(note.id);
    toast({ title: '筆記已刪除' });
    router.replace('/offline');
  };

  if (!note) return null;

  const labels = [
    { label: '甜度', value: note.sweetnessRating, desc: RATING_LABELS.sweetness[note.sweetnessRating - 1] },
    { label: '酸度', value: note.acidityRating, desc: RATING_LABELS.acidity[note.acidityRating - 1] },
    { label: '苦味', value: note.bitternessRating, desc: RATING_LABELS.bitterness[note.bitternessRating - 1] },
    { label: '旨味', value: note.umamiRating, desc: RATING_LABELS.umami[note.umamiRating - 1] },
    { label: '澀感', value: note.astringencyRating, desc: RATING_LABELS.astringency[note.astringencyRating - 1] },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-24 font-body">
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center justify-between gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          {note.uploadedFirestoreId ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">已上傳</Badge>
          ) : (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">本機</Badge>
          )}
          <Link href={`/offline/notes/${id}/edit`}>
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white">
              <Edit className="w-4 h-4" />
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white/30 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#0f0f11] border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>確認刪除？</AlertDialogTitle>
                <AlertDialogDescription>此筆記將從裝置上永久移除，無法復原。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">刪除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-8">
        {/* 圖片 */}
        {images.length > 0 && (
          <div className="flex gap-3">
            {images.map((img, i) => (
              <div key={i} className="flex-1 aspect-[4/3] rounded-2xl overflow-hidden">
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* 標題 */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{note.brandName}</h1>
              {note.subBrand && <p className="text-[#f97316]/70 text-sm">{note.subBrand}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Star className="w-5 h-5 text-[#f97316]" />
              <span className="text-2xl font-bold text-[#f97316]">{note.overallRating}</span>
              <span className="text-white/30 text-sm">/10</span>
            </div>
          </div>
          <p className="text-white/50 text-sm">{note.brewery}</p>
          {note.origin && <p className="text-white/30 text-xs">{note.origin}</p>}
          <p className="text-white/20 text-xs">{note.tastingDate}</p>
        </div>

        {/* 風味標籤 */}
        {note.styleTags && note.styleTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {note.styleTags.map(tag => (
              <Badge key={tag} variant="outline" className="border-[#f97316]/30 text-[#f97316]/80 text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* 雷達圖 */}
        <div className="w-full max-w-xs mx-auto">
          <SakeRadarChart data={{
            sweetness: note.sweetnessRating,
            acidity: note.acidityRating,
            bitterness: note.bitternessRating,
            umami: note.umamiRating,
            astringency: note.astringencyRating,
          }} />
        </div>

        {/* 風味細目 */}
        <div className="grid grid-cols-2 gap-3">
          {labels.map(({ label, value, desc }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center">
              <span className="text-white/40 text-xs font-bold">{label}</span>
              <span className="text-[#f97316] font-bold text-sm">{desc} <span className="text-white/30 text-xs">({value})</span></span>
            </div>
          ))}
        </div>

        {/* 品飲描述 */}
        {note.description && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">品飲描述</p>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{note.description}</p>
          </div>
        )}

        {/* 上傳分享按鈕 */}
        {!note.uploadedFirestoreId && (
          <div className="pt-2">
            {isOnline ? (
              <Link href={`/offline/notes/${id}/upload`} className="block">
                <Button className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold h-12 rounded-xl shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                  <Upload className="w-4 h-4 mr-2" /> 上傳到網路分享
                </Button>
              </Link>
            ) : (
              <Button disabled className="w-full h-12 rounded-xl opacity-40">
                <WifiOff className="w-4 h-4 mr-2" /> 需要連線才能上傳
              </Button>
            )}
          </div>
        )}
        {note.uploadedFirestoreId && (
          <div className="text-center py-3">
            <p className="text-green-400/60 text-xs font-bold uppercase tracking-widest">已發佈至社群</p>
            <Link href={`/notes/${note.uploadedFirestoreId}`} className="text-[#f97316] text-xs underline mt-1 inline-block">
              查看發佈頁面
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
