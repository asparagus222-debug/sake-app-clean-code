'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { ArrowLeft, BadgeDollarSign, Building2, Camera, CircleDollarSign, ClipboardList, ImagePlus, Loader2, Star, Store, Trash2, PencilLine, Trophy, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useDoc, useCollection, useFirestore, useMemoFirebase, useStorage, useUser } from '@/firebase';
import { ExpoEvent, EXPO_QUICK_TAG_GROUPS, SakeNote, UserProfile } from '@/lib/types';
import { authorizedJsonFetch } from '@/lib/authorized-fetch';
import { getExpoCpScore, getExpoNoteDisplayName, getSortableExpoCpScore, getSortableExpoPrice, isPublicPublishedNote } from '@/lib/note-lifecycle';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type SortMode = 'score' | 'price' | 'cp';
const EXPO_QUICK_TAG_SEPARATOR = '::';

const EXPO_QUICK_TAG_CATEGORY_BY_LABEL = EXPO_QUICK_TAG_GROUPS.reduce<Record<string, string[]>>((accumulator, group) => {
  group.tags.forEach((tag) => {
    accumulator[tag] = [...(accumulator[tag] || []), group.category];
  });
  return accumulator;
}, {});

function formatFlavorRating(score: number) {
  return score.toFixed(1);
}

function getExpoQuickTagKey(category: string, tag: string) {
  return `${category}${EXPO_QUICK_TAG_SEPARATOR}${tag}`;
}

function getExpoQuickTagLabel(tag: string) {
  const separatorIndex = tag.indexOf(EXPO_QUICK_TAG_SEPARATOR);
  return separatorIndex >= 0 ? tag.slice(separatorIndex + EXPO_QUICK_TAG_SEPARATOR.length) : tag;
}

function normalizeExpoQuickTags(tags: string[] | undefined) {
  return (tags || []).map((tag) => {
    if (tag.includes(EXPO_QUICK_TAG_SEPARATOR)) return tag;

    const categories = EXPO_QUICK_TAG_CATEGORY_BY_LABEL[tag] || [];
    if (categories.length === 1) {
      return getExpoQuickTagKey(categories[0], tag);
    }

    return tag;
  });
}

function isExpoQuickTagSelected(selectedTags: string[], category: string, tag: string) {
  const scopedTag = getExpoQuickTagKey(category, tag);
  if (selectedTags.includes(scopedTag)) return true;

  const categories = EXPO_QUICK_TAG_CATEGORY_BY_LABEL[tag] || [];
  return categories.length === 1 && selectedTags.includes(tag);
}

type VisionResult = {
  extracted: {
    brandName?: string;
    brewery?: string;
  } | null;
};

function readFileAsDataUri(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.readAsDataURL(file);
  });
}

function resizeImageDataUri(dataUri: string, maxDimension = 1024) {
  return new Promise<string>((resolve) => {
    const image = new window.Image();
    image.src = dataUri;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      let width = image.width;
      let height = image.height;

      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height >= width && height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
  });
}

function getInlineQuickImageFallback(dataUri: string | null) {
  if (!dataUri) return [] as string[];
  return dataUri.length <= 700000 ? [dataUri] : [] as string[];
}

export default function ExpoEventPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const eventId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [isSaving, setIsSaving] = useState(false);
  const [isImageSearching, setIsImageSearching] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [quickImagePreview, setQuickImagePreview] = useState<string | null>(null);
  const [quickImageUrl, setQuickImageUrl] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const imageSearchAbortRef = useRef<AbortController | null>(null);
  const imageSearchRequestIdRef = useRef(0);
  const brandInputEditedAtRef = useRef(0);
  const breweryInputEditedAtRef = useRef(0);
  const lastAiAppliedRef = useRef<{ brandName: string; brewery: string } | null>(null);
  const [formData, setFormData] = useState({
    brandName: '',
    brewery: '',
    booth: '',
    price: '',
    overallRating: 7.0,
    quickTags: [] as string[],
    quickNote: '',
  });

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile } = useDoc<UserProfile>(profileRef);

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

  const sortedNotes = useMemo(() => {
    const notes = [...(rawNotes || [])];
    return notes.sort((left, right) => {
      if (sortMode === 'score') {
        return right.overallRating - left.overallRating
          || (right.createdAt || '').localeCompare(left.createdAt || '');
      }
      if (sortMode === 'cp') {
        return getSortableExpoCpScore(right) - getSortableExpoCpScore(left)
          || right.overallRating - left.overallRating
          || (right.createdAt || '').localeCompare(left.createdAt || '');
      }
      return getSortableExpoPrice(left) - getSortableExpoPrice(right)
        || right.overallRating - left.overallRating
        || (right.createdAt || '').localeCompare(left.createdAt || '');
    });
  }, [rawNotes, sortMode]);

  const counts = useMemo(() => ({
    total: rawNotes?.length || 0,
    published: rawNotes?.filter((note) => isPublicPublishedNote(note)).length || 0,
  }), [rawNotes]);

  const toggleQuickTag = (category: string, tag: string) => {
    const scopedTag = getExpoQuickTagKey(category, tag);
    setFormData((prev) => ({
      ...prev,
      quickTags: prev.quickTags.includes(scopedTag)
        ? prev.quickTags.filter((item) => item !== scopedTag)
        : [...prev.quickTags.filter((item) => item !== tag), scopedTag],
    }));
  };

  useEffect(() => {
    return () => {
      imageSearchAbortRef.current?.abort();
    };
  }, []);

  const cancelImageSearch = () => {
    imageSearchAbortRef.current?.abort();
    imageSearchAbortRef.current = null;
    imageSearchRequestIdRef.current += 1;
    setIsImageSearching(false);
    toast({ title: '已取消圖片辨識' });
  };

  const clearRecognitionData = () => {
    imageSearchAbortRef.current?.abort();
    imageSearchAbortRef.current = null;
    imageSearchRequestIdRef.current += 1;
    setIsImageSearching(false);
    setQuickImagePreview(null);
    setQuickImageUrl(null);
    setFormData((prev) => {
      const aiApplied = lastAiAppliedRef.current;
      if (!aiApplied) {
        return prev;
      }

      return {
        ...prev,
        brandName: prev.brandName === aiApplied.brandName ? '' : prev.brandName,
        brewery: prev.brewery === aiApplied.brewery ? '' : prev.brewery,
      };
    });
    lastAiAppliedRef.current = null;
    toast({ title: '已清除辨識資料' });
  };

  const handleImageSearchFile = async (file: File) => {
    if (!auth) {
      toast({ variant: 'destructive', title: '請先登入後再使用圖片辨識' });
      return;
    }

    imageSearchAbortRef.current?.abort();
    const controller = new AbortController();
    imageSearchAbortRef.current = controller;
    const requestId = imageSearchRequestIdRef.current + 1;
    imageSearchRequestIdRef.current = requestId;
    const searchStartedAt = Date.now();

    setIsImageSearching(true);
    try {
      const dataUri = await readFileAsDataUri(file);
      const resizedDataUri = await resizeImageDataUri(dataUri);
      if (controller.signal.aborted || imageSearchRequestIdRef.current !== requestId) {
        return;
      }

      setQuickImagePreview(resizedDataUri);
      setQuickImageUrl(null);

      const response = await authorizedJsonFetch(auth, '/api/ai/vision-web-detect', {
        method: 'POST',
        body: JSON.stringify({ photoDataUri: resizedDataUri }),
        signal: controller.signal,
      });
      const data = await response.json() as VisionResult & { error?: string };

      if (controller.signal.aborted || imageSearchRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || '以圖搜圖失敗');
      }

      const nextBrandName = data.extracted?.brandName?.trim() || '';
      const nextBrewery = data.extracted?.brewery?.trim() || '';

      lastAiAppliedRef.current = {
        brandName: nextBrandName,
        brewery: nextBrewery,
      };

      setFormData((prev) => ({
        ...prev,
        brandName: nextBrandName && brandInputEditedAtRef.current <= searchStartedAt ? nextBrandName : prev.brandName,
        brewery: nextBrewery && breweryInputEditedAtRef.current <= searchStartedAt ? nextBrewery : prev.brewery,
      }));

      toast({
        title: '已完成簡單搜圖',
        description: nextBrandName || nextBrewery ? '已帶入可辨識到的銘柄與酒造。' : '已載入圖片，但這張圖沒有明確辨識結果。',
      });
    } catch (error: any) {
      if (error?.name === 'AbortError' || controller.signal.aborted || imageSearchRequestIdRef.current !== requestId) {
        return;
      }

      toast({ variant: 'destructive', title: '圖片辨識失敗', description: error.message || '請換一張圖片再試一次' });
    } finally {
      if (imageSearchAbortRef.current === controller) {
        imageSearchAbortRef.current = null;
      }
      if (imageSearchRequestIdRef.current === requestId) {
        setIsImageSearching(false);
      }
    }
  };

  const resolveQuickImageUrls = async () => {
    if (!quickImagePreview) return [] as string[];
    if (quickImageUrl) return [quickImageUrl];
    if (!storage || !user) return getInlineQuickImageFallback(quickImagePreview);

    try {
      const storageRef = ref(storage, `expo-quick/${user.uid}/${eventId}/${Date.now()}.jpg`);
      await uploadString(storageRef, quickImagePreview, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      setQuickImageUrl(downloadUrl);
      return [downloadUrl];
    } catch (error) {
      console.error('expo quick image upload failed:', error);
      return getInlineQuickImageFallback(quickImagePreview);
    }
  };

  const resetForm = () => {
    setEditingNoteId(null);
    setQuickImagePreview(null);
    setQuickImageUrl(null);
    lastAiAppliedRef.current = null;
    setFormData((prev) => ({
      ...prev,
      brandName: '',
      price: '',
      overallRating: 7.0,
      quickTags: [],
      quickNote: '',
    }));
  };

  const handleCreateQuickNote = async () => {
    if (!firestore || !user || !event) return;
    if (!formData.brandName.trim() && !formData.brewery.trim() && !formData.booth.trim()) {
      toast({ variant: 'destructive', title: '銘柄、品牌或攤位至少填一項' });
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const price = formData.price.trim() ? Number(formData.price) : null;
      const imageUrls = await resolveQuickImageUrls();
      const noteData = {
        userId: user.uid,
        username: profile?.username || '',
        entryMode: 'expo-quick' as const,
        visibility: 'private' as const,
        publicationStatus: 'draft' as const,
        brandName: formData.brandName.trim(),
        brewery: formData.brewery.trim(),
        origin: '',
        imageUrls,
        sweetnessRating: 3,
        acidityRating: 3,
        bitternessRating: 3,
        umamiRating: 3,
        astringencyRating: 3,
        overallRating: formData.overallRating,
        styleTags: [] as string[],
        description: formData.quickNote.trim(),
        userDescription: formData.quickNote.trim(),
        otherComments: '',
        tastingDate: now,
        createdAt: now,
        expoMeta: {
          eventId,
          eventName: event.name,
          booth: formData.booth.trim(),
          price: Number.isFinite(price) ? price : null,
          currency: 'TWD',
          quickTags: formData.quickTags,
          quickNote: formData.quickNote.trim(),
          isPurchased: false,
        },
      };
      if (editingNoteId) {
        await updateDoc(doc(firestore, 'sakeTastingNotes', editingNoteId), {
          brandName: formData.brandName.trim(),
          brewery: formData.brewery.trim(),
          imageUrls,
          description: formData.quickNote.trim(),
          userDescription: formData.quickNote.trim(),
          overallRating: formData.overallRating,
          updatedAt: now,
          expoMeta: {
            eventId,
            eventName: event.name,
            booth: formData.booth.trim(),
            price: Number.isFinite(price) ? price : null,
            currency: 'TWD',
            quickTags: formData.quickTags,
            quickNote: formData.quickNote.trim(),
            isPurchased: false,
          },
        });
        toast({ title: '快記已更新' });
      } else {
        await addDoc(collection(firestore, 'sakeTastingNotes'), noteData);
        toast({ title: '酒展快記已儲存' });
      }
      resetForm();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: editingNoteId ? '快記更新失敗' : '快記儲存失敗',
        description: error?.message || '請再試一次',
      });
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
  };

  const handleEditQuickNote = (note: SakeNote) => {
    setEditingNoteId(note.id);
    setQuickImagePreview(note.imageUrls?.[0] || null);
    setQuickImageUrl(note.imageUrls?.[0] || null);
    lastAiAppliedRef.current = null;
    setFormData({
      brandName: note.brandName || '',
      brewery: note.brewery || '',
      booth: note.expoMeta?.booth || '',
      price: typeof note.expoMeta?.price === 'number' ? String(note.expoMeta.price) : '',
      overallRating: note.overallRating || 7.0,
      quickTags: normalizeExpoQuickTags(note.expoMeta?.quickTags),
      quickNote: note.expoMeta?.quickNote || note.userDescription || note.description || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteQuickNote = async (noteId: string) => {
    if (!firestore || deletingNoteId) return;

    setDeletingNoteId(noteId);
    try {
      await deleteDoc(doc(firestore, 'sakeTastingNotes', noteId));
      toast({ title: '快記已刪除' });
    } catch {
      toast({ variant: 'destructive', title: '刪除快記失敗' });
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleDeleteEvent = async () => {
    if (!firestore || !user || !eventId || isDeletingEvent) return;

    setIsDeletingEvent(true);
    try {
      const noteSnapshots = await getDocs(query(
        collection(firestore, 'sakeTastingNotes'),
        where('userId', '==', user.uid),
        where('expoMeta.eventId', '==', eventId)
      ));

      await Promise.all(noteSnapshots.docs.map((noteDoc) => deleteDoc(noteDoc.ref)));
      await deleteDoc(doc(firestore, 'expoEvents', eventId));
      toast({ title: '酒展工作台已刪除' });
      router.replace('/expo');
    } catch {
      toast({ variant: 'destructive', title: '刪除工作台失敗' });
    } finally {
      setIsDeletingEvent(false);
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
    <div className="min-h-screen notebook-texture px-4 py-8 pb-24 font-body">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button type="button" onClick={() => router.push('/expo')} className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70 hover:text-primary transition-colors">
              <ArrowLeft className="w-3 h-3" /> 返回活動列表
            </button>
            <h1 className="mt-3 text-2xl font-headline font-bold text-primary tracking-widest uppercase break-words">{event.name}</h1>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Store className="w-3 h-3 text-primary/70" /> {event.venue || '未填地點'}</span>
              <span className="inline-flex items-center gap-1"><ClipboardList className="w-3 h-3 text-primary/70" /> {event.eventDate}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="rounded-full h-10 px-5 text-[10px] font-bold uppercase tracking-widest text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> 刪除工作台
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="dark-glass border border-white/10 rounded-[2rem]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive uppercase tracking-widest font-bold">刪除這個酒展工作台？</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs">
                    確定要刪除「{event.name}」嗎？這會連同本場所有快記一起刪除，且不可復原。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-full text-[10px] font-bold uppercase">取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteEvent} className="rounded-full bg-destructive text-[10px] font-bold uppercase">
                    {isDeletingEvent ? '刪除中' : '確認刪除'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <div className="text-lg font-headline font-bold text-primary">{counts.total}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">總杯數</div>
              </div>
              <div className="rounded-2xl border border-sky-400/20 bg-sky-500/5 px-4 py-3 text-center">
                <div className="text-lg font-headline font-bold text-sky-300">{counts.published}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-sky-200/70">已發布</div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="dark-glass rounded-[2rem] border border-white/10 p-5 space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-start">
              <div className="space-y-1.5 lg:pt-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">快速品鑑</p>
                <h2 className="text-lg font-bold text-foreground">{editingNoteId ? '編輯這杯快記' : '快速品鑑'}</h2>
              </div>
              <div className="rounded-[1.45rem] border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">AI 輔助辨識</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">拍照帶入酒名與酒造。</p>
                  </div>
                  {(quickImagePreview || quickImageUrl || isImageSearching) && (
                    <Button type="button" variant="ghost" onClick={clearRecognitionData} className="h-7 rounded-full px-2.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
                      <X className="mr-1 h-3 w-3" /> 清除
                    </Button>
                  )}
                </div>

                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
                  <div className="relative overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#141419] min-h-[82px]">
                    {quickImagePreview ? (
                      <Image src={quickImagePreview} alt="辨識圖片預覽" fill unoptimized className="object-cover" />
                    ) : (
                      <div className="flex h-full min-h-[82px] items-center justify-center px-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        尚未加入辨識圖片
                      </div>
                    )}
                    {isImageSearching && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/62 backdrop-blur-sm">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-white">
                          <span>AI</span>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 sm:w-[112px] sm:flex-col sm:items-stretch">
                    {isImageSearching ? (
                      <Button type="button" variant="outline" className="h-10 rounded-2xl border-white/10 bg-white/5 px-3 text-[10px] font-bold uppercase tracking-widest" onClick={cancelImageSearch}>
                        <X className="mr-1 h-3.5 w-3.5" /> 取消
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" className="h-10 rounded-2xl border-white/10 bg-white/5 px-3 text-[10px] font-bold uppercase tracking-widest">
                            <Camera className="mr-1 h-3.5 w-3.5" /> 選圖
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onSelect={() => galleryInputRef.current?.click()}>
                            <ImagePlus className="h-4 w-4" /> 從圖片選擇
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => cameraInputRef.current?.click()}>
                            <Camera className="h-4 w-4" /> 開啟相機
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleImageSearchFile(file);
                    }
                    event.target.value = '';
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleImageSearchFile(file);
                    }
                    event.target.value = '';
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input value={formData.brandName} onChange={(event) => {
                  brandInputEditedAtRef.current = Date.now();
                  setFormData((prev) => ({ ...prev, brandName: event.target.value }));
                }} placeholder="酒名 / 銘柄" className="h-10 rounded-2xl bg-white/5 border-white/10" />
                <Input value={formData.brewery} onChange={(event) => {
                  breweryInputEditedAtRef.current = Date.now();
                  setFormData((prev) => ({ ...prev, brewery: event.target.value }));
                }} placeholder="酒造 / 品牌" className="h-10 rounded-2xl bg-white/5 border-white/10" />
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                <Input value={formData.booth} onChange={(event) => setFormData((prev) => ({ ...prev, booth: event.target.value }))} placeholder="攤位" className="h-10 rounded-2xl bg-white/5 border-white/10" />
                <Input type="number" inputMode="numeric" value={formData.price} onChange={(event) => setFormData((prev) => ({ ...prev, price: event.target.value }))} placeholder="價格" className="h-10 rounded-2xl bg-white/5 border-white/10" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">快速標籤</p>
              <div className="space-y-2.5">
                {EXPO_QUICK_TAG_GROUPS.map((group) => (
                  <div key={group.category} className="rounded-[1.25rem] border border-white/10 bg-white/5 p-2.5">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{group.category}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag) => (
                        <button
                          key={`${group.category}-${tag}`}
                          type="button"
                          onClick={() => toggleQuickTag(group.category, tag)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-widest transition-all',
                            isExpoQuickTagSelected(formData.quickTags, group.category, tag)
                              ? 'border-primary bg-primary text-white shadow-lg'
                              : 'border-white/10 bg-white/5 text-muted-foreground'
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">作者備註</p>
                <Textarea value={formData.quickNote} onChange={(event) => setFormData((prev) => ({ ...prev, quickNote: event.target.value }))} placeholder="一句備註，例如：米旨漂亮、價格高但值得、尾韻短" className="min-h-[88px] rounded-2xl bg-white/5 border-white/10" />
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-3.5 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">風味評分</p>
                  <p className="text-sm font-bold text-primary">{formatFlavorRating(formData.overallRating)}/10</p>
                </div>
                <Slider
                  min={1}
                  max={10}
                  step={0.1}
                  value={[formData.overallRating]}
                  onValueChange={(value) => {
                    const nextValue = value[0];
                    if (nextValue === undefined) return;
                    setFormData((prev) => ({ ...prev, overallRating: Number(nextValue.toFixed(1)) }));
                  }}
                  className="py-1.5"
                />
                <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                  <span>1.0</span>
                  <span>10.0</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] leading-5 text-muted-foreground">銘柄、品牌、攤位至少填一項即可；送出後保留攤位與酒造，方便下一杯繼續記。</p>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {editingNoteId && (
                  <Button type="button" variant="outline" onClick={resetForm} className="rounded-full h-10 px-4 text-[10px] font-bold uppercase tracking-widest">
                    取消編輯
                  </Button>
                )}
                <Button onClick={handleCreateQuickNote} disabled={isSaving} className="rounded-full h-10 px-5 text-[10px] font-bold uppercase tracking-widest">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />} {editingNoteId ? '更新快記' : '儲存快記'}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="dark-glass rounded-[2rem] border border-white/10 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">Compare View</p>
                  <h2 className="text-lg font-bold text-foreground">本場比較清單</h2>
                </div>
                <Link href={`/expo/${eventId}/ranking`}>
                  <Button className="rounded-full h-10 bg-[#ffd166] px-5 text-[10px] font-bold uppercase tracking-widest text-[#21150d] shadow-[0_10px_24px_rgba(255,209,102,0.28)] hover:bg-[#ffe08f]">
                    <Trophy className="w-3.5 h-3.5 mr-1.5" /> 排名打卡頁
                  </Button>
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {[
                  { value: 'score', label: '風味評分', icon: Star },
                  { value: 'price', label: '價格', icon: CircleDollarSign },
                  { value: 'cp', label: 'CP 值', icon: BadgeDollarSign },
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={sortMode === option.value ? 'default' : 'outline'}
                      onClick={() => setSortMode(option.value as SortMode)}
                      className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest"
                    >
                      <Icon className="w-3 h-3 mr-1.5" /> {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {isNotesLoading ? (
              <div className="dark-glass rounded-[2rem] border border-white/10 p-10 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : sortedNotes.length === 0 ? (
              <div className="dark-glass rounded-[2rem] border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
                還沒有本場快記，先在左邊輸入第一杯。
              </div>
            ) : (
              <div className="space-y-3">
                {sortedNotes.map((note) => (
                  <div key={note.id} className="dark-glass rounded-[1.6rem] border border-white/10 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {isPublicPublishedNote(note) && (
                            <Badge variant="outline" className="text-[9px] h-5 px-2 border-emerald-400/30 bg-emerald-500/10 text-emerald-200 font-bold tracking-widest">
                              已發布
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-bold text-foreground break-words leading-snug">{getExpoNoteDisplayName(note)}</p>
                        <div className="mt-1 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {note.brewery && <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-primary/70" /> {note.brewery}</span>}
                          <span className="inline-flex items-center gap-1"><Store className="w-3 h-3 text-primary/70" /> 攤位 {note.expoMeta?.booth || '-'}</span>
                          <span className="inline-flex items-center gap-1"><BadgeDollarSign className="w-3 h-3 text-primary/70" /> {typeof note.expoMeta?.price === 'number' ? `$${note.expoMeta.price}` : '未記價格'}</span>
                          <span className="inline-flex items-center gap-1"><Star className="w-3 h-3 text-primary/70" /> 風味 {formatFlavorRating(note.overallRating)}/10</span>
                          <span className="inline-flex items-center gap-1"><BadgeDollarSign className="w-3 h-3 text-primary/70" /> CP {getExpoCpScore(note)?.toFixed(2) ?? '--'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button type="button" variant="outline" onClick={() => handleEditQuickNote(note)} className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest">
                          <PencilLine className="w-3.5 h-3.5 mr-1.5" /> 編輯
                        </Button>
                        <Link href={`/notes/${note.id}`}>
                          <Button variant="outline" className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest">查看</Button>
                        </Link>
                        <Link href={`/notes/${note.id}/edit`}>
                          <Button className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest">完整整理</Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="outline" className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> 刪除
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="dark-glass border border-white/10 rounded-[2rem]">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-destructive uppercase tracking-widest font-bold">刪除這杯快記？</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs">
                                確定要刪除「{note.brandName || '未命名酒款'}」嗎？刪除後將無法復原。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-full text-[10px] font-bold uppercase">取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteQuickNote(note.id)} className="rounded-full bg-destructive text-[10px] font-bold uppercase">
                                {deletingNoteId === note.id ? '刪除中' : '確認刪除'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {note.expoMeta?.quickTags && note.expoMeta.quickTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {note.expoMeta.quickTags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[9px] h-5 px-2 border-primary/20 bg-primary/10 text-primary font-bold tracking-widest">
                            {getExpoQuickTagLabel(tag)}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {note.expoMeta?.quickNote && <p className="text-sm text-foreground/75 whitespace-pre-wrap">{note.expoMeta.quickNote}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}