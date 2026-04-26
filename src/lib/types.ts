
export interface TastingSession {
  sessionIndex: number;   // 1-based (第1次=1, 第2次=2 …)
  timestamp: string;      // ISO datetime when tasted
  label: string;          // user-editable, e.g. "開瓶當天","第2天"
  sweetness: number;
  acidity: number;
  bitterness: number;
  umami: number;
  astringency: number;
  overallRating: number;
  userDescription: string;
  aiResultNote?: string;
  styleTags?: string[];
}

export type NoteEntryMode = 'standard' | 'expo-quick';

export type NoteVisibility = 'private' | 'public';

export type NotePublicationStatus = 'draft' | 'published';

export type ExpoBuyIntent = 'skip' | 'consider' | 'want' | 'must-buy';

export type ExpoQuickTagGroup = {
  category: string;
  tags: string[];
};

export type ExpoMeta = {
  eventId: string;
  eventName?: string;
  booth: string;
  price?: number | null;
  currency?: string;
  buyIntent?: ExpoBuyIntent;
  quickTags?: string[];
  quickNote?: string;
  isPurchased?: boolean;
};

export type ExpoEvent = {
  id: string;
  userId: string;
  name: string;
  venue?: string;
  eventDate: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ChatMessageType = 'message' | 'announcement';

export type ChatMessage = {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  text: string;
  messageType: ChatMessageType;
  createdAt: string;
};

export type SakeNote = {
  id: string;
  userId: string;
  username?: string;
  entryMode?: NoteEntryMode;
  visibility?: NoteVisibility;
  publicationStatus?: NotePublicationStatus;
  publishedAt?: string;
  brandName: string;
  subBrand?: string;
  brewery: string;
  origin?: string;
  expoMeta?: ExpoMeta;
  imageUrls: string[];
  imageOriginals?: string[];
  imageTransforms?: Array<{ x: number; y: number; scale: number; coordinateSpace?: 'pixels' | 'relative' }>;
  imageSplitRatio?: number;
  alcoholPercent?: string;  // 酒精濃度，例如 "15%" 或 "15-16%"
  sakeInfoTags?: string[];  // 精米步合、酒米、特殊製程等標籤
  foodPairings?: { food: string; pairing: 'yes' | 'no'; reason?: string }[];
  sweetnessRating: number;
  acidityRating: number;
  bitternessRating: number;
  umamiRating: number;
  astringencyRating: number;
  overallRating: number;
  styleTags?: string[];
  servingTemperature?: string;
  servingTemperatures?: string[];
  cupTypes?: string[];
  description: string;
  userDescription?: string;
  guidedTastingSummary?: string;
  guidedTastingAnswers?: Record<string, string | string[]>;
  otherComments?: string;
  aiResultNote?: string;
  activeBrain?: 'left' | 'right';
  tastingDate: string;
  likesCount?: number;
  likedByUserIds?: string[];
  createdAt?: string;
  // Multi-session evolution fields
  sessions?: TastingSession[];        // Extra tasting sessions beyond the original
  evolutionNote?: string;             // Author's manual evolution analysis
  followUpReminder?: {
    enabled: boolean;
    intervalHours: number;
    nextReminderAt: string;           // ISO datetime
  };
};

export type SakeComment = {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
};

export type ThemeSettings = {
  mode: 'dark' | 'light' | 'custom';
  customBg?: string;
  customPrimary?: string;
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
};

export type UserProfile = {
  id: string;
  username: string;
  accountType?: 'anonymous' | 'registered';
  bio: string;
  avatarUrl: string;
  instagram?: string;
  twitter?: string;
  facebook?: string;
  threads?: string;
  website?: string;
  qualifications?: string[];
  hasPin?: boolean;
  isAccountDeleted?: boolean;
  deletedAt?: string;
  themeSettings?: ThemeSettings;
  sponsorTotal?: number;
  authorStats?: {
    noteCount: number;
    likesReceivedCount: number;
    updatedAt: string;
  };
};

export const RATING_LABELS = {
  sweetness: ['極辛', '辛口', '中口', '甘口', '濃醇'],
  acidity: ['柔和', '清爽', '細緻', '鮮明', '強烈'],
  bitterness: ['無味', '微苦', '醇苦', '深邃', '強勁'],
  umami: ['輕盈', '淡雅', '豐沛', '豐厚', '濃郁'],
  astringency: ['順滑', '微澀', '略澀', '收斂', '強澀'],
};

export const STYLE_TAGS_OPTIONS = {
  classification: ['薰酒', '爽酒', '醇酒', '熟酒'],
  style: ['Classic', 'Modern'],
  body: ['Light', 'Medium', 'Rich']
};

export const SERVING_TEMPERATURE_OPTIONS = [
  '雪冷（5°C）',
  '花冷（10°C）',
  '涼冷（15°C）',
  '常溫（20°C）',
  '日向燗（30°C）',
  '人肌燗（35°C）',
  'ぬる燗（40°C）',
  '上燗（45°C）',
  '熱燗（50°C）',
  '飛切燗（55°C）'
];

export const CUP_TYPE_OPTIONS = [
  '蛇目杯',
  '葡萄酒杯',
  '香檳杯',
  '薄口平杯',
  '陶杯',
  '木杯',
];

export const QUALIFICATION_OPTIONS = [
  'SSI 日本酒 Navigator',
  'SSI 唎酒師',
  'SSI 日本酒品質鑑定士',
  'SSI 酒匠',
  'SSI 日本酒學講師',
  'WSET Sake Level 1',
  'WSET Sake Level 2',
  'WSET Sake Level 3',
  'JSA Sake Diploma',
  'Japan Sake Association 認定講師',
  'Japan Sake Association 大師講師',
  'Japan Sake Association Sake Concierge',
  'Japan Sake Association Sake Expert'
];

export const EXPO_QUICK_TAG_GROUPS: ExpoQuickTagGroup[] = [
  {
    category: '香氣',
    tags: ['弱｜花果', '中｜花果', '強｜花果', '弱｜米旨', '中｜米旨', '強｜米旨', '弱｜熟成', '中｜熟成', '強｜熟成', '乳酸', '果酸'],
  },
  {
    category: '氣泡',
    tags: ['無', '微', '中等', '刺激'],
  },
  {
    category: '甘辛口',
    tags: ['超甘口', '偏甘口', '甘辛平衡', '偏辛口', '超辛口'],
  },
  {
    category: '酸度',
    tags: ['不酸', '低酸', '酸感平衡', '明亮酸度', '明顯酸度'],
  },
  {
    category: '苦味',
    tags: ['不苦', '微苦', '苦感平衡', '偏苦', '明顯苦味'],
  },
  {
    category: '口感',
    tags: ['清爽', '圓潤', '醇厚', '微澀', '澀味', '明顯澀味'],
  },
  {
    category: '尾韻',
    tags: ['俐落', '中等', '綿長'],
  },
  {
    category: '酒精味',
    tags: ['無明顯酒精味', '微酒精味', '酒精味明顯'],
  },
  {
    category: '酒精刺激感',
    tags: ['無刺激', '微刺激', '刺激明顯'],
  },
];

export const EXPO_QUICK_TAG_OPTIONS = EXPO_QUICK_TAG_GROUPS.flatMap((group) => group.tags);
