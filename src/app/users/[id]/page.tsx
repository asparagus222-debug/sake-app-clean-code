
"use client"

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserProfile, SakeNote } from '@/lib/types';
import { SakeNoteCard } from '@/components/SakeNoteCard';
import { UserBadge } from '@/components/UserBadge';
import { isPublicPublishedNote } from '@/lib/note-lifecycle';
import { 
  ArrowLeft, 
  Loader2, 
  UserPlus, 
  UserMinus, 
  Award, 
  MapPin, 
  FileText,
  Users,
  Calendar,
  Coffee,
  Instagram,
  Twitter,
  Facebook,
  MessageCircle
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useCollection, 
  useMemoFirebase,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const targetUserId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !targetUserId) return null;
    return doc(firestore, 'users', targetUserId);
  }, [firestore, targetUserId]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const userNotesQuery = useMemoFirebase(() => {
    if (!firestore || !targetUserId) return null;
    return query(
      collection(firestore, 'sakeTastingNotes'),
      where('userId', '==', targetUserId),
      where('visibility', '==', 'public'),
      where('publicationStatus', '==', 'published')
    );
  }, [firestore, targetUserId]);
  const { data: rawNotes, isLoading: isNotesLoading } = useCollection<SakeNote>(userNotesQuery);

  const followersQuery = useMemoFirebase(() => {
    if (!firestore || !targetUserId) return null;
    return collection(firestore, 'users', targetUserId, 'followers');
  }, [firestore, targetUserId]);
  const { data: followers } = useCollection(followersQuery);

  const followingQuery = useMemoFirebase(() => {
    if (!firestore || !targetUserId) return null;
    return collection(firestore, 'users', targetUserId, 'following');
  }, [firestore, targetUserId]);
  const { data: following } = useCollection(followingQuery);

  const followRef = useMemoFirebase(() => {
    if (!firestore || !currentUser || !targetUserId) return null;
    return doc(firestore, 'users', currentUser.uid, 'following', targetUserId);
  }, [firestore, currentUser, targetUserId]);
  const { data: followDoc, isLoading: isFollowLoading } = useDoc(followRef);

  const isFollowing = !!followDoc;
  const isSelf = currentUser?.uid === targetUserId;

  const notes = React.useMemo(() => {
    if (!rawNotes) return [];
    return [...rawNotes].filter(isPublicPublishedNote).sort((a, b) => {
      const dateA = new Date(a.tastingDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.tastingDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [rawNotes]);

  const handleFollow = () => {
    if (!firestore || !currentUser || !targetUserId || isSelf) return;

    const myFollowingRef = doc(firestore, 'users', currentUser.uid, 'following', targetUserId);
    const targetFollowerRef = doc(firestore, 'users', targetUserId, 'followers', currentUser.uid);

    if (isFollowing) {
      deleteDocumentNonBlocking(myFollowingRef);
      deleteDocumentNonBlocking(targetFollowerRef);
      toast({ title: "已取消追蹤" });
    } else {
      const followData = { uid: targetUserId, timestamp: new Date().toISOString() };
      const followerData = { uid: currentUser.uid, timestamp: new Date().toISOString() };
      setDocumentNonBlocking(myFollowingRef, followData, { merge: true });
      setDocumentNonBlocking(targetFollowerRef, followerData, { merge: true });
      toast({ title: "追蹤成功" });
    }
  };

  if (isProfileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center notebook-texture">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-bold tracking-widest uppercase text-[10px]">載入個人檔案中...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center notebook-texture p-6 text-center">
        <h2 className="text-xl font-headline text-primary mb-2">找不到使用者</h2>
        <Button variant="link" onClick={() => router.push('/')} className="text-xs">返回首頁</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen notebook-texture pb-32">
      <header className="sticky top-0 z-50 dark-glass border-b border-white/5 px-4 py-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-primary">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-headline font-bold text-primary gold-glow tracking-widest uppercase truncate max-w-[150px]">
            {profile.username}
          </h1>
          <UserBadge userId={targetUserId} />
        </div>
        <div className="w-10" />
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-12">
        <section className="dark-glass rounded-[3rem] border border-white/10 p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-primary/20 shadow-2xl">
              <AvatarImage src={profile.avatarUrl || `https://picsum.photos/seed/${targetUserId}/200/200`} />
              <AvatarFallback><Loader2 className="animate-spin" /></AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center md:text-left space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-1">
                  <h2 className="text-3xl font-headline font-bold gold-glow">@{profile.username}</h2>
                  <UserBadge userId={targetUserId} className="scale-125" showText />
                </div>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                   <div className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-primary" /> {notes.length} 篇品飲</div>
                   <div className="flex items-center gap-1.5"><Users className="w-3 h-3 text-primary" /> {followers?.length || 0} 追蹤者</div>
                   <div className="flex items-center gap-1.5"><Users className="w-3 h-3 text-primary" /> {following?.length || 0} 追蹤中</div>
                </div>

                <div className="flex justify-center md:justify-start gap-3 pt-2">
                  {profile.instagram && (
                    <Link href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank">
                      <Instagram className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                    </Link>
                  )}
                  {profile.twitter && (
                    <Link href={`https://twitter.com/${profile.twitter.replace('@', '')}`} target="_blank">
                      <Twitter className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                    </Link>
                  )}
                  {profile.facebook && (
                    <Link href={`https://facebook.com/${profile.facebook}`} target="_blank">
                      <Facebook className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                    </Link>
                  )}
                  {profile.threads && (
                    <Link href={`https://threads.net/@${profile.threads.replace('@', '')}`} target="_blank">
                      <MessageCircle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                    </Link>
                  )}
                </div>
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed max-w-xl">
                {profile.bio || "這位作者很神祕，還沒寫下個人簡介。"}
              </p>

              {profile.qualifications && profile.qualifications.length > 0 && (
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  {profile.qualifications.map((q, i) => (
                    <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-[9px] font-bold">
                      <Award className="w-2.5 h-2.5" /> {q}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                {!isSelf && (
                  <Button 
                    onClick={handleFollow} 
                    disabled={isFollowLoading}
                    variant={isFollowing ? "outline" : "default"}
                    className="rounded-full h-11 px-8 font-bold text-xs uppercase tracking-widest shadow-xl"
                  >
                    {isFollowing ? (
                      <><UserMinus className="w-4 h-4 mr-2" /> 取消追蹤</>
                    ) : (
                      <><UserPlus className="w-4 h-4 mr-2" /> 追蹤作者</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="w-5 h-5" />
            <h2 className="text-lg font-headline font-bold uppercase tracking-widest">個人品飲動態</h2>
          </div>

          {isNotesLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : notes.length === 0 ? (
            <div className="text-center py-20 dark-glass rounded-3xl border border-dashed border-white/10">
              <p className="text-muted-foreground italic">目前還沒有公開的品飲筆記。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {notes.map(note => (
                <SakeNoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
