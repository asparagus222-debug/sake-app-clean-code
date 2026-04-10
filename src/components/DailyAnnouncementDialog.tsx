'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFirebase } from '@/firebase/provider';

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DailyAnnouncementDialog() {
  const { user, isUserLoading } = useFirebase();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const storageKey = useMemo(() => {
    if (!user) return null;
    return `daily-announcement:${user.uid}:${getTodayKey()}`;
  }, [user]);

  useEffect(() => {
    if (isUserLoading || !storageKey || pathname !== '/') return;

    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [isUserLoading, pathname, storageKey]);

  useEffect(() => {
    if (pathname !== '/' && open) {
      setOpen(false);
    }
  }, [open, pathname]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && storageKey) {
      try {
        localStorage.setItem(storageKey, 'seen');
      } catch {
        // ignore storage errors
      }
    }
  };

  if (!user || isUserLoading || pathname !== '/') return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="dark-glass border border-white/10 rounded-[2rem] p-6 sm:p-8 max-w-md">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex items-center gap-2 text-primary">
            <Info className="w-5 h-5" />
            <DialogTitle className="font-headline text-xl gold-glow tracking-widest uppercase">
              使用公告
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-7 text-foreground/80">
            本 app 為個人興趣製作，主要希望可以分享跟推廣日本酒；目前尚在建構中，歡迎大家暴力測試，如有任何問題可以至個人資料頁面下方的問題回報區反應。
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}