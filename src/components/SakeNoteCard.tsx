
"use client"

import { SakeNote, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Calendar, Star, Heart, User, Award } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { useFirestore, useUser, updateDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { cn, formatSakeDisplayName } from "@/lib/utils";

interface SakeNoteCardProps {
  note: SakeNote;
}

export function SakeNoteCard({ note }: SakeNoteCardProps) {
  const firestore = useFirestore();
  const { user } = useUser();

  const authorRef = useMemoFirebase(() => {
    if (!firestore || !note.userId) return null;
    return doc(firestore, 'users', note.userId);
  }, [firestore, note.userId]);
  const { data: authorProfile } = useDoc<UserProfile>(authorRef);
  const authorName = authorProfile?.isAccountDeleted
    ? '匿名'
    : authorProfile?.username || note.username || '匿名';

  const likedBy = note.likedByUserIds || [];
  const isLiked = user ? likedBy.includes(user.uid) : false;
  const likesCount = note.likesCount || 0;
  const displayName = formatSakeDisplayName(note.brandName, note.subBrand);

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firestore || !user) return;
    const noteRef = doc(firestore, 'sakeTastingNotes', note.id);
    if (isLiked) {
      updateDocumentNonBlocking(noteRef, {
        likedByUserIds: arrayRemove(user.uid),
        likesCount: Math.max(0, likesCount - 1)
      });
    } else {
      updateDocumentNonBlocking(noteRef, {
        likedByUserIds: arrayUnion(user.uid),
        likesCount: likesCount + 1
      });
    }
  };

  return (
    <Card className="overflow-hidden transition-all border-none dark-glass flex flex-col">
      {/* 圖片區：3:4 直向比例，酒名浮在漸層上 */}
      <Link href={`/notes/${note.id}`} className="relative w-full aspect-[3/4] bg-muted/20 block overflow-hidden group/img-container">
        {note.imageUrls && note.imageUrls.length > 0 ? (
          <Image src={note.imageUrls[0]} alt={displayName} fill className="object-cover group-hover/img-container:scale-105 transition-transform duration-700 ease-out" />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/40 text-[10px] font-bold">NO PHOTO</div>
        )}
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
            <span className="text-xs text-muted-foreground font-bold whitespace-normal break-all leading-tight group-hover/author:text-primary transition-colors">
              {authorName}
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
            className={cn("h-8 px-2 rounded-full transition-all bg-transparent shadow-none border-none select-none [&]:[-webkit-tap-highlight-color:transparent] active:scale-90 active:opacity-60", isLiked ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            onClick={handleLike}
          >
            <Heart className={cn("w-4 h-4 mr-1", isLiked && "fill-current")} />
            <span className="text-[11px] font-bold">{likesCount}</span>
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
