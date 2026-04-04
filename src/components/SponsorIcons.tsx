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

/** 德利（Tokkuri）— $500 贊助成就，參考傳統陶瓷瓶樣式 */
export interface TokkuriColors {
  body:      string; // 瓶身主色
  bodyDark:  string; // 陰影 / 輪廓
  band:      string; // 橫紋主色
  bandLight: string; // 橫紋光澤
  rim:       string; // 瓶口
}

export const TOKKURI_CLASSIC_COLORS: TokkuriColors = {
  body: '#e4e2da', bodyDark: '#a8a59a',
  band: '#1e3a7a', bandLight: '#4a6aaa',
  rim:  '#ccc9bf',
};

export const TOKKURI_VARIANTS: { id: string; name: string; colors: TokkuriColors }[] = [
  {
    id: 'classic',
    name: '白藍（傳統）',
    colors: { body: '#e4e2da', bodyDark: '#a8a59a', band: '#1e3a7a', bandLight: '#4a6aaa', rim: '#ccc9bf' },
  },
  {
    id: 'celadon',
    name: '青瓷',
    colors: { body: '#b8cebe', bodyDark: '#6a9070', band: '#1e4030', bandLight: '#3a7055', rim: '#98b8a0' },
  },
  {
    id: 'black-gold',
    name: '黑金',
    colors: { body: '#282828', bodyDark: '#0e0e0e', band: '#c89a00', bandLight: '#e8c840', rim: '#3a3830' },
  },
  {
    id: 'red-clay',
    name: '朱泥',
    colors: { body: '#c06840', bodyDark: '#7a3818', band: '#2e1008', bandLight: '#5a2810', rim: '#d07850' },
  },
  {
    id: 'ink-navy',
    name: '墨藍',
    colors: { body: '#1e2c48', bodyDark: '#0c1420', band: '#c0b898', bandLight: '#e0d8b0', rim: '#2a3a5a' },
  },
  {
    id: 'silver',
    name: '灰銀',
    colors: { body: '#d0d0c8', bodyDark: '#959590', band: '#686860', bandLight: '#a8a8a0', rim: '#b8b8b0' },
  },
];

/**
 * 德利 SVG — 圓肚瓶身＋橫紋條帶，參考傳統日式德利造型
 * viewBox 20×30，讓瓶身比例接近參考圖
 */
export function TokkuriIcon({ size = 14, colors = TOKKURI_CLASSIC_COLORS }: { size?: number; colors?: TokkuriColors }) {
  const h = Math.round(size * 1.5);
  return (
    <svg width={size} height={h} viewBox="0 0 20 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bottle body — wide ovoid belly with narrow neck */}
      <path
        d="M8.5,1.5 L11.5,1.5 L11.5,7.5 C14,8.5 15,10.5 15,14 C15,21 14.5,24 13.5,26 C12.5,27.8 11.5,28.5 10,28.5 C8.5,28.5 7.5,27.8 6.5,26 C5.5,24 5,21 5,14 C5,10.5 6,8.5 8.5,7.5 Z"
        fill={colors.body} stroke={colors.bodyDark} strokeWidth="0.6"
      />
      {/* Right-side depth shadow */}
      <path
        d="M11.5,7.5 C14,8.5 15,10.5 15,14 C15,21 14.5,24 13.5,26 C12.5,27.8 11.5,28.5 10,28.5"
        stroke={colors.bodyDark} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.18"
      />
      {/* Left highlight */}
      <path
        d="M8.8,9.5 C7.5,11 7,14 7.2,18"
        stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.45" fill="none"
      />
      {/* Upper stripe */}
      <path
        d="M5.3,19 C7.5,18.3 12.5,18.3 14.7,19"
        stroke={colors.band} strokeWidth="2.2" fill="none" strokeLinecap="round"
      />
      {/* Lower stripe */}
      <path
        d="M5.4,21.5 C7.5,20.8 12.5,20.8 14.6,21.5"
        stroke={colors.band} strokeWidth="2.2" fill="none" strokeLinecap="round"
      />
      {/* Stripe sheen */}
      <path
        d="M5.3,19 C6.5,18.5 9,18.3 10.8,18.45"
        stroke={colors.bandLight} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.65"
      />
      {/* Mouth / lip */}
      <ellipse cx="10" cy="1.5" rx="2" ry="0.9" fill={colors.rim} stroke={colors.bodyDark} strokeWidth="0.5"/>
      <ellipse cx="10" cy="1.3" rx="1" ry="0.45" fill={colors.bodyDark} opacity="0.35"/>
    </svg>
  );
}

/** 四合瓶（Yongo）— $1000 贊助成就，參數化配色 */
export interface YongoColors {
  body:      string; // 瓶身主色
  shadow:    string; // 右側陰影
  highlight: string; // 左側高光
  cap:       string; // 瓶蓋
  capSheen:  string; // 瓶蓋光澤
  label:     string; // 標籤底色
  labelEdge: string; // 標籤邊框
  text:      string; // 標籤文字
}

export const YONGO_CLASSIC_COLORS: YongoColors = {
  body: '#8B4010', shadow: '#5a2a08', highlight: '#c27a40',
  cap: '#b0b8c8', capSheen: '#d0d8e8',
  label: '#faf6ee', labelEdge: '#d8ccb0', text: '#1a1a1a',
};

export const YONGO_VARIANTS: { id: string; name: string; colors: YongoColors }[] = [
  {
    id: 'classic',
    name: '傳統褐',
    colors: { body: '#8B4010', shadow: '#5a2a08', highlight: '#c27a40', cap: '#b0b8c8', capSheen: '#d0d8e8', label: '#faf6ee', labelEdge: '#d8ccb0', text: '#1a1a1a' },
  },
  {
    id: 'black-gold',
    name: '黑金',
    colors: { body: '#1a1a1a', shadow: '#080808', highlight: '#505050', cap: '#b88a00', capSheen: '#e0c840', label: '#1e1a10', labelEdge: '#c89a00', text: '#e8d080' },
  },
  {
    id: 'navy',
    name: '藏青',
    colors: { body: '#1e3060', shadow: '#0c1838', highlight: '#4060a0', cap: '#a8b0c8', capSheen: '#c8d0e8', label: '#f0f4ff', labelEdge: '#8090c0', text: '#0c1838' },
  },
  {
    id: 'snow',
    name: '雪白',
    colors: { body: '#e8e8e4', shadow: '#b0b0a8', highlight: '#ffffff', cap: '#989898', capSheen: '#c0c0c0', label: '#f8f8f4', labelEdge: '#c8c8c0', text: '#303028' },
  },
  {
    id: 'crimson',
    name: '暗紅',
    colors: { body: '#6a1020', shadow: '#380810', highlight: '#b04060', cap: '#909090', capSheen: '#b8b8b8', label: '#fff5f5', labelEdge: '#e09090', text: '#380810' },
  },
  {
    id: 'cedar',
    name: '杉木',
    colors: { body: '#a06030', shadow: '#684020', highlight: '#d09060', cap: '#d0b888', capSheen: '#e8d0a8', label: '#f8f0e0', labelEdge: '#c0a868', text: '#302010' },
  },
];

/**
 * 四合瓶 SVG — 角形瓶，縮小瓶蓋，白標籤直排「日本酒」
 */
export function SakeBottleIcon({ size = 14, colors = YONGO_CLASSIC_COLORS }: { size?: number; colors?: YongoColors }) {
  const w = size;
  const h = Math.round(size * 1.4);
  return (
    <svg width={w} height={h} viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cap — small */}
      <rect x="8.8" y="1.5" width="2.4" height="1.8" rx="0.8" fill={colors.cap}/>
      <rect x="9.2" y="1.8" width="1.6" height="1.2" rx="0.5" fill={colors.capSheen}/>
      {/* Neck */}
      <rect x="9" y="3.3" width="2" height="4.2" fill={colors.body}/>
      <rect x="10.2" y="3.3" width="0.8" height="4.2" fill={colors.shadow} opacity="0.35"/>
      {/* Shoulder + body */}
      <path d="M9 7.5 C9 7.5 6.5 9 6.5 11 L6.5 24 C6.5 25.1 7.4 26 8.5 26 L11.5 26 C12.6 26 13.5 25.1 13.5 24 L13.5 11 C13.5 9 11 7.5 11 7.5 Z" fill={colors.body}/>
      {/* Right-side shadow */}
      <path d="M11 7.5 C13 9 13.5 11 13.5 14 L13.5 24 C13.5 25.1 12.6 26 11.5 26" stroke={colors.shadow} strokeWidth="3.5" fill="none" opacity="0.22" strokeLinecap="round"/>
      {/* Left highlight */}
      <path d="M8 11 C8 11 7.4 13 7.4 17" stroke={colors.highlight} strokeWidth="0.6" strokeLinecap="round" opacity="0.5"/>
      {/* Label */}
      <rect x="7.2" y="12.5" width="5.6" height="10" rx="0.5" fill={colors.label} stroke={colors.labelEdge} strokeWidth="0.35"/>
      <text x="10" y="16.5" textAnchor="middle" fontSize="3.4" fontWeight="bold" fill={colors.text} fontFamily="serif">日</text>
      <text x="10" y="19.8" textAnchor="middle" fontSize="3.4" fontWeight="bold" fill={colors.text} fontFamily="serif">本</text>
      <text x="10" y="23.1" textAnchor="middle" fontSize="3.4" fontWeight="bold" fill={colors.text} fontFamily="serif">酒</text>
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
