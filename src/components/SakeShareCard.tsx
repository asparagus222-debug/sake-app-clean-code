"use client"

import React, { useRef, useState, useEffect } from 'react';
import { SakeNote, UserProfile } from '@/lib/types';
import { Share2, X, Loader2, Pencil, RotateCcw, Check, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatSakeDisplayName } from '@/lib/utils';

interface SakeShareCardProps {
  note: SakeNote;
  authorProfile?: UserProfile | null;
  onClose: () => void;
}

// ── Inline SVG Radar Chart ───────────────────────────────────────────────────
function RadarSvg({
  sw, ac, bi, um, as_, size = 130, primaryColor = '#f97316', isDark = true,
}: { sw: number; ac: number; bi: number; um: number; as_: number; size?: number; primaryColor?: string; isDark?: boolean }) {
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
  const gridStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const axisStroke = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const labelFill = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const ph = primaryColor.replace('#', '');
  const areaFill = ph.length === 6
    ? `rgba(${parseInt(ph.slice(0,2),16)},${parseInt(ph.slice(2,4),16)},${parseInt(ph.slice(4,6),16)},0.22)`
    : 'rgba(249,115,22,0.22)';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      {[1, 2, 3, 4, 5].map(lvl => (
        <path key={lvl} d={toPath((lvl / 5) * maxR)} fill="none" stroke={gridStroke} strokeWidth="0.8" />
      ))}
      {angles.map((_, i) => {
        const end = pt(maxR, i);
        return <line key={i} x1={cx.toFixed(1)} y1={cy.toFixed(1)} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} stroke={axisStroke} strokeWidth="0.8" />;
      })}
      <path d={dataPath} fill={areaFill} stroke={primaryColor} strokeWidth="1.5" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.5" fill={primaryColor} />
      ))}
      {angles.map((_, i) => {
        const lp = pt(labelR, i);
        return (
          <text key={i} x={lp.x.toFixed(1)} y={(lp.y + 4).toFixed(1)}
            textAnchor="middle" fontSize="10" fontWeight="700" fill={labelFill}
          >
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}

// ── Tag 排序：日本酒度 > 酒米 > 精米步合 > 其他 ─────────────────────────────
function sortInfoTags(tags: string[]): string[] {
  const priority = (t: string) => {
    if (/日本酒度/.test(t)) return 0;
    if (/山田錦|五百万石|雄町|美山錦|渡舟|愛山|八反錦|越淡麗|神力|日本晴|酒米|米$/.test(t)) return 1;
    if (/精米/.test(t)) return 2;
    return 3;
  };
  return [...tags].sort((a, b) => priority(a) - priority(b));
}

export function SakeShareCard({ note, authorProfile, onClose }: SakeShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const displayName = formatSakeDisplayName(note.brandName, note.subBrand);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  type DescMode = 'none' | 'user' | 'ai' | 'both';
  const [descMode, setDescMode] = useState<DescMode>('user');

  // Committed image position (used in the card)
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const [imgZoom, setImgZoom] = useState(1);
  const [shareImageSrc, setShareImageSrc] = useState<string | null>(note.imageUrls?.[0] || null);

  // Editor modal state
  const [showImgEditor, setShowImgEditor] = useState(false);
  const [editorOffset, setEditorOffset] = useState({ x: 0, y: 0 });
  const [editorZoom, setEditorZoom] = useState(1);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const imgBoxRef = useRef<HTMLDivElement>(null);
  const [previewFrameSize, setPreviewFrameSize] = useState(0);
  const cardImageSizeRef = useRef(0); // card image box px — used for offset scaling
  // Use refs for live values so native event handlers always see latest state
  const editorOffsetRef = useRef({ x: 0, y: 0 });
  const editorZoomRef = useRef(1);
  // Mouse drag (desktop)
  const mouseDragging = useRef(false);
  const mouseLastPt = useRef({ x: 0, y: 0 });

  const onEditorMouseDown = (e: React.MouseEvent) => { mouseDragging.current = true; mouseLastPt.current = { x: e.clientX, y: e.clientY }; };
  const onEditorMouseMove = (e: React.MouseEvent) => {
    if (!mouseDragging.current) return;
    const dx = e.clientX - mouseLastPt.current.x;
    const dy = e.clientY - mouseLastPt.current.y;
    mouseLastPt.current = { x: e.clientX, y: e.clientY };
    const next = { x: editorOffsetRef.current.x + dx, y: editorOffsetRef.current.y + dy };
    editorOffsetRef.current = next;
    setEditorOffset({ ...next });
  };
  const onEditorMouseUp = () => { mouseDragging.current = false; };
  const onEditorWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = Math.max(0.3, Math.min(5, editorZoomRef.current - e.deltaY * 0.001));
    editorZoomRef.current = next;
    setEditorZoom(next);
  };

  // All touch handling via native listeners to avoid React synthetic event issues
  useEffect(() => {
    if (!showImgEditor) return;
    const el = editorContainerRef.current;
    if (!el) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastDist: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        lastDist = null;
      } else if (e.touches.length >= 2) {
        isDragging = false;
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        // Only initialise pinch if fingers are sufficiently apart (avoids tiny-dist explosion)
        lastDist = d > 10 ? d : null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        const next = { x: editorOffsetRef.current.x + dx, y: editorOffsetRef.current.y + dy };
        editorOffsetRef.current = next;
        setEditorOffset({ ...next });
      } else if (e.touches.length >= 2 && lastDist !== null) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (d > 10) {
          const ratio = d / lastDist;
          // Clamp per-frame ratio to prevent sudden jumps
          const safeRatio = Math.max(0.85, Math.min(1.15, ratio));
          const next = Math.max(0.3, Math.min(5, editorZoomRef.current * safeRatio));
          editorZoomRef.current = next;
          setEditorZoom(next);
        }
        lastDist = d;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isDragging = false;
        lastDist = null;
      } else if (e.touches.length === 1) {
        // One finger remains — switch to drag mode
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        lastDist = null;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [showImgEditor]);

  const openImgEditor = () => {
    const cardSize = imgBoxRef.current
      ? Math.round(imgBoxRef.current.getBoundingClientRect().width)
      : 160;
    cardImageSizeRef.current = cardSize;
    // Make the orange frame fill ~85% of the usable editor canvas (viewport minus two toolbars ~110px)
    const editorFrameSize = Math.round(
      Math.min(window.innerWidth * 0.88, (window.innerHeight - 110) * 0.88)
    );
    setPreviewFrameSize(editorFrameSize);
    // Scale existing card-space offset up into editor-space so the crop is shown correctly
    const upScale = editorFrameSize / cardSize;
    const scaledOffset = { x: imgOffset.x * upScale, y: imgOffset.y * upScale };
    editorOffsetRef.current = scaledOffset;
    editorZoomRef.current = imgZoom;
    setEditorOffset(scaledOffset);
    setEditorZoom(imgZoom);
    setShowImgEditor(true);
  };

  const resetImageTransform = () => {
    editorOffsetRef.current = { x: 0, y: 0 };
    editorZoomRef.current = 1;
    setEditorOffset({ x: 0, y: 0 });
    setEditorZoom(1);
    setImgOffset({ x: 0, y: 0 });
    setImgZoom(1);
  };

  const resizeSelectedImage = async (base64: string, maxDimension = 1600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        } else if (height >= width && height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
    });
  };

  const handleReplacePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const resized = await resizeSelectedImage(base64);
      setShareImageSrc(resized);
      resetImageTransform();
      setShowImgEditor(true);
    };
    reader.readAsDataURL(file);
  };

  const confirmImgEdit = () => {
    // Scale editor-space offset back down to card-space
    const downScale = cardImageSizeRef.current / previewFrameSize;
    setImgOffset({ x: editorOffset.x * downScale, y: editorOffset.y * downScale });
    setImgZoom(editorZoom);
    setShowImgEditor(false);
  };

  const sw = note.sweetnessRating ?? 0;
  const ac = note.acidityRating ?? 0;
  const bi = note.bitternessRating ?? 0;
  const um = note.umamiRating ?? 0;
  const as_ = note.astringencyRating ?? 0;
  const sortedTags = sortInfoTags(note.sakeInfoTags ?? []).slice(0, 5);
  const styleTags = (note.styleTags ?? []).slice(0, 4);
  const servingTemperatures = (note.servingTemperatures?.filter(Boolean).length
    ? note.servingTemperatures?.filter(Boolean)
    : note.servingTemperature
      ? [note.servingTemperature]
      : []) ?? [];
  const foodPairings = (note.foodPairings ?? [])
    .filter((pairing) => pairing.food?.trim())
    .slice(0, 4);

  // ── Theme-adaptive card palette ──────────────────────────────────────────
  const theme = authorProfile?.themeSettings;
  const rawBg = (theme?.mode === 'custom' && theme.customBg) ? theme.customBg
              : theme?.mode === 'light' ? '#f5f5f0'
              : '#0c0c10';
  const primaryColor = theme?.customPrimary ?? '#f97316';
  const hBright = (hex: string) => {
    const h = hex.replace('#', '');
    if (h.length !== 6) return 0;
    return (parseInt(h.slice(0,2),16)*299 + parseInt(h.slice(2,4),16)*587 + parseInt(h.slice(4,6),16)*114) / 1000;
  };
  const isDark = hBright(rawBg) < 128;
  const rgba = (hex: string, a: number) => {
    const h = hex.replace('#', '');
    if (h.length !== 6) return `rgba(249,115,22,${a})`;
    return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;
  };
  const cardBackground = theme?.mode === 'light'
    ? 'linear-gradient(155deg, #fafaf5 0%, #f5f5ee 55%, #fff5ee 100%)'
    : (theme?.mode === 'custom' && theme.customBg) ? theme.customBg
    : 'linear-gradient(155deg, #1a1a1e 0%, #0c0c10 55%, #1c0900 100%)';
  const tagStyle: React.CSSProperties = {
    display: 'inline-block', fontSize: 9, fontWeight: 700, lineHeight: 1.3,
    color: isDark ? 'rgba(125,211,252,0.9)' : 'rgba(2,100,165,0.95)',
    background: isDark ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.1)',
    border: `1px solid ${isDark ? 'rgba(14,165,233,0.28)' : 'rgba(14,165,233,0.45)'}`,
    padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap',
    marginRight: 4, marginBottom: 4,
  };
  const tc = {
    text: isDark ? 'white' : '#1a1812',
    textSoft: isDark ? 'rgba(255,255,255,0.8)' : '#2a2420',
    textMuted: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.42)',
    textDesc: isDark ? 'rgba(255,255,255,0.82)' : 'rgba(20,16,12,0.88)',
    divider: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)',
    brandLabel: rgba(primaryColor, 0.9),
    primaryDesc: isDark ? 'rgba(255,214,184,0.92)' : 'rgba(126,47,0,0.9)',
    primaryLabel: isDark ? 'rgba(255,184,123,0.82)' : 'rgba(146,64,14,0.78)',
    primarySite: rgba(primaryColor, 0.5),
    imageBg: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)',
  };
  // ─────────────────────────────────────────────────────────────────────────

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
    // Let React flush so "點擊編輯" overlay disappears before capture
    await new Promise(r => setTimeout(r, 50));
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        backgroundColor: rawBg,
        // Retry twice — first attempt can miss web fonts / cross-origin images
        fetchRequestInit: { cache: 'force-cache' },
      });
      // Convert dataURL → Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const fileName = `${displayName || 'sake'}-sakepath.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: displayName });
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
    <>
      <input
        ref={replaceImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplacePhoto}
      />

      {/* ── Image Editor Modal ── */}
      {showImgEditor && shareImageSrc && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-md">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <button
                className="text-white/50 text-sm font-bold px-2 py-1"
                onClick={() => setShowImgEditor(false)}
              >
                取消
              </button>
              <button
                className="flex items-center gap-1.5 text-white/55 text-[11px] font-bold px-2 py-1 rounded-full border border-white/10 hover:border-white/30 hover:text-white/80 transition-colors"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  replaceImageInputRef.current?.click();
                }}
              >
                <Camera className="w-3 h-3" /> 重選照片
              </button>
            </div>
            <span className="text-white/40 text-[11px] tracking-widest">拖移 · 雙指縮放</span>
            <button
              className="flex items-center gap-1.5 bg-orange-500 text-white text-sm font-bold px-3 py-1 rounded-full"
              onClick={confirmImgEdit}
            >
              <Check className="w-3.5 h-3.5" /> 確認
            </button>
          </div>
          {/* Editing canvas */}
          <div
            ref={editorContainerRef}
            className="flex-1 relative overflow-hidden touch-none select-none cursor-move"
            onMouseDown={onEditorMouseDown}
            onMouseMove={onEditorMouseMove}
            onMouseUp={onEditorMouseUp}
            onMouseLeave={onEditorMouseUp}
            onWheel={onEditorWheel}
          >
            {/* Preview frame uses the exact same cover/translate/scale model as the final share card. */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: previewFrameSize || 160,
              height: previewFrameSize || 160,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.52)',
              border: '1.5px solid rgba(249,115,22,0.65)',
              borderRadius: 12,
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 10,
              background: 'rgba(255,255,255,0.04)',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shareImageSrc}
                alt=""
                crossOrigin="anonymous"
                draggable={false}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: `translate(${editorOffset.x}px, ${editorOffset.y}px) scale(${editorZoom})`,
                  transformOrigin: 'center center',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
              {/* Corner markers */}
              {[
                { top: -1, left: -1, borderTop: '2.5px solid #f97316', borderLeft: '2.5px solid #f97316' },
                { top: -1, right: -1, borderTop: '2.5px solid #f97316', borderRight: '2.5px solid #f97316' },
                { bottom: -1, left: -1, borderBottom: '2.5px solid #f97316', borderLeft: '2.5px solid #f97316' },
                { bottom: -1, right: -1, borderBottom: '2.5px solid #f97316', borderRight: '2.5px solid #f97316' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 14, height: 14, ...s }} />
              ))}
              <div style={{
                position: 'absolute', bottom: -22, left: 0, right: 0,
                textAlign: 'center', fontSize: 9, fontWeight: 700,
                color: 'rgba(249,115,22,0.55)', letterSpacing: '0.1em',
                pointerEvents: 'none',
              }}>實際顯示範圍</div>
            </div>
          </div>
          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 shrink-0">
            <button
              className="flex items-center gap-1.5 text-white/30 text-[11px] hover:text-white/60 transition-colors"
              onClick={resetImageTransform}
            >
              <RotateCcw className="w-3 h-3" /> 重置
            </button>
            <p className="text-white/20 text-[11px]">調整後點確認套用至打卡圖片</p>
          </div>
        </div>
      )}

      {/* ── Main share card modal ── */}
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
              background: cardBackground,
              fontFamily: '"PingFang TC", "Heiti TC", "Noto Sans TC", sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 18px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 9, color: tc.brandLabel, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 3 }}>
                    {note.brewery}{note.origin ? `　${note.origin}` : ''}
                  </p>
                  <h2 style={{ fontSize: 19, fontWeight: 700, color: tc.text, lineHeight: 1.2, wordBreak: 'break-word', margin: 0 }}>
                    {displayName}
                  </h2>
                </div>
                <div style={{ background: primaryColor, borderRadius: 10, padding: '5px 9px', textAlign: 'center' as const, flexShrink: 0 }}>
                  <div style={{ display: 'block', fontSize: 7, color: 'rgba(255,255,255,0.8)', fontWeight: 700, letterSpacing: '0.1em', margin: 0, lineHeight: 1.3 }}>SCORE</div>
                  <div style={{ display: 'block', fontSize: 21, fontWeight: 700, color: 'white', lineHeight: 1.1, margin: 0 }}>{note.overallRating}</div>
                </div>
              </div>
              {(note.alcoholPercent || sortedTags.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, marginTop: 3 }}>
                  {note.alcoholPercent && (
                    <span style={tagStyle}>{`酒精濃度 ${note.alcoholPercent}`}</span>
                  )}
                  {sortedTags.map((tag, i) => (
                    <span key={i} style={tagStyle}>{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Image + Radar */}
            {/* html-to-image uses browser renderer → aspect-ratio:1/1 is fully supported */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px' }}>
              {/* Static image preview — click to open editor */}
              <div
                ref={imgBoxRef}
                style={{
                  width: '48%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden',
                  background: tc.imageBg, flexShrink: 0, position: 'relative',
                  marginRight: 8, cursor: shareImageSrc ? 'pointer' : 'default',
                }}
                onClick={shareImageSrc ? openImgEditor : undefined}
              >
                {shareImageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shareImageSrc} alt="" crossOrigin="anonymous"
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      objectFit: 'cover' as const,
                      transform: `translate(${imgOffset.x}px,${imgOffset.y}px) scale(${imgZoom})`,
                      transformOrigin: 'center center',
                      userSelect: 'none' as const, pointerEvents: 'none' as const,
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍶</div>
                )}
                {/* Edit hint — hidden during export so it doesn't appear in the shared image */}
                {shareImageSrc && !isExporting && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 3, paddingBottom: 5, paddingTop: 10,
                    pointerEvents: 'none',
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>點擊編輯</span>
                  </div>
                )}
              </div>
              {!isExporting && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    replaceImageInputRef.current?.click();
                  }}
                  style={{
                    position: 'absolute', top: 10, left: 10,
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 8px', borderRadius: 999,
                    background: 'rgba(0,0,0,0.48)', color: 'rgba(255,255,255,0.78)',
                    border: '1px solid rgba(255,255,255,0.14)', fontSize: 9, fontWeight: 700,
                  }}
                >
                  <Camera style={{ width: 10, height: 10 }} /> 重選
                </button>
              )}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RadarSvg sw={sw} ac={ac} bi={bi} um={um} as_={as_} size={128} primaryColor={primaryColor} isDark={isDark} />
              </div>
            </div>

            {/* Description */}
            {hasDesc && (
              <div style={{ padding: '0 18px 10px' }}>
                <div style={{ height: 1, background: tc.divider, marginBottom: 9 }} />
                {descMode === 'both' ? (
                  <>
                    {userDesc && (
                      <>
                        <div style={{ display: 'block', fontSize: 7, fontWeight: 700, color: tc.textMuted, letterSpacing: '0.12em', marginBottom: 3, lineHeight: 1.3 }}>作者描述</div>
                        <p style={{ display: 'block', fontSize: 10.5, lineHeight: 1.7, color: tc.textDesc, margin: '0 0 8px', fontWeight: 500 }}>{userDesc}</p>
                      </>
                    )}
                    {aiDesc && (
                      <>
                        {userDesc && <div style={{ height: 1, background: tc.divider, marginBottom: 8 }} />}
                        <div style={{ display: 'block', fontSize: 7, fontWeight: 700, color: tc.primaryLabel, letterSpacing: '0.12em', marginBottom: 3, lineHeight: 1.3 }}>AI 品鑑</div>
                        <p style={{ display: 'block', fontSize: 10.5, lineHeight: 1.7, color: tc.primaryDesc, margin: 0, fontWeight: 500 }}>{aiDesc}</p>
                      </>
                    )}
                  </>
                ) : (
                  <p style={{ display: 'block', fontSize: 10.5, lineHeight: 1.7, color: descMode === 'ai' ? tc.primaryDesc : tc.textDesc, margin: 0, fontWeight: 500 }}>
                    {descMode === 'ai' ? aiDesc : userDesc}
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: `${hasDesc ? 6 : 0}px 18px 15px` }}>
              {!hasDesc && <div style={{ height: 1, background: tc.divider, marginBottom: 9 }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                <div>
                  <div style={{ fontSize: 8, color: tc.textMuted, letterSpacing: '0.1em', marginBottom: 1 }}>品飲者</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: tc.textSoft }}>{authorProfile?.username || note.username || '酒友'}</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 8, color: tc.textMuted, letterSpacing: '0.1em', marginBottom: 1 }}>品飲日期</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: tc.textSoft }}>{new Date(note.tastingDate).toLocaleDateString('zh-TW')}</div>
                </div>
              </div>
              {(servingTemperatures.length > 0 || foodPairings.length > 0) && (
                <div style={{ marginBottom: 10, display: 'grid', gap: 8 }}>
                  {servingTemperatures.length > 0 && (
                    <div>
                      <div style={{ fontSize: 8, color: tc.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>適飲溫度</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {servingTemperatures.map((temperature, index) => (
                          <span
                            key={`${temperature}-${index}`}
                            style={{
                              display: 'inline-block',
                              fontSize: 9,
                              fontWeight: 700,
                              lineHeight: 1.3,
                              color: isDark ? 'rgba(255,244,230,0.9)' : 'rgba(120,53,15,0.92)',
                              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(120,53,15,0.08)',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(120,53,15,0.14)'}`,
                              padding: '3px 8px',
                              borderRadius: 999,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {temperature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {foodPairings.length > 0 && (
                    <div>
                      <div style={{ fontSize: 8, color: tc.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>餐搭建議</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {foodPairings.map((pairing, index) => {
                          const isPairingMatch = pairing.pairing === 'yes';
                          return (
                            <span
                              key={`${pairing.food}-${index}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 9,
                                fontWeight: 700,
                                lineHeight: 1.3,
                                color: isPairingMatch
                                  ? (isDark ? 'rgba(220,252,231,0.92)' : 'rgba(22,101,52,0.9)')
                                  : (isDark ? 'rgba(254,226,226,0.92)' : 'rgba(153,27,27,0.9)'),
                                background: isPairingMatch
                                  ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.1)')
                                  : (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)'),
                                border: `1px solid ${isPairingMatch
                                  ? (isDark ? 'rgba(34,197,94,0.24)' : 'rgba(34,197,94,0.28)')
                                  : (isDark ? 'rgba(239,68,68,0.24)' : 'rgba(239,68,68,0.26)')}`,
                                padding: '3px 8px',
                                borderRadius: 999,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span>{isPairingMatch ? '搭' : '不搭'}</span>
                              <span style={{ opacity: 0.92 }}>{pairing.food}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {styleTags.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8, color: tc.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>風格標籤</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {styleTags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        style={{
                          display: 'inline-block',
                          fontSize: 9,
                          fontWeight: 700,
                          lineHeight: 1.3,
                          color: isDark ? 'rgba(255,230,205,0.88)' : 'rgba(124,45,18,0.9)',
                          background: isDark ? rgba(primaryColor, 0.14) : rgba(primaryColor, 0.1),
                          border: `1px solid ${isDark ? rgba(primaryColor, 0.3) : rgba(primaryColor, 0.35)}`,
                          padding: '3px 8px',
                          borderRadius: 999,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ height: 1, flex: 1, background: tc.divider }} />
                <span style={{ fontSize: 9, color: tc.primarySite, letterSpacing: '0.22em', fontWeight: 700 }}>SAKEPATH.COM</span>
                <div style={{ height: 1, flex: 1, background: tc.divider }} />
              </div>
            </div>
          </div>

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
              variant="ghost"
              style={{ color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.08)' }}
              className="flex-1 rounded-full border h-11 text-xs font-bold uppercase tracking-widest hover:bg-white/15"
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
    </>
  );
}
