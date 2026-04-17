import {
  ExpoBuyIntent,
  NoteEntryMode,
  NotePublicationStatus,
  NoteVisibility,
  SakeNote,
} from '@/lib/types';

export const DEFAULT_NOTE_ENTRY_MODE = 'standard' as const;
export const DEFAULT_NOTE_VISIBILITY: NoteVisibility = 'public';
export const DEFAULT_NOTE_PUBLICATION_STATUS: NotePublicationStatus = 'published';

export function isPublicPublishedNote(
  note?: {
    entryMode?: SakeNote['entryMode'] | string | null;
    visibility?: SakeNote['visibility'] | string | null;
    publicationStatus?: SakeNote['publicationStatus'] | string | null;
  } | null
) {
  if (!note) return false;

  const entryMode = note.entryMode ?? ('standard' as NoteEntryMode);
  const visibility = note.visibility ?? DEFAULT_NOTE_VISIBILITY;
  const publicationStatus = note.publicationStatus ?? DEFAULT_NOTE_PUBLICATION_STATUS;

  return entryMode !== 'expo-quick'
    && visibility === 'public'
    && publicationStatus === 'published';
}

export function isOwnedByUser(note: Pick<SakeNote, 'userId'> | null | undefined, uid?: string | null) {
  return !!note && !!uid && note.userId === uid;
}

export function canViewNote(note: SakeNote | null | undefined, uid?: string | null) {
  return isPublicPublishedNote(note) || isOwnedByUser(note, uid);
}

export function getExpoBuyIntentRank(intent?: ExpoBuyIntent | null) {
  switch (intent) {
    case 'must-buy':
      return 4;
    case 'want':
      return 3;
    case 'consider':
      return 2;
    case 'skip':
    default:
      return 1;
  }
}

export function getExpoBuyIntentLabel(intent?: ExpoBuyIntent | null) {
  switch (intent) {
    case 'must-buy':
      return '必買';
    case 'want':
      return '想買';
    case 'consider':
      return '可考慮';
    case 'skip':
    default:
      return '不買';
  }
}

export function getExpoBuyIntentClassName(intent?: ExpoBuyIntent | null) {
  switch (intent) {
    case 'must-buy':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    case 'want':
      return 'bg-sky-500/15 text-sky-300 border-sky-400/30';
    case 'consider':
      return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
    case 'skip':
    default:
      return 'bg-white/10 text-muted-foreground border-white/10';
  }
}

export function getSortableExpoPrice(note: Pick<SakeNote, 'expoMeta'>) {
  return typeof note.expoMeta?.price === 'number' ? note.expoMeta.price : Number.POSITIVE_INFINITY;
}

export function getExpoRawCpScore(note: Pick<SakeNote, 'overallRating' | 'expoMeta'>) {
  const price = note.expoMeta?.price;
  if (typeof price !== 'number' || price <= 0) return null;

  return ((note.overallRating ** 1.5) / price) * 3160;
}

export function getExpoCpScore(note: Pick<SakeNote, 'overallRating' | 'expoMeta'>) {
  const rawScore = getExpoRawCpScore(note);
  if (rawScore === null) return null;

  return rawScore;
}

export function getSortableExpoCpScore(note: Pick<SakeNote, 'overallRating' | 'expoMeta'>) {
  return getExpoRawCpScore(note) ?? Number.NEGATIVE_INFINITY;
}

export function getExpoNoteDisplayName(note: Pick<SakeNote, 'brandName' | 'brewery' | 'expoMeta'>) {
  const brandName = note.brandName?.trim();
  const brewery = note.brewery?.trim();
  const booth = note.expoMeta?.booth?.trim();

  if (brandName) return brandName;
  if (brewery) return `${brewery}（未填銘柄）`;
  if (booth) return `攤位 ${booth}`;
  return '未命名快記';
}