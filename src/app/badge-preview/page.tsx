"use client";
import React from 'react';

const VARIANTS = [
  {
    id: 'indigo',
    name: '傳統藏青',
    desc: '白釉 × 傳統藏青 — 最正統',
    bg: '#f8f4ec', rim: '#c4b89a', interior: '#fffdf8', rings: '#1e3a7a', dot: '#1e3a7a',
  },
  {
    id: 'cobalt',
    name: '鈷藍',
    desc: '白釉 × 鈷藍 — 清爽現代',
    bg: '#eef2ff', rim: '#a0b4d8', interior: '#f8faff', rings: '#2563eb', dot: '#1d4ed8',
  },
  {
    id: 'gold',
    name: '金彩',
    desc: '奶白 × 燒金 — 高級感',
    bg: '#faf7ef', rim: '#c8a84a', interior: '#fffdf5', rings: '#a07820', dot: '#a07820',
  },
  {
    id: 'night',
    name: '夜色（深色主題）',
    desc: '炭黑 × 霓虹青 — 配合 app 深色介面',
    bg: '#1a2238', rim: '#2e4070', interior: '#1e2a48', rings: '#38bdf8', dot: '#7dd3fc',
  },
  {
    id: 'celadon',
    name: '青瓷',
    desc: '青瓷綠釉 × 深墨綠',
    bg: '#e0f0e8', rim: '#5a9e7e', interior: '#eef8f2', rings: '#1a5c40', dot: '#1a5c40',
  },
  {
    id: 'rose',
    name: '薄紅',
    desc: '粉白釉 × 朱紅 — 暖色系',
    bg: '#fdf0f0', rim: '#e8a0a0', interior: '#fff8f8', rings: '#b83030', dot: '#b83030',
  },
];

function TopViewIcon({ bg, rim, interior, rings, dot, size = 64 }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer cup rim */}
      <circle cx="12" cy="12" r="11" fill={bg} stroke={rim} strokeWidth="0.9"/>
      {/* Inner glaze surface */}
      <circle cx="12" cy="12" r="9.5" fill={interior}/>
      {/* Janome outer ring */}
      <circle cx="12" cy="12" r="6.8" fill="none" stroke={rings} strokeWidth="1.5"/>
      {/* Janome inner ring */}
      <circle cx="12" cy="12" r="3.8" fill="none" stroke={rings} strokeWidth="1.5"/>
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.2" fill={dot}/>
    </svg>
  );
}

function PerspectiveIcon({ bg, rim, interior, rings, dot, size = 64 }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cup body fill */}
      <path d="M4 8 L5.5 20.5 Q12 22.5 18.5 20.5 L20 8 Z" fill={bg}/>
      {/* Cup sides */}
      <line x1="4" y1="8" x2="5.5" y2="20.5" stroke={rim} strokeWidth="0.7"/>
      <line x1="20" y1="8" x2="18.5" y2="20.5" stroke={rim} strokeWidth="0.7"/>
      {/* Foot ring */}
      <ellipse cx="12" cy="21" rx="6.5" ry="1.8" fill={bg} stroke={rim} strokeWidth="0.7"/>
      {/* Top opening (rim ellipse — drawn last to overlap sides) */}
      <ellipse cx="12" cy="8" rx="8.5" ry="2.8" fill={interior} stroke={rim} strokeWidth="0.9"/>
      {/* Janome outer ring (ellipse perspective) */}
      <ellipse cx="12" cy="8" rx="6.2" ry="2" fill="none" stroke={rings} strokeWidth="1.3"/>
      {/* Janome inner ring */}
      <ellipse cx="12" cy="8" rx="3.2" ry="1.1" fill="none" stroke={rings} strokeWidth="1.3"/>
      {/* Center dot */}
      <ellipse cx="12" cy="8" rx="0.9" ry="0.35" fill={dot}/>
    </svg>
  );
}

const SIZES = [14, 20, 32, 64];

export default function BadgePreviewPage() {
  return (
    <div className="min-h-screen bg-[#0a0c14] p-8 pb-24">
      <h1 className="text-white font-bold text-lg uppercase tracking-widest mb-1">蛇目杯 Badge 預覽</h1>
      <p className="text-white/40 text-xs mb-10">上行：俯視圖　下行：3/4 透視圖　尺寸：14 / 20 / 32 / 64 px</p>

      <div className="grid gap-8">
        {VARIANTS.map(v => (
          <div key={v.id} className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="mb-4">
              <p className="text-white font-bold text-sm">{v.name}</p>
              <p className="text-white/40 text-xs">{v.desc}</p>
            </div>

            {/* Top-view row */}
            <div className="flex items-end gap-4 mb-3">
              <span className="text-white/30 text-[9px] uppercase w-16">俯視</span>
              {SIZES.map(s => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <TopViewIcon {...v} size={s}/>
                  <span className="text-white/20 text-[8px]">{s}px</span>
                </div>
              ))}
            </div>

            {/* Perspective row */}
            <div className="flex items-end gap-4">
              <span className="text-white/30 text-[9px] uppercase w-16">透視</span>
              {SIZES.map(s => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <PerspectiveIcon {...v} size={s}/>
                  <span className="text-white/20 text-[8px]">{s}px</span>
                </div>
              ))}
            </div>

            {/* Inline-text context */}
            <div className="mt-4 flex items-center gap-3">
              <span className="text-white/30 text-[9px] uppercase w-16">脈絡</span>
              <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1.5">
                <span className="text-white text-sm font-bold">@蘆笱</span>
                <TopViewIcon {...v} size={16}/>
                <span className="text-white/30 text-[9px] ml-1">(俯視/14px)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1.5">
                <span className="text-white text-sm font-bold">@蘆笱</span>
                <PerspectiveIcon {...v} size={16}/>
                <span className="text-white/30 text-[9px] ml-1">(透視/14px)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
