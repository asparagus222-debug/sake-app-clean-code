'use client';

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
import { Camera, ArrowLeft, Loader2, Check, MapPin, Plus, X, Tag, Search, Save, Upload, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createNote, saveImage } from '@/lib/offline-storage';
import { cn } from '@/lib/utils';

async function resizeImage(base64: string, maxDimension = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height) {
        if (width > maxDimension) { height *= maxDimension / width; width = maxDimension; }
      } else {
        if (height > maxDimension) { width *= maxDimension / height; height = maxDimension; }
      }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
  });
}

type SaveMode = 'local' | 'upload';

export default function OfflineNewNotePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [images, setImages] = useState<string[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [brandSuggestions, setBrandSuggestions] = useState<SakeDatabaseEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [customTag, setCustomTag] = useState('');

  const [expoId, setExpoId] = useState<string | undefined>(undefined);
  const [expoTitle, setExpoTitle] = useState<string | undefined>(undefined);

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
    description: '',
    tastingDate: new Date().toISOString().split('T')[0],
  });

  // 從 URL 取得活動參數
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eid = params.get('expoId');
    const etitle = params.get('expoTitle');
    if (eid) { setExpoId(eid); setExpoTitle(etitle || undefined); }
  }, []);

  // 品牌搜尋
  useEffect(() => {
    if (formData.brandName.trim().length < 1) { setBrandSuggestions([]); setShowSuggestions(false); return; }
    const q = formData.brandName.toLowerCase();
    const results = SAKE_DATABASE.filter(s =>
      s.brand.toLowerCase().includes(q)
    ).slice(0, 6);
    setBrandSuggestions(results);
    setShowSuggestions(results.length > 0);
  }, [formData.brandName]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 拍照 / 選圖
  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newImages: string[] = [];
    for (const file of files.slice(0, 2 - images.length)) {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res) => {
        reader.onload = (ev) => res(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push(await resizeImage(base64));
    }
    setImages(prev => [...prev, ...newImages].slice(0, 2));
  };

  // 填充品牌資訊
  const fillFromSuggestion = (s: SakeDatabaseEntry) => {
    setFormData(prev => ({
      ...prev,
      brandName: s.brand,
      brewery: s.brewery || prev.brewery,
      origin: s.location || prev.origin,
    }));
    setShowSuggestions(false);
  };

  // 風味標籤
  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      styleTags: prev.styleTags.includes(tag)
        ? prev.styleTags.filter(t => t !== tag)
        : [...prev.styleTags, tag],
    }));
  };

  const addCustomTag = () => {
    const t = customTag.trim();
    if (!t || formData.styleTags.includes(t)) return;
    setFormData(prev => ({ ...prev, styleTags: [...prev.styleTags, t] }));
    setCustomTag('');
  };

  // 儲存
  const handleSave = async (mode: SaveMode) => {
    if (!formData.brandName.trim()) {
      toast({ variant: 'destructive', title: '請填入品牌名稱' });
      return;
    }
    setIsSaving(true);
    try {
      // 將圖片存入 IndexedDB
      const imageIds: string[] = [];
      for (const [i, img] of images.entries()) {
        const id = `img_${Date.now()}_${i}`;
        await saveImage(id, img);
        imageIds.push(id);
      }

      const note = createNote({
        brandName: formData.brandName,
        subBrand: formData.subBrand || undefined,
        brewery: formData.brewery,
        origin: formData.origin || undefined,
        imageIds,
        sweetnessRating: formData.sweetness,
        acidityRating: formData.acidity,
        bitternessRating: formData.bitterness,
        umamiRating: formData.umami,
        astringencyRating: formData.astringency,
        overallRating: formData.overallRating,
        styleTags: formData.styleTags,
        description: formData.description,
        tastingDate: formData.tastingDate,
        uploadedFirestoreId: null,
        expoId,
        expoTitle,
      });

      if (mode === 'upload') {
        router.push(`/offline/notes/${note.id}/upload`);
      } else {
        toast({ title: '筆記已儲存至裝置' });
        if (expoId) {
          router.replace(`/offline/expos/${expoId}`);
        } else {
          router.replace('/offline');
        }
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: '儲存失敗' });
    } finally {
      setIsSaving(false);
    }
  };

  const ratingLabels = [
    { key: 'sweetness' as const, label: '甜度', colors: RATING_LABELS.sweetness },
    { key: 'acidity' as const, label: '酸度', colors: RATING_LABELS.acidity },
    { key: 'bitterness' as const, label: '苦味', colors: RATING_LABELS.bitterness },
    { key: 'umami' as const, label: '旨味', colors: RATING_LABELS.umami },
    { key: 'astringency' as const, label: '澀感', colors: RATING_LABELS.astringency },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-40 font-body">
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-sm font-bold text-white">新增品飲筆記</h1>
          {expoTitle && <p className="text-[10px] text-[#f97316]/70">{expoTitle}</p>}
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-8">
        {/* 照片 */}
        <section>
          <Label className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3 block">照片（最多 2 張）</Label>
          <div className="flex gap-3">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowImagePicker(true)}
                  className="flex items-center justify-center w-24 h-24 rounded-xl border-2 border-dashed border-white/20 hover:border-[#f97316]/60 transition-colors"
                >
                  <Camera className="w-6 h-6 text-white/30" />
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageCapture} />
                <input ref={libraryInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageCapture} multiple />
              </>
            )}
          </div>
          {/* 照片來源選單 */}
          {showImagePicker && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setShowImagePicker(false)}>
              <div className="w-full max-w-xl bg-[#18181b] rounded-t-2xl p-4 space-y-2" onClick={e => e.stopPropagation()}>
                <p className="text-center text-xs text-white/40 uppercase tracking-widest font-bold mb-3">選擇照片方式</p>
                <button
                  type="button"
                  onClick={() => { setShowImagePicker(false); cameraInputRef.current?.click(); }}
                  className="flex items-center gap-3 w-full px-4 py-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <Camera className="w-5 h-5 text-[#f97316]" />
                  <span className="text-sm font-bold text-white">拍照</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowImagePicker(false); libraryInputRef.current?.click(); }}
                  className="flex items-center gap-3 w-full px-4 py-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <ImageIcon className="w-5 h-5 text-[#f97316]" />
                  <span className="text-sm font-bold text-white">從相簿選取</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowImagePicker(false)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 基本資訊 */}
        <section className="space-y-4">
          <Label className="text-white/60 text-xs font-bold uppercase tracking-widest block">基本資訊</Label>

          {/* 品牌名稱（含搜尋） */}
          <div className="relative" ref={suggestionRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="品牌名稱 *"
                value={formData.brandName}
                onChange={e => setFormData(p => ({ ...p, brandName: e.target.value }))}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded-xl overflow-hidden z-30 shadow-xl">
                {brandSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => fillFromSuggestion(s)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <p className="text-sm font-bold text-white">{s.brand}</p>
                    <p className="text-[11px] text-white/40">{s.brewery}{s.location ? ` · ${s.location}` : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Input
            placeholder="副品牌 / 酒款"
            value={formData.subBrand}
            onChange={e => setFormData(p => ({ ...p, subBrand: e.target.value }))}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
          <Input
            placeholder="酒藏"
            value={formData.brewery}
            onChange={e => setFormData(p => ({ ...p, brewery: e.target.value }))}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="產地 (縣市)"
              value={formData.origin}
              onChange={e => setFormData(p => ({ ...p, origin: e.target.value }))}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <Input
            type="date"
            value={formData.tastingDate}
            onChange={e => setFormData(p => ({ ...p, tastingDate: e.target.value }))}
            className="bg-white/5 border-white/10 text-white"
          />
        </section>

        {/* 雷達圖預覽 */}
        <section>
          <Label className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3 block">風味輪廓</Label>
          <div className="w-full max-w-xs mx-auto">
            <SakeRadarChart data={{
              sweetness: formData.sweetness,
              acidity: formData.acidity,
              bitterness: formData.bitterness,
              umami: formData.umami,
              astringency: formData.astringency,
            }} />
          </div>
        </section>

        {/* 風味滑桿 */}
        <section className="space-y-6">
          {ratingLabels.map(({ key, label, colors }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white/70 text-sm font-bold">{label}</Label>
                <span className="text-[#f97316] text-sm font-bold">{colors[(formData as any)[key] - 1]}</span>
              </div>
              <Slider
                min={1} max={5} step={1}
                value={[(formData as any)[key]]}
                onValueChange={([v]) => setFormData(p => ({ ...p, [key]: v }))}
                className="w-full"
              />
            </div>
          ))}

          {/* 綜合評分 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-white/70 text-sm font-bold">綜合評分</Label>
              <span className="text-[#f97316] text-xl font-bold">{formData.overallRating} <span className="text-white/30 text-sm">/ 10</span></span>
            </div>
            <Slider
              min={1} max={10} step={1}
              value={[formData.overallRating]}
              onValueChange={([v]) => setFormData(p => ({ ...p, overallRating: v }))}
              className="w-full"
            />
          </div>
        </section>

        {/* 風格標籤 */}
        <section className="space-y-3">
          <Label className="text-white/60 text-xs font-bold uppercase tracking-widest block">
            <Tag className="w-3 h-3 inline mr-1" /> 風格標籤
          </Label>
          {Object.entries(STYLE_TAGS_OPTIONS).map(([group, tags]) => (
            <div key={group} className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-bold border transition-all',
                    formData.styleTags.includes(tag)
                      ? 'bg-[#f97316] border-[#f97316] text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="自訂標籤"
              value={customTag}
              onChange={e => setCustomTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomTag()}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
            />
            <Button variant="outline" size="icon" onClick={addCustomTag} className="border-white/10 text-white/50 hover:text-white shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {formData.styleTags.filter(t => !Object.values(STYLE_TAGS_OPTIONS).flat().includes(t)).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.styleTags
                .filter(t => !Object.values(STYLE_TAGS_OPTIONS).flat().includes(t))
                .map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20">
                    {tag}
                    <button onClick={() => toggleTag(tag)}><X className="w-3 h-3" /></button>
                  </span>
                ))}
            </div>
          )}
        </section>

        {/* 品飲筆記 */}
        <section>
          <Label className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3 block">品飲描述</Label>
          <Textarea
            placeholder="記錄香氣、口感、餘韻..."
            value={formData.description}
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
            rows={5}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </section>
      </div>

      {/* 固定底部按鈕 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0c]/95 backdrop-blur border-t border-white/5 px-4 py-4">
        <div className="max-w-xl mx-auto grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            disabled={isSaving}
            onClick={() => handleSave('local')}
            className="border-white/20 text-white hover:bg-white/5 font-bold"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            儲存至本機
          </Button>
          <Button
            size="lg"
            disabled={isSaving}
            onClick={() => handleSave('upload')}
            className="bg-[#f97316] hover:bg-[#ea580c] text-white font-bold shadow-[0_0_15px_rgba(249,115,22,0.3)]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            上傳分享
          </Button>
        </div>
      </div>
    </div>
  );
}
