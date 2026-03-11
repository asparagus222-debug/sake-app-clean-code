
"use client"

import React from 'react';
import { Medal, Trophy, Star } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

  if (count < 10) return null;

  let badgeData = {
    icon: Medal,
    color: "",
    label: "",
    glow: false,
    sparkle: false
  };

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

  const Icon = badgeData.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1 cursor-default", className)}>
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
}
