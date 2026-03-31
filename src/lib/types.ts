
export type SakeNote = {
  id: string;
  userId: string;
  username?: string;
  brandName: string;
  subBrand?: string;
  brewery: string;
  origin?: string;
  imageUrls: string[];
  imageOriginals?: string[];
  imageTransforms?: Array<{ x: number; y: number; scale: number }>;
  imageSplitRatio?: number;
  sakeInfoTags?: string[];  // 酒精濃度、精米步合、酒米、特殊製程等標籤
  sweetnessRating: number;
  acidityRating: number;
  bitternessRating: number;
  umamiRating: number;
  astringencyRating: number;
  overallRating: number;
  styleTags?: string[];
  description: string;
  userDescription?: string;
  aiResultNote?: string;
  activeBrain?: 'left' | 'right';
  tastingDate: string;
  likesCount?: number;
  likedByUserIds?: string[];
  createdAt?: string;
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
