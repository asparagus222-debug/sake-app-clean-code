import React from 'react';

/** 蛇目杯 — 俯視圖，傳統藏青配色 */
export function JanomeCupIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer cup rim */}
      <circle cx="12" cy="12" r="11" fill="#f8f4ec" stroke="#c4b89a" strokeWidth="0.9"/>
      {/* Inner glaze surface */}
      <circle cx="12" cy="12" r="9.5" fill="#fffdf8"/>
      {/* Janome outer ring */}
      <circle cx="12" cy="12" r="6.8" fill="none" stroke="#1e3a7a" strokeWidth="1.5"/>
      {/* Janome inner ring */}
      <circle cx="12" cy="12" r="3.8" fill="none" stroke="#1e3a7a" strokeWidth="1.5"/>
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.2" fill="#1e3a7a"/>
    </svg>
  );
}

/** 日本酒瓶 SVG — 茶褐色瓶身＋白標籤＋「日本酒」文字 */
export function SakeBottleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bottle body */}
      <path
        d="M9 8.5 C9 8.5 7 9.5 7 13 L7 20 C7 20.8 7.7 21.5 8.5 21.5 L15.5 21.5 C16.3 21.5 17 20.8 17 20 L17 13 C17 9.5 15 8.5 15 8.5 L9 8.5 Z"
        fill="#8B4513"
      />
      {/* Bottle neck */}
      <path
        d="M10.5 4.5 L10.5 8.5 L13.5 8.5 L13.5 4.5 Z"
        fill="#8B4513"
      />
      {/* Bottle cap */}
      <rect x="10" y="2.5" width="4" height="2.5" rx="0.8" fill="#d0d0d0"/>
      {/* White label */}
      <rect x="8" y="12" width="8" height="7" rx="0.5" fill="#f8f5ec" stroke="#ddd5be" strokeWidth="0.4"/>
      {/* Label: 日 */}
      <text x="12" y="16.2" textAnchor="middle" fontSize="3.2" fontWeight="bold" fill="#1a1a1a" fontFamily="serif">日</text>
      {/* Label: 本酒 */}
      <text x="12" y="18.8" textAnchor="middle" fontSize="2.6" fontWeight="bold" fill="#1a1a1a" fontFamily="serif">本酒</text>
      {/* Subtle highlight on bottle */}
      <path
        d="M10.2 11 C10.2 11 9.2 12.5 9.2 15"
        stroke="#c27a40" strokeWidth="0.7" strokeLinecap="round" opacity="0.6"
      />
    </svg>
  );
}
