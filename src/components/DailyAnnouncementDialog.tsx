'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const router = useRouter();
  const { user, isUserLoading } = useFirebase();
  const [open, setOpen] = useState(false);

  const storageKey = useMemo(() => {
    if (!user) return null;
    return `daily-announcement:${user.uid}:${getTodayKey()}`;
  }, [user]);

  useEffect(() => {
    if (isUserLoading || !storageKey) return;

    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [isUserLoading, storageKey]);

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

  if (!user || isUserLoading) return null;

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
        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            onClick={() => {
              handleOpenChange(false);
              router.push('/profile');
            }}
          >
            <MessageSquare className="w-4 h-4 mr-2" /> 前往問題回報
          </Button>
          <Button
            type="button"
            className="w-full rounded-full"
            onClick={() => handleOpenChange(false)}
          >
            我知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}