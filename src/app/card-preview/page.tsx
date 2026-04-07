"use client"

import React from 'react';
import Image from 'next/image';
import { Star, Heart, Calendar, User, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// ── 假資料 ──────────────────────────────────────────────────────────────────
const MOCK_NOTES = [
  {
    id: '1',
    brandName: '名城 まるわらい',
    brewery: '名城酒造株式会社',
    overallRating: 7,
    likesCount: 0,
    date: '2026/4/3',
    username: '蘆笛',
    qualifications: ['SSI 酒匠', 'JAPAN SAKE ASSOCIATION 認定講師'],
    imageUrl: 'https://picsum.photos/seed/sake1/400/600',
  },
  {
    id: '2',
    brandName: '獺祭 磨き二割三分',
    brewery: '旭酒造株式会社',
    overallRating: 9,
    likesCount: 12,
    date: '2026/4/1',
    username: 'SakeLover',
    qualifications: ['SAKE DIPLOMA'],
    imageUrl: 'https://picsum.photos/seed/sake2/400/700',
  },
  {
    id: '3',
    brandName: '十四代 龍の落とし子',
    brewery: '高木酒造',
    overallRating: 10,
    likesCount: 31,
    date: '2026/3/28',
    username: '清酒探偵',
    qualifications: [],
    imageUrl: 'https://picsum.photos/seed/sake3/400/550',
  },
  {
    id: '4',
    brandName: '而今 特別純米',
    brewery: '木屋正酒造',
    overallRating: 8,
    likesCount: 5,
    date: '2026/3/20',
    username: 'Jessie',
    qualifications: ['SSI 酒匠'],
    imageUrl: 'https://picsum.photos/seed/sake4/400/620',
  },
];

// ── 方案 A：object-contain + 深色背景（固定高度）─────────────────────────
function CardA({ note }: { note: typeof MOCK_NOTES[0] }) {
  return (
    <Card className="overflow-hidden border-none bg-zinc-900 flex flex-col">
      <div className="relative h-44 w-full bg-zinc-950">
        <Image src={note.imageUrl} alt={note.brandName} fill className="object-contain" />
        <div className="absolute top-3 right-3">
          <Badge className="bg-primary/90 font-bold border-none text-[10px]">
            <Star className="w-3 h-3 mr-1 fill-white" /> {note.overallRating}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4 flex-1 flex flex-col gap-2">
        <p className="text-[10px] text-pink-400 font-bold uppercase tracking-widest opacity-80">{note.brewery}</p>
        <p className="font-bold text-sm text-white leading-tight">{note.brandName}</p>
        <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <User className="w-2.5 h-2.5 text-pink-400/60" />
            <span className="text-[11px] text-zinc-400">{note.username}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            <Calendar className="w-2.5 h-2.5 opacity-50" />
            {note.date}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 方案 B：aspect-ratio 3:4 + object-cover（自適應直向比例）──────────────
function CardB({ note }: { note: typeof MOCK_NOTES[0] }) {
  return (
    <Card className="overflow-hidden border-none bg-zinc-900 flex flex-col">
      <div className="relative w-full aspect-[3/4] bg-zinc-950">
        <Image src={note.imageUrl} alt={note.brandName} fill className="object-cover" />
        <div className="absolute top-3 right-3">
          <Badge className="bg-primary/90 font-bold border-none text-[10px]">
            <Star className="w-3 h-3 mr-1 fill-white" /> {note.overallRating}
          </Badge>
        </div>
        {/* 漸層遮罩 */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-900 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[9px] text-pink-400 font-bold uppercase tracking-widest opacity-80">{note.brewery}</p>
          <p className="font-bold text-sm text-white leading-tight">{note.brandName}</p>
        </div>
      </div>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <User className="w-2.5 h-2.5 text-pink-400/60" />
          <span className="text-[11px] text-zinc-400">{note.username}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Calendar className="w-2.5 h-2.5 opacity-50" />
          {note.date}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 方案 C：橫式 layout（圖左、資訊右）─────────────────────────────────────
function CardC({ note }: { note: typeof MOCK_NOTES[0] }) {
  return (
    <Card className="overflow-hidden border-none bg-zinc-900">
      <div className="flex items-stretch h-32">
        {/* 左側圖片 */}
        <div className="relative w-24 shrink-0 bg-zinc-950">
          <Image src={note.imageUrl} alt={note.brandName} fill className="object-contain" />
        </div>
        {/* 右側資訊 */}
        <CardContent className="p-3 flex flex-col justify-between flex-1 min-w-0">
          <div>
            <p className="text-[9px] text-pink-400 font-bold uppercase tracking-widest opacity-80 leading-none mb-1">{note.brewery}</p>
            <p className="font-bold text-sm text-white leading-tight line-clamp-2">{note.brandName}</p>
          </div>
          <div className="flex items-center justify-between mt-auto">
            <Badge className="bg-primary/90 font-bold border-none text-[10px] h-5">
              <Star className="w-3 h-3 mr-1 fill-white" /> {note.overallRating}
            </Badge>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Heart className="w-3 h-3" /> {note.likesCount}
            </div>
          </div>
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <User className="w-2.5 h-2.5 text-pink-400/60" />
              <span className="text-[11px] text-zinc-400">{note.username}</span>
            </div>
            <span className="text-[10px] text-zinc-500">{note.date}</span>
          </div>
          {note.qualifications.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {note.qualifications.slice(0, 2).map((q, i) => (
                <Badge key={i} variant="outline" className="text-[7px] py-0 h-4 border-pink-400/20 bg-pink-400/5 text-pink-400/70 font-bold flex items-center gap-0.5 uppercase whitespace-nowrap">
                  <Award className="w-2 h-2" /> {q}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

// ── 方案 D：瀑布流（CSS columns masonry）────────────────────────────────────
function CardD({ note, tall }: { note: typeof MOCK_NOTES[0]; tall?: boolean }) {
  return (
    <Card className="overflow-hidden border-none bg-zinc-900 break-inside-avoid mb-3">
      <div className={`relative w-full bg-zinc-950 ${tall ? 'h-72' : 'h-48'}`}>
        <Image src={note.imageUrl} alt={note.brandName} fill className="object-cover" />
        <div className="absolute top-3 right-3">
          <Badge className="bg-primary/90 font-bold border-none text-[10px]">
            <Star className="w-3 h-3 mr-1 fill-white" /> {note.overallRating}
          </Badge>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-900 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[9px] text-pink-400 font-bold uppercase tracking-widest opacity-80">{note.brewery}</p>
          <p className="font-bold text-sm text-white leading-tight">{note.brandName}</p>
        </div>
      </div>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <User className="w-2.5 h-2.5 text-pink-400/60" />
          <span className="text-[11px] text-zinc-400">{note.username}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Heart className="w-3 h-3" /> {note.likesCount}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 主頁面 ─────────────────────────────────────────────────────────────────
export default function CardPreviewPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20 font-body">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-16">

        <div>
          <h1 className="text-xl font-bold text-pink-400 tracking-widest mb-1">卡片版面方案預覽</h1>
          <p className="text-xs text-zinc-500">使用假資料，確認喜歡的版型後告訴我，我直接替換正式元件</p>
        </div>

        {/* ── 方案 A ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">方案 A　object-contain + 深色背景</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">圖片完整顯示，固定高度，四周補黑色；結構最接近現在，只換一個 CSS 屬性</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_NOTES.slice(0, 2).map(n => <CardA key={n.id} note={n} />)}
          </div>
        </section>

        {/* ── 方案 B ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">方案 B　3:4 直向比例 + 漸層文字覆蓋</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">圖片占大部分空間，酒名浮在漸層上；視覺最飽滿，但卡片較高</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_NOTES.slice(0, 2).map(n => <CardB key={n.id} note={n} />)}
          </div>
        </section>

        {/* ── 方案 C ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">方案 C　橫式 Layout（圖左、資訊右）</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">清單感強，一次看更多筆記；左側用 object-contain 完整露出酒瓶</p>
          </div>
          <div className="flex flex-col gap-3">
            {MOCK_NOTES.map(n => <CardC key={n.id} note={n} />)}
          </div>
        </section>

        {/* ── 方案 D ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">方案 D　瀑布流（Masonry 兩欄）</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">每張圖高度不同、自由排列；最有視覺張力，適合照片風格各異的情境</p>
          </div>
          <div className="columns-2 gap-3">
            <CardD note={MOCK_NOTES[0]} tall />
            <CardD note={MOCK_NOTES[1]} />
            <CardD note={MOCK_NOTES[2]} />
            <CardD note={MOCK_NOTES[3]} tall />
          </div>
        </section>

      </div>
    </div>
  );
}
