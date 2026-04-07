"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type QType = 'single' | 'multi' | 'rating5';
interface Opt { value: string; label: string; emoji?: string; }
interface Q {
  id: string;
  section: string;
  sectionColor: string;
  text: string;
  hint?: string;
  optional?: boolean;
  type: QType;
  low?: string;   // for rating5 left label
  high?: string;  // for rating5 right label
  options: Opt[];
}

export interface GuidedTastingResult {
  sweetness: number;
  acidity: number;
  bitterness: number;
  umami: number;
  astringency: number;
  userDescription: string;
  styleTags: string[];
  foodPairings: { food: string; pairing: 'yes'; reason: string }[];
}

// ─── Question Bank ────────────────────────────────────────────────────────────
const QUESTIONS: Q[] = [
  // ── 外觀 ──────────────────────────────────────────────────────────────────
  {
    id: 'color', section: '外觀', sectionColor: '#d4af37',
    text: '酒液的顏色？', type: 'single',
    options: [
      { value: '無色透明', label: '無色透明', emoji: '💧' },
      { value: '淡黃色',   label: '淡黃色',   emoji: '🌙' },
      { value: '金黃色',   label: '金黃色',   emoji: '⭐' },
      { value: '淡琥珀色', label: '淡琥珀色', emoji: '🍯' },
      { value: '琥珀色',   label: '琥珀色',   emoji: '🌅' },
    ],
  },
  {
    id: 'clarity', section: '外觀', sectionColor: '#d4af37',
    text: '清澈度？', type: 'single',
    options: [
      { value: '晶瑩剔透', label: '晶瑩剔透', emoji: '💎' },
      { value: '清澈',     label: '清澈',     emoji: '🫙' },
      { value: '略帶濁感', label: '略帶濁感', emoji: '🫧' },
      { value: '濁酒',     label: '濁酒（にごり）', emoji: '🌫️' },
    ],
  },
  // ── 香氣 ──────────────────────────────────────────────────────────────────
  {
    id: 'aromaIntensity', section: '香氣', sectionColor: '#7c3aed',
    text: '香氣的強度？', type: 'single',
    options: [
      { value: '淡雅低調', label: '淡雅低調', emoji: '🌿' },
      { value: '適中均衡', label: '適中均衡', emoji: '🌸' },
      { value: '濃郁豐富', label: '濃郁豐富', emoji: '🌺' },
      { value: '強烈奔放', label: '強烈奔放', emoji: '🎆' },
    ],
  },
  {
    id: 'aromaType', section: '香氣', sectionColor: '#7c3aed',
    text: '主要香氣類型？', hint: '可多選', type: 'multi',
    options: [
      { value: '吟釀花香', label: '吟釀花香', emoji: '🌸' },
      { value: '水果香',   label: '水果香',   emoji: '🍊' },
      { value: '稻米清香', label: '稻米清香', emoji: '🌾' },
      { value: '乳酸奶香', label: '乳酸奶香', emoji: '🥛' },
      { value: '木桶陳釀', label: '木桶陳釀', emoji: '🪵' },
      { value: '礦物土壤', label: '礦物土壤', emoji: '🪨' },
      { value: '草本植物', label: '草本植物', emoji: '🌿' },
    ],
  },
  {
    id: 'aromaDetail', section: '香氣', sectionColor: '#7c3aed',
    text: '更細緻的香氣描述？', hint: '可多選', optional: true, type: 'multi',
    options: [
      { value: '蘋果梨子', label: '蘋果梨子', emoji: '🍎' },
      { value: '哈密瓜',   label: '哈密瓜',   emoji: '🍈' },
      { value: '香蕉鳳梨', label: '香蕉鳳梨', emoji: '🍋' },
      { value: '柑橘檸檬', label: '柑橘檸檬', emoji: '🍊' },
      { value: '白桃荔枝', label: '白桃荔枝', emoji: '🍑' },
      { value: '栗子蜂蜜', label: '栗子蜂蜜', emoji: '🍯' },
      { value: '白花茉莉', label: '白花茉莉', emoji: '🌼' },
      { value: '奶油布丁', label: '奶油布丁', emoji: '🍮' },
      { value: '辛香料',   label: '辛香料',   emoji: '🧄' },
    ],
  },
  // ── 口感 ──────────────────────────────────────────────────────────────────
  {
    id: 'sweetness', section: '口感', sectionColor: '#059669',
    text: '甜味強度？', type: 'rating5', low: '乾爽無甜', high: '濃郁甜潤',
    options: [{value:'1',label:'1'},{value:'2',label:'2'},{value:'3',label:'3'},{value:'4',label:'4'},{value:'5',label:'5'}],
  },
  {
    id: 'acidity', section: '口感', sectionColor: '#059669',
    text: '酸味強度？', type: 'rating5', low: '幾乎無酸', high: '高酸活潑',
    options: [{value:'1',label:'1'},{value:'2',label:'2'},{value:'3',label:'3'},{value:'4',label:'4'},{value:'5',label:'5'}],
  },
  {
    id: 'bitterness', section: '口感', sectionColor: '#059669',
    text: '苦味強度？', type: 'rating5', low: '幾乎無苦', high: '強烈苦澀',
    options: [{value:'1',label:'1'},{value:'2',label:'2'},{value:'3',label:'3'},{value:'4',label:'4'},{value:'5',label:'5'}],
  },
  {
    id: 'umami', section: '口感', sectionColor: '#059669',
    text: '旨味（鮮味）強度？', type: 'rating5', low: '輕盈清淡', high: '濃郁旨鮮',
    options: [{value:'1',label:'1'},{value:'2',label:'2'},{value:'3',label:'3'},{value:'4',label:'4'},{value:'5',label:'5'}],
  },
  {
    id: 'astringency', section: '口感', sectionColor: '#059669',
    text: '澀感強度？', type: 'rating5', low: '絲滑無澀', high: '強烈收澀',
    options: [{value:'1',label:'1'},{value:'2',label:'2'},{value:'3',label:'3'},{value:'4',label:'4'},{value:'5',label:'5'}],
  },
  {
    id: 'tasteOverall', section: '口感', sectionColor: '#059669',
    text: '整體口感印象？', type: 'single',
    options: [
      { value: '清爽輕盈', label: '清爽輕盈', emoji: '🌊' },
      { value: '均衡細緻', label: '均衡細緻', emoji: '⚖️' },
      { value: '飽滿圓潤', label: '飽滿圓潤', emoji: '🌕' },
      { value: '濃醇厚重', label: '濃醇厚重', emoji: '🏔️' },
    ],
  },
  // ── 尾韻 ──────────────────────────────────────────────────────────────────
  {
    id: 'finishLength', section: '尾韻', sectionColor: '#0ea5e9',
    text: '尾韻的長度？', type: 'single',
    options: [
      { value: '短暫清脆', label: '短暫清脆', emoji: '⚡' },
      { value: '適中均衡', label: '適中均衡', emoji: '🌤️' },
      { value: '綿長悠遠', label: '綿長悠遠', emoji: '🌅' },
      { value: '極長持久', label: '極長持久', emoji: '🌠' },
    ],
  },
  {
    id: 'finishChar', section: '尾韻', sectionColor: '#0ea5e9',
    text: '尾韻的感受？', hint: '可多選', type: 'multi',
    options: [
      { value: '乾淨清爽', label: '乾淨清爽', emoji: '✨' },
      { value: '微甜收尾', label: '微甜收尾', emoji: '🍬' },
      { value: '苦底韻',   label: '苦底韻',   emoji: '🍵' },
      { value: '旨味回甘', label: '旨味回甘', emoji: '🌿' },
      { value: '餘香持久', label: '餘香持久', emoji: '🌸' },
      { value: '礦物感',   label: '礦物感',   emoji: '🪨' },
      { value: '溫暖酒感', label: '溫暖酒感', emoji: '🔥' },
    ],
  },
  // ── 風味總評 ──────────────────────────────────────────────────────────────
  {
    id: 'style', section: '風味總評', sectionColor: '#f97316',
    text: '整體風格定位？', type: 'single',
    options: [
      { value: '優雅細緻', label: '優雅細緻', emoji: '🎭' },
      { value: '清新輕快', label: '清新輕快', emoji: '🍃' },
      { value: '濃郁豐富', label: '濃郁豐富', emoji: '🌷' },
      { value: '個性獨特', label: '個性獨特', emoji: '💥' },
      { value: '均衡和諧', label: '均衡和諧', emoji: '☯️' },
    ],
  },
  {
    id: 'impression', section: '風味總評', sectionColor: '#f97316',
    text: '對這款酒的整體印象？', hint: '可多選', optional: true, type: 'multi',
    options: [
      { value: '適合搭餐', label: '適合搭餐', emoji: '🍽️' },
      { value: '適合單飲', label: '適合單飲', emoji: '🥂' },
      { value: '高性價比', label: '高性價比', emoji: '💰' },
      { value: '適合初學者', label: '適合初學者', emoji: '🎯' },
      { value: '適合送禮', label: '適合送禮', emoji: '🎁' },
      { value: '個性酒款', label: '個性酒款', emoji: '⭐' },
      { value: '季節限定感', label: '季節限定感', emoji: '🍂' },
    ],
  },
  // ── 餐搭 ──────────────────────────────────────────────────────────────────
  {
    id: 'food', section: '餐搭', sectionColor: '#dc2626',
    text: '推薦搭配的料理？', hint: '可多選', optional: true, type: 'multi',
    options: [
      { value: '生魚片',   label: '生魚片',   emoji: '🐟' },
      { value: '壽司',     label: '壽司',     emoji: '🍣' },
      { value: '貝類海鮮', label: '貝類海鮮', emoji: '🦞' },
      { value: '天婦羅',   label: '天婦羅',   emoji: '🍤' },
      { value: '燒鳥',     label: '燒鳥',     emoji: '🍗' },
      { value: '豆腐',     label: '豆腐',     emoji: '🫘' },
      { value: '起司',     label: '起司',     emoji: '🧀' },
      { value: '沙拉涼拌', label: '沙拉涼拌', emoji: '🥗' },
      { value: '白肉料理', label: '白肉料理', emoji: '🍖' },
      { value: '燉煮料理', label: '燉煮料理', emoji: '🍲' },
      { value: '和牛紅肉', label: '和牛/紅肉', emoji: '🥩' },
    ],
  },
];

const SECTIONS = ['外觀', '香氣', '口感', '尾韻', '風味總評', '餐搭'];
const SECTION_COLORS: Record<string, string> = {
  '外觀': '#d4af37', '香氣': '#7c3aed', '口感': '#059669',
  '尾韻': '#0ea5e9', '風味總評': '#f97316', '餐搭': '#dc2626',
};
const SECTION_ICONS: Record<string, string> = {
  '外觀': '👁️', '香氣': '👃', '口感': '👅', '尾韻': '🌊', '風味總評': '⭐', '餐搭': '🍽️',
};

// ─── Build result from answers ────────────────────────────────────────────────
function buildResult(answers: Record<string, string | string[]>): GuidedTastingResult {
  const get = (id: string) => answers[id] as string | undefined;
  const getArr = (id: string) => (answers[id] as string[] | undefined) ?? [];
  const getNum = (id: string) => parseInt((answers[id] as string) || '3', 10);

  const parts: string[] = [];

  // 外觀
  const color = get('color');
  const clarity = get('clarity');
  if (color || clarity) {
    parts.push(`【外觀】酒液${color ?? ''}${clarity ? `，${clarity}` : ''}`);
  }

  // 香氣
  const aromaInt = get('aromaIntensity');
  const aromaType = getArr('aromaType');
  const aromaDetail = getArr('aromaDetail');
  if (aromaInt || aromaType.length > 0) {
    let line = '【香氣】';
    if (aromaInt) line += `香氣${aromaInt}`;
    if (aromaType.length > 0) line += `${aromaInt ? '，' : ''}帶有${aromaType.join('、')}`;
    if (aromaDetail.length > 0) line += `；細嗅可辨${aromaDetail.join('、')}`;
    parts.push(line);
  }

  // 口感
  const sw = getNum('sweetness');
  const ac = getNum('acidity');
  const bi = getNum('bitterness');
  const um = getNum('umami');
  const as_ = getNum('astringency');
  const tasteOverall = get('tasteOverall');
  if (tasteOverall) {
    parts.push(`【口感】${tasteOverall}，甜/酸/苦/旨/澀 ${sw}/${ac}/${bi}/${um}/${as_}`);
  }

  // 尾韻
  const finLen = get('finishLength');
  const finChar = getArr('finishChar');
  if (finLen || finChar.length > 0) {
    let line = '【尾韻】';
    if (finLen) line += finLen;
    if (finChar.length > 0) line += `${finLen ? '，' : ''}${finChar.join('、')}`;
    parts.push(line);
  }

  // 總評
  const style = get('style');
  const impression = getArr('impression');
  if (style) {
    let line = `【總評】${style}`;
    if (impression.length > 0) line += `，${impression.join('、')}`;
    parts.push(line);
  }

  const styleTags: string[] = [];
  if (style) styleTags.push(style);
  styleTags.push(...impression);

  const foods = getArr('food');
  const foodPairings = foods.map(food => ({ food, pairing: 'yes' as const, reason: '' }));

  return {
    sweetness: sw, acidity: ac, bitterness: bi, umami: um, astringency: as_,
    userDescription: parts.join('\n'),
    styleTags,
    foodPairings,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  onComplete: (result: GuidedTastingResult) => void;
  onClose: () => void;
}

export function GuidedTasting({ onComplete, onClose }: Props) {
  // step -1 = intro screen
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [autoAdvance, setAutoAdvance] = useState<ReturnType<typeof setTimeout> | null>(null);

  const q = step >= 0 ? QUESTIONS[step] : null;
  const progress = step < 0 ? 0 : ((step + 1) / QUESTIONS.length) * 100;
  const answer = q ? (answers[q.id] ?? (q.type === 'multi' ? [] : '')) : '';
  const isAnswered = q
    ? (q.type === 'multi' ? (answer as string[]).length > 0 : (answer as string).length > 0)
    : false;
  const canNext = isAnswered || (q?.optional ?? false);
  const isLast = step === QUESTIONS.length - 1;

  const goNext = () => {
    if (isLast) {
      onComplete(buildResult(answers));
    } else {
      setStep(s => s + 1);
    }
  };

  const goBack = () => {
    if (step <= 0) setStep(-1);
    else setStep(s => s - 1);
  };

  const toggleOption = (value: string) => {
    if (!q) return;
    if (q.type === 'multi') {
      setAnswers(prev => {
        const prev_ = (prev[q.id] as string[]) ?? [];
        return {
          ...prev,
          [q.id]: prev_.includes(value) ? prev_.filter(v => v !== value) : [...prev_, value],
        };
      });
    } else {
      // single / rating5: toggle off if same value; auto-advance for single (not rating5)
      const newVal = answers[q.id] === value ? '' : value;
      setAnswers(prev => ({ ...prev, [q.id]: newVal }));
      if (q.type === 'single' && newVal) {
        // auto-advance after 280ms so user sees the selection
        if (autoAdvance) clearTimeout(autoAdvance);
        const t = setTimeout(() => {
          if (step < QUESTIONS.length - 1) setStep(s => s + 1);
          else onComplete(buildResult({ ...answers, [q.id]: newVal }));
        }, 280);
        setAutoAdvance(t);
      }
    }
  };

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (step === -1) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'linear-gradient(160deg, #0a0a0c 0%, #130a14 100%)' }}
      >
        <div className="flex items-center justify-end px-5 pt-6 pb-4">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center overflow-y-auto pb-4">
          <div className="text-4xl mb-2">🍶</div>
          <h1 className="text-xl font-bold text-white tracking-wide mb-1">引導式品鑒</h1>
          <p className="text-white/45 text-xs leading-relaxed mb-4 max-w-xs">
            跟著步驟完成品評，系統自動填入評分與品飲描述，共 {QUESTIONS.length} 個問題
          </p>

          <div className="w-full grid grid-cols-2 gap-1.5 max-w-sm">
            {SECTIONS.map((s, i) => {
              const count = QUESTIONS.filter(q => q.section === s).length;
              return (
                <div
                  key={s}
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: `${SECTION_COLORS[s]}14`, border: `1px solid ${SECTION_COLORS[s]}28` }}
                >
                  <span className="text-sm shrink-0">{SECTION_ICONS[s]}</span>
                  <span className="text-xs font-bold text-white/80 flex-1 text-left">{s}</span>
                  <span className="text-[9px] font-bold text-white/30">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-10 pt-3">
          <Button
            className="w-full h-14 rounded-full text-sm font-bold uppercase tracking-widest"
            style={{ background: '#f97316' }}
            onClick={() => setStep(0)}
          >
            開始品鑒 <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  if (!q) return null;
  const sectionColor = q.sectionColor;

  // ── Question screen ────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(160deg, #0a0a0c 0%, #130a14 100%)' }}
    >
      {/* Header */}
      <div className="px-5 pt-6 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: `${sectionColor}20`, border: `1px solid ${sectionColor}40` }}
          >
            <span className="text-sm">{SECTION_ICONS[q.section]}</span>
            <span className="text-xs font-bold" style={{ color: sectionColor }}>{q.section}</span>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-400"
            style={{ width: `${progress}%`, background: sectionColor }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-white/25 font-bold">
            {SECTIONS.indexOf(q.section) + 1} / {SECTIONS.length} 個區塊
          </span>
          <span className="text-[10px] text-white/25 font-bold">{step + 1} / {QUESTIONS.length}</span>
        </div>
      </div>

      {/* Question + Options */}
      <div className="flex-1 overflow-y-auto px-5 py-2">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white leading-snug">{q.text}</h2>
          {q.hint && <p className="text-xs text-white/35 mt-1.5 font-medium">{q.hint}</p>}
        </div>

        {q.type === 'rating5' ? (
          <div className="space-y-4">
            {q.low && (
              <div className="flex justify-between text-[10px] text-white/35 font-bold">
                <span>← {q.low}</span>
                <span>{q.high} →</span>
              </div>
            )}
            <div className="flex gap-2.5">
              {q.options.map(opt => {
                const selected = answer === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    className={cn(
                      'flex-1 aspect-square rounded-2xl flex items-center justify-center font-bold text-xl transition-all active:scale-95',
                      selected ? 'text-white shadow-lg scale-105' : 'bg-white/6 text-white/40'
                    )}
                    style={selected ? { background: sectionColor, boxShadow: `0 4px 20px ${sectionColor}50` } : undefined}
                  >
                    {opt.value}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {q.options.map(opt => {
              const selected = q.type === 'multi'
                ? (answer as string[]).includes(opt.value)
                : answer === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  className={cn(
                    'relative rounded-2xl p-4 text-left transition-all border active:scale-95',
                    selected
                      ? 'text-white border-transparent'
                      : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/8'
                  )}
                  style={selected ? { background: `${sectionColor}28`, borderColor: sectionColor } : undefined}
                >
                  {opt.emoji && <span className="text-2xl block mb-1.5">{opt.emoji}</span>}
                  <span className="text-xs font-bold leading-tight">{opt.label}</span>
                  {selected && (
                    <div
                      className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: sectionColor }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-10 pt-3 shrink-0 space-y-2">
        {/* For multi/rating5 show explicit next button; single auto-advances */}
        {q.type !== 'single' && (
          <Button
            className="w-full h-14 rounded-full text-sm font-bold uppercase tracking-widest transition-all"
            style={canNext ? { background: sectionColor } : undefined}
            disabled={!canNext}
            variant={canNext ? 'default' : 'outline'}
            onClick={goNext}
          >
            {isLast
              ? <><Check className="w-4 h-4 mr-2" /> 完成品鑒</>
              : <>下一步 <ArrowRight className="w-4 h-4 ml-2" /></>
            }
          </Button>
        )}
        {q.optional && !isAnswered && (
          <button
            onClick={goNext}
            className="w-full text-center text-xs text-white/25 py-1.5 font-bold uppercase tracking-widest"
          >
            跳過此題
          </button>
        )}
      </div>
    </div>
  );
}
