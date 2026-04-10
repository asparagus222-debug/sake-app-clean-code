# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Admin custom claims

Admin access now depends on the Firebase Auth custom claim `admin: true`.

Grant admin access by running one of these commands with Admin SDK credentials available in your shell:

```bash
node scripts/set-admin-claim.mjs --email you@example.com --admin true
node scripts/set-admin-claim.mjs --uid someFirebaseUid --admin true
```

Remove admin access with `--admin false`.

After updating claims, the target user must sign out and sign back in before the new admin access takes effect.
