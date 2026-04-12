import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getProjectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;

  const rcPath = path.resolve(process.cwd(), '.firebaserc');
  if (!fs.existsSync(rcPath)) return undefined;

  try {
    const parsed = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
    return parsed?.projects?.default;
  } catch {
    return undefined;
  }
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = getProjectId();

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return initializeApp({
      projectId,
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
    });
  }

  return initializeApp(projectId ? { projectId } : undefined);
}

async function syncAuthorStatsForUid(db, uid, dryRun) {
  const notesSnapshot = await db.collection('sakeTastingNotes').where('userId', '==', uid).get();
  const noteCount = notesSnapshot.size;
  const likesReceivedCount = notesSnapshot.docs.reduce((total, noteDoc) => {
    const likesCount = noteDoc.data().likesCount;
    return total + (typeof likesCount === 'number' ? likesCount : 0);
  }, 0);

  const authorStats = {
    noteCount,
    likesReceivedCount,
    updatedAt: new Date().toISOString(),
  };

  if (!dryRun) {
    await db.collection('users').doc(uid).set({ authorStats }, { merge: true });
  }

  return authorStats;
}

async function main() {
  const targetUid = getArg('--uid');
  const dryRun = hasFlag('--dry-run');
  const app = getAdminApp();
  const db = getFirestore(app);

  const userDocs = targetUid
    ? [await db.collection('users').doc(targetUid).get()]
    : (await db.collection('users').get()).docs;

  const existingUserDocs = userDocs.filter((doc) => doc.exists);
  if (existingUserDocs.length === 0) {
    console.log('No matching users found.');
    return;
  }

  let processed = 0;
  for (const userDoc of existingUserDocs) {
    const authorStats = await syncAuthorStatsForUid(db, userDoc.id, dryRun);
    processed += 1;
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${userDoc.id} => noteCount=${authorStats.noteCount}, likesReceivedCount=${authorStats.likesReceivedCount}`
    );
  }

  console.log(`${dryRun ? 'Checked' : 'Updated'} ${processed} user(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});