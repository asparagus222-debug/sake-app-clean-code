import { NoteDetailClient } from '@/components/notes/NoteDetailClient';
import { getAdminApp } from '@/lib/firebase-admin';
import { SakeNote } from '@/lib/types';
import { getFirestore } from 'firebase-admin/firestore';

function toPlainNote(id: string, data: Record<string, unknown>): SakeNote {
  return JSON.parse(JSON.stringify({ id, ...data })) as SakeNote;
}

async function getInitialNote(id: string): Promise<SakeNote | null> {
  try {
    const db = getFirestore(getAdminApp());
    const snapshot = await db.collection('sakeTastingNotes').doc(id).get();
    if (!snapshot.exists) return null;
    return toPlainNote(snapshot.id, snapshot.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialNote = await getInitialNote(id);

  return <NoteDetailClient initialNote={initialNote} />;
}