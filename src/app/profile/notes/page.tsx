
"use client"

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SakeNote } from '@/lib/types';
import { 
  ArrowLeft, 
  Trash2, 
  Edit2, 
  Loader2, 
  Clock, 
  Calendar,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUser, deleteDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function MyNotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const myNotesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'sakeTastingNotes'),
      where('userId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: rawNotes, isLoading } = useCollection<SakeNote>(myNotesQuery);

  const notes = React.useMemo(() => {
    if (!rawNotes) return null;
    return [...rawNotes].sort((a, b) => {
      const dateA = new Date(a.tastingDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.tastingDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [rawNotes]);

  const isEditable = (createdAtStr?: string) => {
    if (!createdAtStr) return false;
    const createdAt = new Date(createdAtStr).getTime();
    const now = new Date().getTime();
    return (now - createdAt) < (2 * 60 * 60 * 1000);
  };

  const handleDelete = (noteId: string) => {
    if (!firestore) return;
    const noteRef = doc(firestore, 'sakeTastingNotes', noteId);
    deleteDocumentNonBlocking(noteRef);
    toast({ title: "筆記已成功刪除" });
  };

  if (isUserLoading || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center notebook-texture font-body">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse font-bold tracking-widest text-xs uppercase">載入筆記中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen notebook-texture p-4 md:p-8 pb-32 font-body">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => router.push('/profile')} className="hover:bg-primary/10 text-primary">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-headline font-bold text-primary gold-glow tracking-widest uppercase">貼文管理</h1>
          <div className="w-10" />
        </header>

        {!notes || notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 dark-glass rounded-[3rem] border border-dashed border-white/10 space-y-4">
            <AlertCircle className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">目前沒有品飲紀錄</p>
            <Button onClick={() => router.push('/notes/new')} className="rounded-full h-10 px-8 text-xs font-bold uppercase tracking-widest">開始第一篇筆記</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {notes.map((note) => {
              const editable = isEditable(note.createdAt);
              return (
                <div key={note.id} className="dark-glass p-4 rounded-[2rem] border border-white/5 flex items-center gap-4 group hover:bg-white/[0.02] transition-all duration-300">
                  {/* 點擊整個區塊均可導航至詳情頁 */}
                  <Link href={`/notes/${note.id}`} className="flex flex-1 items-center gap-4 min-w-0">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-muted/10 border border-white/5 group-hover:scale-105 transition-transform duration-300">
                      {note.imageUrls && note.imageUrls[0] ? (
                        <Image src={note.imageUrls[0]} alt={note.brandName} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground/40 font-bold uppercase">No Img</div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary font-bold uppercase tracking-widest truncate leading-tight">{note.brewery}</p>
                      <h3 className="text-sm font-bold break-words mb-1 group-hover:text-primary transition-colors leading-tight">{note.brandName}</h3>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        <div className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5 opacity-50" /> {new Date(note.tastingDate).toLocaleDateString('zh-TW')}</div>
                        {editable && <div className="flex items-center gap-1 text-accent"><Clock className="w-2.5 h-2.5" /> 限時編輯中</div>}
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2">
                    {editable && (
                      <Link href={`/notes/${note.id}/edit`}>
                        <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 rounded-full w-10 h-10">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full w-10 h-10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="dark-glass border border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-primary font-headline text-xl gold-glow tracking-widest uppercase">確定要刪除嗎？</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">此操作將永久刪除這篇筆記。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6 gap-3">
                          <AlertDialogCancel className="rounded-full">取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(note.id)} className="rounded-full bg-destructive">確定刪除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
