"use client"

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { RATING_LABELS, SERVING_TEMPERATURE_OPTIONS, STYLE_TAGS_OPTIONS, SakeNote } from '@/lib/types';
import { SakeRadarChart } from '@/components/SakeRadarChart';
import { SAKE_DATABASE, SakeDatabaseEntry, normalizeSakeInfo } from '@/lib/sake-data';
import { Camera, ArrowLeft, Loader2, Check, MapPin, Repeat, Plus, X, Tag, Info, Search, Sparkles, BrainCircuit, Palette, Images, BookMarked, Bell, Clock, Lock, Unlock, ArrowRight, ListChecks, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GuidedTasting, GuidedTastingResult } from '@/components/GuidedTasting';
import { useFirestore, useUser, useAuth, addDocumentNonBlocking, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, deleteDoc, query, where, limit, orderBy, addDoc } from 'firebase/firestore';
import { authorizedJsonFetch } from '@/lib/authorized-fetch';
import { cn } from '@/lib/utils';

async function getImageRatio(src: string): Promise<number> {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => resolve(img.width / img.height);
    img.onerror = () => resolve(1);
    img.src = src;
  });
}

async function resizeImage(base64: string, maxDimension: number = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width; let height = img.height;
      if (width > height) {
        if (width > maxDimension) { height *= maxDimension / width; width = maxDimension; }
      } else {
        if (height > maxDimension) { width *= maxDimension / height; height = maxDimension; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
  });
}

function roundDuration(value: number): number {
  return Math.round(value * 10) / 10;
}

function cachePublishedNote(note: SakeNote, limitCount = 20) {
  if (typeof window === 'undefined') return;

  try {
    const existing = JSON.parse(localStorage.getItem('home_latest_notes_snapshot') || '[]') as SakeNote[];
    const next = [note, ...existing.filter((item) => item.id !== note.id)].slice(0, limitCount);
    localStorage.setItem('home_latest_notes_snapshot', JSON.stringify(next));
  } catch {
    // Ignore local cache failures and keep the publish flow moving.
  }
}

export default function NewNotePage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifyCountdown, setIdentifyCountdown] = useState(0);
  const identifyAbortRef = useRef<AbortController | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lockedImgs, setLockedImgs] = useState([false, false]);
  
  const [images, setImages] = useState<string[]>([]);
  const [originals, setOriginals] = useState<string[]>([]); // resized originals for re-editing
  const [zooms, setZooms] = useState<number[]>([1, 1]);
  const [offsets, setOffsets] = useState<{ x: number; y: number }[]>([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  const [imgRatios, setImgRatios] = useState<number[]>([1, 1]); // width/height per image slot
  const [splitRatio, setSplitRatio] = useState<number>(50);
  
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialDist, setInitialDist] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState<number | null>(null);

  // 相機/相簿選擇器
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ type: 'new' | 'replace' | 'replace-all'; idx: number }>({ type: 'new', idx: 0 });
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [brandSuggestions, setBrandSuggestions] = useState<SakeDatabaseEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [customTag, setCustomTag] = useState("");
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  // 追蹤開瓶後風味變化提醒
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderUnit, setReminderUnit] = useState<'hours' | 'days' | 'months' | 'years'>('hours');
  const [reminderValue, setReminderValue] = useState(24);
  const [showGuidedTasting, setShowGuidedTasting] = useState(false);

  const handleGuidedComplete = (result: GuidedTastingResult) => {
    setFormData(prev => ({
      ...prev,
      sweetness: result.sweetness,
      acidity: result.acidity,
      bitterness: result.bitterness,
      umami: result.umami,
      astringency: result.astringency,
      userDescription: result.userDescription,
      styleTags: [...new Set([...prev.styleTags, ...result.styleTags])],
      foodPairings: result.foodPairings,
    }));
    setShowGuidedTasting(false);
    toast({ title: '引導品鑑完成', description: '已自動填入評分與品飲描述' });
  };

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const isAccountStatusPending = isUserLoading || (!!user && !!userDocRef && isProfileLoading);
  const canCreateNote = !!profile?.username;

  // 使用者已存的銘柄名稱列表，用於 AI 辨識後的標準化
  const myNotesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'sakeTastingNotes'),
      where('userId', '==', user.uid),
      orderBy('tastingDate', 'desc'),
      limit(100)
    );
  }, [firestore, user]);
  const { data: myNotes } = useCollection<SakeNote>(myNotesQuery);
  const knownBrands = React.useMemo(() => {
    if (!myNotes) return [];
    const seen = new Set<string>();
    return myNotes
      .filter(n => { const k = n.brandName; if (!k || seen.has(k)) return false; seen.add(k); return true; })
      .map(n => ({ brandName: n.brandName, brewery: n.brewery, origin: n.origin || '' }));
  }, [myNotes]);

  const [formData, setFormData] = useState({
    brandName: '',
    subBrand: '',
    brewery: '',
    origin: '',
    alcoholPercent: '',
    sweetness: 3,
    acidity: 3,
    bitterness: 3,
    umami: 3,
    astringency: 3,
    overallRating: 7,
    styleTags: [] as string[],
    servingTemperatures: [] as string[],
    sakeInfoTags: [] as string[],
    foodPairings: [] as { food: string; pairing: 'yes' | 'no'; reason: string }[],
    userDescription: '',
    aiResultNote: '',
    activeBrain: null as 'left' | 'right' | null,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 從草稿載入（URL 包含 ?draft=<id> 時）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const draftParam = params.get('draft');
    if (!draftParam) return;
    try {
      const raw = localStorage.getItem('sake_note_drafts');
      if (!raw) return;
      const arr = JSON.parse(raw);
      const d = arr.find((item: Record<string, unknown>) => item.id === draftParam);
      if (!d) return;
      setDraftId(d.id as string);
      setIsEditingDraft(true);
      if (d.formData) {
        setFormData(prev => ({
          ...prev,
          ...(d.formData as Partial<typeof prev>),
          servingTemperatures: Array.isArray((d.formData as { servingTemperatures?: unknown }).servingTemperatures)
            ? ((d.formData as { servingTemperatures?: string[] }).servingTemperatures || []).filter(Boolean)
            : typeof (d.formData as { servingTemperature?: unknown }).servingTemperature === 'string'
              ? [((d.formData as { servingTemperature?: string }).servingTemperature || '')].filter(Boolean)
              : prev.servingTemperatures,
        }));
      }
      if ((d.images as string[])?.length) setImages(d.images as string[]);
      if ((d.originals as string[])?.length) setOriginals(d.originals as string[]);
      if (d.zooms) setZooms(d.zooms as number[]);
      if (d.offsets) setOffsets(d.offsets as {x:number;y:number}[]);
      if (d.splitRatio !== undefined) setSplitRatio(d.splitRatio as number);
      if (d.imgRatios) setImgRatios(d.imgRatios as number[]);
      toast({ title: '草稿已載入', description: `繼續編輯「${(d.brandName as string) || '未命名草稿'}」` });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBrandChange = (value: string) => {
    setFormData(prev => ({ ...prev, brandName: value }));
    if (value.length > 0) {
      const filtered = SAKE_DATABASE.filter(item => 
        item.brand.toLowerCase().includes(value.toLowerCase()) || 
        item.brewery.toLowerCase().includes(value.toLowerCase()) ||
        item.location.toLowerCase().includes(value.toLowerCase())
      );
      setBrandSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (item: SakeDatabaseEntry) => {
    setFormData(prev => ({ ...prev, brandName: item.brand, brewery: item.brewery, origin: item.location }));
    setShowSuggestions(false);
  };

  // --- AI 雙腦品鑑邏輯 ---
  const generateBrainNote = async (mode: 'left' | 'right') => {
  if (isGenerating || !formData.brandName) return;
  
  setIsGenerating(true);
// 先切換發光顏色與顯示標題
  setFormData(prev => ({ ...prev, activeBrain: mode }));

  try {
    const response = await authorizedJsonFetch(auth, '/api/ai/generate-note', {
      method: 'POST',
      body: JSON.stringify({
        brandName: formData.brandName,
        subBrand: formData.subBrand,
        brewery: formData.brewery,
        origin: formData.origin,
        alcoholPercent: formData.alcoholPercent,
        sakeInfoTags: formData.sakeInfoTags,
        ratings: { 
          sweetness: formData.sweetness, 
          acidity: formData.acidity, 
          bitterness: formData.bitterness, 
          umami: formData.umami, 
          astringency: formData.astringency 
        },
        userDescription: formData.userDescription,
        mode
      })
    });
    
    const data = await response.json();
    if (data.text) {
      // 將 AI 生成的內容填入下方的卡片
      setFormData(prev => ({ ...prev, aiResultNote: data.text }));
      toast({ title: `${mode === 'left' ? '理性' : '感性'}品鑑筆記生成成功` });
    }
  } catch (err) {
    toast({ variant: "destructive", title: "AI 連線失敗" });
  } finally {
    setIsGenerating(false);
  }
};

  const prepareAiIdentifyImage = async (idx: number): Promise<{ dataUri: string; source: 'original' | 'captured' } | null> => {
    if (!images[idx]) return null;

    const original = originals[idx] || images[idx];
    const ratio = imgRatios[idx] || 1;
    const defaultZoom = images.length === 1 ? Math.min(ratio, 1 / ratio) : 1;
    const zoomUnchanged = Math.abs(zooms[idx] - defaultZoom) < 0.001;
    const offsetUnchanged = Math.abs(offsets[idx].x) < 0.5 && Math.abs(offsets[idx].y) < 0.5;

    if (original && zoomUnchanged && offsetUnchanged) {
      return { dataUri: original, source: 'original' };
    }

    const captured = await captureCurrentView(idx);
    const optimized = await resizeImage(captured, 1024);
    return { dataUri: optimized, source: 'captured' };
  };

  const triggerAIIdentification = async () => {
    const abortController = new AbortController();
    identifyAbortRef.current = abortController;
    setIsIdentifying(true);
    setIdentifyCountdown(20);
    const totalStart = performance.now();
    const countdownInterval = setInterval(() => {
      setIdentifyCountdown(prev => prev - 1);
    }, 1000);
    try {
      const preprocessStart = performance.now();
      const [preparedFront, preparedBack] = await Promise.all([
        prepareAiIdentifyImage(0),
        images[1] ? prepareAiIdentifyImage(1) : Promise.resolve(null),
      ]);

      if (!preparedFront?.dataUri) {
        throw new Error('missing-identify-image');
      }

      const preprocessMs = roundDuration(performance.now() - preprocessStart);
      const requestStart = performance.now();
      const response = await authorizedJsonFetch(auth, '/api/ai/identify-sake', {
        method: 'POST',
        body: JSON.stringify({
          photoDataUri: preparedFront.dataUri,
          ...(preparedBack?.dataUri ? { backPhotoDataUri: preparedBack.dataUri } : {}),
        }),
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error('API error');
      const requestMs = roundDuration(performance.now() - requestStart);
      const result = await response.json();
      const serverTimingHeader = response.headers.get('x-identify-sake-timing');
      let serverTiming: Record<string, unknown> | null = null;
      if (serverTimingHeader) {
        try {
          serverTiming = JSON.parse(serverTimingHeader) as Record<string, unknown>;
        } catch {
          serverTiming = null;
        }
      }

      if (result) {
        const newInfoTags: string[] = [];
        if (result.seimaibuai) newInfoTags.push(`精米${result.seimaibuai}`);
        if (result.riceName) newInfoTags.push(result.riceName);
        if (result.specialProcess) newInfoTags.push(...result.specialProcess);
        if (result.yeast) newInfoTags.push(`酵母${result.yeast}`);
        if (result.smv) newInfoTags.push(`日本酒度${result.smv}`);
        const normalized = normalizeSakeInfo(
          result.brandName || '',
          result.brewery || '',
          result.origin || '',
          knownBrands
        );
        setFormData(prev => ({
          ...prev,
          brandName: normalized.brandName || prev.brandName,
          brewery: normalized.brewery || prev.brewery,
          origin: normalized.origin || prev.origin,
          alcoholPercent: result.alcoholPercent || prev.alcoholPercent,
          sakeInfoTags: newInfoTags.length > 0 ? newInfoTags : prev.sakeInfoTags,
        }));
        console.info('[AI辨識前端計時]', {
          preprocessMs,
          requestMs,
          totalMs: roundDuration(performance.now() - totalStart),
          frontImageSource: preparedFront.source,
          backImageSource: preparedBack?.source ?? null,
          serverTiming,
        });
        toast({ title: "AI 辨識成功", description: "已自動填充資訊。" });
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        toast({ title: "AI 辨識已取消" });
      } else {
        toast({ variant: "destructive", title: "AI 辨識失敗" });
      }
    } finally {
      clearInterval(countdownInterval);
      setIsIdentifying(false);
      setIdentifyCountdown(0);
      identifyAbortRef.current = null;
    }
  };

  const openPicker = (type: 'new' | 'replace' | 'replace-all', idx = 0) => {
    setPickerTarget({ type, idx });
    setShowPicker(true);
  };

  const handlePickerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setShowPicker(false);
    if (!files || files.length === 0) { e.target.value = ''; return; }
    if (pickerTarget.type === 'replace-all') {
      handleReplaceAll(files);
    } else if (pickerTarget.type === 'replace') {
      handleReplaceImage(pickerTarget.idx, files[0]);
    } else {
      const remainingSlots = 2 - images.length;
      if (remainingSlots <= 0) { e.target.value = ''; return; }
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const startIdx = images.length;
      const totalAfter = startIdx + filesToProcess.length;
      if (startIdx === 1) {
        setZooms(prev => { const next = [...prev]; next[0] = 1; return next; });
      }
      filesToProcess.forEach((file, slotOffset) => {
        const slotIdx = startIdx + slotOffset;
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const resized = await resizeImage(base64, 1024);
          const ratio = await getImageRatio(resized);
          const newZoom = (slotIdx === 0 && totalAfter === 1) ? Math.min(ratio, 1 / ratio) : 1;
          setImages(prev => [...prev, resized]);
          setOriginals(prev => [...prev, resized]);
          setImgRatios(prev => { const next = [...prev]; next[slotIdx] = ratio; return next; });
          setZooms(prev => { const next = [...prev]; next[slotIdx] = newZoom; return next; });
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const remainingSlots = 2 - images.length;
      if (remainingSlots <= 0) return;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const startIdx = images.length;
      const totalAfter = startIdx + filesToProcess.length;
      // 切到雙圖模式時，第一張 zoom 重置為 1（配合 object-cover）
      if (startIdx === 1) {
        setZooms(prev => { const next = [...prev]; next[0] = 1; return next; });
      }
      filesToProcess.forEach((file, slotOffset) => {
        const slotIdx = startIdx + slotOffset;
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const resized = await resizeImage(base64, 1024);
          const ratio = await getImageRatio(resized);
          // 單圖模式：初始 zoom 設為 containZoom（顯示完整圖片）
          // 雙圖模式：初始 zoom = 1（配合 object-cover 填滿半格）
          const newZoom = (slotIdx === 0 && totalAfter === 1) ? Math.min(ratio, 1 / ratio) : 1;
          setImages(prev => [...prev, resized]);
          setOriginals(prev => [...prev, resized]);
          setImgRatios(prev => { const next = [...prev]; next[slotIdx] = ratio; return next; });
          setZooms(prev => { const next = [...prev]; next[slotIdx] = newZoom; return next; });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleReplaceImage = (idx: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const resized = await resizeImage(base64, 1024);
      const ratio = await getImageRatio(resized);
      const isSingleMode = images.length === 1;
      const newZoom = isSingleMode ? Math.min(ratio, 1 / ratio) : 1;
      setImages(prev => { const next = [...prev]; next[idx] = resized; return next; });
      setOriginals(prev => { const next = [...prev]; next[idx] = resized; return next; });
      setImgRatios(prev => { const next = [...prev]; next[idx] = ratio; return next; });
      setZooms(prev => { const next = [...prev]; next[idx] = newZoom; return next; });
      setOffsets(prev => { const next = [...prev]; next[idx] = { x: 0, y: 0 }; return next; });
    };
    reader.readAsDataURL(file);
  };

  const handleReplaceAll = (files: FileList) => {
    const filesToProcess = Array.from(files).slice(0, 2);
    const total = filesToProcess.length;
    setLockedImgs([false, false]);
    setSplitRatio(50);
    Promise.all(
      filesToProcess.map((file, slotIdx) =>
        new Promise<{ slotIdx: number; resized: string; ratio: number; newZoom: number }>(resolve => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result as string;
            const resized = await resizeImage(base64, 1024);
            const ratio = await getImageRatio(resized);
            const newZoom = (slotIdx === 0 && total === 1) ? Math.min(ratio, 1 / ratio) : 1;
            resolve({ slotIdx, resized, ratio, newZoom });
          };
          reader.readAsDataURL(file);
        })
      )
    ).then(results => {
      const sortedResults = [...results].sort((a, b) => a.slotIdx - b.slotIdx);
      setImages(sortedResults.map(r => r.resized));
      setOriginals(sortedResults.map(r => r.resized));
      const newImgRatios = [1, 1]; const newZooms = [1, 1]; const newOffsets = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
      sortedResults.forEach(r => { newImgRatios[r.slotIdx] = r.ratio; newZooms[r.slotIdx] = r.newZoom; });
      setImgRatios(newImgRatios); setZooms(newZooms); setOffsets(newOffsets);
    });
  };

  const handleSaveDraft = () => {
    try {
      const id = draftId || Date.now().toString();
      const draft = {
        id,
        brandName: formData.brandName || '未命名草稿',
        formData,
        images,
        originals,
        zooms,
        offsets,
        splitRatio,
        imgRatios,
        savedAt: new Date().toISOString(),
      };
      const raw = localStorage.getItem('sake_note_drafts');
      const arr: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex(d => d.id === id);
      if (idx >= 0) { arr[idx] = draft; } else { arr.push(draft); }
      localStorage.setItem('sake_note_drafts', JSON.stringify(arr));
      setDraftId(id);
      setIsEditingDraft(true);
      toast({ title: '草稿已儲存', description: '可從首頁草稿列表繼續編輯' });
    } catch {
      toast({ variant: 'destructive', title: '儲存草稿失敗', description: '裝置儲存空間可能不足' });
    }
  };

  const captureCurrentView = async (idx: number): Promise<string> => {
    if (!images[idx]) return "";
    const img = new window.Image();
    img.src = images[idx];
    await new Promise((resolve) => { img.onload = resolve; });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return images[idx];
    const SIZE = 1200;
    canvas.width = SIZE; canvas.height = SIZE;
    const zoom = zooms[idx]; const offset = offsets[idx];
    // object-cover 語義：短邊擐滿 SIZE
    const imgRatio = img.width / img.height;
    let coverW, coverH;
    if (imgRatio > 1) { coverH = SIZE; coverW = SIZE * imgRatio; }
    else { coverW = SIZE; coverH = SIZE / imgRatio; }
    // 基礎居中（cover 裁切為正中央）
    const baseX = (SIZE - coverW) / 2;
    const baseY = (SIZE - coverH) / 2;
    // 將畫面裏的 px offset 比例導成 canvas 小數
    const editorWidth = window.innerWidth < 640 ? window.innerWidth - 64 : 640;
    const scaleFactor = SIZE / editorWidth;
    const drawW = coverW * zoom;
    const drawH = coverH * zoom;
    // zoom 從中心漲將
    const zoomOffX = (coverW - drawW) / 2;
    const zoomOffY = (coverH - drawH) / 2;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img,
      baseX + zoomOffX + (offset.x * scaleFactor),
      baseY + zoomOffY + (offset.y * scaleFactor),
      drawW, drawH);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const toggleStyleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      styleTags: prev.styleTags.includes(tag) ? prev.styleTags.filter(t => t !== tag) : [...prev.styleTags, tag]
    }));
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !formData.styleTags.includes(tag)) {
      setFormData(prev => ({ ...prev, styleTags: [...prev.styleTags, tag] }));
      setCustomTag("");
    }
  };

  const onTouchStart = (e: React.TouchEvent, idx: number) => {
    setDraggingIdx(idx);
    if (e.touches.length === 1) {
      setDragStart({ x: e.touches[0].clientX - offsets[idx].x, y: e.touches[0].clientY - offsets[idx].y });
    } else if (e.touches.length === 2) {
      setInitialDist(Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY));
      setInitialZoom(zooms[idx]);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (draggingIdx === null) return;
    if (e.touches.length === 1) {
      setOffsets(prev => {
        const next = [...prev];
        next[draggingIdx] = { x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y };
        return next;
      });
    } else if (e.touches.length === 2 && initialDist && initialZoom) {
      const scale = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) / initialDist;
      const r = imgRatios[draggingIdx] || 1;
      // 單圖模式允許縮小到 containZoom（顯示完整圖片）；雙圖模式最小 1
      const minZoom = images.length === 1 ? Math.min(r, 1 / r) : 1;
      setZooms(prev => {
        const next = [...prev];
        next[draggingIdx] = Math.min(Math.max(initialZoom * scale, minZoom), 5);
        return next;
      });
    }
  };

  const onMouseDown = (e: React.MouseEvent, idx: number) => {
    setDraggingIdx(idx);
    setDragStart({ x: e.clientX - offsets[idx].x, y: e.clientY - offsets[idx].y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (draggingIdx === null) return;
    setOffsets(prev => {
      const next = [...prev];
      next[draggingIdx] = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
      return next;
    });
  };

const handleSave = async () => {
  if (!firestore || !user) return;
  
  // 強制要求用戶有 username
  if (!profile?.username) {
    toast({ variant: "destructive", title: "請先設置使用者名稱", description: "前往個人檔案頁面設置您的名稱" });
    router.push('/profile');
    return;
  }

  setIsSaving(true);
  try {
    const finalImages = await Promise.all(images.map((_, i) => captureCurrentView(i)));
    
    const noteData = {
      userId: user.uid,
      username: profile.username,
      ...formData,
      // 統一用 Rating 後綴儲存，與 types.ts 一致
      sweetnessRating: formData.sweetness,
      acidityRating: formData.acidity,
      bitternessRating: formData.bitterness,
      umamiRating: formData.umami,
      astringencyRating: formData.astringency,
      userDescription: formData.userDescription, 
      aiResultNote: formData.aiResultNote,
      activeBrain: formData.activeBrain,
      sakeInfoTags: formData.sakeInfoTags,
      servingTemperatures: formData.servingTemperatures,
      alcoholPercent: formData.alcoholPercent,
      foodPairings: formData.foodPairings,
      
      imageUrls: finalImages,
      imageOriginals: originals,
      imageTransforms: images.map((_, i) => ({ x: offsets[i].x, y: offsets[i].y, scale: zooms[i] })),
      tastingDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(firestore, 'sakeTastingNotes'), noteData);
    cachePublishedNote({
      id: docRef.id,
      ...noteData,
      description: formData.userDescription || '',
    } as SakeNote);
    // 讓 top3 cache 失效，下次首頁載入時重算
    deleteDoc(doc(firestore, 'meta', 'top3')).catch(() => {});
    try {
      if (draftId) {
        const raw = localStorage.getItem('sake_note_drafts');
        const arr: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem('sake_note_drafts', JSON.stringify(arr.filter(d => d.id !== draftId)));
      }
    } catch {}

    // 儲存開瓶後追蹤提醒
    if (reminderEnabled && docRef) {
      try {
        const intervalHours =
          reminderUnit === 'years' ? reminderValue * 24 * 365 :
          reminderUnit === 'months' ? reminderValue * 24 * 30 :
          reminderUnit === 'days' ? reminderValue * 24 :
          reminderValue;
        const nextAt = new Date(Date.now() + intervalHours * 3600 * 1000).toISOString();
        const reminders = JSON.parse(localStorage.getItem('sake_reminders') || '[]');
        reminders.push({ noteId: docRef.id, brandName: formData.brandName, nextReminderAt: nextAt, intervalHours });
        localStorage.setItem('sake_reminders', JSON.stringify(reminders));
      } catch {}
    }

    toast({ title: "筆記已發布" });
    window.location.replace('/');
  } catch (err) {
    toast({ variant: "destructive", title: "儲存失敗" });
    setIsSaving(false);
  }
};

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 mb-24 notebook-texture min-h-screen font-body select-none" onMouseMove={onMouseMove} onMouseUp={() => setDraggingIdx(null)}>
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => window.location.replace('/')} className="text-primary hover:bg-primary/10 transition-colors"><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="text-lg font-headline text-primary ml-2 gold-glow tracking-widest uppercase">建立品飲筆記</h1>
      </div>

      {/* 要求登入提示 */}
      {isAccountStatusPending ? (
        <div className="dark-glass rounded-[2rem] border border-white/10 bg-white/5 p-6 mb-6">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-primary/70 flex-shrink-0 mt-0.5 animate-spin" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-bold text-foreground">正在確認帳戶狀態</p>
              <p className="text-xs text-muted-foreground">稍候即可判斷是否可直接建立品飲筆記。</p>
            </div>
          </div>
        </div>
      ) : !user ? (
        <div className="dark-glass rounded-[2rem] border border-amber-500/30 bg-amber-500/10 p-6 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <p className="text-sm font-bold text-amber-100">請先登入後再建立貼文</p>
              <p className="text-xs text-amber-100/80">目前已不再自動建立匿名帳號，建立品飲筆記前請先登入或找回帳戶。</p>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => router.push('/profile')} className="rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-8">
                  前往登入／建立帳戶
                </Button>
                <Button onClick={() => router.push('/recover')} variant="outline" className="rounded-full text-xs font-bold h-8 border-amber-400/40 text-amber-100 bg-transparent hover:bg-amber-500/10">
                  找回帳戶
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : !canCreateNote && (
        <div className="dark-glass rounded-[2rem] border border-amber-500/30 bg-amber-500/10 p-6 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <p className="text-sm font-bold text-amber-100">建立帳戶以開始貼文</p>
              <p className="text-xs text-amber-100/80">您需要設置使用者名稱後才能建立品飲筆記。</p>
              <Button 
                onClick={() => router.push('/profile')} 
                className="rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-8"
              >
                前往設置個人檔案
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5" style={{ opacity: canCreateNote ? 1 : 0.5, pointerEvents: canCreateNote ? 'auto' : 'none' }}>

        {/* 照片聚焦編輯 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <Label className="text-[10px] uppercase font-bold text-primary tracking-widest shrink-0">照片聚焦編輯</Label>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="outline" size="sm" type="button" className="text-[9px] font-bold h-6 rounded-full border-primary/40 text-primary bg-primary/5" onClick={() => setShowGuidedTasting(true)}>
                <ListChecks className="w-2.5 h-2.5 mr-1" /> 引導品鑒
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled
                className="text-[9px] font-bold h-6 rounded-full border-white/10 bg-white/5 text-muted-foreground/55 opacity-100 cursor-not-allowed disabled:opacity-100 disabled:pointer-events-none"
                title="專業品鑑功能建構中"
              >
                <ClipboardCheck className="w-2.5 h-2.5 mr-1" /> 專業品鑑（建構中）
              </Button>
              {images.length > 0 && (
                <Button variant="outline" size="sm" className="text-[9px] font-bold h-6 px-2 rounded-full border-primary/40 text-primary bg-primary/5" onClick={() => openPicker('replace-all')} title="重選圖片">
                  <Camera className="w-3 h-3" />
                </Button>
              )}
              <Button variant="outline" size="sm" className="text-[9px] font-bold h-6 px-2 rounded-full border-primary/40 text-primary bg-primary/5" onClick={() => images.length === 2 && setImages([images[1], images[0]])} disabled={images.length < 2} title="換位">
                <Repeat className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <div className="dark-glass rounded-[2rem] overflow-hidden border border-primary/20 p-3 space-y-3 shadow-xl">
            {images.length > 0 ? (
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black shadow-inner flex touch-none">
                {images.length === 2 ? (
                  <>
                    <div className={cn("h-full relative overflow-hidden", lockedImgs[0] ? "cursor-default" : "cursor-move")} style={{ width: `${splitRatio}%` }} onTouchStart={lockedImgs[0] ? undefined : (e) => onTouchStart(e, 0)} onTouchMove={lockedImgs[0] ? undefined : onTouchMove} onTouchEnd={lockedImgs[0] ? undefined : () => setDraggingIdx(null)} onMouseDown={lockedImgs[0] ? undefined : (e) => onMouseDown(e, 0)}>
                      {/* 雙圖模式：contain 定位，顯示完整圖片，作者自行平移/縮放構圖 */}
                      {(() => {
                        const R = imgRatios[0] || 1;
                        const C = splitRatio / 100; // sub-container aspect (W/H), H = total square side
                        // contain by height: R < C → image taller → fill height, center horizontally
                        // contain by width:  R >= C → image wider  → fill width,  center vertically
                        const byH = R < C;
                        return <img src={images[0]} className="absolute pointer-events-none" style={byH ? {
                          height: '100%', width: 'auto',
                          top: '0', left: '50%',
                          transform: `translateX(-50%) translate(${offsets[0].x}px, ${offsets[0].y}px) scale(${zooms[0]})`,
                          transformOrigin: 'center center',
                        } : {
                          width: '100%', height: 'auto',
                          left: '0', top: '50%',
                          transform: `translateY(-50%) translate(${offsets[0].x}px, ${offsets[0].y}px) scale(${zooms[0]})`,
                          transformOrigin: 'center center',
                        }} alt="img1" />;
                      })()}
                      <button type="button" className={cn("absolute top-2 left-2 z-20 flex items-center gap-1 backdrop-blur-sm px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all border cursor-pointer", lockedImgs[0] ? "bg-primary/20 border-primary/60 text-primary" : "bg-black/60 hover:bg-white/20 border-white/20 text-white/60")} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => setLockedImgs(prev => { const next = [...prev]; next[0] = !next[0]; return next; })}>
                        {lockedImgs[0] ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                    <div className="h-full w-px bg-white/20 z-10" />
                    <div className={cn("h-full relative overflow-hidden", lockedImgs[1] ? "cursor-default" : "cursor-move")} style={{ width: `${100 - splitRatio}%` }} onTouchStart={lockedImgs[1] ? undefined : (e) => onTouchStart(e, 1)} onTouchMove={lockedImgs[1] ? undefined : onTouchMove} onTouchEnd={lockedImgs[1] ? undefined : () => setDraggingIdx(null)} onMouseDown={lockedImgs[1] ? undefined : (e) => onMouseDown(e, 1)}>
                      {(() => {
                        const R = imgRatios[1] || 1;
                        const C = (100 - splitRatio) / 100;
                        const byH = R < C;
                        return <img src={images[1]} className="absolute pointer-events-none" style={byH ? {
                          height: '100%', width: 'auto',
                          top: '0', left: '50%',
                          transform: `translateX(-50%) translate(${offsets[1].x}px, ${offsets[1].y}px) scale(${zooms[1]})`,
                          transformOrigin: 'center center',
                        } : {
                          width: '100%', height: 'auto',
                          left: '0', top: '50%',
                          transform: `translateY(-50%) translate(${offsets[1].x}px, ${offsets[1].y}px) scale(${zooms[1]})`,
                          transformOrigin: 'center center',
                        }} alt="img2" />;
                      })()}
                      <button type="button" className={cn("absolute top-2 left-2 z-20 flex items-center gap-1 backdrop-blur-sm px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all border cursor-pointer", lockedImgs[1] ? "bg-primary/20 border-primary/60 text-primary" : "bg-black/60 hover:bg-white/20 border-white/20 text-white/60")} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => setLockedImgs(prev => { const next = [...prev]; next[1] = !next[1]; return next; })}>
                        {lockedImgs[1] ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className={cn("w-full h-full relative overflow-hidden", lockedImgs[0] ? "cursor-default" : "cursor-move")} onTouchStart={lockedImgs[0] ? undefined : (e) => onTouchStart(e, 0)} onTouchMove={lockedImgs[0] ? undefined : onTouchMove} onTouchEnd={lockedImgs[0] ? undefined : () => setDraggingIdx(null)} onMouseDown={lockedImgs[0] ? undefined : (e) => onMouseDown(e, 0)}>
                    {/* 單圖模式：手動 cover 定位，初始顯示完整圖片；transform-origin 恰好在容器中心 */}
                    <img src={images[0]} className="absolute pointer-events-none" style={{
                      width: imgRatios[0] >= 1 ? `${imgRatios[0] * 100}%` : '100%',
                      height: imgRatios[0] < 1 ? `${(1 / imgRatios[0]) * 100}%` : '100%',
                      left: imgRatios[0] >= 1 ? `${(1 - imgRatios[0]) * 50}%` : '0%',
                      top: imgRatios[0] < 1 ? `${(1 - 1 / imgRatios[0]) * 50}%` : '0%',
                      transform: `translate(${offsets[0].x}px, ${offsets[0].y}px) scale(${zooms[0]})`,
                      transformOrigin: 'center center',
                    }} alt="img1" />
                    <button type="button" className={cn("absolute top-2 left-2 z-20 flex items-center gap-1 backdrop-blur-sm px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border cursor-pointer", lockedImgs[0] ? "bg-primary/20 border-primary/60 text-primary" : "bg-black/60 hover:bg-white/20 border-white/20 text-white/60")} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => setLockedImgs(prev => { const next = [...prev]; next[0] = !next[0]; return next; })}>
                      {lockedImgs[0] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                  </div>
                )}
                {/* AI 辨識按鈕 — 右上角 */}
                {!isIdentifying && originals.length > 0 && (
                  <button
                    type="button"
                    onClick={triggerAIIdentification}
                    className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-black/60 hover:bg-primary/30 border border-primary/40 text-primary backdrop-blur-sm px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all"
                  >
                    <Sparkles className="w-3 h-3" />
                    AI 辨識
                  </button>
                )}
                {isIdentifying && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md">
                    <div className="bg-primary/20 p-4 rounded-full animate-pulse border border-primary/30 mb-4"><Sparkles className="w-8 h-8 text-primary" /></div>
                    <p className="text-white text-xs font-bold uppercase tracking-widest animate-pulse">AI 辨識酒標中...</p>
                    {identifyCountdown > 0 ? (
                      <p className="text-primary text-lg font-bold mt-2 tabular-nums">{identifyCountdown}<span className="text-[10px] text-white/50 ml-1">s</span></p>
                    ) : (
                      <p className="text-white/60 text-[10px] font-medium mt-2 px-6 text-center leading-relaxed">持續努力辨識中，期間可以先填寫筆記跟評分，感謝您耐心等待 🙇</p>
                    )}
                    <p className="text-white/40 text-[9px] font-bold mt-1 px-6 text-center">AI 可能會出錯，請查證辨識內容</p>
                    <button
                      type="button"
                      onClick={() => identifyAbortRef.current?.abort()}
                      className="mt-4 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 hover:text-white backdrop-blur-sm px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      <X className="w-3 h-3" /> 取消
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => openPicker('new')} className="aspect-square rounded-xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-all group w-full">
                <Camera className="w-8 h-8 text-primary/30 group-hover:text-primary mb-2" />
                <div className="flex items-center gap-1.5 mb-1"><Sparkles className="w-3 h-3 text-primary animate-pulse" /><span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">點擊上傳酒標</span></div>
              </button>
            )}
            {images.length === 2 && <Slider value={[splitRatio]} onValueChange={v => setSplitRatio(v[0])} min={20} max={80} step={1} className="h-4" />}
            {images.length === 1 && (
              <p className="text-[9px] text-primary/50 text-center font-medium flex items-center justify-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />加入背標可大幅加速 AI 辨識
              </p>
            )}
          </div>
        </section>

        {/* 基礎資訊 */}
        <section className="space-y-3 relative" ref={suggestionRef}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 relative">
              <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">銘柄 (品牌)</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
                <Input placeholder="例如：十四代" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.brandName} onChange={e => handleBrandChange(e.target.value)} onFocus={() => formData.brandName && setShowSuggestions(true)} />
              </div>
              {showSuggestions && brandSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 dark-glass border border-primary/20 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                  {brandSuggestions.map((item, idx) => (
                    <button key={idx} className="w-full text-left px-3 py-2 hover:bg-primary/20 border-b border-primary/10 transition-colors" onClick={() => selectSuggestion(item)}>
                      <p className="font-bold text-primary text-xs">{item.brand}</p>
                      <p className="text-[10px] text-muted-foreground">{item.brewery} | {item.location}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">酒造</Label>
              <Input placeholder="例如：高木酒造" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.brewery} onChange={e => setFormData(p => ({ ...p, brewery: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">產地</Label>
              <Input placeholder="例如：山形縣" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.origin} onChange={e => setFormData(p => ({ ...p, origin: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">酒精濃度 (%)</Label>
              <Input placeholder="例如：16" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.alcoholPercent} onChange={e => setFormData(p => ({ ...p, alcoholPercent: e.target.value }))} />
            </div>
          </div>

          {/* 酒鑑資訊標籤 — AI 自動填入，可手動補充/刪除 */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">酒鑑資訊標籤</Label>
              <span className="text-[8px] text-muted-foreground/60">AI 自動辨識，可手動加刪</span>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {formData.sakeInfoTags.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-sky-500/10 text-sky-300 border border-sky-500/30 px-2.5 py-1 rounded-full text-[9px] font-bold">
                  {tag}
                  <button type="button" onClick={() => setFormData(p => ({ ...p, sakeInfoTags: p.sakeInfoTags.filter(t => t !== tag) }))}>
                    <X className="w-2.5 h-2.5 hover:text-white" />
                  </button>
                </span>
              ))}
              {formData.sakeInfoTags.length === 0 && (
                <span className="text-[8px] text-muted-foreground/40 italic ml-1">按右上角 AI 辨識鈕後自動填入...</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="sake-info-tag-input"
                placeholder="自訂標籤（如：生原酒、無濾過、720ml）..."
                className="bg-white/5 h-8 text-[9px] rounded-xl flex-1 border-sky-500/30"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v && !formData.sakeInfoTags.includes(v)) {
                      setFormData(p => ({ ...p, sakeInfoTags: [...p.sakeInfoTags, v] }));
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 rounded-xl bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/30"
                onClick={() => {
                  const input = document.getElementById('sake-info-tag-input') as HTMLInputElement;
                  const v = input?.value.trim();
                  if (v && !formData.sakeInfoTags.includes(v)) {
                    setFormData(p => ({ ...p, sakeInfoTags: [...p.sakeInfoTags, v] }));
                    if (input) input.value = '';
                  }
                }}
              ><Plus className="w-3 h-3 text-sky-300" /></Button>
            </div>
          </div>
        </section>

        {/* 感官評分 */}
        <section className="space-y-4 dark-glass p-5 rounded-xl border border-primary/20 shadow-xl">
          <h2 className="text-[10px] font-headline text-primary border-b border-primary/10 pb-1 gold-glow uppercase tracking-widest">感官評分</h2>
          <div className="space-y-4">
            {['sweetness', 'acidity', 'bitterness', 'umami', 'astringency'].map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label className="font-bold text-foreground text-[9px] uppercase tracking-widest">{key === 'sweetness' ? '甘' : key === 'acidity' ? '酸' : key === 'bitterness' ? '苦' : key === 'umami' ? '旨' : '澀'}</Label>
                  <span className="text-primary font-bold text-[9px] bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">{RATING_LABELS[key as keyof typeof RATING_LABELS][(formData[key as keyof typeof formData] as number) - 1]}</span>
                </div>
                <Slider min={1} max={5} step={1} value={[formData[key as keyof typeof formData] as number]} onValueChange={v => setFormData(p => ({ ...p, [key]: v[0] }))} />
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-center pt-2"><SakeRadarChart data={{ sweetness: formData.sweetness, acidity: formData.acidity, bitterness: formData.bitterness, umami: formData.umami, astringency: formData.astringency }} /></div>
        </section>

{/* --- AI 品鑑筆記區塊 --- */}
<section className="space-y-4">
  {/* 標題與按鈕區 */}
  <div className="flex justify-between items-end px-1">
    <Label className="text-[11px] font-bold text-primary uppercase tracking-widest ml-1">AI 品鑑筆記</Label>
    <div className="flex gap-2">
      <Button 
        variant="outline" size="sm" 
        onClick={() => generateBrainNote('left')}
        disabled={isGenerating || !formData.brandName}
        className={cn(
          "h-8 rounded-full text-[9px] font-bold transition-all border-blue-500/40 bg-blue-500/5 text-blue-400 hover:bg-blue-500/20",
          formData.activeBrain === 'left' && "ring-1 ring-blue-500 ring-offset-1 ring-offset-black"
        )}
      >
        <Sparkles className="w-2.5 h-2.5 mr-1" /> 理性品鑑
      </Button>
      <Button 
        variant="outline" size="sm" 
        onClick={() => generateBrainNote('right')}
        disabled={isGenerating || !formData.brandName}
        className={cn(
          "h-8 rounded-full text-[9px] font-bold transition-all border-rose-500/40 bg-rose-500/5 text-rose-400 hover:bg-rose-500/20",
          formData.activeBrain === 'right' && "ring-1 ring-rose-500 ring-offset-1 ring-offset-black"
        )}
      >
        <Sparkles className="w-2.5 h-2.5 mr-1" /> 感性品鑑
      </Button>
    </div>
  </div>

  <div className="grid grid-cols-1 gap-4">
    {/* 上方：作者原始筆記 (琥珀金配色) */}
    <div className="relative group overflow-hidden bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 transition-all hover:border-amber-500/40">
      <div className="flex items-center gap-2 mb-2 text-amber-500/70">
        <div className="p-1 bg-amber-500/10 rounded-md"><Info size={12} /></div>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">作者的原始筆記</span>
      </div>
      <Textarea 
        placeholder="在此寫下你最直覺的品飲感受..."
        className="min-h-[100px] bg-transparent border-none p-0 text-xs leading-relaxed focus-visible:ring-0 placeholder:text-amber-500/40 text-foreground"
        value={formData.userDescription}
        onChange={e => setFormData(p => ({ ...p, userDescription: e.target.value }))}
      />
    </div>

    {/* 下方：AI 生成筆記 (動態變色) */}
    <div className={cn(
      "relative group overflow-hidden rounded-xl p-4 transition-all duration-500 border min-h-[120px]",
      formData.activeBrain === 'left' ? "bg-blue-500/10 border-blue-500/40" : 
      formData.activeBrain === 'right' ? "bg-rose-500/10 border-rose-500/40" : 
      "bg-white/5 border-white/10 opacity-50"
    )}>
      {/* 標記背景光暈 */}
      <div className={cn(
        "absolute -top-10 -right-10 w-32 h-32 blur-[50px] rounded-full transition-colors duration-700",
        formData.activeBrain === 'left' ? "bg-blue-500/20" : 
        formData.activeBrain === 'right' ? "bg-rose-500/20" : "bg-transparent"
      )} />

      <div className="flex items-center justify-between mb-2">
        <div className={cn(
          "flex items-center gap-2 font-bold text-[9px] uppercase tracking-[0.2em]",
          formData.activeBrain === 'left' ? "text-blue-400" : "text-rose-400"
        )}>
          {formData.activeBrain === 'left' ? <BrainCircuit size={12} /> : <Palette size={12} />}
          {formData.activeBrain === 'left' ? "AI 理性品鑑" : formData.activeBrain === 'right' ? "AI 感性品鑑" : "點擊上方按鈕生成"}
        </div>
        {isGenerating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>

      <Textarea 
        readOnly={!formData.aiResultNote}
        placeholder={formData.brandName ? "點擊上方按鈕，讓 AI 為你的筆記增色..." : "請先輸入銘柄名稱"}
        className="min-h-[80px] bg-transparent border-none p-0 text-xs leading-relaxed focus-visible:ring-0 text-foreground"
        value={formData.aiResultNote}
        onChange={e => setFormData(p => ({ ...p, aiResultNote: e.target.value }))}
      />
    </div>
  </div>
</section>

        {/* 食材搭配 */}
        <section className="space-y-3 dark-glass p-5 rounded-xl border border-emerald-500/20 shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-emerald-500/10 pb-2 mb-1">
            <span className="text-base">&#127860;</span>
            <h2 className="text-[10px] font-headline text-emerald-400 uppercase tracking-widest">這樣搭好嗎？</h2>
          </div>
          <div className="space-y-2">
            {formData.foodPairings.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder="料理名稱"
                  value={item.food}
                  onChange={e => setFormData(p => { const fp = [...p.foodPairings]; fp[idx] = { ...fp[idx], food: e.target.value }; return { ...p, foodPairings: fp }; })}
                  className="bg-white/5 border-emerald-500/20 h-8 text-[10px] rounded-xl w-24 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => setFormData(p => { const fp = [...p.foodPairings]; fp[idx] = { ...fp[idx], pairing: fp[idx].pairing === 'yes' ? 'no' : 'yes' }; return { ...p, foodPairings: fp }; })}
                  className={cn(
                    "h-8 px-3 rounded-xl text-[9px] font-bold shrink-0 border transition-all",
                    item.pairing === 'yes'
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                      : "bg-red-500/20 border-red-500/50 text-red-300"
                  )}
                >
                  {item.pairing === 'yes' ? '搭配' : '不搭'}
                </button>
                <Input
                  placeholder="為什麼？"
                  value={item.reason}
                  onChange={e => setFormData(p => { const fp = [...p.foodPairings]; fp[idx] = { ...fp[idx], reason: e.target.value }; return { ...p, foodPairings: fp }; })}
                  className="bg-white/5 border-emerald-500/20 h-8 text-[10px] rounded-xl flex-1"
                />
                <button type="button" onClick={() => setFormData(p => ({ ...p, foodPairings: p.foodPairings.filter((_, i) => i !== idx) }))} className="p-1.5 rounded-full text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {formData.foodPairings.length === 0 && (
              <p className="text-[9px] text-muted-foreground/40 italic ml-1">還未新增搭配建議，點擊下方 + 開始新增...</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFormData(p => ({ ...p, foodPairings: [...p.foodPairings, { food: '', pairing: 'yes', reason: '' }] }))}
            className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors mt-1"
          >
            <Plus className="w-3 h-3" /> 新增欄位
          </button>
        </section>

        {/* 風格標籤 */}
        <section className="space-y-3 dark-glass p-5 rounded-xl border border-primary/20 shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-primary/10 pb-1 mb-2">
             <Tag className="w-3.5 h-3.5 text-primary" />
             <h2 className="text-[10px] font-headline text-primary uppercase tracking-widest">風格標籤</h2>
          </div>
          <div className="space-y-3">
            {['classification', 'style', 'body'].map(group => (
              <div key={group} className="space-y-1.5">
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{group === 'classification' ? '分類' : group === 'style' ? '風格' : '酒體'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_TAGS_OPTIONS[group as keyof typeof STYLE_TAGS_OPTIONS].map(tag => (
                    <button key={tag} type="button" onClick={() => toggleStyleTag(tag)} className={cn("px-3 py-1 rounded-full border text-[9px] font-bold transition-all", formData.styleTags.includes(tag) ? "bg-primary text-white border-primary shadow-lg" : "bg-white/5 border-primary/30 text-muted-foreground")}>{tag}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="space-y-1.5">
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">適飲溫度</p>
              <div className="flex flex-wrap gap-1.5">
                {SERVING_TEMPERATURE_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFormData(p => ({
                      ...p,
                      servingTemperatures: p.servingTemperatures.includes(option)
                        ? p.servingTemperatures.filter(item => item !== option)
                        : [...p.servingTemperatures, option],
                    }))}
                    className={cn(
                      "px-3 py-1 rounded-full border text-[9px] font-bold transition-all",
                      formData.servingTemperatures.includes(option) ? "bg-amber-500 text-black border-amber-400 shadow-lg" : "bg-white/5 border-primary/30 text-muted-foreground"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Input placeholder="自定義標籤..." value={customTag} onChange={e => setCustomTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())} className="bg-white/5 h-8 text-[9px] rounded-xl flex-1 border-primary/40" />
              <Button onClick={addCustomTag} size="icon" className="h-8 w-8 rounded-xl"><Plus className="w-3 h-3" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {formData.styleTags.filter(t => !Object.values(STYLE_TAGS_OPTIONS).flat().includes(t)).map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-[9px] font-bold">{tag}<button onClick={() => toggleStyleTag(tag)}><X className="w-2.5 h-2.5 hover:text-white" /></button></span>
              ))}
            </div>
          </div>
        </section>

        {/* 綜合評分 */}
        <section className="space-y-2 pt-2 border-t border-primary/10">
          <div className="flex justify-between items-center px-1">
            <Label className="text-[10px] font-headline text-primary uppercase tracking-widest">綜合評分</Label>
            <div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-primary">{formData.overallRating}</span><span className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase">/ 10</span></div>
          </div>
          <Slider min={1} max={10} step={1} value={[formData.overallRating]} onValueChange={v => setFormData(p => ({ ...p, overallRating: v[0] }))} />
        </section>

        <div className="flex gap-3 mb-12">

          {/* 開瓶後風味追蹤提醒 */}
          <section className={cn("w-full space-y-3 dark-glass p-4 rounded-xl border transition-all", reminderEnabled ? "border-amber-500/40 bg-amber-500/5" : "border-primary/20")}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => {
                  const next = !reminderEnabled;
                  setReminderEnabled(next);
                  if (next && typeof window !== 'undefined' && 'Notification' in window) {
                    Notification.requestPermission();
                  }
                }}
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                  reminderEnabled ? "bg-amber-500 border-amber-500" : "border-primary/40 bg-transparent"
                )}
              >
                {reminderEnabled && <Check className="w-3 h-3 text-black" />}
              </div>
              <div>
                <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <Bell className="w-3 h-3 text-amber-500" /> 設定開瓶後風味追蹤提醒
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">時間到時提醒您再次品飲並記錄</p>
              </div>
            </label>

            {reminderEnabled && (
              <div className="pt-2 border-t border-amber-500/20 space-y-3">
                <p className="text-[9px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3" /> 多久後提醒？</p>
                <div className="flex gap-2">
                  {/* 數值下拉 */}
                  <select
                    value={reminderValue}
                    onChange={e => setReminderValue(Number(e.target.value))}
                    className="flex-1 bg-[#1a1a1a] border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl px-3 h-9 appearance-none cursor-pointer focus:outline-none focus:border-amber-500"
                  >
                    {(() => {
                      const max = reminderUnit === 'hours' ? 23 : reminderUnit === 'days' ? 31 : reminderUnit === 'months' ? 12 : 20;
                      return Array.from({ length: max }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ));
                    })()}
                  </select>
                  {/* 單位下拉 */}
                  <select
                    value={reminderUnit}
                    onChange={e => {
                      const u = e.target.value as 'hours' | 'days' | 'months' | 'years';
                      setReminderUnit(u);
                      const maxVal = u === 'hours' ? 23 : u === 'days' ? 31 : u === 'months' ? 12 : 20;
                      setReminderValue(v => Math.min(v, maxVal));
                    }}
                    className="flex-1 bg-[#1a1a1a] border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl px-3 h-9 appearance-none cursor-pointer focus:outline-none focus:border-amber-500"
                  >
                    <option value="hours">小時後</option>
                    <option value="days">日後</option>
                    <option value="months">個月後</option>
                    <option value="years">年後</option>
                  </select>
                </div>
                <p className="text-[9px] text-amber-400/70 italic">
                  提醒時間：{reminderValue} {reminderUnit === 'hours' ? '小時' : reminderUnit === 'days' ? '日' : reminderUnit === 'months' ? '個月' : '年'}後（儲存後開始計時）
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="flex gap-3 mb-12">
          <Button
            variant="outline"
            className="flex-none h-12 px-5 text-xs rounded-full font-bold uppercase tracking-widest border-primary/40 text-primary"
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            <BookMarked className="w-3 h-3 mr-2" /> 儲存草稿
          </Button>
          <Button
            className="flex-1 h-12 text-xs rounded-full font-bold uppercase tracking-widest bg-primary shadow-2xl"
            onClick={handleSave}
            disabled={isSaving || isIdentifying || images.length === 0}
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Check className="w-3 h-3 mr-2" />} 發佈筆記
          </Button>
        </div>
      </div>

      {/* 相機 / 相簿選擇底部彈窗 */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowPicker(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#18181b] border border-white/10 rounded-t-[2rem] p-6 pb-12 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">選擇圖片來源</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all"
              >
                <Camera className="w-8 h-8 text-primary" />
                <span className="text-sm font-bold text-white">拍照</span>
                <span className="text-[9px] text-white/50">使用相機</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all"
              >
                <Images className="w-8 h-8 text-primary" />
                <span className="text-sm font-bold text-white">相簿</span>
                <span className="text-[9px] text-white/50">從圖片庫選取</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 隱藏 file inputs — 相機 & 相簿 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePickerFile}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple={pickerTarget.type !== 'replace'}
        className="hidden"
        onChange={handlePickerFile}
      />

      {showGuidedTasting && (
        <GuidedTasting
          onComplete={handleGuidedComplete}
          onClose={() => setShowGuidedTasting(false)}
        />
      )}
    </div>
  );
}