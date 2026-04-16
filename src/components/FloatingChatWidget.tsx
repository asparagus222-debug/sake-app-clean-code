'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { Bell, Megaphone, MessagesSquare, Minimize2, Send, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { authorizedJsonFetch } from '@/lib/authorized-fetch';
import { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

const CHAT_COLLAPSED_STORAGE_KEY = 'floating_chat_collapsed';
const CHAT_SEEN_ANNOUNCEMENTS_KEY = 'floating_chat_seen_announcements';

function readSeenAnnouncements() {
  if (typeof window === 'undefined') return [] as string[];

  try {
    const raw = window.localStorage.getItem(CHAT_SEEN_ANNOUNCEMENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeSeenAnnouncements(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CHAT_SEEN_ANNOUNCEMENTS_KEY, JSON.stringify(ids.slice(-50)));
}

export function FloatingChatWidget() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(CHAT_COLLAPSED_STORAGE_KEY) !== 'false';
  });
  const [activeAnnouncement, setActiveAnnouncement] = useState<ChatMessage | null>(null);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'chatMessages'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
  }, [firestore]);
  const { data: rawMessages, isLoading } = useCollection<ChatMessage>(messagesQuery);

  const messages = useMemo(() => [...(rawMessages || [])].reverse(), [rawMessages]);
  const latestAnnouncement = useMemo(() => {
    const reversed = [...messages].reverse();
    return reversed.find((message) => message.messageType === 'announcement') || null;
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHAT_COLLAPSED_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (!latestAnnouncement) return;
    const seen = readSeenAnnouncements();
    if (seen.includes(latestAnnouncement.id)) return;
    setActiveAnnouncement(latestAnnouncement);
  }, [latestAnnouncement]);

  const dismissAnnouncement = () => {
    if (!activeAnnouncement) return;
    const seen = readSeenAnnouncements();
    if (!seen.includes(activeAnnouncement.id)) {
      writeSeenAnnouncements([...seen, activeAnnouncement.id]);
    }
    setActiveAnnouncement(null);
  };

  const handleSend = async () => {
    if (!user || !auth || isSending) return;
    const text = draft.trim();
    if (!text) return;

    setIsSending(true);
    setSendError(null);
    try {
      const response = await authorizedJsonFetch(auth, '/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : '聊天室送出失敗');
      }
      setDraft('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : '聊天室送出失敗');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {activeAnnouncement && (
        <div className="pointer-events-none fixed top-5 left-1/2 z-[70] w-[min(92vw,32rem)] -translate-x-1/2 px-2">
          <div className="pointer-events-auto dark-glass rounded-[1.8rem] border border-amber-400/30 bg-amber-500/10 px-5 py-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-amber-500/20 p-2 text-amber-300">
                <Megaphone className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">聊天室公告</p>
                <p className="mt-1 text-sm font-bold text-foreground">@{activeAnnouncement.username}</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/85 break-words">{activeAnnouncement.text}</p>
              </div>
              <button type="button" onClick={dismissAnnouncement} className="rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed left-4 bottom-4 z-[65] max-w-[calc(100vw-2rem)]">
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="group flex h-16 w-16 items-center justify-center rounded-full border border-sky-400/30 bg-[#111317]/95 text-sky-200 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:scale-105 hover:bg-sky-500/10"
          >
            <div className="relative">
              <MessagesSquare className="h-7 w-7" />
              {latestAnnouncement && !readSeenAnnouncements().includes(latestAnnouncement.id) && (
                <span className="absolute -right-1.5 -top-1.5 inline-flex h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-[#111317]" />
              )}
            </div>
          </button>
        ) : (
          <div className="dark-glass flex h-[min(70vh,42rem)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#101215]/95 shadow-[0_18px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300">Open Chat</p>
                <p className="text-sm font-bold text-foreground">酒友聊天室</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setIsCollapsed(true)} className="rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors">
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <MessagesSquare className="w-5 h-5 animate-pulse" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground px-4">
                  <Bell className="w-5 h-5 text-sky-300/70" />
                  <p>聊天室目前還沒有訊息，第一句就從你開始。</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = user?.uid === message.userId;
                  return (
                    <div key={message.id} className={cn('flex gap-2', isMine && 'justify-end')}>
                      {!isMine && (
                        <Avatar className="mt-1 h-8 w-8 border border-white/10">
                          <AvatarImage src={message.avatarUrl} />
                          <AvatarFallback className="bg-white/10 text-[10px] text-foreground">{message.username.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn('max-w-[78%] rounded-[1.25rem] px-3 py-2 text-sm shadow-lg', isMine ? 'bg-primary text-primary-foreground' : 'bg-white/8 text-foreground')}>
                        <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                          <span className={cn(isMine ? 'text-primary-foreground/80' : 'text-sky-300')}>@{message.username}</span>
                          {message.messageType === 'announcement' && (
                            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5', isMine ? 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground' : 'border-amber-400/30 bg-amber-500/10 text-amber-300')}>
                              <Megaphone className="w-3 h-3" /> 公告
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
                        <p className={cn('mt-1 text-[10px]', isMine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{new Date(message.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-white/10 px-3 py-3 space-y-2">
              {sendError && <p className="text-[11px] text-red-300">{sendError}</p>}
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-2">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={user ? '想說什麼就打什麼，公告請用 ! 開頭' : '登入後即可發言'}
                  className="min-h-[78px] resize-none border-none bg-transparent px-2 py-2 text-sm text-foreground focus-visible:ring-0"
                  disabled={!user || isSending}
                />
                <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-2">
                  <p className="text-[10px] text-muted-foreground">近 100 則訊息。`!` 開頭會變公告，且 30 分鐘只能用一次。</p>
                  <Button onClick={handleSend} disabled={!user || !draft.trim() || isSending} className="rounded-full h-9 px-4 text-[10px] font-bold uppercase tracking-widest">
                    {isSending ? <MessagesSquare className="w-3.5 h-3.5 mr-1.5 animate-pulse" /> : <Send className="w-3.5 h-3.5 mr-1.5" />} 送出
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}