"use client"

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, Upload, Search, ExternalLink, Globe, Tag, Image as ImageIcon, Sparkles, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface WebEntity { entityId: string; score: number; description: string; }
interface MatchImage { url: string; }
interface PageMatch { url: string; pageTitle: string; fullMatchingImages?: MatchImage[]; }
interface Extracted { brandName: string; brewery: string; origin: string; alcoholPercent: string; }
interface VisionResult {
  ocrText: string;
  webEntities: WebEntity[];
  fullMatchingImages: MatchImage[];
  partialMatchingImages: MatchImage[];
  pagesWithMatchingImages: PageMatch[];
  bestGuessLabels: { label: string; languageCode: string }[];
  extracted: Extracted | null;
}

async function resizeImage(base64: string, maxDimension = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxDimension) { h = h * maxDimension / w; w = maxDimension; } }
      else { if (h > maxDimension) { w = w * maxDimension / h; h = maxDimension; } }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
  });
}

export default function VisionLabPage() {
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const resized = await resizeImage(reader.result as string);
      setPhotoDataUri(resized);
      setResult(null);
      setError(null);
      setElapsed(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  };

  const handleSearch = async () => {
    if (!photoDataUri) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    const t0 = Date.now();
    try {
      const res = await fetch('/api/ai/vision-web-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoDataUri }),
      });
      const data = await res.json();
      setElapsed(Date.now() - t0);
      if (!res.ok) {
        setError(data.error || '辨識失敗');
      } else {
        setResult(data as VisionResult);
      }
    } catch (e: any) {
      setError(e.message || '網路錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500/20 text-green-300 border-green-500/40';
    if (score >= 0.5) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    return 'bg-white/10 text-white/50 border-white/20';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-primary hover:text-primary/80 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-sm font-bold tracking-widest uppercase text-primary">Vision Lab</h1>
          <p className="text-[10px] text-white/40 tracking-wider">Google Cloud Vision — WEB_DETECTION 試驗</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Upload zone */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-2xl transition-all cursor-pointer group",
            photoDataUri ? "border-primary/40" : "border-white/20 hover:border-primary/40"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          {photoDataUri ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoDataUri} alt="uploaded" className="w-full rounded-2xl object-contain max-h-80" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-2xl">
                <div className="flex items-center gap-2 bg-primary/20 border border-primary/40 px-4 py-2 rounded-full text-primary text-xs font-bold">
                  <Camera className="w-4 h-4" /> 更換圖片
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center gap-3 text-white/40 group-hover:text-white/60 transition-colors">
              <Upload className="w-10 h-10" />
              <p className="text-sm font-medium">點擊或拖曳上傳酒標圖片</p>
              <p className="text-[11px]">支援 JPG / PNG，自動縮放至 1024px</p>
            </div>
          )}
        </div>

        {/* Search button */}
        <Button
          onClick={handleSearch}
          disabled={!photoDataUri || isLoading}
          className="w-full h-12 text-sm font-bold rounded-xl bg-primary hover:bg-primary/90 text-black"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />以圖搜圖中...</>
          ) : (
            <><Search className="w-4 h-4 mr-2" />使用 Cloud Vision WEB_DETECTION 搜尋</>
          )}
        </Button>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-5">
            {/* timing */}
            <p className="text-[11px] text-white/30 text-right tracking-wider">
              回應時間：{elapsed ? `${(elapsed / 1000).toFixed(2)}s` : '—'}
            </p>

            {/* Extracted sake info — shown first and prominently */}
            {result.extracted && (
              <section className="bg-primary/10 border border-primary/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Gemini 萃取結果</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '銘柄', value: result.extracted.brandName },
                    { label: '酒造', value: result.extracted.brewery },
                    { label: '產地', value: result.extracted.origin },
                    { label: '酒精濃度', value: result.extracted.alcoholPercent },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-black/30 rounded-xl px-3 py-2">
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">{label}</p>
                      <p className={cn("text-sm font-bold", value ? 'text-white' : 'text-white/20')}>
                        {value || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* OCR Raw Text */}
            {result.ocrText && (
              <section>
                <SectionTitle icon={<Tag className="w-3.5 h-3.5" />} title="OCR 辨識文字" />
                <pre className="mt-2 bg-white/5 rounded-xl px-3 py-2.5 text-[11px] text-white/60 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{result.ocrText}</pre>
              </section>
            )}

            {/* Best Guess Labels */}
            {result.bestGuessLabels.length > 0 && (
              <section>
                <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />} title="Best Guess Labels（最佳猜測）" />
                <div className="flex flex-wrap gap-2 mt-2">
                  {result.bestGuessLabels.map((l, i) => (
                    <span key={i} className="bg-primary/20 border border-primary/40 text-primary text-xs px-3 py-1 rounded-full font-bold">
                      {l.label} <span className="text-primary/50 ml-1 text-[10px]">{l.languageCode}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Web Entities */}
            {result.webEntities.length > 0 && (
              <section>
                <SectionTitle icon={<Tag className="w-3.5 h-3.5" />} title={`Web Entities（${result.webEntities.length} 筆）`} />
                <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {result.webEntities.filter(e => e.description).map((e, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-xs text-white/80">{e.description}</span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", scoreColor(e.score))}>
                        {(e.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Pages with matching images */}
            {result.pagesWithMatchingImages.length > 0 && (
              <section>
                <SectionTitle icon={<Globe className="w-3.5 h-3.5" />} title={`相關網頁（${result.pagesWithMatchingImages.length} 筆）`} />
                <div className="mt-2 space-y-2">
                  {result.pagesWithMatchingImages.map((p, i) => (
                    <a
                      key={i}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-xl px-3 py-2.5 group"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/30 group-hover:text-primary transition-colors" />
                      <div className="min-w-0">
                        <p className="text-xs text-white/80 truncate">{p.pageTitle || '（無標題）'}</p>
                        <p className="text-[10px] text-white/30 truncate">{p.url}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Full matching images */}
            {result.fullMatchingImages.length > 0 && (
              <section>
                <SectionTitle icon={<ImageIcon className="w-3.5 h-3.5" />} title={`完全吻合圖片（${result.fullMatchingImages.length} 筆）`} />
                <div className="mt-2 space-y-1">
                  {result.fullMatchingImages.map((img, i) => (
                    <a key={i} href={img.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-lg px-3 py-2 group">
                      <ImageIcon className="w-3.5 h-3.5 shrink-0 text-white/30 group-hover:text-primary transition-colors" />
                      <p className="text-[10px] text-white/50 truncate">{img.url}</p>
                      <ExternalLink className="w-3 h-3 shrink-0 text-white/20 group-hover:text-primary transition-colors ml-auto" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Partial matching images */}
            {result.partialMatchingImages.length > 0 && (
              <section>
                <SectionTitle icon={<ImageIcon className="w-3.5 h-3.5" />} title={`部分吻合圖片（${result.partialMatchingImages.length} 筆）`} />
                <div className="mt-2 space-y-1">
                  {result.partialMatchingImages.slice(0, 5).map((img, i) => (
                    <a key={i} href={img.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors rounded-lg px-3 py-2 group">
                      <ImageIcon className="w-3.5 h-3.5 shrink-0 text-white/30 group-hover:text-primary transition-colors" />
                      <p className="text-[10px] text-white/50 truncate">{img.url}</p>
                      <ExternalLink className="w-3 h-3 shrink-0 text-white/20 group-hover:text-primary transition-colors ml-auto" />
                    </a>
                  ))}
                  {result.partialMatchingImages.length > 5 && (
                    <p className="text-[10px] text-white/30 text-center pt-1">+{result.partialMatchingImages.length - 5} 筆（已省略）</p>
                  )}
                </div>
              </section>
            )}

            {/* Empty state */}
            {result.webEntities.length === 0 && result.pagesWithMatchingImages.length === 0 && result.bestGuessLabels.length === 0 && (
              <div className="text-center py-8 text-white/30">
                <p className="text-sm">Cloud Vision 未回傳任何結果</p>
                <p className="text-xs mt-1">圖片可能解析度不足或標籤不常見</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-white/50">
      <span className="text-primary">{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}
