"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { SakeNote, RATING_LABELS, STYLE_TAGS_OPTIONS } from '@/lib/types';
import { SakeRadarChart } from '@/components/SakeRadarChart';
import { SAKE_DATABASE, SakeDatabaseEntry } from '@/lib/sake-data';
import { ArrowLeft, Loader2, Check, MapPin, Repeat, Plus, X, Tag, Info, Search, Sparkles, BrainCircuit, Palette, Camera, Images } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  const [pickerIdx, setPickerIdx] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // img refs only needed for captureCurrentView container sizing
  const imgRef0 = useRef<HTMLImageElement>(null);
  const imgRef1 = useRef<HTMLImageElement>(null);

  const [brandSuggestions, setBrandSuggestions] = useState<SakeDatabaseEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [customTag, setCustomTag] = useState("");

  const noteRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'sakeTastingNotes', id);
  }, [firestore, id]);
  const { data: note, isLoading: isNoteLoading } = useDoc<SakeNote>(noteRef);

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

  const openPicker = (idx: number) => {
    setPickerIdx(idx);
    setShowPicker(true);
  };

  const handlePickerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setShowPicker(false);
    if (files && files[0]) handleReplaceImage(pickerIdx, files[0]);
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
        toast({ title: `${mode === 'left' ? '左腦理性' : '右腦感性'}筆記生成成功` });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "AI 連線失敗" });
    } finally {
      setIsGenerating(false);
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

  const handleSave = async () => {
    if (!firestore || !user || !note) return;
    setIsSaving(true);
    try {
      const finalImages = await Promise.all(images.map((_, i) => captureCurrentView(i)));
      // 儲存目前的縮放位移參數，供下次重新編輯時還原
      const transforms = images.map((_, i) => ({ x: offsets[i]?.x ?? 0, y: offsets[i]?.y ?? 0, scale: zooms[i] ?? 1 }));
      const noteData = {
        brandName: formData.brandName,
        brewery: formData.brewery,
        origin: formData.origin,
        overallRating: formData.overallRating,
        styleTags: formData.styleTags,
        sakeInfoTags: formData.sakeInfoTags,
        userDescription: formData.userDescription,
        aiResultNote: formData.aiResultNote,
        activeBrain: formData.activeBrain,
        description: formData.userDescription,
        imageUrls: finalImages,
        imageOriginals: images,
        imageTransforms: transforms,
        imageSplitRatio: images.length === 2 ? splitRatio : 50,
        sweetnessRating: formData.sweetness,
        acidityRating: formData.acidity,
        bitternessRating: formData.bitterness,
        umamiRating: formData.umami,
        astringencyRating: formData.astringency,
      };
      await updateDoc(doc(firestore, 'sakeTastingNotes', note.id), noteData);
      // 讓 top3 cache 失效，下次首頁載入時重算
      deleteDoc(doc(firestore, 'meta', 'top3')).catch(() => {});
      toast({ title: "修改已儲存" });
      router.push('/profile');
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
        <Button variant="ghost" size="icon" onClick={() => router.push('/profile')} className="text-primary"><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="text-lg font-headline text-primary ml-2 gold-glow tracking-widest uppercase">編輯品飲筆記</h1>
      </div>

      <div className="space-y-5">
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <Label className="text-[10px] uppercase font-bold text-primary tracking-widest">照片聚焦編輯</Label>
            <Button variant="outline" size="sm" className="text-[9px] font-bold h-6 rounded-full border-primary/40 text-primary bg-primary/5" onClick={() => images.length === 2 && setImages([images[1], images[0]])} disabled={images.length < 2}>
              <Repeat className="w-2.5 h-2.5 mr-1" /> 換位
            </Button>
          </div>

          <div className="dark-glass rounded-[2rem] overflow-hidden border border-primary/20 p-3 space-y-3 shadow-xl">
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black shadow-inner flex touch-none">
              {images.length === 2 ? (
                <>
                  <div id="container-0" className="h-full relative overflow-hidden cursor-move" style={{ width: `${splitRatio}%` }} onTouchStart={(e) => onTouchStart(e, 0)} onTouchMove={onTouchMove} onTouchEnd={() => setDraggingIdx(null)} onMouseDown={(e) => onMouseDown(e, 0)}>
                    <img ref={imgRef0} src={images[0]} className="w-full h-full object-cover pointer-events-none" style={{ transform: `translate(${offsets[0].x}px, ${offsets[0].y}px) scale(${zooms[0]})` }} alt="img1" />
                    <button type="button" className="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-black/60 hover:bg-white/20 border border-white/20 text-white/60 backdrop-blur-sm px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => openPicker(0)}>
                      <Camera className="w-2.5 h-2.5" /> 重選
                    </button>
                  </div>
                  <div className="h-full w-px bg-white/20 z-10" />
                  <div id="container-1" className="h-full relative overflow-hidden cursor-move" style={{ width: `${100 - splitRatio}%` }} onTouchStart={(e) => onTouchStart(e, 1)} onTouchMove={onTouchMove} onTouchEnd={() => setDraggingIdx(null)} onMouseDown={(e) => onMouseDown(e, 1)}>
                    <img ref={imgRef1} src={images[1]} className="w-full h-full object-cover pointer-events-none" style={{ transform: `translate(${offsets[1].x}px, ${offsets[1].y}px) scale(${zooms[1]})` }} alt="img2" />
                    <button type="button" className="absolute bottom-2 right-2 z-20 flex items-center gap-1 bg-black/60 hover:bg-white/20 border border-white/20 text-white/60 backdrop-blur-sm px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => openPicker(1)}>
                      <Camera className="w-2.5 h-2.5" /> 重選
                    </button>
                  </div>
                </>
              ) : (
                <div id="container-0" className="w-full h-full relative overflow-hidden cursor-move" onTouchStart={(e) => onTouchStart(e, 0)} onTouchMove={onTouchMove} onTouchEnd={() => setDraggingIdx(null)} onMouseDown={(e) => onMouseDown(e, 0)}>
                  {/* 單圖模式：手動 cover 定位，配合 captureCurrentView 數學 */}
                  <img ref={imgRef0} src={images[0]} className="absolute pointer-events-none" style={{
                    width: imgRatios[0] >= 1 ? `${imgRatios[0] * 100}%` : '100%',
                    height: imgRatios[0] < 1 ? `${(1 / imgRatios[0]) * 100}%` : '100%',
                    left: imgRatios[0] >= 1 ? `${(1 - imgRatios[0]) * 50}%` : '0%',
                    top: imgRatios[0] < 1 ? `${(1 - 1 / imgRatios[0]) * 50}%` : '0%',
                    transform: `translate(${offsets[0].x}px, ${offsets[0].y}px) scale(${zooms[0]})`,
                    transformOrigin: 'center center',
                  }} alt="img1" />
                  <button type="button" className="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-black/60 hover:bg-white/20 border border-white/20 text-white/60 backdrop-blur-sm px-2.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={() => openPicker(0)}>
                    <Camera className="w-3 h-3" /> 重選
                  </button>
                </div>
              )}
            </div>
            {images.length === 2 && <Slider value={[splitRatio]} onValueChange={v => setSplitRatio(v[0])} min={20} max={80} step={1} className="h-4" />}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 relative" ref={suggestionRef}>
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

        <section className="space-y-4 dark-glass p-5 rounded-[1.5rem] border border-primary/20 shadow-xl">
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

        {/* AI 雙腦品鑑筆記區塊 */}
        <section className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <div className="flex flex-col">
              <Label className="text-[11px] font-bold text-primary uppercase tracking-widest ml-1">AI 雙腦品鑑筆記</Label>
              <span className="text-[8px] text-muted-foreground ml-1">LEFT: 理性分析 / RIGHT: 感性想像</span>
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
                <Sparkles className="w-2.5 h-2.5 mr-1" /> 左腦品鑑
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
                <Sparkles className="w-2.5 h-2.5 mr-1" /> 右腦品鑑
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="relative overflow-hidden bg-amber-500/5 border border-amber-500/20 rounded-[1.5rem] p-4 transition-all hover:border-amber-500/40">
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
              "relative overflow-hidden rounded-[1.5rem] p-4 transition-all duration-500 border min-h-[120px]",
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
                  {formData.activeBrain === 'left' ? "AI 理性分析修飾" : formData.activeBrain === 'right' ? "AI 感性想像引導" : "等待點擊上方按鈕生成"}
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

        <section className="space-y-3 dark-glass p-5 rounded-[1.5rem] border border-primary/20 shadow-xl">
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

        <Button className="w-full h-12 text-xs rounded-full shadow-2xl font-bold uppercase tracking-widest bg-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Check className="w-3 h-3 mr-2" />} 儲存修改
        </Button>
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
                className="flex flex-col items-center gap-3 p-6 rounded-[1.5rem] bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all"
              >
                <Camera className="w-8 h-8 text-primary" />
                <span className="text-sm font-bold text-foreground">拍照</span>
                <span className="text-[9px] text-muted-foreground">使用相機</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 rounded-[1.5rem] bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all"
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
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickerFile} />
    </div>
  );
}