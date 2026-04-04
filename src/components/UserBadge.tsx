
"use client"

import React, { useState } from 'react';
import { Medal, Trophy, Star } from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { JanomeCupIcon, SakeBottleIcon, TokkuriIcon, TOKKURI_CLASSIC_COLORS, KodaruIcon, KODARU_GOLD_COLORS } from '@/components/SponsorIcons';

interface UserBadgeProps {
  userId: string;
  className?: string;
  showText?: boolean;
}

export function UserBadge({ userId, className, showText = false }: UserBadgeProps) {
  const firestore = useFirestore();

  // 獲取該使用者的所有貼文以計算成就
  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return query(collection(firestore, 'sakeTastingNotes'), where('userId', '==', userId));
  }, [firestore, userId]);

  const { data: notes } = useCollection(notesQuery);
  const count = notes?.length || 0;

  // 獲取贊助累積金額
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);

  const { data: userProfile } = useDoc(userDocRef);
  const sponsorTotal: number = (userProfile?.sponsorTotal as number) || 0;
  const sponsorBadge =
    sponsorTotal >= 3000 ? 'kodaru' :
    sponsorTotal >= 1000 ? 'bottle' :
    sponsorTotal >= 500  ? 'sake' :
    sponsorTotal >= 200  ? 'cup' : null;

  let badgeData: { icon: typeof Medal; color: string; label: string; glow: boolean; sparkle: boolean } | null = null;

  if (count >= 50) {
    badgeData = { icon: Star, color: "text-[#ffd700]", label: "傳說級愛好者 (50+)", glow: true, sparkle: true };
  } else if (count >= 40) {
    badgeData = { icon: Trophy, color: "text-[#ffd700]", label: "大師級愛好者 (40+)", glow: true, sparkle: false };
  } else if (count >= 30) {
    badgeData = { icon: Medal, color: "text-[#ffd700]", label: "金牌品飲家 (30+)", glow: false, sparkle: false };
  } else if (count >= 20) {
    badgeData = { icon: Medal, color: "text-[#c0c0c0]", label: "銀牌品飲家 (20+)", glow: false, sparkle: false };
  } else if (count >= 10) {
    badgeData = { icon: Medal, color: "text-[#cd7f32]", label: "銅牌品飲家 (10+)", glow: false, sparkle: false };
  }

  if (!badgeData && !sponsorBadge) return null;

  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {badgeData && (() => {
        const Icon = badgeData.icon;
        return (
          <Tooltip open={openTooltip === 'activity'}>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center gap-1 cursor-pointer select-none"
                onPointerDown={() => setOpenTooltip('activity')}
                onPointerUp={() => setOpenTooltip(null)}
                onPointerLeave={() => setOpenTooltip(null)}
              >
                <Icon
                  className={cn(
                    "w-3.5 h-3.5",
                    badgeData.color,
                    badgeData.glow && "animate-badge-glow",
                    badgeData.sparkle && "animate-badge-sparkle"
                  )}
                />
                {showText && <span className="text-[9px] font-bold uppercase tracking-tighter opacity-70">{badgeData.label}</span>}
              </span>
            </TooltipTrigger>
            <TooltipContent className="dark-glass border-white/10 text-[9px] font-bold uppercase py-1 px-2">
              {badgeData.label}
            </TooltipContent>
          </Tooltip>
        );
      })()}
      {sponsorBadge && (() => {
        const labels: Record<string, string> = {
          cup:    `蛇目杯贊助者 — 累積贊助 NT$200`,
          sake:   `德利贊助者 — 累積贊助 NT$500`,
          bottle: `四合瓶贊助者 — 累積贊助 NT$1000`,
          kodaru: `菰樽贊助者 — 累積贊助 NT$3000，隐藏成就`,
        };
        return (
          <Tooltip open={openTooltip === 'sponsor'}>
            <TooltipTrigger asChild>
              <span
                className="cursor-pointer select-none leading-none inline-flex items-center"
                onPointerDown={() => setOpenTooltip('sponsor')}
                onPointerUp={() => setOpenTooltip(null)}
                onPointerLeave={() => setOpenTooltip(null)}
              >
                {sponsorBadge === 'cup'    && <JanomeCupIcon size={14} />}
                {sponsorBadge === 'sake'   && <TokkuriIcon size={14} colors={TOKKURI_CLASSIC_COLORS} />}
                {sponsorBadge === 'bottle' && <SakeBottleIcon size={14} />}
                {sponsorBadge === 'kodaru' && <KodaruIcon size={16} colors={KODARU_GOLD_COLORS} />}
              </span>
            </TooltipTrigger>
            <TooltipContent className="dark-glass border-white/10 text-[9px] font-bold uppercase py-1 px-2">
              {labels[sponsorBadge]}
            </TooltipContent>
          </Tooltip>
        );
      })()}
    </span>
  );
}
