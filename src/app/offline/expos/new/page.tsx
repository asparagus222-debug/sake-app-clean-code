'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, CalendarDays, MapPin } from 'lucide-react';
import { createExpo } from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';

export default function OfflineNewExpoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast({ variant: 'destructive', title: '請填入活動名稱' });
      return;
    }
    setIsSaving(true);
    try {
      const expo = createExpo({
        title: formData.title,
        location: formData.location || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
      });
      router.replace(`/offline/expos/${expo.id}`);
    } catch {
      toast({ variant: 'destructive', title: '建立失敗' });
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-body">
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-sm font-bold text-white">建立活動</h1>
      </nav>

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <div className="space-y-4">
          <div>
            <Label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2 block">活動名稱 *</Label>
            <Input
              placeholder="例：2026 東京酒展"
              value={formData.title}
              onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <div>
            <Label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2 block">地點</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="城市 / 場館"
                value={formData.location}
                onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2 block">
                <CalendarDays className="w-3 h-3 inline mr-1" />開始日期
              </Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2 block">結束日期</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-12 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold rounded-xl"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          建立活動
        </Button>
      </div>
    </div>
  );
}
