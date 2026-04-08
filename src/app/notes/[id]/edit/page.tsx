"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { SakeNote, RATING_LABELS, STYLE_TAGS_OPTIONS, TastingSession } from '@/lib/types';
import { SakeRadarChart } from '@/components/SakeRadarChart';
import { SAKE_DATABASE, SakeDatabaseEntry, normalizeSakeInfo } from '@/lib/sake-data';
import { ArrowLeft, Loader2, Check, MapPin, Repeat, Plus, X, Tag, Info, Search, Sparkles, BrainCircuit, Palette, Camera, Images, Clock, Lock, Unlock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';

async function getImageRatio(src: string): Promise<number> {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => resolve(img.width / img.height);
    img.onerror = () => resolve(1);
    img.src = src;
  });
}

async function resizeImage(base64: string, maxDimension = 1024): Promise<string> {
  return new Promise(resolve => {
    const img = new window.Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxDimension) { h *= maxDimension / w; w = maxDimension; } }
      else { if (h > maxDimension) { w *= maxDimension / h; h = maxDimension; } }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
  });
}

export default function EditNotePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifyCountdown, setIdentifyCountdown] = useState(0);
  const identifyAbortRef = useRef<AbortController | null>(null);
  const [lockedImgs, setLockedImgs] = useState([false, false]);
  
  const [images, setImages] = useState<string[]>([]);
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [zooms, setZooms] = useState<number[]>([1, 1]);
  const [offsets, setOffsets] = useState<{ x: number; y: number }[]>([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  const [imgRatios, setImgRatios] = useState<number[]>([1, 1]); // width/height per image slot
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialDist, setInitialDist] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState<number | null>(null);

  // 相機/相簿選擇器
  const [showPicker, setShowPicker] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // img refs only needed for captureCurrentView container sizing
  const imgRef0 = useRef<HTMLImageElement>(null);
  const imgRef1 = useRef<HTMLImageElement>(null);

  const [brandSuggestions, setBrandSuggestions] = useState<SakeDatabaseEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [customTag, setCustomTag] = useState("");

  // Multi-session state
  const [extraSessions, setExtraSessions] = useState<TastingSession[]>([]);
  const [activeSessionIdx, setActiveSessionIdx] = useState(0); // 0 = original note

  const noteRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'sakeTastingNotes', id);
  }, [firestore, id]);
  const { data: note, isLoading: isNoteLoading } = useDoc<SakeNote>(noteRef);

  // knownBrands: 使用者自己的品馍紀錄，供 AI 辨識正規化比對
  const myNotesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'sakeTastingNotes'), where('userId', '==', user.uid));
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
    sweetness: 3,
    acidity: 3,
    bitterness: 3,
    umami: 3,
    astringency: 3,
    overallRating: 7,
    styleTags: [] as string[],
    sakeInfoTags: [] as string[],
    alcoholPercent: '',
    foodPairings: [] as { food: string; pairing: 'yes' | 'no'; reason: string }[],
    userDescription: '',
    aiResultNote: '',
    activeBrain: null as 'left' | 'right' | null,
  });

  useEffect(() => {
    if (note) {
      setFormData({
        brandName: note.brandName,
        subBrand: note.subBrand || '',
        brewery: note.brewery,
        origin: note.origin || '',
        sweetness: note.sweetnessRating,
        acidity: note.acidityRating,
        bitterness: note.bitternessRating,
        umami: note.umamiRating,
        astringency: note.astringencyRating,
        overallRating: note.overallRating,
        styleTags: note.styleTags || [],
        sakeInfoTags: note.sakeInfoTags || [],
        alcoholPercent: note.alcoholPercent || '',
        foodPairings: (note.foodPairings || []).map((fp: { food: string; pairing: 'yes' | 'no'; reason?: string }) => ({ food: fp.food, pairing: fp.pairing, reason: fp.reason || '' })),
        userDescription: note.userDescription || note.description || '',
        aiResultNote: note.aiResultNote || '',
        activeBrain: note.activeBrain || null,
      });
      if (note.imageUrls) {
        const imgs = note.imageOriginals || note.imageUrls;
        setImages(imgs);
        // 偵測圖片比例，供單圖模式的手動 cover CSS 使用
        imgs.forEach((src: string, idx: number) => {
          const img = new window.Image();
          img.onload = () => {
            setImgRatios(prev => { const next = [...prev]; next[idx] = img.width / img.height; return next; });
          };
          img.src = src;
        });
      }
      if (note.imageSplitRatio) setSplitRatio(note.imageSplitRatio);
      if (note.imageTransforms) {
        setZooms(note.imageTransforms.map(t => t.scale));
        setOffsets(note.imageTransforms.map(t => ({ x: t.x, y: t.y })));
      }
      if (note.sessions) setExtraSessions(note.sessions);
    }
  }, [note]);

  const handleReplaceImage = (idx: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const resized = await resizeImage(base64, 1024);
      const ratio = await getImageRatio(resized);
      const isSingle = images.length === 1;
      const newZoom = isSingle ? Math.min(ratio, 1 / ratio) : 1;
      setImages(prev => { const next = [...prev]; next[idx] = resized; return next; });
      setImgRatios(prev => { const next = [...prev]; next[idx] = ratio; return next; });
      setZooms(prev => { const next = [...prev]; next[idx] = newZoom; return next; });
      setOffsets(prev => { const next = [...prev]; next[idx] = { x: 0, y: 0 }; return next; });
    };
    reader.readAsDataURL(file);
  };

  const openPicker = () => {
    setShowPicker(true);
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
      const newImgRatios = [1, 1]; const newZooms = [1, 1]; const newOffsets = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
      sortedResults.forEach(r => { newImgRatios[r.slotIdx] = r.ratio; newZooms[r.slotIdx] = r.newZoom; });
      setImgRatios(newImgRatios); setZooms(newZooms); setOffsets(newOffsets);
    });
  };

  const handlePickerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setShowPicker(false);
    if (files && files.length > 0) handleReplaceAll(files);
    e.target.value = '';
  };

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

  // AI 雙腦品鑑
  const generateBrainNote = async (mode: 'left' | 'right') => {
    if (isGenerating || !formData.brandName) return;
    setIsGenerating(true);
    setFormData(prev => ({ ...prev, activeBrain: mode }));
    try {
      const response = await fetch('/api/ai/generate-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: formData.brandName,
          ratings: {
            sweetness: formData.sweetness,
            acidity: formData.acidity,
            bitterness: formData.bitterness,
            umami: formData.umami,
            astringency: formData.astringency
          },
          tags: formData.styleTags,
          userDescription: formData.userDescription,
          mode
        })
      });
      const data = await response.json();
      if (data.text) {
        setFormData(prev => ({ ...prev, aiResultNote: data.text }));
        toast({ title: `${mode === 'left' ? '理性' : '感性'}品鑑筆記生成成功` });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "AI 連線失敗" });
    } finally {
      setIsGenerating(false);
    }
  };

  const triggerAIIdentification = async (photoDataUri: string, backPhotoDataUri?: string) => {
    const abortController = new AbortController();
    identifyAbortRef.current = abortController;
    setIsIdentifying(true);
    setIdentifyCountdown(20);
    const countdownInterval = setInterval(() => {
      setIdentifyCountdown(prev => prev - 1);
    }, 1000);
    try {
      const [optimizedPhoto, optimizedBack] = await Promise.all([
        resizeImage(photoDataUri, 1024),
        backPhotoDataUri ? resizeImage(backPhotoDataUri, 1024) : Promise.resolve(undefined),
      ]);
      const response = await fetch('/api/ai/identify-sake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoDataUri: optimizedPhoto, ...(optimizedBack ? { backPhotoDataUri: optimizedBack } : {}) }),
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error('API error');
      const result = await response.json();
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

  const captureCurrentView = async (idx: number): Promise<string> => {
    if (!images[idx]) return "";
    const img = new window.Image();
    img.src = images[idx];
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
    if (!img.width) return images[idx];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return images[idx];
    const SIZE = 1200;
    canvas.width = SIZE; canvas.height = SIZE;

    // 直接從 state 讀取 zoom/offset
    const zoom = zooms[idx] ?? 1;
    const offset = offsets[idx] ?? { x: 0, y: 0 };

    // object-cover 語義：短邊撐滿 SIZE，長邊溢出（裁切）
    const imgRatio = img.width / img.height;
    let coverW, coverH;
    if (imgRatio > 1) { coverH = SIZE; coverW = SIZE * imgRatio; }
    else { coverW = SIZE; coverH = SIZE / imgRatio; }
    // 基礎居中（cover 裁切為正中央）
    const baseX = (SIZE - coverW) / 2;
    const baseY = (SIZE - coverH) / 2;
    // 將畫面裡的 px offset 比例導成 canvas 數值
    const container = document.getElementById(`container-${idx}`);
    const scaleFactor = SIZE / (container?.clientWidth || 390);
    const drawW = coverW * zoom;
    const drawH = coverH * zoom;
    // zoom 從中心縮放
    const zoomOffX = (coverW - drawW) / 2;
    const zoomOffY = (coverH - drawH) / 2;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, SIZE, SIZE);
    try {
      ctx.drawImage(img,
        baseX + zoomOffX + (offset.x * scaleFactor),
        baseY + zoomOffY + (offset.y * scaleFactor),
        drawW, drawH);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return images[idx];
    }
  };

  const toggleStyleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      styleTags: prev.styleTags.includes(tag) ? prev.styleTags.filter(t => t !== tag) : [...prev.styleTags, tag]
    }));
  };

  // Session helper: snapshot current formData ratings/notes into the sessions array before switching
  const snapshotCurrentSession = (sessions: TastingSession[]): TastingSession[] => {
    if (activeSessionIdx === 0) return sessions; // slot 0 is already in formData
    const next = [...sessions];
    const idx = activeSessionIdx - 1;
    if (next[idx]) {
      next[idx] = {
        ...next[idx],
        sweetness: formData.sweetness,
        acidity: formData.acidity,
        bitterness: formData.bitterness,
        umami: formData.umami,
        astringency: formData.astringency,
        overallRating: formData.overallRating,
        userDescription: formData.userDescription,
        aiResultNote: formData.aiResultNote || '',
      };
    }
    return next;
  };

  const switchToSession = (idx: number) => {
    if (idx === activeSessionIdx) return;
    // Save current formData to the right slot
    setExtraSessions(prev => snapshotCurrentSession(prev));
    // Load target session
    if (idx === 0) {
      // Restore from original note
      if (note) {
        setFormData(prev => ({
          ...prev,
          sweetness: note.sweetnessRating,
          acidity: note.acidityRating,
          bitterness: note.bitternessRating,
          umami: note.umamiRating,
          astringency: note.astringencyRating,
          overallRating: note.overallRating,
          userDescription: note.userDescription || note.description || '',
          aiResultNote: note.aiResultNote || '',
          activeBrain: note.activeBrain || null,
        }));
      }
    } else {
      const session = extraSessions[idx - 1];
      if (session) {
        setFormData(prev => ({
          ...prev,
          sweetness: session.sweetness,
          acidity: session.acidity,
          bitterness: session.bitterness,
          umami: session.umami,
          astringency: session.astringency,
          overallRating: session.overallRating,
          userDescription: session.userDescription,
          aiResultNote: session.aiResultNote || '',
          activeBrain: null,
        }));
      }
    }
    setActiveSessionIdx(idx);
  };

  const addNewSession = () => {
    // Snapshot current before adding
    setExtraSessions(prev => {
      const snapshotted = snapshotCurrentSession(prev);
      const newSession: TastingSession = {
        sessionIndex: snapshotted.length + 2,
        timestamp: new Date().toISOString(),
        label: `第${snapshotted.length + 2}次品飲`,
        sweetness: 3,
        acidity: 3,
        bitterness: 3,
        umami: 3,
        astringency: 3,
        overallRating: 7,
        userDescription: '',
        aiResultNote: '',
        styleTags: [],
      };
      const updated = [...snapshotted, newSession];
      // Switch form to new session
      setActiveSessionIdx(updated.length);
      setFormData(p => ({
        ...p,
        sweetness: 3,
        acidity: 3,
        bitterness: 3,
        umami: 3,
        astringency: 3,
        overallRating: 7,
        userDescription: '',
        aiResultNote: '',
        activeBrain: null,
      }));
      return updated;
    });
  };

  const deleteSession = (idx: number) => {
    // idx is 1-based (extra sessions start at 1)
    setExtraSessions(prev => prev.filter((_, i) => i !== idx - 1));
    // If the deleted tab was active or after active, go back to previous tab
    if (activeSessionIdx >= idx) {
      const fallback = activeSessionIdx === idx ? idx - 1 : activeSessionIdx - 1;
      setActiveSessionIdx(0);
      if (note && fallback === 0) {
        setFormData(p => ({
          ...p,
          sweetness: note.sweetnessRating,
          acidity: note.acidityRating,
          bitterness: note.bitternessRating,
          umami: note.umamiRating,
          astringency: note.astringencyRating,
          overallRating: note.overallRating,
          userDescription: note.userDescription || note.description || '',
          aiResultNote: note.aiResultNote || '',
          activeBrain: note.activeBrain || null,
        }));
      }
    }
  };

  const saveCurrentSession = async () => {
    if (!firestore || !user || !note) return;
    setIsSaving(true);
    try {
      const finalSessions = snapshotCurrentSession(extraSessions);
      const session0Data = activeSessionIdx === 0 ? {
        sweetnessRating: formData.sweetness,
        acidityRating: formData.acidity,
        bitternessRating: formData.bitterness,
        umamiRating: formData.umami,
        astringencyRating: formData.astringency,
        overallRating: formData.overallRating,
        userDescription: formData.userDescription,
        aiResultNote: formData.aiResultNote,
        activeBrain: formData.activeBrain,
        description: formData.userDescription,
      } : {};
      await updateDoc(doc(firestore, 'sakeTastingNotes', note.id), {
        sessions: finalSessions,
        ...session0Data,
      });
      deleteDoc(doc(firestore, 'meta', 'top3')).catch(() => {});
      toast({ title: `「${activeSessionIdx === 0 ? '開瓶品飲' : extraSessions[activeSessionIdx - 1]?.label || `第${activeSessionIdx + 1}次`}」就儲存` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '儲存失敗', description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!firestore || !user || !note) return;
    setIsSaving(true);
    try {
      // Snapshot current session before saving
      const finalSessions = snapshotCurrentSession(extraSessions);

      const finalImages = await Promise.all(images.map((_, i) => captureCurrentView(i)));
      // 儲存目前的縮放位移參數，供下次重新編輯時還原
      const transforms = images.map((_, i) => ({ x: offsets[i]?.x ?? 0, y: offsets[i]?.y ?? 0, scale: zooms[i] ?? 1 }));

      // Build session-0 data (original)
      const session0Data = activeSessionIdx === 0 ? {
        sweetnessRating: formData.sweetness,
        acidityRating: formData.acidity,
        bitternessRating: formData.bitterness,
        umamiRating: formData.umami,
        astringencyRating: formData.astringency,
        overallRating: formData.overallRating,
        userDescription: formData.userDescription,
        aiResultNote: formData.aiResultNote,
        activeBrain: formData.activeBrain,
        description: formData.userDescription,
      } : {
        sweetnessRating: note.sweetnessRating,
        acidityRating: note.acidityRating,
        bitternessRating: note.bitternessRating,
        umamiRating: note.umamiRating,
        astringencyRating: note.astringencyRating,
        overallRating: note.overallRating,
        userDescription: note.userDescription || note.description || '',
        aiResultNote: note.aiResultNote || '',
        activeBrain: note.activeBrain || null,
        description: note.userDescription || note.description || '',
      };

      const noteData = {
        brandName: formData.brandName,
        brewery: formData.brewery,
        origin: formData.origin,
        styleTags: formData.styleTags,
        sakeInfoTags: formData.sakeInfoTags,
        alcoholPercent: formData.alcoholPercent,
        foodPairings: formData.foodPairings,
        imageUrls: finalImages,
        imageOriginals: images,
        imageTransforms: transforms,
        imageSplitRatio: images.length === 2 ? splitRatio : 50,
        sessions: finalSessions,
        ...session0Data,
      };
      await updateDoc(doc(firestore, 'sakeTastingNotes', note.id), noteData);
      // 讓 top3 cache 失效，下次首頁載入時重算
      deleteDoc(doc(firestore, 'meta', 'top3')).catch(() => {});
      toast({ title: "修改已儲存" });
      router.push(`/notes/${id}`);
    } catch (err: any) {
      console.error('[EditNote] save error:', err);
      toast({ variant: "destructive", title: "儲存失敗", description: err?.message || String(err) });
      setIsSaving(false);
    }
  };

  if (isUserLoading || isNoteLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center notebook-texture font-body">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground text-[8px] font-bold uppercase tracking-widest">載入中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 mb-24 notebook-texture min-h-screen font-body select-none" onMouseMove={onMouseMove} onMouseUp={() => setDraggingIdx(null)}>
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/notes/${id}`)} className="text-primary"><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="text-lg font-headline text-primary ml-2 gold-glow tracking-widest uppercase">編輯品飲筆記</h1>
      </div>

      {/* Session Tabs */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => switchToSession(0)}
          className={cn(
            "flex-shrink-0 px-3 py-1.5 rounded-full border text-[9px] font-bold transition-all",
            activeSessionIdx === 0 ? "bg-primary text-white border-primary shadow-lg" : "bg-white/5 border-primary/30 text-muted-foreground"
          )}
        >
          開瓶品飲
        </button>
        {extraSessions.map((s, i) => (
          <div key={i} className="flex-shrink-0 flex items-center">
            <button
              type="button"
              onClick={() => switchToSession(i + 1)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-l-full border text-[9px] font-bold transition-all",
                activeSessionIdx === i + 1 ? "bg-primary text-white border-primary shadow-lg" : "bg-white/5 border-primary/30 text-muted-foreground"
              )}
            >
              <Clock className="w-2.5 h-2.5" /> {s.label}
            </button>
            <button
              type="button"
              onClick={() => deleteSession(i + 1)}
              className={cn(
                "flex items-center justify-center w-6 py-1.5 rounded-r-full border-t border-r border-b text-[9px] font-bold transition-all hover:bg-destructive/20 hover:text-destructive",
                activeSessionIdx === i + 1 ? "border-primary bg-primary/80 text-white" : "border-primary/30 bg-white/5 text-muted-foreground"
              )}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addNewSession}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-primary/40 text-primary text-[9px] font-bold hover:bg-primary/10 transition-all"
        >
          <Plus className="w-2.5 h-2.5" /> 新增品飲
        </button>
      </div>

      <div className="space-y-5">
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <Label className="text-[10px] uppercase font-bold text-primary tracking-widest">照片聚焦編輯</Label>
            <div className="flex gap-1.5">
              {images.length > 0 && (
                <Button variant="outline" size="sm" className="text-[9px] font-bold h-6 rounded-full border-primary/40 text-primary bg-primary/5" onClick={() => openPicker()}>
                  <Camera className="w-2.5 h-2.5 mr-1" /> 重選
                </Button>
              )}
              <Button variant="outline" size="sm" className="text-[9px] font-bold h-6 rounded-full border-primary/40 text-primary bg-primary/5" onClick={() => images.length === 2 && setImages([images[1], images[0]])} disabled={images.length < 2}>
                <Repeat className="w-2.5 h-2.5 mr-1" /> 換位
              </Button>
            </div>
          </div>

          <div className="dark-glass rounded-[2rem] overflow-hidden border border-primary/20 p-3 space-y-3 shadow-xl">
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black shadow-inner flex touch-none">
              {images.length === 2 ? (
                <>
                  <div id="container-0" className={cn("h-full relative overflow-hidden", lockedImgs[0] ? "cursor-default" : "cursor-move")} style={{ width: `${splitRatio}%` }} onTouchStart={lockedImgs[0] ? undefined : (e) => onTouchStart(e, 0)} onTouchMove={lockedImgs[0] ? undefined : onTouchMove} onTouchEnd={lockedImgs[0] ? undefined : () => setDraggingIdx(null)} onMouseDown={lockedImgs[0] ? undefined : (e) => onMouseDown(e, 0)}>
                    {(() => {
                      const R = imgRatios[0] || 1;
                      const C = splitRatio / 100;
                      const byH = R < C;
                      return <img ref={imgRef0} src={images[0]} className="absolute pointer-events-none" style={byH ? {
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
                    <button type="button" className={cn("absolute top-2 left-2 z-20 flex items-center gap-1 backdrop-blur-sm px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all border", lockedImgs[0] ? "bg-primary/20 border-primary/60 text-primary" : "bg-black/60 hover:bg-white/20 border-white/20 text-white/60")} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => setLockedImgs(prev => { const next = [...prev]; next[0] = !next[0]; return next; })}>
                      {lockedImgs[0] ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                  <div className="h-full w-px bg-white/20 z-10" />
                  <div id="container-1" className={cn("h-full relative overflow-hidden", lockedImgs[1] ? "cursor-default" : "cursor-move")} style={{ width: `${100 - splitRatio}%` }} onTouchStart={lockedImgs[1] ? undefined : (e) => onTouchStart(e, 1)} onTouchMove={lockedImgs[1] ? undefined : onTouchMove} onTouchEnd={lockedImgs[1] ? undefined : () => setDraggingIdx(null)} onMouseDown={lockedImgs[1] ? undefined : (e) => onMouseDown(e, 1)}>
                    {(() => {
                      const R = imgRatios[1] || 1;
                      const C = (100 - splitRatio) / 100;
                      const byH = R < C;
                      return <img ref={imgRef1} src={images[1]} className="absolute pointer-events-none" style={byH ? {
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
                    <button type="button" className={cn("absolute top-2 left-2 z-20 flex items-center gap-1 backdrop-blur-sm px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all border", lockedImgs[1] ? "bg-primary/20 border-primary/60 text-primary" : "bg-black/60 hover:bg-white/20 border-white/20 text-white/60")} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => setLockedImgs(prev => { const next = [...prev]; next[1] = !next[1]; return next; })}>
                      {lockedImgs[1] ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                </>
              ) : (
                <div id="container-0" className={cn("w-full h-full relative overflow-hidden", lockedImgs[0] ? "cursor-default" : "cursor-move")} onTouchStart={lockedImgs[0] ? undefined : (e) => onTouchStart(e, 0)} onTouchMove={lockedImgs[0] ? undefined : onTouchMove} onTouchEnd={lockedImgs[0] ? undefined : () => setDraggingIdx(null)} onMouseDown={lockedImgs[0] ? undefined : (e) => onMouseDown(e, 0)}>
                  {/* 單圖模式：手動 cover 定位，配合 captureCurrentView 數學 */}
                  <img ref={imgRef0} src={images[0]} className="absolute pointer-events-none" style={{
                    width: imgRatios[0] >= 1 ? `${imgRatios[0] * 100}%` : '100%',
                    height: imgRatios[0] < 1 ? `${(1 / imgRatios[0]) * 100}%` : '100%',
                    left: imgRatios[0] >= 1 ? `${(1 - imgRatios[0]) * 50}%` : '0%',
                    top: imgRatios[0] < 1 ? `${(1 - 1 / imgRatios[0]) * 50}%` : '0%',
                    transform: `translate(${offsets[0].x}px, ${offsets[0].y}px) scale(${zooms[0]})`,
                    transformOrigin: 'center center',
                  }} alt="img1" />
                  <button type="button" className={cn("absolute top-2 left-2 z-20 flex items-center gap-1 backdrop-blur-sm px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border", lockedImgs[0] ? "bg-primary/20 border-primary/60 text-primary" : "bg-black/60 hover:bg-white/20 border-white/20 text-white/60")} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => setLockedImgs(prev => { const next = [...prev]; next[0] = !next[0]; return next; })}>
                    {lockedImgs[0] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>
              )}
              {/* AI 辨識按鈕 */}
              {!isIdentifying && images.length > 0 && (
                <button
                  type="button"
                  onClick={async () => { const photo = await captureCurrentView(0); triggerAIIdentification(photo || images[0], images[1]); }}
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
                    <p className="text-white/60 text-[10px] font-medium mt-2 px-6 text-center leading-relaxed">不好意思，剛去扶老奶奶過馬路，延遲了一下，感謝您耐心等候🙇</p>
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
            {images.length === 2 && <Slider value={[splitRatio]} onValueChange={v => setSplitRatio(v[0])} min={20} max={80} step={1} className="h-4" />}
            {images.length === 1 && (
              <p className="text-[9px] text-primary/50 text-center font-medium flex items-center justify-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />加入背標可大幅加速 AI 辨識
              </p>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 relative" ref={suggestionRef}>
          <div className="space-y-1 relative">
            <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">銘柄 (品牌)</Label>
            <div className="relative">
              <Input placeholder="例如：十四代" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.brandName} onChange={e => handleBrandChange(e.target.value)} onFocus={() => formData.brandName && setShowSuggestions(true)} />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
            </div>
            {showSuggestions && brandSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 dark-glass border border-primary/20 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                {brandSuggestions.map((item, idx) => (
                  <button key={idx} className="w-full text-left px-3 py-2 hover:bg-primary/20 border-b border-primary/10 last:border-none transition-colors" onClick={() => selectSuggestion(item)}>
                    <p className="font-bold text-primary text-xs">{item.brand}</p>
                    <p className="text-[10px] text-muted-foreground">{item.brewery} | {item.location}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">酒造</Label><Input className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.brewery} onChange={e => setFormData(p => ({ ...p, brewery: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">產地</Label><Input className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.origin} onChange={e => setFormData(p => ({ ...p, origin: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">酒精濃度 (%)</Label><Input placeholder="例如：16" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.alcoholPercent} onChange={e => setFormData(p => ({ ...p, alcoholPercent: e.target.value }))} /></div>
        </section>

        {/* 酒譜資訊標籤 */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <Label className="text-[9px] uppercase font-bold text-muted-foreground">酒譜資訊標籤</Label>
            <span className="text-[8px] text-muted-foreground/60">可手動加入/刪除</span>
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
              <span className="text-[8px] text-muted-foreground/40 italic ml-1">尚無資訊標籤...</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              id="edit-sake-info-tag-input"
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
                const input = document.getElementById('edit-sake-info-tag-input') as HTMLInputElement;
                const v = input?.value.trim();
                if (v && !formData.sakeInfoTags.includes(v)) {
                  setFormData(p => ({ ...p, sakeInfoTags: [...p.sakeInfoTags, v] }));
                  if (input) input.value = '';
                }
              }}
            ><Plus className="w-3 h-3 text-sky-300" /></Button>
          </div>
        </section>

        {/* Session label editor for extra sessions */}
        {activeSessionIdx > 0 && extraSessions[activeSessionIdx - 1] && (
          <section className="space-y-2 dark-glass p-4 rounded-xl border border-primary/20">
            <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1 flex items-center gap-1"><Clock className="w-3 h-3" /> 品飲時間標記</Label>
            <input
              className="bg-white/5 border border-primary/40 h-9 rounded-xl text-xs w-full px-3 text-foreground"
              value={extraSessions[activeSessionIdx - 1].label}
              onChange={e => setExtraSessions(prev => {
                const next = [...prev];
                next[activeSessionIdx - 1] = { ...next[activeSessionIdx - 1], label: e.target.value };
                return next;
              })}
              placeholder="例如：開瓶第2天、24小時後..."
            />
            <p className="text-[9px] text-muted-foreground ml-1">
              {new Date(extraSessions[activeSessionIdx - 1].timestamp).toLocaleString('zh-TW')}
            </p>
          </section>
        )}

        <section className="space-y-4 dark-glass p-5 rounded-xl border border-primary/20 shadow-xl">
          <h2 className="text-[10px] font-headline text-primary border-b border-primary/10 pb-1 gold-glow uppercase tracking-widest">感官評分</h2>          <div className="space-y-4">
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

        {/* AI 品鑑筆記區塊 */}
        <section className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <div className="flex flex-col">
              <Label className="text-[11px] font-bold text-primary uppercase tracking-widest ml-1">AI 品鑑筆記</Label>
            </div>
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
            <div className="relative overflow-hidden bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 transition-all hover:border-amber-500/40">
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

            <div className={cn(
              "relative overflow-hidden rounded-xl p-4 transition-all duration-500 border min-h-[120px]",
              formData.activeBrain === 'left' ? "bg-blue-500/10 border-blue-500/40" :
              formData.activeBrain === 'right' ? "bg-rose-500/10 border-rose-500/40" :
              "bg-white/5 border-white/10 opacity-50"
            )}>
              <div className="absolute -top-10 -right-10 w-32 h-32 blur-[50px] rounded-full transition-colors duration-700"
                style={{ background: formData.activeBrain === 'left' ? 'rgba(59,130,246,0.2)' : formData.activeBrain === 'right' ? 'rgba(244,63,94,0.2)' : 'transparent' }} />
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

        <section className="space-y-3 dark-glass p-5 rounded-xl border border-primary/20 shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-primary/10 pb-1 mb-2"><Tag className="w-3.5 h-3.5 text-primary" /><h2 className="text-[10px] font-headline text-primary gold-glow uppercase tracking-widest">風格標籤</h2></div>
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
            <div className="flex gap-2">
              <Input placeholder="自定義標籤..." value={customTag} onChange={e => setCustomTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), setFormData(p => ({ ...p, styleTags: [...p.styleTags, customTag.trim()] })), setCustomTag(""))} className="bg-white/5 h-8 text-[9px] rounded-xl flex-1 border-primary/40" />
              <Button onClick={() => { if(customTag.trim()) { setFormData(p => ({ ...p, styleTags: [...p.styleTags, customTag.trim()] })); setCustomTag(""); } }} size="icon" className="h-8 w-8 rounded-xl"><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </section>

        <section className="space-y-2 pt-2 border-t border-primary/10">
          <div className="flex justify-between items-center px-1">
            <Label className="text-[10px] font-headline text-primary uppercase tracking-widest">綜合評分</Label>
            <div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-primary">{formData.overallRating}</span><span className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase">/ 10</span></div>
          </div>
          <Slider min={1} max={10} step={1} value={[formData.overallRating]} onValueChange={v => setFormData(p => ({ ...p, overallRating: v[0] }))} />
        </section>

        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full h-11 text-xs rounded-full font-bold uppercase tracking-widest border-primary/40 text-primary"
            onClick={saveCurrentSession}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Check className="w-3 h-3 mr-2" />}
            儲存「{activeSessionIdx === 0 ? '開瓶品飲' : extraSessions[activeSessionIdx - 1]?.label || `第${activeSessionIdx + 1}次`}」
          </Button>
          <Button className="w-full h-12 text-xs rounded-full shadow-2xl font-bold uppercase tracking-widest bg-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Check className="w-3 h-3 mr-2" />} 儲存所有修改
          </Button>
        </div>
      </div>

      {/* 相機 / 相簿選擇底部彈窗 */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowPicker(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#18181b] border border-white/10 rounded-t-[2rem] p-6 pb-12 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">選擇圖片來源</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all"
              >
                <Camera className="w-8 h-8 text-primary" />
                <span className="text-sm font-bold text-foreground">拍照</span>
                <span className="text-[9px] text-muted-foreground">使用相機</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all"
              >
                <Images className="w-8 h-8 text-primary" />
                <span className="text-sm font-bold text-foreground">相簿</span>
                <span className="text-[9px] text-muted-foreground">從圖片庫選取</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 隱藏 file inputs — 相機 & 相簿 */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePickerFile} />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePickerFile} />
    </div>
  );
}