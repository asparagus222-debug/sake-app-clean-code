import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function parseAdminValue(value) {
  if (!value) return true;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
    });
  }

  return initializeApp();
}

async function main() {
  const uid = getArg('--uid');
  const email = getArg('--email');
  const adminValue = parseAdminValue(getArg('--admin'));

  if (!uid && !email) {
    console.error('Usage: node scripts/set-admin-claim.mjs --uid <uid> [--admin true|false]');
    console.error('   or: node scripts/set-admin-claim.mjs --email <email> [--admin true|false]');
    process.exit(1);
  }

  const auth = getAuth(getAdminApp());
  const userRecord = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email);
  const nextClaims = {
    ...(userRecord.customClaims ?? {}),
    admin: adminValue,
  };

  await auth.setCustomUserClaims(userRecord.uid, nextClaims);

  console.log(`Updated admin claim for ${userRecord.uid} (${userRecord.email ?? 'no-email-user'}) => admin=${adminValue}`);
  console.log('The target user must sign out and sign back in, or refresh their ID token, before the new claim takes effect.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});