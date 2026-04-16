'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDoc, collection, doc, orderBy, query, where } from 'firebase/firestore';
import { CalendarDays, ChevronRight, Loader2, MapPin, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { ExpoEvent, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function ExpoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    venue: '',
    eventDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile } = useDoc<UserProfile>(profileRef);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'expoEvents'),
      where('userId', '==', user.uid),
      orderBy('eventDate', 'desc')
    );
  }, [firestore, user]);
  const { data: events, isLoading } = useCollection<ExpoEvent>(eventsQuery);

  const handleCreateEvent = async () => {
    if (!firestore || !user) return;
    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: '請先填寫活動名稱' });
      return;
    }

    setIsCreating(true);
    try {
      const now = new Date().toISOString();
      const eventData = {
        userId: user.uid,
        name: formData.name.trim(),
        venue: formData.venue.trim(),
        eventDate: formData.eventDate || now.slice(0, 10),
        notes: formData.notes.trim(),
        createdAt: now,
        updatedAt: now,
      };
      const eventRef = await addDoc(collection(firestore, 'expoEvents'), eventData);
      toast({ title: '酒展活動已建立' });
      router.push(`/expo/${eventRef.id}`);
    } catch {
      toast({ variant: 'destructive', title: '建立活動失敗' });
      setIsCreating(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen notebook-texture flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen notebook-texture px-4 py-10">
        <div className="max-w-xl mx-auto dark-glass rounded-[2rem] border border-white/10 p-6 text-center space-y-4">
          <h1 className="text-xl font-headline font-bold text-primary tracking-widest uppercase">酒展快速模式</h1>
          <p className="text-sm text-muted-foreground">登入後即可建立酒展活動，開始私人快記與比較。</p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => router.push('/recover')} className="rounded-full h-10 px-5 text-xs font-bold uppercase tracking-widest">登入帳戶</Button>
            <Button variant="outline" onClick={() => router.push('/')} className="rounded-full h-10 px-5 text-xs font-bold uppercase tracking-widest">返回首頁</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen notebook-texture px-4 py-8 pb-24 font-body">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300">Private Workspace</p>
            <h1 className="text-2xl font-headline font-bold text-primary tracking-widest uppercase">酒展快速模式</h1>
            <p className="text-sm text-muted-foreground mt-2">先快速記錄、回家再補完整，同一篇整理後再發布。</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/')} className="rounded-full h-10 px-5 text-xs font-bold uppercase tracking-widest">
            返回首頁
          </Button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="dark-glass rounded-[2rem] border border-white/10 p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">新建活動</p>
              <h2 className="text-lg font-bold text-foreground">下一場酒展先建起來</h2>
              <p className="text-sm text-muted-foreground">一場酒展一個工作台，現場快記和回家比較都掛在同一場底下。</p>
            </div>
            <div className="grid gap-4">
              <Input
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例如：2026 台北國際酒展"
                className="h-11 rounded-2xl bg-white/5 border-white/10"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  value={formData.venue}
                  onChange={(event) => setFormData((prev) => ({ ...prev, venue: event.target.value }))}
                  placeholder="地點"
                  className="h-11 rounded-2xl bg-white/5 border-white/10"
                />
                <Input
                  type="date"
                  value={formData.eventDate}
                  onChange={(event) => setFormData((prev) => ({ ...prev, eventDate: event.target.value }))}
                  className="h-11 rounded-2xl bg-white/5 border-white/10"
                />
              </div>
              <Textarea
                value={formData.notes}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="補充備註，例如先攻哪幾個酒造、想特別找什麼類型"
                className="min-h-[110px] rounded-2xl bg-white/5 border-white/10"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">{profile?.username ? `目前以 ${profile.username} 身分建立` : '可先建立活動，稍後再補完整貼文'}</p>
              <Button onClick={handleCreateEvent} disabled={isCreating} className="rounded-full h-11 px-6 text-xs font-bold uppercase tracking-widest">
                {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} 建立活動
              </Button>
            </div>
          </div>

          <div className="dark-glass rounded-[2rem] border border-white/10 p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">使用方式</p>
              <h2 className="text-lg font-bold text-foreground">現場只做必要動作</h2>
            </div>
            <div className="space-y-3 text-sm text-foreground/80">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">1. 建立酒展活動</div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">2. 每杯只記酒名、booth、價格、分數、想買程度</div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">3. 回家用比較頁切排序，挑出最值得買和最值得發文的酒</div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">4. 從同一篇進入完整編輯，補好之後再發布</div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">My Events</p>
              <h2 className="text-lg font-bold text-foreground">我的酒展工作台</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="w-3 h-3 text-sky-300" /> 只顯示自己的私人活動
            </div>
          </div>

          {isLoading ? (
            <div className="dark-glass rounded-[2rem] border border-white/10 p-10 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !events || events.length === 0 ? (
            <div className="dark-glass rounded-[2rem] border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
              目前還沒有酒展活動，先建立第一場即可開始使用。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <Link key={event.id} href={`/expo/${event.id}`} className="group dark-glass rounded-[2rem] border border-white/10 p-5 space-y-4 hover:border-sky-400/30 hover:bg-sky-500/5 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground break-words leading-snug">{event.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3 text-primary/70" /> {event.eventDate}</span>
                        {event.venue && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-primary/70" /> {event.venue}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-sky-300 transition-colors" />
                  </div>
                  {event.notes && <p className="text-sm text-foreground/70 line-clamp-3">{event.notes}</p>}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}