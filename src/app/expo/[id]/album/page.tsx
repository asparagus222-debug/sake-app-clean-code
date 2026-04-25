'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, orderBy, query, where } from 'firebase/firestore';
import { ArrowLeft, Check, Download, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { ExpoEvent, SakeNote } from '@/lib/types';
import { getExpoNoteDisplayName } from '@/lib/note-lifecycle';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ExpoAlbumPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const eventId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const [selectedPhotoKeys, setSelectedPhotoKeys] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const allPhotos = useMemo(() => {
    const photos: { key: string; src: string; noteName: string }[] = [];
    (rawNotes || []).forEach((note) => {
      (note.imageUrls || []).forEach((src, idx) => {
        if (src) photos.push({ key: `${note.id}-${idx}`, src, noteName: getExpoNoteDisplayName(note) });
      });
    });
    return photos;
  }, [rawNotes]);

  const downloadImage = async (src: string, filename: string) => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ variant: 'destructive', title: '下載失敗', description: '請稍後再試' });
    }
  };

  if (isUserLoading || isEventLoading) {
    return (
      <div className="min-h-screen notebook-texture flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen notebook-texture px-4 py-8 pb-24 font-body">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-primary">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">Photo Album</p>
              <h1 className="text-xl font-headline font-bold text-primary tracking-widest uppercase">活動相簿</h1>
              {event?.name && <p className="text-xs text-muted-foreground mt-0.5">{event.name}</p>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground shrink-0">{allPhotos.length} 張</p>
        </div>

        {/* Multi-select toolbar */}
        {multiSelectActive && (
          <div className="dark-glass rounded-[1.5rem] border border-white/10 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">已選 {selectedPhotoKeys.size} 張</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedPhotoKeys(new Set(allPhotos.map(p => p.key)))}
                className="rounded-full h-8 px-3 text-[10px] font-bold uppercase"
              >
                全選
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setSelectedPhotoKeys(new Set()); setMultiSelectActive(false); }}
                className="rounded-full h-8 px-3 text-[10px] font-bold uppercase"
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={selectedPhotoKeys.size === 0}
                onClick={async () => {
                  const toDownload = allPhotos.filter(p => selectedPhotoKeys.has(p.key));
                  for (const photo of toDownload) {
                    await downloadImage(photo.src, `${photo.noteName}-${photo.key}.jpg`);
                    await new Promise(r => setTimeout(r, 300));
                  }
                }}
                className="rounded-full h-8 px-3 text-[10px] font-bold uppercase"
              >
                <Download className="w-3 h-3 mr-1.5" /> 下載已選
              </Button>
            </div>
          </div>
        )}

        {/* Photo grid */}
        {isNotesLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : allPhotos.length === 0 ? (
          <div className="dark-glass rounded-[2rem] border border-dashed border-white/10 p-16 text-center text-sm text-muted-foreground">
            還沒有任何照片，快記時拍照後照片會出現在這裡。
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {allPhotos.map((photo) => {
                const isSelected = selectedPhotoKeys.has(photo.key);
                return (
                  <div
                    key={photo.key}
                    className={cn(
                      'relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all',
                      isSelected ? 'border-primary' : 'border-transparent'
                    )}
                    onTouchStart={() => {
                      longPressTimerRef.current = setTimeout(() => {
                        setMultiSelectActive(true);
                        setSelectedPhotoKeys(new Set([photo.key]));
                      }, 500);
                    }}
                    onTouchEnd={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                    onTouchMove={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                    onClick={() => {
                      if (multiSelectActive) {
                        setSelectedPhotoKeys(prev => {
                          const next = new Set(prev);
                          next.has(photo.key) ? next.delete(photo.key) : next.add(photo.key);
                          return next;
                        });
                      } else {
                        setLightboxSrc(photo.src);
                      }
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.src} alt={photo.noteName} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                      <p className="text-[8px] font-bold text-white truncate">{photo.noteName}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {!multiSelectActive && (
              <p className="text-center text-[9px] text-muted-foreground">長按圖片可進入多選模式</p>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90" onClick={() => setLightboxSrc(null)}>
          <button
            type="button"
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightboxSrc(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="absolute bottom-8 right-4 z-10 flex items-center gap-2 rounded-full bg-primary px-4 h-10 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg hover:bg-primary/80"
            onClick={(e) => { e.stopPropagation(); void downloadImage(lightboxSrc, `sake-${Date.now()}.jpg`); }}
          >
            <Download className="w-4 h-4" /> 下載
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="photo"
            className="max-h-[85vh] max-w-[95vw] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
