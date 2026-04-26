'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { ArrowLeft, BadgeDollarSign, BookMarked, Building2, Camera, Check, ChevronDown, CircleDollarSign, ClipboardList, FilePen, Images, Loader2, Star, Store, Trash2, PencilLine, Trophy, X } from 'lucide-react';
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
const AROMA_CATEGORY = '香氣';
const AROMA_INTENSITY_OPTIONS = ['弱', '中', '強'] as const;
const AROMA_PROFILE_OPTIONS = ['花果', '米旨', '熟成'] as const;
const AROMA_NOTE_OPTIONS = ['乳酸', '果酸'] as const;

type AromaIntensity = (typeof AROMA_INTENSITY_OPTIONS)[number];
type AromaProfile = (typeof AROMA_PROFILE_OPTIONS)[number];
type AromaNote = (typeof AROMA_NOTE_OPTIONS)[number];
type RecognitionAppliedFields = {
  brandName: boolean;
  brewery: boolean;
  origin: boolean;
};
type RecognitionSnapshot = {
  brandName: string;
  brewery: string;
  origin: string;
  appliedFields: RecognitionAppliedFields;
};

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

function normalizeAromaProfileLabel(label: string) {
  return label.endsWith('香') ? label.slice(0, -1) : label;
}

function parseAromaQuickTag(tag: string) {
  const [intensity, rawProfile] = getExpoQuickTagLabel(tag).split('｜');
  const profile = normalizeAromaProfileLabel(rawProfile || '');

  if (
    AROMA_INTENSITY_OPTIONS.includes(intensity as AromaIntensity)
    && AROMA_PROFILE_OPTIONS.includes(profile as AromaProfile)
  ) {
    return {
      intensity: intensity as AromaIntensity,
      profile: profile as AromaProfile,
    };
  }

  return null;
}

function isAromaStandaloneQuickTag(tag: string) {
  return AROMA_NOTE_OPTIONS.includes(getExpoQuickTagLabel(tag) as AromaNote);
}

function removeAromaQuickTags(tags: string[]) {
  return tags.filter((tag) => parseAromaQuickTag(tag) === null && !isAromaStandaloneQuickTag(tag));
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
    origin?: string;
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
  const [isQuickTagsExpanded, setIsQuickTagsExpanded] = useState(false);
  const [aromaSelection, setAromaSelection] = useState<{ intensity: AromaIntensity | null; profiles: AromaProfile[]; notes: AromaNote[] }>({ intensity: null, profiles: [], notes: [] });
  const [recognitionSnapshot, setRecognitionSnapshot] = useState<RecognitionSnapshot | null>(null);
  const [quickImagePreview, setQuickImagePreview] = useState<string | null>(null);
  const [quickImageUrl, setQuickImageUrl] = useState<string | null>(null);
  const [isImageSourcePickerOpen, setIsImageSourcePickerOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const imageSearchAbortRef = useRef<AbortController | null>(null);
  const imageSearchRequestIdRef = useRef(0);
  const brandInputEditedAtRef = useRef(0);
  const breweryInputEditedAtRef = useRef(0);
  const originInputEditedAtRef = useRef(0);
  const [formData, setFormData] = useState({
    brandName: '',
    brewery: '',
    origin: '',
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

  const hasRecognitionData = Boolean(recognitionSnapshot && (recognitionSnapshot.brandName || recognitionSnapshot.brewery || recognitionSnapshot.origin));

  const toggleQuickTag = (category: string, tag: string) => {
    const scopedTag = getExpoQuickTagKey(category, tag);
    setFormData((prev) => ({
      ...prev,
      quickTags: prev.quickTags.includes(scopedTag)
        ? prev.quickTags.filter((item) => item !== scopedTag)
        : [...prev.quickTags.filter((item) => item !== tag), scopedTag],
    }));
  };

  const updateAromaSelection = (field: 'intensity' | 'profile' | 'note', value: AromaIntensity | AromaProfile | AromaNote) => {
    setAromaSelection((prev) => {
      const nextSelection = field === 'intensity'
        ? {
            ...prev,
            intensity: prev.intensity === value ? null : value as AromaIntensity,
          }
        : field === 'note'
          ? {
              ...prev,
              notes: prev.notes.includes(value as AromaNote)
                ? prev.notes.filter((note) => note !== value)
                : [...prev.notes, value as AromaNote],
            }
        : {
            ...prev,
            profiles: prev.profiles.includes(value as AromaProfile)
              ? prev.profiles.filter((profile) => profile !== value)
              : [...prev.profiles, value as AromaProfile],
          };

      setFormData((current) => {
        const quickTagsWithoutAroma = removeAromaQuickTags(current.quickTags);
        const nextAromaTags = [
          ...(nextSelection.intensity
            ? nextSelection.profiles.map((profile) => getExpoQuickTagKey(AROMA_CATEGORY, `${nextSelection.intensity}｜${profile}`))
            : []),
          ...nextSelection.notes.map((note) => getExpoQuickTagKey(AROMA_CATEGORY, note)),
        ];

        if (nextAromaTags.length === 0) {
          return {
            ...current,
            quickTags: quickTagsWithoutAroma,
          };
        }

        return {
          ...current,
          quickTags: [
            ...quickTagsWithoutAroma,
            ...nextAromaTags,
          ],
        };
      });

      return nextSelection;
    });
  };

  useEffect(() => {
    return () => {
      imageSearchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      router.replace('/expo');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [router]);

  const clearRecognitionFields = (snapshot: RecognitionSnapshot | null, showToast = true) => {
    if (!snapshot) return;

    setFormData((prev) => ({
      ...prev,
      brandName: prev.brandName === snapshot.brandName ? '' : prev.brandName,
      brewery: prev.brewery === snapshot.brewery ? '' : prev.brewery,
      origin: prev.origin === snapshot.origin ? '' : prev.origin,
    }));
    setRecognitionSnapshot(null);
    if (showToast) {
      toast({ title: '已清除辨識資料' });
    }
  };

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
    clearRecognitionFields(recognitionSnapshot, true);
  };

  const runImageRecognition = async (
    resizedDataUri: string,
    options?: { preserveStoredImageUrl?: boolean }
  ) => {
    if (!auth) {
      toast({ variant: 'destructive', title: '請先登入後再使用圖片辨識' });
      return;
    }
    if (!resizedDataUri.startsWith('data:')) {
      toast({ variant: 'destructive', title: '請先重新選取圖片再辨識' });
      return;
    }

    imageSearchAbortRef.current?.abort();
    const controller = new AbortController();
    imageSearchAbortRef.current = controller;
    const requestId = imageSearchRequestIdRef.current + 1;
    imageSearchRequestIdRef.current = requestId;
    const searchStartedAt = Date.now();

    setIsImageSearching(true);
    setRecognitionSnapshot(null);

    try {
      if (!options?.preserveStoredImageUrl) {
        setQuickImageUrl(null);
      }
      setQuickImagePreview(resizedDataUri);

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
      const nextOrigin = data.extracted?.origin?.trim() || '';

      const appliedFields = {
        brandName: Boolean(nextBrandName && brandInputEditedAtRef.current <= searchStartedAt),
        brewery: Boolean(nextBrewery && breweryInputEditedAtRef.current <= searchStartedAt),
        origin: Boolean(nextOrigin && originInputEditedAtRef.current <= searchStartedAt),
      };

      setRecognitionSnapshot({
        brandName: nextBrandName,
        brewery: nextBrewery,
        origin: nextOrigin,
        appliedFields,
      });

      setFormData((prev) => ({
        ...prev,
        brandName: appliedFields.brandName ? nextBrandName : prev.brandName,
        brewery: appliedFields.brewery ? nextBrewery : prev.brewery,
        origin: appliedFields.origin ? nextOrigin : prev.origin,
      }));

      toast({
        title: '已完成簡單搜圖',
        description: nextBrandName || nextBrewery || nextOrigin ? '已帶入可辨識到的銘柄、酒造與產地。' : '已載入圖片，但這張圖沒有明確辨識結果。',
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

  const handleImageSearchFile = async (file: File) => {
    try {
      const dataUri = await readFileAsDataUri(file);
      const resizedDataUri = await resizeImageDataUri(dataUri);
      imageSearchAbortRef.current?.abort();
      imageSearchAbortRef.current = null;
      imageSearchRequestIdRef.current += 1;
      setIsImageSearching(false);
      clearRecognitionFields(recognitionSnapshot, false);
      setQuickImagePreview(resizedDataUri);
      setQuickImageUrl(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: '圖片讀取失敗', description: error.message || '請換一張圖片再試一次' });
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
    setAromaSelection({ intensity: null, profiles: [], notes: [] });
    setRecognitionSnapshot(null);
    setQuickImagePreview(null);
    setQuickImageUrl(null);
    setFormData((prev) => ({
      ...prev,
      brandName: '',
      brewery: '',
      origin: '',
      booth: '',
      price: '',
      overallRating: 7.0,
      quickTags: [],
      quickNote: '',
    }));
  };

  const handleCreateQuickNote = async (visibility: 'private' | 'public' = 'private', publicationStatus: 'draft' | 'published' = 'draft') => {
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
        visibility,
        publicationStatus,
        ...(visibility === 'public' && publicationStatus === 'published' ? { publishedAt: now } : {}),
        brandName: formData.brandName.trim(),
        brewery: formData.brewery.trim(),
        origin: formData.origin.trim(),
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
          origin: formData.origin.trim(),
          imageUrls,
          description: formData.quickNote.trim(),
          userDescription: formData.quickNote.trim(),
          overallRating: formData.overallRating,
          visibility,
          publicationStatus,
          ...(visibility === 'public' && publicationStatus === 'published' ? { publishedAt: now } : {}),
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
        const docRef = await addDoc(collection(firestore, 'sakeTastingNotes'), noteData);
        const toastMessages: Record<string, string> = {
          'private-draft': '草稿已儲存',
          'private-published': '已存至個人筆記',
          'public-published': '酒展快記已公開發佈',
        };
        toast({ title: toastMessages[`${visibility}-${publicationStatus}`] || '已儲存' });
        resetForm();
        setIsSaving(false);
        if (publicationStatus === 'draft') {
          router.push(`/notes/${docRef.id}/edit`);
          return;
        }
      }
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
    const normalizedQuickTags = normalizeExpoQuickTags(note.expoMeta?.quickTags);
    const parsedAromas = normalizedQuickTags.map((tag) => parseAromaQuickTag(tag)).filter((value): value is NonNullable<ReturnType<typeof parseAromaQuickTag>> => value !== null);
    const parsedAromaNotes = normalizedQuickTags
      .filter((tag) => isAromaStandaloneQuickTag(tag))
      .map((tag) => getExpoQuickTagLabel(tag) as AromaNote);

    setEditingNoteId(note.id);
    setQuickImagePreview(note.imageUrls?.[0] || null);
    setQuickImageUrl(note.imageUrls?.[0] || null);
    setRecognitionSnapshot(null);
    setAromaSelection({
      intensity: parsedAromas[0]?.intensity || null,
      profiles: parsedAromas.map((item) => item.profile),
      notes: parsedAromaNotes,
    });
    setFormData({
      brandName: note.brandName || '',
      brewery: note.brewery || '',
      origin: note.origin || '',
      booth: note.expoMeta?.booth || '',
      price: typeof note.expoMeta?.price === 'number' ? String(note.expoMeta.price) : '',
      overallRating: note.overallRating || 7.0,
      quickTags: normalizedQuickTags,
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
            <h1 className="mt-3 text-base font-headline font-bold text-primary tracking-widest uppercase whitespace-nowrap overflow-x-auto">{event.name}</h1>
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
          <div className="dark-glass rounded-[2rem] border border-white/10 p-4 space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_136px] items-start gap-3">
              <div className="space-y-3">
                <div className="space-y-1 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">快速品鑑</p>
                <h2 className="text-lg font-bold text-foreground">{editingNoteId ? '編輯這杯快記' : '快速品鑑'}</h2>
                </div>
                <Input value={formData.brandName} onChange={(event) => {
                  brandInputEditedAtRef.current = Date.now();
                  setFormData((prev) => ({ ...prev, brandName: event.target.value }));
                }} placeholder="酒名 / 銘柄" className="h-10 rounded-2xl bg-white/5 border-white/10" />
                <Input value={formData.brewery} onChange={(event) => {
                  breweryInputEditedAtRef.current = Date.now();
                  setFormData((prev) => ({ ...prev, brewery: event.target.value }));
                }} placeholder="酒造 / 品牌" className="h-10 rounded-2xl bg-white/5 border-white/10" />
                <Input value={formData.origin} onChange={(event) => {
                  originInputEditedAtRef.current = Date.now();
                  setFormData((prev) => ({ ...prev, origin: event.target.value }));
                }} placeholder="產地 / 縣" className="h-10 rounded-2xl bg-white/5 border-white/10" />
              </div>
              <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-2.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">AI 辨識</p>
                <button
                  type="button"
                  onClick={() => setIsImageSourcePickerOpen(true)}
                  className="relative block aspect-[3/4] w-full overflow-hidden rounded-[1rem] border border-white/10 bg-[#141419]"
                >
                  {quickImagePreview ? (
                    <Image src={quickImagePreview} alt="辨識圖片預覽" fill unoptimized className="object-contain object-center p-1" />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                  {isImageSearching && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/62 backdrop-blur-sm">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white">
                        <span>AI</span>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      </div>
                    </div>
                  )}
                  {!quickImagePreview && !isImageSearching && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white">
                        <Camera className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                </button>
                <div className="mt-2">
                  {isImageSearching ? (
                    <Button type="button" variant="outline" className="h-8 w-full rounded-2xl border-white/10 bg-white/5 px-2 text-[9px] font-bold tracking-[0.08em]" onClick={cancelImageSearch}>
                      <X className="mr-1 h-3.5 w-3.5 shrink-0" /> 辨識中
                    </Button>
                  ) : hasRecognitionData ? (
                    <Button type="button" variant="outline" className="h-8 w-full rounded-2xl border-white/10 bg-white/5 px-2 text-[9px] font-bold tracking-[0.08em]" onClick={clearRecognitionData}>
                      <X className="mr-1 h-3.5 w-3.5 shrink-0" /> 清除辨識
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 w-full rounded-2xl border-white/10 bg-white/5 px-2 text-[9px] font-bold tracking-[0.08em]"
                      onClick={() => quickImagePreview && void runImageRecognition(quickImagePreview, { preserveStoredImageUrl: true })}
                      disabled={!quickImagePreview}
                    >
                      辨識
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Input value={formData.booth} onChange={(event) => setFormData((prev) => ({ ...prev, booth: event.target.value }))} placeholder="攤位" className="h-10 rounded-2xl bg-white/5 border-white/10" />
                <Input type="number" inputMode="numeric" value={formData.price} onChange={(event) => setFormData((prev) => ({ ...prev, price: event.target.value }))} placeholder="價格" className="h-10 rounded-2xl bg-white/5 border-white/10" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">快速標籤</p>
                  <p className="text-[10px] text-muted-foreground">已選 {formData.quickTags.length} 個</p>
                </div>
                <Button type="button" variant="outline" onClick={() => setIsQuickTagsExpanded((prev) => !prev)} className="h-8 rounded-full border-white/10 bg-white/5 px-3 text-[10px] font-bold uppercase tracking-widest">
                  {isQuickTagsExpanded ? '收合' : '展開'} <ChevronDown className={cn('ml-1.5 h-3.5 w-3.5 transition-transform', isQuickTagsExpanded && 'rotate-180')} />
                </Button>
              </div>

              {!isQuickTagsExpanded ? (
                <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-3 py-2.5">
                  {formData.quickTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.quickTags.map((tag) => (
                        <Badge key={tag} variant="outline" className="h-5 rounded-full border-primary/20 bg-primary/10 px-2 text-[9px] font-bold tracking-widest text-primary">
                          {getExpoQuickTagLabel(tag)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">尚未選擇標籤，點右側展開。</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {EXPO_QUICK_TAG_GROUPS.map((group) => (
                    <div key={group.category} className="rounded-[1.15rem] border border-white/10 bg-white/5 p-2">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{group.category}</p>
                      {group.category === AROMA_CATEGORY ? (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {AROMA_INTENSITY_OPTIONS.map((intensity) => (
                              <button
                                key={intensity}
                                type="button"
                                onClick={() => updateAromaSelection('intensity', intensity)}
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest transition-all',
                                  aromaSelection.intensity === intensity
                                    ? 'border-primary bg-primary text-white shadow-lg'
                                    : 'border-white/10 bg-white/5 text-muted-foreground'
                                )}
                              >
                                {intensity}
                              </button>
                            ))}
                            <span className="px-1 text-[10px] text-muted-foreground">|</span>
                            {AROMA_PROFILE_OPTIONS.map((profile) => (
                              <button
                                key={profile}
                                type="button"
                                onClick={() => updateAromaSelection('profile', profile)}
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest transition-all',
                                  aromaSelection.profiles.includes(profile)
                                    ? 'border-primary bg-primary text-white shadow-lg'
                                    : 'border-white/10 bg-white/5 text-muted-foreground'
                                )}
                              >
                                {profile}
                              </button>
                            ))}
                            <span className="px-1 text-[10px] text-muted-foreground">|</span>
                            {AROMA_NOTE_OPTIONS.map((note) => (
                              <button
                                key={note}
                                type="button"
                                onClick={() => updateAromaSelection('note', note)}
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest transition-all',
                                  aromaSelection.notes.includes(note)
                                    ? 'border-primary bg-primary text-white shadow-lg'
                                    : 'border-white/10 bg-white/5 text-muted-foreground'
                                )}
                              >
                                {note}
                              </button>
                            ))}
                          </div>
                          <p className="text-[9px] text-muted-foreground">
                            {((aromaSelection.intensity && aromaSelection.profiles.length > 0) || aromaSelection.notes.length > 0)
                              ? `已合併為 ${[
                                  ...(aromaSelection.intensity
                                    ? aromaSelection.profiles.map((profile) => `${aromaSelection.intensity}｜${profile}`)
                                    : []),
                                  ...aromaSelection.notes,
                                ].join('、')}`
                              : '先選強度與花果/米旨/熟成，乳酸與果酸可獨立勾選'}
                          </p>
                        </div>
                      ) : group.category === '口感' ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {group.tags.slice(0, 3).map((tag) => (
                            <button
                              key={`${group.category}-${tag}`}
                              type="button"
                              onClick={() => toggleQuickTag(group.category, tag)}
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest transition-all',
                                isExpoQuickTagSelected(formData.quickTags, group.category, tag)
                                  ? 'border-primary bg-primary text-white shadow-lg'
                                  : 'border-white/10 bg-white/5 text-muted-foreground'
                              )}
                            >
                              {tag}
                            </button>
                          ))}
                          <span className="px-1 text-[10px] text-muted-foreground">|</span>
                          {group.tags.slice(3).map((tag) => (
                            <button
                              key={`${group.category}-${tag}`}
                              type="button"
                              onClick={() => toggleQuickTag(group.category, tag)}
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest transition-all',
                                isExpoQuickTagSelected(formData.quickTags, group.category, tag)
                                  ? 'border-primary bg-primary text-white shadow-lg'
                                  : 'border-white/10 bg-white/5 text-muted-foreground'
                              )}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : group.category === '酒精' ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {group.tags.slice(0, 3).map((tag) => (
                            <button
                              key={`${group.category}-${tag}`}
                              type="button"
                              onClick={() => toggleQuickTag(group.category, tag)}
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest transition-all',
                                isExpoQuickTagSelected(formData.quickTags, group.category, tag)
                                  ? 'border-primary bg-primary text-white shadow-lg'
                                  : 'border-white/10 bg-white/5 text-muted-foreground'
                              )}
                            >
                              {tag}
                            </button>
                          ))}
                          <span className="px-1 text-[10px] text-muted-foreground">|</span>
                          {group.tags.slice(3).map((tag) => (
                            <button
                              key={`${group.category}-${tag}`}
                              type="button"
                              onClick={() => toggleQuickTag(group.category, tag)}
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest transition-all',
                                isExpoQuickTagSelected(formData.quickTags, group.category, tag)
                                  ? 'border-primary bg-primary text-white shadow-lg'
                                  : 'border-white/10 bg-white/5 text-muted-foreground'
                              )}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {group.tags.map((tag) => (
                            <button
                              key={`${group.category}-${tag}`}
                              type="button"
                              onClick={() => toggleQuickTag(group.category, tag)}
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest transition-all',
                                isExpoQuickTagSelected(formData.quickTags, group.category, tag)
                                  ? 'border-primary bg-primary text-white shadow-lg'
                                  : 'border-white/10 bg-white/5 text-muted-foreground'
                              )}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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

            <div className="flex flex-col gap-2">
              <p className="text-[10px] leading-5 text-muted-foreground">銘柄、品牌、攤位至少填一項即可；送出後保留攤位與酒造，方便下一杯繼續記。</p>
              <div className="flex items-center gap-2 w-full">
                {editingNoteId && (
                  <Button type="button" variant="outline" onClick={resetForm} className="rounded-full h-10 px-4 text-[10px] font-bold uppercase tracking-widest">
                    取消編輯
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => handleCreateQuickNote('private', 'draft')}
                  disabled={isSaving}
                  className="flex-1 rounded-full h-10 px-5 text-[10px] font-bold uppercase tracking-widest"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FilePen className="w-3.5 h-3.5 mr-1.5" />} {editingNoteId ? '更新草稿' : '儲存草稿'}
                </Button>
              </div>
            </div>
          </div>

          {isImageSourcePickerOpen && (
            <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={() => setIsImageSourcePickerOpen(false)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div className="relative w-full max-w-md rounded-t-[2rem] border border-white/10 bg-[#18181b] p-6 pb-12 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
                <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-widest text-white/50">選擇圖片來源</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsImageSourcePickerOpen(false);
                      cameraInputRef.current?.click();
                    }}
                    className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 transition-all hover:border-primary/30 hover:bg-primary/10 active:scale-95"
                  >
                    <Camera className="h-8 w-8 text-primary" />
                    <span className="text-sm font-bold text-foreground">拍照</span>
                    <span className="text-[9px] text-muted-foreground">使用相機</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsImageSourcePickerOpen(false);
                      galleryInputRef.current?.click();
                    }}
                    className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 transition-all hover:border-primary/30 hover:bg-primary/10 active:scale-95"
                  >
                    <Images className="h-8 w-8 text-primary" />
                    <span className="text-sm font-bold text-foreground">相簿</span>
                    <span className="text-[9px] text-muted-foreground">從圖片庫選取</span>
                  </button>
                </div>
              </div>
            </div>
          )}

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

          <div className="space-y-4">
            <div className="dark-glass rounded-[2rem] border border-white/10 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">Compare View</p>
                  <h2 className="text-lg font-bold text-foreground truncate">本場比較清單</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/expo/${eventId}/album`}>
                    <Button variant="outline" className="rounded-full h-10 px-4 text-[10px] font-bold uppercase tracking-widest">
                      <Images className="w-3.5 h-3.5 mr-1.5" /> 相簿
                    </Button>
                  </Link>
                  <Link href={`/expo/${eventId}/ranking`}>
                    <Button className="rounded-full h-10 bg-[#ffd166] px-5 text-[10px] font-bold uppercase tracking-widest text-[#21150d] shadow-[0_10px_24px_rgba(255,209,102,0.28)] hover:bg-[#ffe08f]">
                      <Trophy className="w-3.5 h-3.5 mr-1.5" /> 排名打卡頁
                    </Button>
                  </Link>
                </div>
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