
"use client"

import { SakeNote, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserBadge } from "@/components/UserBadge";
import Image from "next/image";
import { Calendar, Star, Heart, User, Award } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { useFirestore, useUser, updateDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { cn } from "@/lib/utils";

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

  const likedBy = note.likedByUserIds || [];
  const isLiked = user ? likedBy.includes(user.uid) : false;
  const likesCount = note.likesCount || 0;

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
    <Card className="overflow-hidden h-full transition-all border-none dark-glass flex flex-col">
      <Link href={`/notes/${note.id}`} className="relative h-44 w-full bg-muted/20 block overflow-hidden group/img-container">
        {note.imageUrls && note.imageUrls.length > 0 ? (
          <Image src={note.imageUrls[0]} alt={note.brandName} fill className="object-cover group-hover/img-container:scale-105 transition-transform duration-700 ease-out opacity-80" />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/40 text-[10px] font-bold">NO PHOTO</div>
        )}
        <div className="absolute top-3 right-3">
          <Badge className="bg-primary/90 hover:bg-primary font-bold border-none shadow-lg text-[10px]">
            <Star className="w-3 h-3 mr-1 fill-white" /> {note.overallRating}
          </Badge>
        </div>
      </Link>
      
      <CardContent className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-primary font-bold uppercase tracking-widest mb-0.5 break-words opacity-80 leading-tight">
              {note.brewery}
            </p>
            <Link href={`/notes/${note.id}`} className="inline-block max-w-full group/title">
              <h3 className="font-headline text-base group-hover/title:text-primary transition-colors break-words leading-tight">
                {note.brandName}
              </h3>
            </Link>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className={cn("h-9 px-2 rounded-full transition-all bg-transparent shadow-none border-none select-none [&]:[-webkit-tap-highlight-color:transparent] active:scale-90 active:opacity-60", isLiked ? "text-primary" : "text-white/60 hover:text-white")}
            onClick={handleLike}
          >
            <Heart className={cn("w-4 h-4 mr-1", isLiked && "fill-current")} />
            <span className="text-[11px] font-bold">{likesCount}</span>
          </Button>
        </div>

        <div className="mt-auto pt-3 border-t border-white/5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Link href={`/users/${note.userId}`} className="flex items-center gap-1 hover:text-primary transition-colors min-w-0 group/author">
                <User className="w-2.5 h-2.5 text-primary/60" />
                <span className="text-xs text-muted-foreground font-bold break-words group-hover/author:text-primary transition-colors">
                  {authorProfile?.username || note.username || "匿名"}
                </span>
                <UserBadge userId={note.userId} />
              </Link>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-tighter ml-2">
              <Calendar className="w-2.5 h-2.5 opacity-50" />
              {new Date(note.tastingDate || note.createdAt || "").toLocaleDateString('zh-TW')}
            </div>
          </div>
          
          {/* 作者頭銜顯示 (最多3個) */}
          {authorProfile?.qualifications && authorProfile.qualifications.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {authorProfile.qualifications.slice(0, 3).map((q, idx) => (
                <Badge key={idx} variant="outline" className="text-[7px] py-0 h-4 border-primary/20 bg-primary/5 text-primary/70 font-bold flex items-center gap-0.5 uppercase">
                  <Award className="w-2 h-2" /> {q}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
