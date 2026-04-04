'use client';

import {
  KodaruIcon, KODARU_VARIANTS,
  JanomeCupIcon, SakeBottleIcon,
  TokkuriIcon, TOKKURI_VARIANTS,
} from '@/components/SponsorIcons';

export default function BadgePreviewPage() {
  return (
    <main className="min-h-screen bg-[#0e1117] text-white p-8 space-y-14">
      <h1 className="text-2xl font-bold tracking-widest uppercase opacity-80">Badge Preview</h1>

      {/* Tier overview */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">贊助成就等級一覧</h2>
        <div className="flex flex-wrap gap-8 items-end">
          {[
            { label: '$200 蛇目杯', node: <JanomeCupIcon size={40} /> },
            { label: '$500 德利（預設白藍）', node: <TokkuriIcon size={36} /> },
            { label: '$1000 四合瓶', node: <SakeBottleIcon size={36} /> },
            { label: '$3000 菰樽（金彩）', node: <KodaruIcon size={48} colors={KODARU_VARIANTS.find(v=>v.id==='gold')!.colors} /> },
          ].map(({ label, node }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              {node}
              <span className="text-[10px] text-white/40">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tokkuri variants ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">$500 德利 — 6 配色方案</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
          {TOKKURI_VARIANTS.map((v) => (
            <div key={v.id} className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5">
              <TokkuriIcon size={52} colors={v.colors} />
              <span className="text-[11px] font-bold text-white/70">{v.name}</span>
              <span className="text-[9px] font-mono text-white/30">{v.id}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Tokkuri at badge size */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">德利 at badge size (14px) — 行內顯示模擬</h2>
        <div className="flex flex-wrap gap-4 items-center">
          {TOKKURI_VARIANTS.map((v) => (
            <div key={v.id} className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
              <TokkuriIcon size={14} colors={v.colors} />
              <span className="text-xs text-white/60">用戶名稱 — {v.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Kodaru variants ── */}
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

      <p className="text-[10px] text-white/20 mt-8">
        選好配色後，告知 Copilot 要用哪個 variant id，即可套用。預覽完後刪除此頁面。
      </p>
    </main>
  );
}
