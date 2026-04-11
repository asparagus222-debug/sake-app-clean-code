'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { doc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDoc, useMemoFirebase, useFirebase } from '@/firebase';

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DailyAnnouncementDialog() {
  const { user, isUserLoading, firestore } = useFirebase();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const announcementRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'meta', 'dailyAnnouncement');
  }, [firestore]);
  const { data: announcement, isLoading: isAnnouncementLoading } = useDoc<{
    title?: string;
    message?: string;
    enabled?: boolean;
    updatedAt?: string;
  }>(announcementRef);
  const announcementTitle = announcement?.title?.trim() || '使用公告';
  const announcementMessage = announcement?.message?.trim() || '';
  const isAnnouncementEnabled = announcement?.enabled !== false && announcementMessage.length > 0;
  const audienceKey = user?.uid || 'guest';

  const storageKey = useMemo(() => {
    if (!isAnnouncementEnabled) return null;
    return `daily-announcement:${audienceKey}:${getTodayKey()}:${announcement?.updatedAt || 'default'}`;
  }, [announcement?.updatedAt, audienceKey, isAnnouncementEnabled]);

  useEffect(() => {
    if (isUserLoading || isAnnouncementLoading || !storageKey || pathname !== '/') return;

    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [isAnnouncementLoading, isUserLoading, pathname, storageKey]);

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

  if (isUserLoading || isAnnouncementLoading || pathname !== '/' || !isAnnouncementEnabled) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="dark-glass border border-white/10 rounded-[2rem] p-6 sm:p-8 max-w-md">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex items-center gap-2 text-primary">
            <Info className="w-5 h-5" />
            <DialogTitle className="font-headline text-xl gold-glow tracking-widest uppercase">
              {announcementTitle}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-7 text-foreground/80">
            {announcementMessage}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}