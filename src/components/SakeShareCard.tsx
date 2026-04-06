"use client"

import React, { useRef, useState, useEffect } from 'react';
import { SakeNote, UserProfile } from '@/lib/types';
import { Share2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SakeShareCardProps {
  note: SakeNote;
  authorProfile?: UserProfile | null;
  onClose: () => void;
}

// ── Inline SVG Radar Chart（html2canvas 相容，純 SVG 不依賴 recharts）──────
function RadarSvg({
  sw, ac, bi, um, as_, size = 130,
}: { sw: number; ac: number; bi: number; um: number; as_: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.36;
  const labelR = maxR + 13;
  const labels = ['甘', '酸', '苦', '旨', '澀'];
  const values = [sw, ac, bi, um, as_];
  const angles = labels.map((_, i) => ((i * 72 - 90) * Math.PI) / 180);
  const pt = (r: number, i: number) => ({
    x: cx + r * Math.cos(angles[i]),
    y: cy + r * Math.sin(angles[i]),
  });
  const toPath = (r: number) =>
    angles.map((_, i) => `${i === 0 ? 'M' : 'L'}${pt(r, i).x.toFixed(1)},${pt(r, i).y.toFixed(1)}`).join(' ') + ' Z';
  const dataPoints = values.map((v, i) => pt((v / 5) * maxR, i));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      {[1, 2, 3, 4, 5].map(lvl => (
        <path key={lvl} d={toPath((lvl / 5) * maxR)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
      ))}
      {angles.map((_, i) => {
        const end = pt(maxR, i);
        return <line key={i} x1={cx.toFixed(1)} y1={cy.toFixed(1)} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />;
      })}
      <path d={dataPath} fill="rgba(249,115,22,0.22)" stroke="#f97316" strokeWidth="1.5" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.5" fill="#f97316" />
      ))}
      {angles.map((_, i) => {
        const lp = pt(labelR, i);
        return (
          <text key={i} x={lp.x.toFixed(1)} y={(lp.y + 4).toFixed(1)}
            textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.55)"
          >
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}

// ── Tag 優先排序：酒精 > 日本酒度 > 酒米 > 精米步合 > 其他 ──────
function sortInfoTags(tags: string[]): string[] {
  const priority = (t: string) => {
    if (/\d+(\.\d+)?[度%]/.test(t) && !/精米/.test(t)) return 0;
    if (/日本酒度/.test(t)) return 1;
    if (/山田錦|五百万石|雄町|美山錦|渡舟|愛山|八反錦|越淡麗|神力|日本晴|酒米|米$/.test(t)) return 2;
    if (/精米/.test(t)) return 3;
    return 4;
  };
  return [...tags].sort((a, b) => priority(a) - priority(b));
}

export function SakeShareCard({ note, authorProfile, onClose }: SakeShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  type DescMode = 'none' | 'user' | 'ai' | 'both';
  const [descMode, setDescMode] = useState<DescMode>('user');

  // Image pan / pinch
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const [imgZoom, setImgZoom] = useState(1);
  const dragging = useRef(false);
  const lastPt = useRef({ x: 0, y: 0 });
  const lastDist = useRef<number | null>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);

  // Prevent page scroll while dragging inside the image box (React registers touchmove as passive)
  useEffect(() => {
    const el = imgContainerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => { e.preventDefault(); };
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => { dragging.current = true; lastPt.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setImgOffset(prev => ({ x: prev.x + e.clientX - lastPt.current.x, y: prev.y + e.clientY - lastPt.current.y }));
    lastPt.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { dragging.current = false; };
  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); setImgZoom(z => Math.max(0.4, Math.min(3, z - e.deltaY * 0.0008))); };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) { dragging.current = true; lastPt.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
    else if (e.touches.length === 2) { lastDist.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && dragging.current) {
      setImgOffset(prev => ({ x: prev.x + e.touches[0].clientX - lastPt.current.x, y: prev.y + e.touches[0].clientY - lastPt.current.y }));
      lastPt.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && lastDist.current != null) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setImgZoom(z => Math.max(0.4, Math.min(3, z * (dist / lastDist.current!))));
      lastDist.current = dist;
    }
  };
  const onTouchEnd = () => { dragging.current = false; lastDist.current = null; };

  const sw = note.sweetnessRating ?? 0;
  const ac = note.acidityRating ?? 0;
  const bi = note.bitternessRating ?? 0;
  const um = note.umamiRating ?? 0;
  const as_ = note.astringencyRating ?? 0;
  const sortedTags = sortInfoTags(note.sakeInfoTags ?? []).slice(0, 5);

  // Compute the description content to render based on descMode
  const userDesc = note.userDescription || note.description || '';
  const aiDesc = note.aiResultNote || '';
  const hasDesc = descMode !== 'none' && (
    (descMode === 'user' && userDesc) ||
    (descMode === 'ai' && aiDesc) ||
    (descMode === 'both' && (userDesc || aiDesc))
  );

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, useCORS: true, allowTaint: false,
        backgroundColor: '#0c0c10', logging: false,
      });
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => (b ? res(b) : rej(new Error('blob'))), 'image/png')
      );
      const fileName = `${note.brandName || 'sake'}-sakepath.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: note.brandName });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('分享失敗', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-3 py-4" onClick={e => e.stopPropagation()}>

        {/* ── 分享卡本體 ── */}
        <div
          ref={cardRef}
          style={{
            width: '100%', borderRadius: 26, overflow: 'hidden',
            background: 'linear-gradient(155deg, #1a1a1e 0%, #0c0c10 55%, #1c0900 100%)',
            fontFamily: '"PingFang TC", "Heiti TC", "Noto Sans TC", sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ padding: '16px 18px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 9, color: 'rgba(249,115,22,0.82)', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 3 }}>
                  {note.brewery}{note.origin ? `　${note.origin}` : ''}
                </p>
                <h2 style={{ fontSize: 19, fontWeight: 700, color: 'white', lineHeight: 1.2, wordBreak: 'break-word', margin: 0 }}>
                  {note.brandName}
                </h2>
              </div>
              <div style={{ background: '#f97316', borderRadius: 10, padding: '5px 9px', textAlign: 'center' as const, flexShrink: 0 }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', fontWeight: 700, letterSpacing: '0.1em' }}>SCORE</div>
                <div style={{ fontSize: 21, fontWeight: 700, color: 'white', lineHeight: 1.1 }}>{note.overallRating}</div>
              </div>
            </div>
{(note.alcoholPercent || sortedTags.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginTop: 7 }}>
                {note.alcoholPercent && (
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: 'rgba(251,191,36,0.95)',
                    background: 'rgba(245,158,11,0.18)',
                    border: '1px solid rgba(245,158,11,0.45)',
                    padding: '2px 7px', borderRadius: 999,
                  }}>{`酒精濃度 ${note.alcoholPercent}`}</span>
                )}
                {sortedTags.map((tag, i) => (
                  <span key={i} style={{
                    fontSize: 9, fontWeight: 700,
                    color: 'rgba(125,211,252,0.9)',
                    background: 'rgba(14,165,233,0.12)',
                    border: '1px solid rgba(14,165,233,0.28)',
                    padding: '2px 7px', borderRadius: 999,
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Image + Radar */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 8 }}>
            <div
              style={{
                width: '48%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden',
                background: 'rgba(0,0,0,0.5)', flexShrink: 0, position: 'relative' as const, cursor: 'move',
              }}
              ref={imgContainerRef}
              onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
              onWheel={onWheel}
            >
              {note.imageUrls?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={note.imageUrls[0]} alt="" crossOrigin="anonymous"
                  style={{
                    position: 'absolute' as const, inset: 0, width: '100%', height: '100%',
                    objectFit: 'contain' as const,
                    transform: `translate(${imgOffset.x}px,${imgOffset.y}px) scale(${imgZoom})`,
                    transformOrigin: 'center center',
                    userSelect: 'none' as const, pointerEvents: 'none' as const,
                  }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍶</div>
              )}
              <div style={{ position: 'absolute' as const, bottom: 4, right: 5, fontSize: 7, color: 'rgba(255,255,255,0.22)', fontWeight: 700, pointerEvents: 'none' as const }}>拖移縮放</div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RadarSvg sw={sw} ac={ac} bi={bi} um={um} as_={as_} size={128} />
            </div>
          </div>

          {/* Description */}
          {hasDesc && (
            <div style={{ padding: '0 18px 10px' }}>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 9 }} />
              {descMode === 'both' ? (
                <>
                  {userDesc && <p style={{ fontSize: 10, lineHeight: 1.65, color: 'rgba(255,255,255,0.58)', margin: '0 0 6px' }}>{userDesc}</p>}
                  {aiDesc && (
                    <>
                      {userDesc && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 6 }} />}
                      <p style={{ fontSize: 10, lineHeight: 1.65, color: 'rgba(249,115,22,0.65)', margin: 0 }}>{aiDesc}</p>
                    </>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 10, lineHeight: 1.65, color: descMode === 'ai' ? 'rgba(249,115,22,0.65)' : 'rgba(255,255,255,0.58)', margin: 0 }}>
                  {descMode === 'ai' ? aiDesc : userDesc}
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: `${hasDesc ? 6 : 0}px 18px 15px` }}>
            {!hasDesc && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 9 }} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
              <div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', marginBottom: 1 }}>品飲者</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{authorProfile?.username || note.username || '酒友'}</div>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', marginBottom: 1 }}>品飲日期</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{new Date(note.tastingDate).toLocaleDateString('zh-TW')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
              <span style={{ fontSize: 9, color: 'rgba(249,115,22,0.45)', letterSpacing: '0.22em', fontWeight: 700 }}>SAKEPATH.COM</span>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
            </div>
          </div>
        </div>

        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', textAlign: 'center', margin: 0 }}>
          拖移 / 滾輪 / 捏合縮放 可調整圖片
        </p>

        {/* 描述顯示模式選擇 */}
        <div className="flex gap-1.5 justify-center flex-wrap">
          {(['none', 'user', 'ai', 'both'] as DescMode[]).map(m => (
            <button key={m} onClick={() => setDescMode(m)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                descMode === m
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-transparent text-white/40 border-white/20 hover:border-white/40'
              }`}
            >
              {m === 'none' ? '不顯示描述' : m === 'user' ? '作者描述' : m === 'ai' ? 'AI品鑑' : '兩者'}
            </button>
          ))}
        </div>

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
            onClick={handleShare}
            disabled={isExporting}
          >
            {isExporting
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> 處理中</>
              : <><Share2 className="w-4 h-4 mr-1.5" /> 分享圖片</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
