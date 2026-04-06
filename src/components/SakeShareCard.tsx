"use client"

import React, { useRef, useState } from 'react';
import { SakeNote, RATING_LABELS, UserProfile } from '@/lib/types';
import { Download, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SakeShareCardProps {
  note: SakeNote;
  authorProfile?: UserProfile | null;
  onClose: () => void;
}

// 品飲雷達的簡版橫條圖（純 CSS，避免 html2canvas 對 SVG 的轉換問題）
function FlavorBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-white/60 w-4 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-white/50 w-3 text-right">{value}</span>
    </div>
  );
}

export function SakeShareCard({ note, authorProfile, onClose }: SakeShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const sw = note.sweetnessRating ?? 0;
  const ac = note.acidityRating ?? 0;
  const bi = note.bitternessRating ?? 0;
  const um = note.umamiRating ?? 0;
  const as_ = note.astringencyRating ?? 0;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `${note.brandName || 'sake'}-share.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('匯出失敗', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>

        {/* ── 分享卡本體 ── */}
        <div
          ref={cardRef}
          className="w-full rounded-[2rem] overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #18181b 0%, #0a0a0c 60%, #1a0a00 100%)',
            fontFamily: '"PingFang TC", "Heiti TC", sans-serif',
          }}
        >
          {/* 頂部圖片 */}
          {note.imageUrls?.[0] && (
            <div className="relative w-full" style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={note.imageUrls[0]}
                alt={note.brandName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                crossOrigin="anonymous"
              />
              {/* 漸層遮罩 */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 30%, rgba(10,10,12,0.95) 100%)',
              }} />
              {/* 評分 */}
              <div style={{
                position: 'absolute', top: 14, right: 14,
                background: 'rgba(249,115,22,0.92)',
                borderRadius: 999, padding: '4px 12px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>★ {note.overallRating}</span>
              </div>
            </div>
          )}

          <div style={{ padding: '20px 24px 24px' }}>
            {/* 酒名 */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: 'rgba(249,115,22,0.85)', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 4 }}>
                {note.brewery}
                {note.origin ? `　${note.origin}` : ''}
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', lineHeight: 1.2, marginBottom: 6 }}>
                {note.brandName}
              </h2>
              {/* 規格標籤 */}
              {note.sakeInfoTags && note.sakeInfoTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {note.sakeInfoTags.slice(0, 5).map((tag, i) => (
                    <span key={i} style={{
                      fontSize: 9, fontWeight: 700, color: 'rgba(125,211,252,0.9)',
                      background: 'rgba(14,165,233,0.12)',
                      border: '1px solid rgba(14,165,233,0.3)',
                      padding: '2px 7px', borderRadius: 999,
                    }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* 分隔線 */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 14 }} />

            {/* 風味橫條 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {[
                { label: '甘', value: sw },
                { label: '酸', value: ac },
                { label: '苦', value: bi },
                { label: '旨', value: um },
                { label: '澀', value: as_ },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', width: 14 }}>{label}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: '#f97316', width: `${(value / 5) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 10, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* 品飲描述 */}
            {(note.userDescription || note.description) && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12 }} />
                <p style={{
                  fontSize: 11, lineHeight: 1.7, color: 'rgba(255,255,255,0.7)',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  marginBottom: 14,
                }}>
                  {note.userDescription || note.description}
                </p>
              </>
            )}

            {/* 底部：作者 + 日期 + app 標識 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 2, letterSpacing: '0.1em' }}>品飲者</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                  {authorProfile?.username || note.username || '酒友'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 2, letterSpacing: '0.1em' }}>品飲日期</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                  {new Date(note.tastingDate).toLocaleDateString('zh-TW')}
                </p>
              </div>
            </div>

            {/* App 浮水印 */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
              <span style={{ fontSize: 9, color: 'rgba(249,115,22,0.4)', letterSpacing: '0.2em', fontWeight: 700 }}>
                SAKE TASTING NOTES
              </span>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
            </div>
          </div>
        </div>

        {/* ── 操作按鈕 ── */}
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1 rounded-full border-white/20 text-white/70 hover:bg-white/10 h-11 text-xs font-bold uppercase tracking-widest"
            onClick={onClose}
          >
            <X className="w-4 h-4 mr-1.5" /> 關閉
          </Button>
          <Button
            className="flex-1 rounded-full h-11 text-xs font-bold uppercase tracking-widest"
            onClick={handleDownload}
            disabled={isExporting}
          >
            {isExporting
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> 匯出中...</>
              : <><Download className="w-4 h-4 mr-1.5" /> 儲存圖片</>
            }
          </Button>
        </div>
        <p className="text-[10px] text-white/30 text-center">長按或點擊「儲存圖片」下載分享卡</p>
      </div>
    </div>
  );
}
