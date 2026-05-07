'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { RATING_LABELS, STYLE_TAGS_OPTIONS } from '@/lib/types';
import { SakeRadarChart } from '@/components/SakeRadarChart';
import { SAKE_DATABASE, SakeDatabaseEntry } from '@/lib/sake-data';
import { Camera, ArrowLeft, Loader2, MapPin, Plus, X, Tag, Search, Save, ImageIcon, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getNoteById, updateNote, saveImage, deleteImages, getAllImages, getExpoById } from '@/lib/offline-storage';
import { cn } from '@/lib/utils';
import { GuidedTasting, GuidedTastingResult } from '@/components/GuidedTasting';

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

export default function OfflineEditNotePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 圖片：{ dataUrl, imageId | null } — null 代表新圖（尚未存入 IndexedDB）
  const [imageItems, setImageItems] = useState<Array<{ dataUrl: string; imageId: string | null }>>([]);
  const [originalImageIds, setOriginalImageIds] = useState<string[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [brandSuggestions, setBrandSuggestions] = useState<SakeDatabaseEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [customTag, setCustomTag] = useState('');
  const [expoQuickTags, setExpoQuickTags] = useState<string[]>([]);
  const [showGuidedTasting, setShowGuidedTasting] = useState(false);

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
    userDescription: '',
    tastingDate: new Date().toISOString().split('T')[0],
  });

  // 載入既有筆記
  useEffect(() => {
    const note = getNoteById(id);
    if (!note) { router.replace('/offline'); return; }

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
      description: note.description,
      userDescription: note.userDescription || '',
      tastingDate: note.tastingDate,
    });

    setOriginalImageIds(note.imageIds);
    getAllImages(note.imageIds).then(urls => {
      setImageItems(note.imageIds.map((id, i) => ({ dataUrl: urls[i] || '', imageId: id })).filter(item => item.dataUrl));
    });

    if (note.expoId) {
      const expo = getExpoById(note.expoId);
      if (expo?.quickTags?.length) setExpoQuickTags(expo.quickTags);
    }

    setIsLoading(false);
  }, [id, router]);

  const handleGuidedComplete = (result: GuidedTastingResult) => {
    setFormData(prev => ({
      ...prev,
      sweetness: result.sweetness,
      acidity: result.acidity,
      bitterness: result.bitterness,
      umami: result.umami,
      astringency: result.astringency,
      description: result.guidedSummary || prev.description,
      styleTags: [...new Set([...prev.styleTags, ...result.styleTags])],
    }));
    setShowGuidedTasting(false);
  };

  // 品牌搜尋
  useEffect(() => {
    if (formData.brandName.trim().length < 1) { setBrandSuggestions([]); setShowSuggestions(false); return; }
    const q = formData.brandName.toLowerCase();
    const results = SAKE_DATABASE.filter(s => s.brand.toLowerCase().includes(q)).slice(0, 6);
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

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files.slice(0, 2 - imageItems.length)) {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res) => {
        reader.onload = (ev) => res(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      const resized = await resizeImage(base64);
      setImageItems(prev => [...prev, { dataUrl: resized, imageId: null }].slice(0, 2));
    }
    e.target.value = '';
  };

  const fillFromSuggestion = (s: SakeDatabaseEntry) => {
    setFormData(prev => ({
      ...prev,
      brandName: s.brand,
      brewery: s.brewery || prev.brewery,
      origin: s.location || prev.origin,
    }));
    setShowSuggestions(false);
  };

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

  const handleSave = async () => {
    if (!formData.brandName.trim()) {
      toast({ variant: 'destructive', title: '請填入品牌名稱' });
      return;
    }
    setIsSaving(true);
    try {
      // 找出被移除的舊圖片
      const removedIds = originalImageIds.filter(
        oid => !imageItems.some(item => item.imageId === oid)
      );
      if (removedIds.length > 0) await deleteImages(removedIds);

      // 新圖片存入 IndexedDB
      const finalImageIds: string[] = [];
      for (const item of imageItems) {
        if (item.imageId) {
          finalImageIds.push(item.imageId);
        } else {
          const newId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await saveImage(newId, item.dataUrl);
          finalImageIds.push(newId);
        }
      }

      updateNote(id, {
        brandName: formData.brandName,
        subBrand: formData.subBrand || undefined,
        brewery: formData.brewery,
        origin: formData.origin || undefined,
        imageIds: finalImageIds,
        sweetnessRating: formData.sweetness,
        acidityRating: formData.acidity,
        bitternessRating: formData.bitterness,
        umamiRating: formData.umami,
        astringencyRating: formData.astringency,
        overallRating: formData.overallRating,
        styleTags: formData.styleTags,
        description: formData.description,
        userDescription: formData.userDescription || undefined,
        tastingDate: formData.tastingDate,
      });

      toast({ title: '筆記已更新' });
      router.replace(`/offline/notes/${id}`);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: '更新失敗' });
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#f97316] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-32 font-body">
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-sm font-bold text-white flex-1">編輯品飲筆記</h1>
        <Button
          variant="ghost" size="sm"
          onClick={() => setShowGuidedTasting(true)}
          className="shrink-0 rounded-full text-[10px] font-bold text-[#f97316]/80 hover:text-[#f97316] border border-[#f97316]/30 hover:border-[#f97316]/60 h-9 px-3"
        >
          <BookOpen className="w-3 h-3 mr-1" /> 引導品鑑
        </Button>
      </nav>

      {showGuidedTasting && (
        <GuidedTasting
          onComplete={handleGuidedComplete}
          onClose={() => setShowGuidedTasting(false)}
        />
      )}

      <div className="max-w-xl mx-auto px-4 py-6 space-y-8">
        {/* 照片 */}
        <section>
          <Label className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3 block">照片（最多 2 張）</Label>
          <div className="flex gap-3">
            {imageItems.map((item, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10">
                <img src={item.dataUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImageItems(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {imageItems.length < 2 && (
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

          {/* 品牌名稱 */}
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
            {showSuggestions && brandSuggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1a1a1e] border border-white/10 rounded-xl overflow-hidden shadow-xl">
                {brandSuggestions.map(s => (
                  <button
                    key={s.brand}
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-white/70 text-sm font-bold">綜合評分</Label>
              <span className="text-[#f97316] text-xl font-bold">{formData.overallRating.toFixed(1)} <span className="text-white/30 text-sm">/ 10</span></span>
            </div>
            <Slider
              min={1} max={10} step={0.1}
              value={[formData.overallRating]}
              onValueChange={([v]) => setFormData(p => ({ ...p, overallRating: Math.round(v * 10) / 10 }))}
              className="w-full"
            />
          </div>
        </section>

        {/* 風格標籤 */}
        <section className="space-y-3">
          <Label className="text-white/60 text-xs font-bold uppercase tracking-widest block">
            <Tag className="w-3 h-3 inline mr-1" /> 風格標籤
          </Label>
          {expoQuickTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-[#f97316]/70 font-bold uppercase tracking-widest">活動快速標籤</p>
              <div className="flex flex-wrap gap-2">
                {expoQuickTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-bold border transition-all',
                      formData.styleTags.includes(tag)
                        ? 'bg-[#f97316] border-[#f97316] text-white'
                        : 'bg-[#f97316]/10 border-[#f97316]/30 text-[#f97316]/80 hover:border-[#f97316]/60'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/5 pt-2" />
            </div>
          )}
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

        {/* 品飲描述 */}
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

        {/* 作者描述 */}
        <section>
          <Label className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3 block">作者描述</Label>
          <Textarea
            placeholder="個人感想、購買意願、備忘..."
            value={formData.userDescription}
            onChange={e => setFormData(p => ({ ...p, userDescription: e.target.value }))}
            rows={3}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </section>
      </div>

      {/* 固定底部 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0c]/95 backdrop-blur border-t border-white/5 px-4 py-4">
        <div className="max-w-xl mx-auto">
          <Button
            size="lg"
            disabled={isSaving}
            onClick={handleSave}
            className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold shadow-[0_0_15px_rgba(249,115,22,0.3)]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            儲存更新
          </Button>
        </div>
      </div>
    </div>
  );
}
