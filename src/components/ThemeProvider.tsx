
'use client';

import React, { useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, firestore } = useFirebase();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: profile } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    const theme = profile?.themeSettings;
    const root = document.documentElement;

    // 清除舊樣式
    root.removeAttribute('data-theme');
    root.style.removeProperty('--background');
    root.style.removeProperty('--primary');
    root.style.removeProperty('--foreground');
    root.style.removeProperty('--card');
    root.style.removeProperty('--card-foreground');
    root.style.removeProperty('--popover-foreground');
    root.style.removeProperty('--secondary-foreground');
    root.style.removeProperty('--muted-foreground');
    root.style.removeProperty('--border');
    root.style.removeProperty('--glass-color');
    root.style.removeProperty('--glass-border');
    root.style.removeProperty('--texture-color');
    root.style.removeProperty('--font-size-base');

    // 調校字體映射，移除 xl 並使縮放更為溫和
    const fontSizeMap = { 
      xs: '13px', 
      sm: '14.5px', 
      base: '16px', 
      lg: '17.5px' 
    };
    
    // 降級校驗：如果舊資料中存在 'xl'，則回退到 'lg'
    const currentSize = (theme?.fontSize === 'xl' ? 'lg' : (theme?.fontSize || 'base')) as keyof typeof fontSizeMap;
    root.style.setProperty('--font-size-base', fontSizeMap[currentSize]);

    if (!theme || theme.mode === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (theme.mode === 'light') {
      root.setAttribute('data-theme', 'light');
    } else if (theme.mode === 'custom') {
      root.setAttribute('data-theme', 'custom');
      
      const hexToHsl = (hex: string) => {
        const cleanHex = hex.replace('#', '');
        let r = parseInt(cleanHex.slice(0, 2), 16), g = parseInt(cleanHex.slice(2, 4), 16), b = parseInt(cleanHex.slice(4, 6), 16);
        const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
        const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
            case gNorm: h = (bNorm - rNorm) / d + 2; break;
            case bNorm: h = (rNorm - gNorm) / d + 4; break;
          }
          h /= 6;
        }
        return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
      };

      const bgHsl = hexToHsl(theme.customBg || '#0a0a0c');
      const primaryHsl = hexToHsl(theme.customPrimary || '#f97316');
      const isBgDark = (parseInt((theme.customBg || '#000000').slice(1,3), 16) * 299 + parseInt((theme.customBg || '#000000').slice(3,5), 16) * 587 + parseInt((theme.customBg || '#000000').slice(5,7), 16) * 114) / 1000 < 128;

      root.style.setProperty('--background', bgHsl);
      root.style.setProperty('--primary', primaryHsl);
      root.style.setProperty('--foreground', isBgDark ? '0 0% 98%' : '240 10% 4%');
      root.style.setProperty('--card', isBgDark ? '240 10% 7%' : '0 0% 100%');
      root.style.setProperty('--card-foreground', isBgDark ? '0 0% 98%' : '240 10% 4%');
      root.style.setProperty('--popover-foreground', isBgDark ? '0 0% 98%' : '240 10% 4%');
      root.style.setProperty('--secondary-foreground', isBgDark ? '0 0% 98%' : '240 10% 4%');
      root.style.setProperty('--muted-foreground', isBgDark ? '240 5% 65%' : '240 5% 45%');
      root.style.setProperty('--border', isBgDark ? '240 5% 15%' : '240 5% 85%');
      root.style.setProperty('--glass-color', isBgDark ? '20, 20, 25' : '255, 255, 255');
      root.style.setProperty('--glass-border', isBgDark ? '255, 255, 255' : '0, 0, 0');
      root.style.setProperty('--texture-color', isBgDark ? '255, 255, 255' : '0, 0, 0');
    }
  }, [profile?.themeSettings]);

  return <>{children}</>;
}
