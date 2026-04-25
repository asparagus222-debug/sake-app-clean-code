"use client"

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CUP_TYPE_OPTIONS, SERVING_TEMPERATURE_OPTIONS } from '@/lib/types';

type QType = 'single' | 'multi' | 'rating5' | 'text';
type GuidedAnswerValue = string | string[];
export type GuidedTastingAnswers = Record<string, GuidedAnswerValue>;

interface Opt { value: string; label: string; emoji?: string; }
interface Q {
  id: string;
  section: string;
  sectionColor: string;
  text: string;
  shortLabel?: string;
  hint?: string;
  optional?: boolean;
  allowCustom?: boolean;
  type: QType;
  low?: string;
  high?: string;
  options: Opt[];
}

export interface GuidedTastingResult {
  sweetness: number;
  acidity: number;
  bitterness: number;
  umami: number;
  astringency: number;
  userDescription: string;
  guidedSummary: string;
  styleTags: string[];
  foodPairings: { food: string; pairing: 'yes'; reason: string }[];
  servingTemperatures: string[];
  cupTypes: string[];
  otherComments?: string;
  answers: GuidedTastingAnswers;
}

const QUESTIONS: Q[] = [
  {
    id: 'color', section: '外觀', sectionColor: '#d4af37',
    text: '酒液的顏色？', shortLabel: '酒液顏色', type: 'single',
    options: [
      { value: '無色透明', label: '無色透明', emoji: '💧' },
      { value: '淡黃色', label: '淡黃色', emoji: '🌙' },
      { value: '金黃色', label: '金黃色', emoji: '⭐' },
      { value: '淡琥珀色', label: '淡琥珀色', emoji: '🍯' },
      { value: '琥珀色', label: '琥珀色', emoji: '🌅' },
    ],
  },
  {
    id: 'clarity', section: '外觀', sectionColor: '#d4af37',
    text: '清澈度？', shortLabel: '清澈度', type: 'single',
    options: [
      { value: '晶瑩剔透', label: '晶瑩剔透', emoji: '💎' },
      { value: '清澈', label: '清澈', emoji: '🫙' },
      { value: '略帶濁感', label: '略帶濁感', emoji: '🫧' },
      { value: '濁酒', label: '濁酒（にごり）', emoji: '🌫️' },
    ],
  },
  {
    id: 'bubbles', section: '外觀', sectionColor: '#d4af37',
    text: '氣泡感？', shortLabel: '氣泡', type: 'single',
    options: [
      { value: '無', label: '無', emoji: '⚪' },
      { value: '微', label: '微', emoji: '🫧' },
      { value: '中等', label: '中等', emoji: '✨' },
      { value: '強', label: '強', emoji: '🥂' },
    ],
  },
  {
    id: 'aromaIntensity', section: '香氣', sectionColor: '#7c3aed',
    text: '香氣的強度？', shortLabel: '香氣強度', type: 'single',
    options: [
      { value: '淡雅低調', label: '淡雅低調', emoji: '🌿' },
      { value: '適中均衡', label: '適中均衡', emoji: '🌸' },
      { value: '濃郁豐富', label: '濃郁豐富', emoji: '🌺' },
      { value: '強烈奔放', label: '強烈奔放', emoji: '🎆' },
    ],
  },
  {
    id: 'aromaType', section: '香氣', sectionColor: '#7c3aed',
    text: '主要香氣類型？', shortLabel: '主要香氣', hint: '可多選', type: 'multi', allowCustom: true,
    options: [
      { value: '吟釀花香', label: '吟釀花香', emoji: '🌸' },
      { value: '水果香', label: '水果香', emoji: '🍊' },
      { value: '稻米清香', label: '稻米清香', emoji: '🌾' },
      { value: '乳酸奶香', label: '乳酸奶香', emoji: '🥛' },
      { value: '木桶陳釀', label: '木桶陳釀', emoji: '🪵' },
      { value: '礦物土壤', label: '礦物土壤', emoji: '🪨' },
      { value: '草本植物', label: '草本植物', emoji: '🌿' },
      { value: '煙燻味', label: '煙燻味', emoji: '🔥' },
    ],
  },
  {
    id: 'aromaDetail', section: '香氣', sectionColor: '#7c3aed',
    text: '更細緻的香氣描述？', shortLabel: '細緻香氣', hint: '可多選', optional: true, type: 'multi',
    options: [
      { value: '蘋果梨子', label: '蘋果梨子', emoji: '🍎' },
      { value: '哈密瓜', label: '哈密瓜', emoji: '🍈' },
      { value: '香蕉鳳梨', label: '香蕉鳳梨', emoji: '🍋' },
      { value: '柑橘檸檬', label: '柑橘檸檬', emoji: '🍊' },
      { value: '白桃荔枝', label: '白桃荔枝', emoji: '🍑' },
      { value: '栗子蜂蜜', label: '栗子蜂蜜', emoji: '🍯' },
      { value: '白花茉莉', label: '白花茉莉', emoji: '🌼' },
      { value: '奶油布丁', label: '奶油布丁', emoji: '🍮' },
      { value: '辛香料', label: '辛香料', emoji: '🧄' },
    ],
  },
  {
    id: 'sweetness', section: '口感', sectionColor: '#059669',
    text: '甜味強度？', shortLabel: '甜味', type: 'rating5', low: '乾爽無甜', high: '濃郁甜潤',
    options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }],
  },
  {
    id: 'acidity', section: '口感', sectionColor: '#059669',
    text: '酸味強度？', shortLabel: '酸味', type: 'rating5', low: '幾乎無酸', high: '高酸活潑',
    options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }],
  },
  {
    id: 'bitterness', section: '口感', sectionColor: '#059669',
    text: '苦味強度？', shortLabel: '苦味', type: 'rating5', low: '幾乎無苦', high: '強烈苦澀',
    options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }],
  },
  {
    id: 'umami', section: '口感', sectionColor: '#059669',
    text: '旨味（鮮味）強度？', shortLabel: '旨味', type: 'rating5', low: '輕盈清淡', high: '濃郁旨鮮',
    options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }],
  },
  {
    id: 'astringency', section: '口感', sectionColor: '#059669',
    text: '澀感強度？', shortLabel: '澀感', type: 'rating5', low: '絲滑無澀', high: '強烈收澀',
    options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }],
  },
  {
    id: 'tasteOverall', section: '口感', sectionColor: '#059669',
    text: '整體口感印象？', shortLabel: '口感印象', type: 'single',
    options: [
      { value: '清爽輕盈', label: '清爽輕盈', emoji: '🌊' },
      { value: '均衡細緻', label: '均衡細緻', emoji: '⚖️' },
      { value: '飽滿圓潤', label: '飽滿圓潤', emoji: '🌕' },
      { value: '濃醇厚重', label: '濃醇厚重', emoji: '🏔️' },
    ],
  },
  {
    id: 'finishLength', section: '尾韻', sectionColor: '#0ea5e9',
    text: '尾韻的長度？', shortLabel: '尾韻長度', type: 'single',
    options: [
      { value: '短暫清脆', label: '短暫清脆', emoji: '⚡' },
      { value: '適中均衡', label: '適中均衡', emoji: '🌤️' },
      { value: '綿長悠遠', label: '綿長悠遠', emoji: '🌅' },
      { value: '極長持久', label: '極長持久', emoji: '🌠' },
    ],
  },
  {
    id: 'finishChar', section: '尾韻', sectionColor: '#0ea5e9',
    text: '尾韻的感受？', shortLabel: '尾韻感受', hint: '可多選', type: 'multi',
    options: [
      { value: '乾淨清爽', label: '乾淨清爽', emoji: '✨' },
      { value: '微甜收尾', label: '微甜收尾', emoji: '🍬' },
      { value: '苦底韻', label: '苦底韻', emoji: '🍵' },
      { value: '旨味回甘', label: '旨味回甘', emoji: '🌿' },
      { value: '餘香持久', label: '餘香持久', emoji: '🌸' },
      { value: '礦物感', label: '礦物感', emoji: '🪨' },
      { value: '溫暖酒感', label: '溫暖酒感', emoji: '🔥' },
    ],
  },
  {
    id: 'style', section: '風味總評', sectionColor: '#f97316',
    text: '整體風格定位？', shortLabel: '風格定位', type: 'single',
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
    text: '對這款酒的整體印象？', shortLabel: '整體印象', hint: '可多選', optional: true, type: 'multi',
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
  {
    id: 'food', section: '餐搭', sectionColor: '#dc2626',
    text: '推薦搭配的料理？', shortLabel: '推薦餐搭', hint: '可多選', optional: true, type: 'multi',
    options: [
      { value: '生魚片', label: '生魚片', emoji: '🐟' },
      { value: '壽司', label: '壽司', emoji: '🍣' },
      { value: '貝類海鮮', label: '貝類海鮮', emoji: '🦞' },
      { value: '天婦羅', label: '天婦羅', emoji: '🍤' },
      { value: '燒鳥', label: '燒鳥', emoji: '🍗' },
      { value: '豆腐', label: '豆腐', emoji: '🫘' },
      { value: '起司', label: '起司', emoji: '🧀' },
      { value: '沙拉涼拌', label: '沙拉涼拌', emoji: '🥗' },
      { value: '白肉料理', label: '白肉料理', emoji: '🍖' },
      { value: '燉煮料理', label: '燉煮料理', emoji: '🍲' },
      { value: '和牛紅肉', label: '和牛/紅肉', emoji: '🥩' },
    ],
  },
  {
    id: 'servingTemperature', section: '飲用建議', sectionColor: '#f59e0b',
    text: '建議的適飲溫度？', shortLabel: '適飲溫度', hint: '可多選', optional: true, type: 'multi',
    options: SERVING_TEMPERATURE_OPTIONS.map((option) => ({ value: option, label: option, emoji: '🌡️' })),
  },
  {
    id: 'cupType', section: '飲用建議', sectionColor: '#f59e0b',
    text: '推薦的杯型？', shortLabel: '推薦杯型', hint: '可多選', optional: true, type: 'multi',
    options: CUP_TYPE_OPTIONS.map((option) => ({ value: option, label: option, emoji: '🍶' })),
  },
  {
    id: 'otherComments', section: '其他補充', sectionColor: '#64748b',
    text: '有其他想補充的嗎？', shortLabel: '額外補充', hint: '可自由填寫補充、情境、搭配經驗等', optional: true, type: 'text',
    options: [],
  },
];

const SECTIONS = ['外觀', '香氣', '口感', '尾韻', '風味總評', '餐搭', '飲用建議', '其他補充'];
const SECTION_COLORS: Record<string, string> = {
  '外觀': '#d4af37',
  '香氣': '#7c3aed',
  '口感': '#059669',
  '尾韻': '#0ea5e9',
  '風味總評': '#f97316',
  '餐搭': '#dc2626',
  '飲用建議': '#f59e0b',
  '其他補充': '#64748b',
};
const SECTION_ICONS: Record<string, string> = {
  '外觀': '👁️',
  '香氣': '👃',
  '口感': '👅',
  '尾韻': '🌊',
  '風味總評': '⭐',
  '餐搭': '🍽️',
  '飲用建議': '🍶',
  '其他補充': '📝',
};

function hasAnswer(answers: GuidedTastingAnswers, questionId: string) {
  const value = answers[questionId];
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' && value.trim().length > 0;
}

function buildResult(answers: GuidedTastingAnswers): GuidedTastingResult {
  const get = (id: string) => answers[id] as string | undefined;
  const getArr = (id: string) => (answers[id] as string[] | undefined) ?? [];
  const getNum = (id: string) => parseInt((answers[id] as string) || '3', 10);

  const parts: string[] = [];

  const color = get('color');
  const clarity = get('clarity');
  const bubbles = get('bubbles');
  if (color || clarity || bubbles) {
    let line = `【外觀】酒液${color ?? ''}`;
    if (clarity) line += `${color ? '，' : ''}${clarity}`;
    if (bubbles) line += `${color || clarity ? '，' : ''}氣泡感${bubbles}`;
    parts.push(line);
  }

  const aromaIntensity = get('aromaIntensity');
  const aromaType = getArr('aromaType');
  const aromaTypeCustom = get('aromaTypeCustom')?.trim();
  const aromaDetail = getArr('aromaDetail');
  const allAromaTypes = aromaTypeCustom ? [...aromaType, aromaTypeCustom] : aromaType;
  if (aromaIntensity || allAromaTypes.length > 0 || aromaDetail.length > 0) {
    let line = '【香氣】';
    if (aromaIntensity) line += `香氣${aromaIntensity}`;
    if (allAromaTypes.length > 0) line += `${aromaIntensity ? '，' : ''}帶有${allAromaTypes.join('、')}`;
    if (aromaDetail.length > 0) line += `${aromaIntensity || allAromaTypes.length > 0 ? '；' : ''}細嗅可辨${aromaDetail.join('、')}`;
    parts.push(line);
  }

  const tasteOverall = get('tasteOverall');
  if (tasteOverall) {
    parts.push(`【口感】${tasteOverall}`);
  }

  const finishLength = get('finishLength');
  const finishChar = getArr('finishChar');
  if (finishLength || finishChar.length > 0) {
    let line = '【尾韻】';
    if (finishLength) line += finishLength;
    if (finishChar.length > 0) line += `${finishLength ? '，' : ''}${finishChar.join('、')}`;
    parts.push(line);
  }

  const style = get('style');
  const impression = getArr('impression');
  if (style || impression.length > 0) {
    let line = '【總評】';
    if (style) line += style;
    if (impression.length > 0) line += `${style ? '，' : ''}${impression.join('、')}`;
    parts.push(line);
  }

  const styleTags: string[] = [];
  if (style) styleTags.push(style);
  styleTags.push(...impression);

  const foods = getArr('food');
  const foodPairings = foods.map((food) => ({ food, pairing: 'yes' as const, reason: '' }));
  const servingTemperatures = getArr('servingTemperature');
  const cupTypes = getArr('cupType');
  const otherComments = get('otherComments') ?? '';
  const guidedSummary = parts.join('\n');

  return {
    sweetness: getNum('sweetness'),
    acidity: getNum('acidity'),
    bitterness: getNum('bitterness'),
    umami: getNum('umami'),
    astringency: getNum('astringency'),
    userDescription: guidedSummary,
    guidedSummary,
    styleTags,
    foodPairings,
    servingTemperatures,
    cupTypes,
    otherComments,
    answers,
  };
}

interface Props {
  onComplete: (result: GuidedTastingResult) => void;
  onClose: () => void;
  initialAnswers?: GuidedTastingAnswers;
  onAnswersChange?: (answers: GuidedTastingAnswers) => void;
}

export function GuidedTasting({ onComplete, onClose, initialAnswers, onAnswersChange }: Props) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [continuousMode, setContinuousMode] = useState(false);
  const [answers, setAnswers] = useState<GuidedTastingAnswers>(initialAnswers ?? {});
  
  const activeSectionQuestions = useMemo(
    () => continuousMode ? QUESTIONS : (activeSection ? QUESTIONS.filter((question) => question.section === activeSection) : []),
    [activeSection, continuousMode]
  );
  const activeQuestion = continuousMode
    ? activeSectionQuestions[activeQuestionIndex] ?? null
    : (activeSection ? activeSectionQuestions[activeQuestionIndex] ?? null : null);
  const answeredCount = useMemo(
    () => QUESTIONS.filter((question) => hasAnswer(answers, question.id)).length,
    [answers]
  );
  const activeIsLastInSection = activeSectionQuestions.length > 0 && activeQuestionIndex === activeSectionQuestions.length - 1;

  const updateAnswer = (questionId: string, value: GuidedAnswerValue) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      onAnswersChange?.(next);
      return next;
    });
  };

  const returnHome = () => {
    setActiveSection(null);
    setActiveQuestionIndex(0);
    setContinuousMode(false);
  };

  const enterSection = (section: string, startFromFirst = false) => {
    const sectionQuestions = QUESTIONS.filter((question) => question.section === section);
    const firstUnansweredIndex = sectionQuestions.findIndex((question) => !hasAnswer(answers, question.id));
    setActiveSection(section);
    if (startFromFirst || firstUnansweredIndex === -1) {
      setActiveQuestionIndex(0);
      return;
    }
    setActiveQuestionIndex(firstUnansweredIndex);
  };

  const startFromBeginning = () => {
    setContinuousMode(true);
    setActiveSection(null);
    setActiveQuestionIndex(0);
  };

  const moveNextInSection = () => {
    if (continuousMode) {
      if (activeIsLastInSection) {
        onComplete(buildResult(answers));
        return;
      }
      setActiveQuestionIndex((prev) => prev + 1);
      return;
    }
    
    if (activeIsLastInSection) {
      returnHome();
      return;
    }
    setActiveQuestionIndex((prev) => prev + 1);
  };

  const primaryActionLabel = continuousMode
    ? activeIsLastInSection
      ? '完成品鑑'
      : '確認並下一題'
    : activeIsLastInSection
      ? '確認並返回分組'
      : '確認並下一題';

  const toggleOption = (question: Q, value: string) => {
    if (question.type === 'multi') {
      const current = (answers[question.id] as string[] | undefined) ?? [];
      updateAnswer(
        question.id,
        current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
      );
      return;
    }

    const current = answers[question.id] as string | undefined;
    const nextValue = current === value ? '' : value;
    updateAnswer(question.id, nextValue);
  };

  if (!activeQuestion) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'linear-gradient(160deg, #0a0a0c 0%, #130a14 100%)' }}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Guided Tasting</p>
            <h1 className="text-xl font-bold text-white tracking-wide">引導式品鑑</h1>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white/80">已完成 {answeredCount} / {QUESTIONS.length} 題</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">點任一題目補充後會自動回到這裡，你可以逐題慢慢補，最後再一次整理到筆記。</p>
              </div>
              <div className="text-3xl">🍶</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
          {SECTIONS.map((section) => {
            const sectionQuestions = QUESTIONS.filter((question) => question.section === section);
            const sectionDone = sectionQuestions.filter((question) => hasAnswer(answers, question.id)).length;
            const sectionAllDone = sectionDone === sectionQuestions.length;
            const sectionSummary = sectionQuestions
              .filter((question) => hasAnswer(answers, question.id))
              .slice(0, 2)
              .map((question) => question.shortLabel ?? question.text)
              .join('、');

            return (
              <section key={section} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{SECTION_ICONS[section]}</span>
                    <div>
                      <p className="text-xs font-bold text-white/85">{section}</p>
                      <p className="text-[10px] text-white/35">{sectionDone} / {sectionQuestions.length} 已填寫</p>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{ background: `${SECTION_COLORS[section]}22`, color: SECTION_COLORS[section] }}
                  >
                    {sectionAllDone ? '已完成' : '可補充'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => enterSection(section)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all',
                    sectionAllDone ? 'border-emerald-400/35 bg-emerald-400/10 text-white' : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/8'
                  )}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: sectionAllDone ? '#10b981' : `${SECTION_COLORS[section]}22`, color: sectionAllDone ? '#052e16' : SECTION_COLORS[section] }}
                  >
                    {sectionAllDone ? <Check className="h-3.5 w-3.5" /> : SECTION_ICONS[section]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-tight">{section}（{sectionQuestions.length} 題）</p>
                    <p className="mt-1 text-[10px] text-white/40">{sectionSummary ? `已填：${sectionSummary}` : '尚未填寫'}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/35" />
                </button>
              </section>
            );
          })}
        </div>

        <div className="px-5 pb-10 pt-3 space-y-3">
          <Button
            className="h-12 w-full rounded-2xl border border-primary/40 bg-primary/10 text-primary text-xs font-bold tracking-widest hover:bg-primary/20 hover:border-primary/60 transition-all"
            variant="ghost"
            onClick={startFromBeginning}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> 從頭開始品鑑
          </Button>
          <Button
            className="h-14 w-full rounded-2xl bg-primary text-white text-sm font-bold tracking-widest shadow-lg shadow-primary/30 hover:brightness-110 transition-all"
            onClick={() => onComplete(buildResult(answers))}
          >
            <Check className="mr-2 h-5 w-5" /> 完成品鑑
          </Button>
          <p className="text-center text-[10px] text-white/30">可只補特定分組，補完後直接點「完成品鑑」整理到筆記。</p>
        </div>
      </div>
    );
  }

  const answer = answers[activeQuestion.id] ?? (activeQuestion.type === 'multi' ? [] : '');
  const answered = hasAnswer(answers, activeQuestion.id);
  const canSave = answered || activeQuestion.optional;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(160deg, #0a0a0c 0%, #130a14 100%)' }}
    >
      <div className="px-5 pt-6 pb-3 shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={returnHome} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>

          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: `${activeQuestion.sectionColor}20`, border: `1px solid ${activeQuestion.sectionColor}40` }}>
            <span className="text-sm">{SECTION_ICONS[activeQuestion.section]}</span>
            <span className="text-xs font-bold" style={{ color: activeQuestion.sectionColor }}>{activeQuestion.section}</span>
          </div>

          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        <div className="rounded-full bg-white/8 px-3 py-2 text-center text-[10px] font-bold text-white/35">
          {continuousMode
            ? `第 ${activeQuestionIndex + 1} / ${activeSectionQuestions.length} 題`
            : `${activeQuestion.section}：第 ${activeQuestionIndex + 1} / ${activeSectionQuestions.length} 題`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-2">
        <div className="mb-6">
          <h2 className="text-xl font-bold leading-snug text-white">{activeQuestion.text}</h2>
          {activeQuestion.hint && <p className="mt-1.5 text-xs font-medium text-white/35">{activeQuestion.hint}</p>}
        </div>

        {activeQuestion.type === 'rating5' ? (
          <div className="space-y-4">
            {activeQuestion.low && (
              <div className="flex justify-between text-[10px] font-bold text-white/35">
                <span>← {activeQuestion.low}</span>
                <span>{activeQuestion.high} →</span>
              </div>
            )}
            <div className="flex gap-2.5">
              {activeQuestion.options.map((option) => {
                const selected = answer === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => toggleOption(activeQuestion, option.value)}
                    className={cn(
                      'flex-1 aspect-square rounded-2xl flex items-center justify-center font-bold text-xl transition-all active:scale-95',
                      selected ? 'text-white shadow-lg scale-105' : 'bg-white/6 text-white/40'
                    )}
                    style={selected ? { background: activeQuestion.sectionColor, boxShadow: `0 4px 20px ${activeQuestion.sectionColor}50` } : undefined}
                  >
                    {option.value}
                  </button>
                );
              })}
            </div>
          </div>
        ) : activeQuestion.type === 'text' ? (
          <textarea
            className="min-h-[160px] w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white outline-none transition-all focus:border-white/20"
            placeholder="例如：這支酒在回溫後米旨味更明顯、和某道料理特別搭、今天喝酒的情境感受..."
            value={typeof answer === 'string' ? answer : ''}
            onChange={(event) => updateAnswer(activeQuestion.id, event.target.value)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {activeQuestion.options.map((option) => {
              const selected = activeQuestion.type === 'multi'
                ? (answer as string[]).includes(option.value)
                : answer === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => toggleOption(activeQuestion, option.value)}
                  className={cn(
                    'relative rounded-2xl border p-4 text-left transition-all active:scale-95',
                    selected ? 'border-transparent text-white' : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/8'
                  )}
                  style={selected ? { background: `${activeQuestion.sectionColor}28`, borderColor: activeQuestion.sectionColor } : undefined}
                >
                  {option.emoji && <span className="mb-1.5 block text-2xl">{option.emoji}</span>}
                  <span className="text-xs font-bold leading-tight">{option.label}</span>
                  {selected && (
                    <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full" style={{ background: activeQuestion.sectionColor }}>
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {activeQuestion.allowCustom && (
            <input
              type="text"
              className="mt-2.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:border-white/30 placeholder:text-white/25"
              placeholder="其他香氣（自填）"
              value={typeof answers[`${activeQuestion.id}Custom`] === 'string' ? answers[`${activeQuestion.id}Custom`] as string : ''}
              onChange={(e) => updateAnswer(`${activeQuestion.id}Custom`, e.target.value)}
            />
          )}
        )}
      </div>

      <div className="space-y-2 px-5 pb-10 pt-3 shrink-0">
        <Button
          className="w-full h-14 rounded-full text-sm font-bold uppercase tracking-widest transition-all"
          style={canSave ? { background: activeQuestion.sectionColor } : undefined}
          disabled={!canSave}
          variant={canSave ? 'default' : 'outline'}
          onClick={moveNextInSection}
        >
          {primaryActionLabel} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        {answered && continuousMode && (
          <button
            onClick={() => moveNextInSection()}
            className="w-full text-center text-xs font-bold uppercase tracking-widest text-white/30 py-1.5"
          >
            跳過此題 →
          </button>
        )}

        {!answered && !continuousMode && (
          <button
            onClick={returnHome}
            className="w-full text-center text-xs font-bold uppercase tracking-widest text-white/25 py-1.5"
          >
            先跳過這題，返回首頁
          </button>
        )}

        {!answered && continuousMode && (
          <button
            onClick={() => moveNextInSection()}
            className="w-full text-center text-xs font-bold uppercase tracking-widest text-white/25 py-1.5"
          >
            先跳過這題 →
          </button>
        )}
      </div>
    </div>
  );
}
