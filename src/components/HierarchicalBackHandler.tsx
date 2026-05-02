'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getHierarchicalParentPath } from '@/lib/nav-hierarchy';

type NavApiEvent = Event & {
  navigationType?: string;
  canIntercept?: boolean;
  destination: { url: string; index?: number };
  intercept: (opts: { handler: () => Promise<void> }) => void;
};

type NavigationWithEvents = EventTarget & {
  currentEntry?: { index?: number };
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

function norm(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const t = pathname.replace(/\/+$/, '');
  return t === '' ? '/' : t;
}

/**
 * 在支援 Navigation API 的瀏覽器（多數 Chromium、最新 Firefox）：
 * 系統／手勢「返回」時，若與網址的邏輯上一層不一致，改為導向上一層。
 * Safari／不支援時僅退回一般 history 行為；須搭配各頁面使用 useLayerBackNavigation 的頂部返回鈕。
 */
export function HierarchicalBackHandler() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const w = typeof window !== 'undefined' ? (window as Window & { navigation?: NavigationWithEvents }) : undefined;
    const nav = w?.navigation;
    if (!nav?.addEventListener) return;

    const onNavigate = (event: Event) => {
      const ev = event as NavApiEvent;

      const fromPath = pathnameRef.current || '/';
      if (norm(fromPath) === '/') return;

      const parentTarget = norm(getHierarchicalParentPath(fromPath));
      const fromNorm = norm(fromPath);
      if (parentTarget === fromNorm) return;

      if (ev.navigationType !== 'traverse') return;

      try {
        const destPathname = new URL(ev.destination.url).pathname;
        const destNorm = norm(destPathname);
        if (!ev.canIntercept) return;
        if (destNorm === parentTarget) return;

        const cur = nav.currentEntry;
        const curIndex =
          typeof cur?.index === 'number' ? cur.index : NaN;
        const destIndex =
          typeof ev.destination.index === 'number' ? ev.destination.index : NaN;

        const isBackward =
          !Number.isNaN(curIndex) &&
          !Number.isNaN(destIndex) &&
          destIndex < curIndex;

        if (!isBackward) return;

        ev.intercept({
          handler: () =>
            new Promise<void>((resolve) => {
              router.push(parentTarget);
              resolve();
            }),
        });
      } catch {
        /* ignore malformed destination */
      }
    };

    nav.addEventListener('navigate', onNavigate as EventListener);
    return () => nav.removeEventListener('navigate', onNavigate as EventListener);
  }, [router]);

  return null;
}
