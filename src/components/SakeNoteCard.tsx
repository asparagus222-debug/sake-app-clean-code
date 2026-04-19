
"use client"

import React from "react";
import { SakeNote, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Star, Heart, User, Award } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { UserBadge } from "@/components/UserBadge";
import { useAuth, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { authorizedJsonFetch } from '@/lib/authorized-fetch';
import { cn, formatSakeDisplayName } from "@/lib/utils";
import { NoteImagePreview } from '@/components/notes/NoteImagePreview';

interface SakeNoteCardProps {
  note: SakeNote;
}

export function SakeNoteCard({ note }: SakeNoteCardProps) {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();

  const authorRef = useMemoFirebase(() => {
    if (!firestore || !note.userId) return null;
    return doc(firestore, 'users', note.userId);
  }, [firestore, note.userId]);
  const { data: authorProfile } = useDoc<UserProfile>(authorRef);
  const authorName = authorProfile?.isAccountDeleted
    ? '匿名'
    : authorProfile?.username || note.username || '匿名';

  const [isLiking, setIsLiking] = React.useState(false);
  const [likeState, setLikeState] = React.useState(() => {
    const likedBy = note.likedByUserIds || [];
    return {
      liked: user ? likedBy.includes(user.uid) : false,
      likesCount: note.likesCount || 0,
    };
  });
  const displayName = formatSakeDisplayName(note.brandName, note.subBrand);

  React.useEffect(() => {
    const likedBy = note.likedByUserIds || [];
    setLikeState({
      liked: user ? likedBy.includes(user.uid) : false,
      likesCount: note.likesCount || 0,
    });
  }, [note.likedByUserIds, note.likesCount, user]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !auth || isLiking) return;

    setIsLiking(true);
    try {
      const res = await authorizedJsonFetch(auth, `/api/notes/${note.id}/like`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '按讚失敗');
      }
      setLikeState({
        liked: data.liked === true,
        likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
      });
    } catch {
      // keep the current UI state when the request fails
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <Card className="overflow-hidden transition-all border-none dark-glass flex flex-col">
      {/* 圖片區：與貼文頁一致的正方形比例 */}
      <Link href={`/notes/${note.id}`} className="relative w-full aspect-square bg-muted/20 block overflow-hidden group/img-container">
        <NoteImagePreview
          imageUrls={note.imageUrls}
          imageOriginals={note.imageOriginals}
          imageTransforms={note.imageTransforms}
          imageSplitRatio={note.imageSplitRatio}
          alt={displayName}
          className="flex h-full w-full transition-transform duration-700 ease-out group-hover/img-container:scale-105"
        />
        {/* 評分 badge */}
        <div className="absolute top-3 right-3">
          <Badge className="bg-primary/90 hover:bg-primary font-bold border-none shadow-lg text-[10px]">
            <Star className="w-3 h-3 mr-1 fill-white" /> {note.overallRating}
          </Badge>
        </div>
        {/* 漸層遮罩 + 酒廠 / 酒名 */}
        <div className="card-img-overlay absolute inset-x-0 bottom-0 h-28 pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 p-4 pointer-events-none">
          <p className="text-[9px] text-primary font-bold uppercase tracking-widest opacity-90 leading-none mb-1 drop-shadow">
            {note.brewery}
          </p>
          <h3 className="font-headline text-base leading-tight drop-shadow" style={{ color: 'var(--card-overlay-text)' }}>
            {displayName}
          </h3>
        </div>
      </Link>

      {/* 底欄：作者、日期、愛心 */}
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-1.5 min-w-0">
          <Link href={`/users/${note.userId}`} className="flex items-start gap-1 hover:text-primary transition-colors min-w-0 group/author">
            <User className="w-2.5 h-2.5 text-primary/60 shrink-0 mt-0.5" />
            <span className="flex min-w-0 items-center gap-1 leading-tight">
              <span className="text-xs text-muted-foreground font-bold whitespace-normal break-all group-hover/author:text-primary transition-colors">
                {authorName}
              </span>
              {!authorProfile?.isAccountDeleted && note.userId && (
                <UserBadge userId={note.userId} profile={authorProfile ?? null} className="shrink-0 origin-left scale-[0.82] sm:scale-[0.9]" />
              )}
            </span>
          </Link>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-tighter min-w-0">
            <Calendar className="w-2.5 h-2.5 opacity-50 shrink-0" />
            <span>{new Date(note.tastingDate || note.createdAt || "").toLocaleDateString('zh-TW')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 px-2 rounded-full transition-all bg-transparent shadow-none border-none select-none [&]:[-webkit-tap-highlight-color:transparent] active:scale-90 active:opacity-60", likeState.liked ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart className={cn("w-4 h-4 mr-1", likeState.liked && "fill-current")} />
            <span className="text-[11px] font-bold">{likeState.likesCount}</span>
          </Button>
        </div>
      </CardContent>

      {/* 作者頭銜（有才顯示） */}
      {!authorProfile?.isAccountDeleted && authorProfile?.qualifications && authorProfile.qualifications.length > 0 && (
        <div className="px-3 pb-3 flex flex-wrap gap-1">
          {authorProfile.qualifications.slice(0, 3).map((q, idx) => (
            <Badge key={idx} variant="outline" className="text-[7px] py-0 h-4 border-primary/20 bg-primary/5 text-primary/70 font-bold flex items-center gap-0.5 uppercase whitespace-nowrap">
              <Award className="w-2 h-2" /> {q}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
