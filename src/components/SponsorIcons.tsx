import React from 'react';

/** 蛇目杯 — 俯視圖，傳統藏青配色 */
export function JanomeCupIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#f8f4ec" stroke="#c4b89a" strokeWidth="0.9"/>
      <circle cx="12" cy="12" r="9.5" fill="#fffdf8"/>
      <circle cx="12" cy="12" r="6.8" fill="none" stroke="#1e3a7a" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="3.8" fill="none" stroke="#1e3a7a" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="1.2" fill="#1e3a7a"/>
    </svg>
  );
}

/**
 * 德利（一合瓶）— 細長瓶身、白標籤、直排「日本酒」
 * viewBox 20×28 讓瓶身比例更高更瘦
 */
export function SakeBottleIcon({ size = 14 }: { size?: number }) {
  const w = size;
  const h = Math.round(size * 1.4);
  return (
    <svg width={w} height={h} viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cap */}
      <rect x="8" y="1" width="4" height="3" rx="1" fill="#b0b8c8"/>
      <rect x="8.5" y="1.2" width="3" height="2.6" rx="0.7" fill="#d0d8e8"/>
      {/* Neck */}
      <rect x="8.8" y="4" width="2.4" height="4" fill="#7a3a10"/>
      {/* Shoulder curve */}
      <path d="M8.8 8 C8.8 8 6.5 9.2 6.5 11 L6.5 24 C6.5 25.1 7.4 26 8.5 26 L11.5 26 C12.6 26 13.5 25.1 13.5 24 L13.5 11 C13.5 9.2 11.2 8 11.2 8 Z" fill="#8B4010"/>
      {/* Highlight on body */}
      <path d="M8 11.5 C8 11.5 7.4 13.5 7.4 17" stroke="#c27a40" strokeWidth="0.6" strokeLinecap="round" opacity="0.5"/>
      {/* White label */}
      <rect x="7.2" y="12.5" width="5.6" height="10" rx="0.5" fill="#faf6ee" stroke="#d8ccb0" strokeWidth="0.35"/>
      {/* 日 — top */}
      <text x="10" y="16.5" textAnchor="middle" fontSize="3.4" fontWeight="bold" fill="#1a1a1a" fontFamily="serif">日</text>
      {/* 本 — middle */}
      <text x="10" y="19.8" textAnchor="middle" fontSize="3.4" fontWeight="bold" fill="#1a1a1a" fontFamily="serif">本</text>
      {/* 酒 — bottom */}
      <text x="10" y="23.1" textAnchor="middle" fontSize="3.4" fontWeight="bold" fill="#1a1a1a" fontFamily="serif">酒</text>
    </svg>
  );
}

/** 菰樽（Kodaru）— $3000 隱藏徽章，可傳入配色 */
export interface KodaruColors {
  ropeLight: string;
  ropeDark:  string;
  barrelTop: string;
  barrelMid: string;
  barrelLow: string;
  labelBg:   string;
  labelBorder: string;
  textTop:   string;
  textMain:  string;
  textAccent: string;
}

export const KODARU_GOLD_COLORS: KodaruColors = {
  ropeLight: '#f0dfa0', ropeDark: '#7a5a10',
  barrelTop: '#fffae8', barrelMid: '#f5e8b0', barrelLow: '#e0cc80',
  labelBg: '#fffdf5', labelBorder: '#a07820',
  textTop: '#a07820', textMain: '#3a2800', textAccent: '#c89a00',
};

export const KODARU_VARIANTS: { id: string; name: string; colors: KodaruColors }[] = [
  {
    id: 'classic',
    name: '傳統黑白',
    colors: {
      ropeLight: '#e8e0d0', ropeDark: '#2a2018',
      barrelTop: '#f5f0e8', barrelMid: '#e8dfc8', barrelLow: '#d4c8a8',
      labelBg: '#faf7f0', labelBorder: '#8B1a1a',
      textTop: '#8B1a1a', textMain: '#111', textAccent: '#8B1a1a',
    },
  },
  {
    id: 'indigo',
    name: '藏青×白',
    colors: {
      ropeLight: '#dce4f0', ropeDark: '#1e3a7a',
      barrelTop: '#f0f4fc', barrelMid: '#dce8f8', barrelLow: '#c4d4f0',
      labelBg: '#f8faff', labelBorder: '#1e3a7a',
      textTop: '#1e3a7a', textMain: '#0d1f50', textAccent: '#1e3a7a',
    },
  },
  {
    id: 'gold',
    name: '金彩',
    colors: {
      ropeLight: '#f0dfa0', ropeDark: '#7a5a10',
      barrelTop: '#fffae8', barrelMid: '#f5e8b0', barrelLow: '#e0cc80',
      labelBg: '#fffdf5', labelBorder: '#a07820',
      textTop: '#a07820', textMain: '#3a2800', textAccent: '#c89a00',
    },
  },
  {
    id: 'night',
    name: '夜色（深色主題）',
    colors: {
      ropeLight: '#2a3a50', ropeDark: '#0a1020',
      barrelTop: '#1a2838', barrelMid: '#152030', barrelLow: '#101828',
      labelBg: '#1e2e42', labelBorder: '#38bdf8',
      textTop: '#38bdf8', textMain: '#e0f0ff', textAccent: '#7dd3fc',
    },
  },
  {
    id: 'crimson',
    name: '朱紅',
    colors: {
      ropeLight: '#f0c8b0', ropeDark: '#6a1010',
      barrelTop: '#fff0ec', barrelMid: '#f8d8cc', barrelLow: '#e8b8a8',
      labelBg: '#fff8f5', labelBorder: '#b83030',
      textTop: '#b83030', textMain: '#3a0808', textAccent: '#e04040',
    },
  },
  {
    id: 'cedar',
    name: '杉木×墨',
    colors: {
      ropeLight: '#d8c8a8', ropeDark: '#3a2810',
      barrelTop: '#f0e8d8', barrelMid: '#e0d0b0', barrelLow: '#c8b888',
      labelBg: '#f8f4ec', labelBorder: '#5a3a18',
      textTop: '#5a3a18', textMain: '#1a0e00', textAccent: '#8B5a28',
    },
  },
];

export function KodaruIcon({ size = 32, colors }: { size?: number; colors: KodaruColors }) {
  const { ropeLight, ropeDark, barrelTop, barrelMid, barrelLow, labelBg, labelBorder, textTop, textMain, textAccent } = colors;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg-${ropeLight}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={barrelTop}/>
          <stop offset="50%" stopColor={barrelMid}/>
          <stop offset="100%" stopColor={barrelLow}/>
        </linearGradient>
      </defs>

      {/* Barrel body ellipse shape */}
      <path d="M10 14 Q8 24 10 34 Q18 40 24 40 Q30 40 38 34 Q40 24 38 14 Q30 8 24 8 Q18 8 10 14 Z"
        fill={`url(#bg-${ropeLight})`} stroke={ropeDark} strokeWidth="0.8"/>

      {/* Horizontal barrel hoops */}
      <path d="M11 17 Q24 11 37 17" stroke={ropeDark} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d="M10 24 Q24 20 38 24" stroke={ropeDark} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d="M11 31 Q24 37 37 31" stroke={ropeDark} strokeWidth="1.4" fill="none" strokeLinecap="round"/>

      {/* Rope wrapping — top ring (circles along ellipse) */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const rx = 14.5, ry = 4.2;
        const cx = 24 + rx * Math.cos(rad);
        const cy = 10.5 + ry * Math.sin(rad);
        return <circle key={`rt${i}`} cx={cx} cy={cy} r="1.5" fill={i % 2 === 0 ? ropeLight : ropeDark}/>;
      })}
      {/* Rope wrapping — bottom ring */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const rx = 14.5, ry = 4.2;
        const cx = 24 + rx * Math.cos(rad);
        const cy = 37.5 + ry * Math.sin(rad);
        return <circle key={`rb${i}`} cx={cx} cy={cy} r="1.5" fill={i % 2 === 0 ? ropeLight : ropeDark}/>;
      })}

      {/* Label background */}
      <rect x="13" y="16" width="22" height="18" rx="1.5"
        fill={labelBg} stroke={labelBorder} strokeWidth="1"/>
      {/* Label top band */}
      <rect x="13" y="16" width="22" height="5" rx="1.5"
        fill={labelBorder} opacity="0.15"/>
      {/* Top label text: 登錄 商標 */}
      <text x="24" y="20.2" textAnchor="middle" fontSize="3" fontWeight="bold"
        fill={textTop} fontFamily="serif" letterSpacing="2">登錄  商標</text>
      {/* 日 */}
      <text x="24" y="26.5" textAnchor="middle" fontSize="7" fontWeight="bold"
        fill={textMain} fontFamily="serif">日</text>
      {/* 本酒 */}
      <text x="24" y="33" textAnchor="middle" fontSize="6.5" fontWeight="bold"
        fill={textMain} fontFamily="serif">本酒</text>
      {/* Accent dots on label sides */}
      {[19,21.5,24,26.5,29].map((y, i) => (
        <circle key={`dl${i}`} cx="14.5" cy={y} r="0.8" fill={textAccent} opacity="0.7"/>
      ))}
      {[19,21.5,24,26.5,29].map((y, i) => (
        <circle key={`dr${i}`} cx="33.5" cy={y} r="0.8" fill={textAccent} opacity="0.7"/>
      ))}
    </svg>
  );
}
