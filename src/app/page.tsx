import { HomeClient } from '@/components/home/HomeClient';
import { AUTH_BOOTSTRAP_COOKIE_NAME, readAuthBootstrapFromCookieValue } from '@/lib/auth-bootstrap';
import { getAdminApp } from '@/lib/firebase-admin';
import { isPublicPublishedNote } from '@/lib/note-lifecycle';
import { SakeNote } from '@/lib/types';
import { getFirestore } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

type Top3Group = {
  brandName: string;
  brewery: string;
  avgRating: number;
  noteCount: number;
  imageUrl?: string;
};

const INITIAL_NOTES_LIMIT = 20;
const INITIAL_RANKING_LIMIT = 24;

function toPlainNote(id: string, data: Record<string, unknown>): SakeNote {
  return JSON.parse(JSON.stringify({ id, ...data })) as SakeNote;
}

async function getInitialLatestNotes(): Promise<SakeNote[]> {
  try {
    const db = getFirestore(getAdminApp());
    const snapshot = await db
      .collection('sakeTastingNotes')
      .orderBy('tastingDate', 'desc')
      .limit(INITIAL_NOTES_LIMIT * 3)
      .get();

    return snapshot.docs
      .map(doc => toPlainNote(doc.id, doc.data() as Record<string, unknown>))
      .filter(isPublicPublishedNote)
      .slice(0, INITIAL_NOTES_LIMIT);
  } catch {
    return [];
  }
}

async function getInitialTop3Groups(): Promise<Top3Group[]> {
  try {
    const db = getFirestore(getAdminApp());
    const cacheDoc = await db.collection('meta').doc('top3').get();
    const cacheGroups = cacheDoc.data()?.groups;

    if (Array.isArray(cacheGroups) && cacheGroups.length > 0) {
      return JSON.parse(JSON.stringify(cacheGroups)) as Top3Group[];
    }

    const snapshot = await db
      .collection('sakeTastingNotes')
      .orderBy('overallRating', 'desc')
      .limit(INITIAL_RANKING_LIMIT * 3)
      .get();
    const rankingNotes = snapshot.docs
      .map(doc => toPlainNote(doc.id, doc.data() as Record<string, unknown>))
      .filter(isPublicPublishedNote);

    const map = new Map<string, { brandName: string; brewery: string; notes: SakeNote[] }>();
    for (const note of rankingNotes) {
      if (!note.brandName) continue;
      const key = `${note.brandName}|||${note.brewery}`;
      if (!map.has(key)) map.set(key, { brandName: note.brandName, brewery: note.brewery, notes: [] });
      map.get(key)!.notes.push(note);
    }

    return [...map.values()]
      .map(group => {
        const bestRatings = group.notes.map(note => {
          const sessionMax = note.sessions?.length ? Math.max(...note.sessions.map(session => session.overallRating)) : 0;
          return Math.max(note.overallRating, sessionMax);
        });
        const avgRating = bestRatings.reduce((sum, rating) => sum + rating, 0) / group.notes.length;
        const byLikes = [...group.notes].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
        const byDate = [...group.notes].sort((a, b) => (b.tastingDate || '').localeCompare(a.tastingDate || ''));
        const imageUrl = (byLikes.find(note => note.imageUrls?.[0]) || byDate.find(note => note.imageUrls?.[0]))?.imageUrls?.[0];
        return {
          brandName: group.brandName,
          brewery: group.brewery,
          avgRating,
          noteCount: group.notes.length,
          imageUrl,
        };
      })
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const initialAuthBootstrap = readAuthBootstrapFromCookieValue(cookieStore.get(AUTH_BOOTSTRAP_COOKIE_NAME)?.value);
  const [initialLatestNotes, initialTop3Groups] = await Promise.all([
    getInitialLatestNotes(),
    getInitialTop3Groups(),
  ]);

  return (
    <HomeClient
      initialAuthBootstrap={initialAuthBootstrap}
      initialLatestNotes={initialLatestNotes}
      initialTop3Groups={initialTop3Groups}
    />
  );
}
