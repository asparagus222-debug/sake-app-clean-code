"use client"

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { RATING_LABELS, STYLE_TAGS_OPTIONS } from '@/lib/types';
import { SakeRadarChart } from '@/components/SakeRadarChart';
import { SAKE_DATABASE, SakeDatabaseEntry } from '@/lib/sake-data';
import { identifySake } from '@/ai/flows/identify-sake-flow';
import { Camera, ArrowLeft, Loader2, Check, MapPin, Repeat, Plus, X, Tag, Info, Search, Sparkles, BrainCircuit, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, addDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

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

export default function NewNotePage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [images, setImages] = useState<string[]>([]);
  const [zooms, setZooms] = useState<number[]>([1, 1]);
  const [offsets, setOffsets] = useState<{ x: number; y: number }[]>([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  const [splitRatio, setSplitRatio] = useState<number>(50);
  
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialDist, setInitialDist] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState<number | null>(null);

  const [brandSuggestions, setBrandSuggestions] = useState<SakeDatabaseEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [customTag, setCustomTag] = useState("");

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile } = useDoc(userDocRef);

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
    userDescription: '',  // 👈 新增：作者原始筆記
    aiResultNote: '',     // 👈 新增：AI 生成的修飾筆記
    activeBrain: null as 'left' | 'right' | null, // 👈 新增：紀錄目前點擊的是哪一邊
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
    const response = await fetch('/api/ai/generate-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: formData.brandName,
        subBrand: formData.subBrand,
        ratings: { 
          sweetness: formData.sweetness, 
          acidity: formData.acidity, 
          bitterness: formData.bitterness, 
          umami: formData.umami, 
          astringency: formData.astringency 
        },
        tags: formData.styleTags,
        userDescription: formData.userDescription, // 把作者寫的原始內容傳給 AI
        mode
      })
    });
    
    const data = await response.json();
    if (data.text) {
      // 將 AI 生成的內容填入下方的卡片
      setFormData(prev => ({ ...prev, aiResultNote: data.text }));
      toast({ title: `${mode === 'left' ? '左腦理性' : '右腦感性'}筆記生成成功` });
    }
  } catch (err) {
    toast({ variant: "destructive", title: "AI 連線失敗" });
  } finally {
    setIsGenerating(false);
  }
};

  const triggerAIIdentification = async (photoDataUri: string) => {
    setIsIdentifying(true);
    try {
      const optimizedPhoto = await resizeImage(photoDataUri, 1024);
      const result = await identifySake({ photoDataUri: optimizedPhoto });
      if (result) {
        setFormData(prev => ({
          ...prev,
          brandName: result.brandName || prev.brandName,
          brewery: result.brewery || prev.brewery,
          origin: result.origin || prev.origin
        }));
        toast({ title: "AI 辨識成功", description: "已自動填充資訊。" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "AI 辨識失敗" });
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const remainingSlots = 2 - images.length;
      if (remainingSlots <= 0) return;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const isFirstUpload = images.length === 0;
      filesToProcess.forEach((file, index) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setImages(prev => {
            const next = [...prev, base64];
            if (isFirstUpload && index === 0) triggerAIIdentification(base64);
            return next;
          });
        };
        reader.readAsDataURL(file);
      });
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
    canvas.width = 1200; canvas.height = 1200;
    const zoom = zooms[idx]; const offset = offsets[idx];
    const imgRatio = img.width / img.height;
    let drawWidth, drawHeight;
    if (imgRatio > 1) { drawHeight = 1200 * zoom; drawWidth = drawHeight * imgRatio; }
    else { drawWidth = 1200 * zoom; drawHeight = drawWidth / imgRatio; }
    const baseOffsetX = (1200 - drawWidth) / 2;
    const baseOffsetY = (1200 - drawHeight) / 2;
    const editorWidth = window.innerWidth < 640 ? window.innerWidth - 64 : 640;
    const scaleFactor = 1200 / editorWidth;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1200, 1200);
    ctx.drawImage(img, baseOffsetX + (offset.x * scaleFactor), baseOffsetY + (offset.y * scaleFactor), drawWidth, drawHeight);
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
      setZooms(prev => {
        const next = [...prev];
        next[draggingIdx] = Math.min(Math.max(initialZoom * scale, 1), 5);
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
      
      imageUrls: finalImages,
      tastingDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    await addDocumentNonBlocking(collection(firestore, 'sakeTastingNotes'), noteData);
    toast({ title: "筆記已發布" });
    router.push('/');
  } catch (err) {
    toast({ variant: "destructive", title: "儲存失敗" });
    setIsSaving(false);
  }
};

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 mb-24 notebook-texture min-h-screen font-body select-none" onMouseMove={onMouseMove} onMouseUp={() => setDraggingIdx(null)}>
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-primary hover:bg-primary/10 transition-colors"><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="text-lg font-headline text-primary ml-2 gold-glow tracking-widest uppercase">建立品飲筆記</h1>
      </div>

      {/* 要求登入提示 */}
      {!profile?.username && (
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

      <div className="space-y-5" style={{ opacity: !profile?.username ? 0.5 : 1, pointerEvents: !profile?.username ? 'none' : 'auto' }}>
        
        {/* 照片聚焦編輯 */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <Label className="text-[10px] uppercase font-bold text-primary tracking-widest">照片聚焦編輯</Label>
            <Button variant="outline" size="sm" className="text-[9px] font-bold h-6 rounded-full border-primary/40 text-primary bg-primary/5" onClick={() => images.length === 2 && setImages([images[1], images[0]])} disabled={images.length < 2}>
              <Repeat className="w-2.5 h-2.5 mr-1" /> 換位
            </Button>
          </div>
          <div className="dark-glass rounded-[2rem] overflow-hidden border border-primary/20 p-3 space-y-3 shadow-xl">
            {images.length > 0 ? (
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black shadow-inner flex touch-none">
                {images.length === 2 ? (
                  <>
                    <div className="h-full relative overflow-hidden cursor-move" style={{ width: `${splitRatio}%` }} onTouchStart={(e) => onTouchStart(e, 0)} onTouchMove={onTouchMove} onTouchEnd={() => setDraggingIdx(null)} onMouseDown={(e) => onMouseDown(e, 0)}>
                      <img src={images[0]} className="w-full h-full object-cover pointer-events-none" style={{ transform: `translate(${offsets[0].x}px, ${offsets[0].y}px) scale(${zooms[0]})` }} alt="img1" />
                    </div>
                    <div className="h-full w-px bg-white/20 z-10" />
                    <div className="h-full relative overflow-hidden cursor-move" style={{ width: `${100 - splitRatio}%` }} onTouchStart={(e) => onTouchStart(e, 1)} onTouchMove={onTouchMove} onTouchEnd={() => setDraggingIdx(null)} onMouseDown={(e) => onMouseDown(e, 1)}>
                      <img src={images[1]} className="w-full h-full object-cover pointer-events-none" style={{ transform: `translate(${offsets[1].x}px, ${offsets[1].y}px) scale(${zooms[1]})` }} alt="img2" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full relative overflow-hidden cursor-move" onTouchStart={(e) => onTouchStart(e, 0)} onTouchMove={onTouchMove} onTouchEnd={() => setDraggingIdx(null)} onMouseDown={(e) => onMouseDown(e, 0)}>
                    <img src={images[0]} className="w-full h-full object-cover pointer-events-none" style={{ transform: `translate(${offsets[0].x}px, ${offsets[0].y}px) scale(${zooms[0]})` }} alt="img1" />
                  </div>
                )}
                {isIdentifying && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md">
                    <div className="bg-primary/20 p-4 rounded-full animate-pulse border border-primary/30 mb-4"><Sparkles className="w-8 h-8 text-primary" /></div>
                    <p className="text-white text-xs font-bold uppercase tracking-widest animate-pulse">AI 辨識酒標中...</p>
                  </div>
                )}
              </div>
            ) : (
              <label className="aspect-square rounded-xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-all group">
                <Camera className="w-8 h-8 text-primary/30 group-hover:text-primary mb-2" />
                <div className="flex items-center gap-1.5 mb-1"><Sparkles className="w-3 h-3 text-primary animate-pulse" /><span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">點擊上傳酒標</span></div>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
              </label>
            )}
            {images.length === 2 && <Slider value={[splitRatio]} onValueChange={v => setSplitRatio(v[0])} min={20} max={80} step={1} className="h-4" />}
          </div>
        </section>

        {/* 基礎資訊 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 relative" ref={suggestionRef}>
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
            <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">副標 / 規格</Label>
            <Input placeholder="例如：生原酒" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.subBrand} onChange={e => setFormData(p => ({ ...p, subBrand: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">酒造</Label>
            <Input placeholder="例如：高木酒造" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.brewery} onChange={e => setFormData(p => ({ ...p, brewery: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">產地</Label>
            <Input placeholder="例如：山形縣" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" value={formData.origin} onChange={e => setFormData(p => ({ ...p, origin: e.target.value }))} />
          </div>
        </section>

        {/* 感官評分 */}
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

{/* --- AI 雙腦品鑑筆記區塊 --- */}
<section className="space-y-4">
  {/* 標題與按鈕區 */}
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
        <Sparkles className="w-2.5 h-2.5 mr-1" /> 左腦品鑒
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
        <Sparkles className="w-2.5 h-2.5 mr-1" /> 右腦品鑒
      </Button>
    </div>
  </div>

  <div className="grid grid-cols-1 gap-4">
    {/* 上方：作者原始筆記 (琥珀金配色) */}
    <div className="relative group overflow-hidden bg-amber-500/5 border border-amber-500/20 rounded-[1.5rem] p-4 transition-all hover:border-amber-500/40">
      <div className="flex items-center gap-2 mb-2 text-amber-500/70">
        <div className="p-1 bg-amber-500/10 rounded-md"><Info size={12} /></div>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">作者的原始筆記</span>
      </div>
      <Textarea 
        placeholder="在此寫下你最直覺的品飲感受..."
        className="min-h-[100px] bg-transparent border-none p-0 text-xs leading-relaxed focus-visible:ring-0 placeholder:text-amber-500/20 text-amber-50/90"
        value={formData.userDescription}
        onChange={e => setFormData(p => ({ ...p, userDescription: e.target.value }))}
      />
    </div>

    {/* 下方：AI 生成筆記 (動態變色) */}
    <div className={cn(
      "relative group overflow-hidden rounded-[1.5rem] p-4 transition-all duration-500 border min-h-[120px]",
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
          {formData.activeBrain === 'left' ? "AI 理性分析修飾" : formData.activeBrain === 'right' ? "AI 感性想像引導" : "等待點擊上方按鈕生成"}
        </div>
        {isGenerating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>

      <Textarea 
        readOnly={!formData.aiResultNote}
        placeholder={formData.brandName ? "點擊上方按鈕，讓 AI 為你的筆記增色..." : "請先輸入銘柄名稱"}
        className={cn(
          "min-h-[80px] bg-transparent border-none p-0 text-xs leading-relaxed focus-visible:ring-0",
          formData.activeBrain === 'left' ? "text-blue-50/90" : "text-rose-50/90"
        )}
        value={formData.aiResultNote}
        onChange={e => setFormData(p => ({ ...p, aiResultNote: e.target.value }))}
      />
    </div>
  </div>
</section>

        {/* 風格標籤 */}
        <section className="space-y-3 dark-glass p-5 rounded-[1.5rem] border border-primary/20 shadow-xl">
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

        <Button className="w-full h-12 text-xs rounded-full mb-12 shadow-2xl font-bold uppercase tracking-widest bg-primary" onClick={handleSave} disabled={isSaving || isIdentifying || images.length === 0}>
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Check className="w-3 h-3 mr-2" />} 發布筆記
        </Button>
      </div>
    </div>
  );
}