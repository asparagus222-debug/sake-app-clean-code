import {
  ExpoBuyIntent,
  NotePublicationStatus,
  NoteVisibility,
  SakeNote,
} from '@/lib/types';

export const DEFAULT_NOTE_ENTRY_MODE = 'standard' as const;
export const DEFAULT_NOTE_VISIBILITY: NoteVisibility = 'public';
export const DEFAULT_NOTE_PUBLICATION_STATUS: NotePublicationStatus = 'published';

export function isPublicPublishedNote(
  note?: Pick<SakeNote, 'visibility' | 'publicationStatus'> | null
) {
  if (!note) return false;
  return note.visibility === 'public' && note.publicationStatus === 'published';
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