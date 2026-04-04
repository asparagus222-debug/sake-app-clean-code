'use client';

import { KodaruIcon, KODARU_VARIANTS, JanomeCupIcon, SakeBottleIcon } from '@/components/SponsorIcons';

export default function BadgePreviewPage() {
  return (
    <main className="min-h-screen bg-[#0e1117] text-white p-8 space-y-12">
      <h1 className="text-2xl font-bold tracking-widest uppercase opacity-80">Badge Preview</h1>

      {/* All sponsor badge tiers */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">贊助等級一覧</h2>
        <div className="flex flex-wrap gap-6 items-center">
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">☕</span>
            <span className="text-[10px] text-white/40">$50 咖啡</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <JanomeCupIcon size={32} />
            <span className="text-[10px] text-white/40">$200 蛇目杯</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <SakeBottleIcon size={28} />
            <span className="text-[10px] text-white/40">$500 德利</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">🎎</span>
            <span className="text-[10px] text-white/40">$1000 四合瓶</span>
          </div>
          {/* kodaru variants shown below */}
        </div>
      </section>

      {/* Kodaru variants */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">$3000 菰樽 — 6 配色方案</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
          {KODARU_VARIANTS.map((v) => (
            <div key={v.id} className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5">
              <KodaruIcon size={64} colors={v.colors} />
              <span className="text-[11px] font-bold text-white/70">{v.name}</span>
              <span className="text-[9px] font-mono text-white/30">{v.id}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Kodaru at badge size (16px) */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">菰樽 at badge size (16px) — 行內顯示模擬</h2>
        <div className="flex flex-wrap gap-6 items-center">
          {KODARU_VARIANTS.map((v) => (
            <div key={v.id} className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
              <KodaruIcon size={16} colors={v.colors} />
              <span className="text-xs text-white/60">用戶名稱 — {v.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Kodaru at card size (24px) */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">菰樽 at card size (24px)</h2>
        <div className="flex flex-wrap gap-4 items-center">
          {KODARU_VARIANTS.map((v) => (
            <div key={v.id} className="flex flex-col items-center gap-2">
              <KodaruIcon size={24} colors={v.colors} />
              <span className="text-[9px] text-white/40">{v.name}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[10px] text-white/20 mt-8">
        選好配色後，告知 Copilot 要用哪個 variant id，即可套用到 UserBadge。
        確認後刪除此頁面 <code className="bg-white/10 px-1 rounded">src/app/badge-preview/page.tsx</code>
      </p>
    </main>
  );
}
