import { mergeSakeBrandName } from '@/lib/utils';
"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { SakeNote, RATING_LABELS, SERVING_TEMPERATURE_OPTIONS, STYLE_TAGS_OPTIONS } from '@/lib/types';
import { SakeRadarChart } from '@/components/SakeRadarChart';
import { SAKE_DATABASE, SakeDatabaseEntry } from '@/lib/sake-data';
import { ArrowLeft, Loader2, Check, MapPin, Repeat, Plus, X, Tag, Info, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, updateDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { deleteField, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export default function EditNotePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [isSaving, setIsSaving] = useState(false);
  
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

  const noteRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'sakeTastingNotes', id);
  }, [firestore, id]);
  const { data: note, isLoading: isNoteLoading } = useDoc<SakeNote>(noteRef);

  const [formData, setFormData] = useState({
    brandName: '',
    brewery: '',
    origin: '',
    sweetness: 3,
    acidity: 3,
    bitterness: 3,
    umami: 3,
    astringency: 3,
    overallRating: 7,
    styleTags: [] as string[],
    servingTemperatures: [] as string[],
    description: '',
  });

  useEffect(() => {
    if (note) {
      setFormData({
        brandName: mergeSakeBrandName(note.brandName, note.subBrand),
        brewery: note.brewery,
        origin: note.origin || '',
        sweetness: note.sweetnessRating,
        acidity: note.acidityRating,
        bitterness: note.bitternessRating,
        umami: note.umamiRating,
        astringency: note.astringencyRating,
        overallRating: note.overallRating,
        styleTags: note.styleTags || [],
        servingTemperatures: note.servingTemperatures || (note.servingTemperature ? [note.servingTemperature] : []),
        description: note.description || '',
      });
      if (note.imageUrls) {
        setImages(note.imageUrls);
        setZooms(note.imageUrls.map(() => 1));
        setOffsets(note.imageUrls.map(() => ({ x: 0, y: 0 })));
      }
      if (note.imageSplitRatio) setSplitRatio(note.imageSplitRatio);
    }
  }, [note]);

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
    setFormData(prev => ({ 
      ...prev, 
      brandName: item.brand, 
      brewery: item.brewery, 
      origin: item.location 
    }));
    setShowSuggestions(false);
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
    setFormData(prev => {
      const exists = prev.styleTags.includes(tag);
      if (exists) {
        return { ...prev, styleTags: prev.styleTags.filter(t => t !== tag) };
      } else {
        return { ...prev, styleTags: [...prev.styleTags, tag] };
      }
    });
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
    if (!firestore || !user || !note) return;
    setIsSaving(true);
    try {
      const finalImages = await Promise.all(images.map((_, i) => images[i].startsWith('http') ? images[i] : captureCurrentView(i)));
      const noteData = {
        brandName: formData.brandName,
        subBrand: deleteField(),
        brewery: formData.brewery,
        origin: formData.origin,
        imageUrls: finalImages,
        imageSplitRatio: images.length === 2 ? splitRatio : 50,
        sweetnessRating: formData.sweetness,
        acidityRating: formData.acidity,
        bitternessRating: formData.bitterness,
        umamiRating: formData.umami,
        astringencyRating: formData.astringency,
        overallRating: formData.overallRating,
        styleTags: formData.styleTags,
        servingTemperatures: formData.servingTemperatures,
        servingTemperature: deleteField(),
        description: formData.description,
      };
      updateDocumentNonBlocking(doc(firestore, 'sakeTastingNotes', note.id), noteData);
      toast({ title: "修改已儲存" });
      router.push('/profile');
    } catch (err) {
      toast({ variant: "destructive", title: "儲存失敗" });
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
            </div>
            {images.length === 2 && <Slider value={[splitRatio]} onValueChange={v => setSplitRatio(v[0])} min={20} max={80} step={1} className="h-4" />}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
          <div className="space-y-1 relative" ref={suggestionRef}>
            <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">銘柄 (品牌)</Label>
            <div className="relative">
              <Input 
                placeholder="例如：十四代"
                className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs" 
                value={formData.brandName} 
                onChange={e => handleBrandChange(e.target.value)} 
                onFocus={() => formData.brandName && setShowSuggestions(true)}
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
            </div>
            {showSuggestions && brandSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 dark-glass border border-primary/20 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                {brandSuggestions.map((item, idx) => (
                  <button 
                    key={idx} 
                    className="w-full text-left px-3 py-2 hover:bg-primary/20 border-b border-primary/10 last:border-none transition-colors" 
                    onClick={() => selectSuggestion(item)}
                  >
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
            <div className="relative">
              <Input placeholder="例如：山形縣" className="bg-white/5 border-primary/40 h-9 rounded-xl text-xs pl-8" value={formData.origin} onChange={e => setFormData(p => ({ ...p, origin: e.target.value }))} />
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
            </div>
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

        <section className="space-y-3">
          <Label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-1">品飲描述</Label>
          <Textarea 
            className="min-h-[160px] bg-white/5 border-primary/40 rounded-xl p-3 text-xs leading-relaxed" 
            value={formData.description} 
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} 
          />
        </section>

        <section className="space-y-3 dark-glass p-5 rounded-[1.5rem] border border-primary/20 shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-primary/10 pb-1 mb-2">
             <Tag className="w-3.5 h-3.5 text-primary" />
             <h2 className="text-[10px] font-headline text-primary border-b border-primary/10 pb-1 gold-glow uppercase tracking-widest">風格標籤</h2>
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
    </div>
  );
}
