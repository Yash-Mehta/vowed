# Claude Code Guide — Vowed

This file captures project conventions, architecture decisions, and development process for use by Claude Code and collaborators.

---

## Versioning

- Semantic versioning: `v1.x.x` — do **not** jump to `v2.x.x` without explicit instruction
- Patch (`v1.x.X`) for bug fixes; minor (`v1.X.0`) for new features
- Always merge to `main` first, then tag
- Always confirm the bump level with the user before tagging
- `app.json` version and iOS `buildNumber` must be updated before every build
- `buildNumber` resets to `"1"` for each new version string; increment only if re-uploading the same version to App Store Connect

## Build Process

```bash
# Local iOS production build (EAS free tier exhausted — always build locally)
eas build --platform ios --profile production --local

# Move to Desktop for Transporter upload
mv build-*.ipa ~/Desktop/Vowed-vX.X.X-buildN.ipa
```

- Builds are submitted to TestFlight/App Store via **Transporter** (not `eas submit`)
- EAS Free plan resets monthly — use `--local` to avoid limits

## Seed Data

Three seed weddings + one empty account for development:

| Account | Email | Password | Role |
|---|---|---|---|
| Wedding 1 host | `james.carter@example.com` | `Vowed123!` | Host — James & Olivia · Tuscany |
| Wedding 2 host | `emma.shaw@example.com` | `Vowed123!` | Host — Emma & Ryan · Lake Como |
| Both weddings | `sophia.lane@example.com` | `Vowed123!` | Guest in both |
| Empty account | `test.empty@example.com` | `Test123!` | No weddings |

**Invite codes:** `VOWED-GUEST` / `VOWED-HOST` · `VOWED2-GUEST` / `VOWED2-HOST`

```bash
# Full reset
npx tsx scripts/wipe-db.ts
npx tsx scripts/seed.ts
npx tsx scripts/seed2.ts
npx tsx scripts/seed-empty-user.ts
```

`wipe-db.ts` targets only the named seed weddings and known seed emails — it never wipes real user data.

---

## Architecture

### Multi-Wedding Auth Flow

Sign in → always lands on `select-wedding` screen (`weddingId = null`). User taps a card → `switchWedding()` → routed to tabs.

Key principle: `switchWedding()` is **synchronous and does not write to SecureStore**, so signing out always clears the active wedding and returns to the selection screen.

Routing is driven entirely by `_layout.tsx` reacting to Zustand state:

```
weddingId set        → /(tabs)/feed
pendingWeddingId set → /(auth)/profile-setup
userWeddingIds > 0   → /select-wedding
else                 → /(auth)/invite
```

The `onMidJoinScreen` guard in `_layout.tsx` prevents redirect loops for screens in the join flow (`invite`, `profile-setup`, `register`, `verify-email`).

### Zustand Stores

| Store | File | Purpose |
|---|---|---|
| `useAuthStore` | `store/authStore.ts` | Firebase user, role, weddingId, userWeddingIds, switchWedding |
| `useWeddingStore` | `store/weddingStore.ts` | WeddingConfig, countdown helpers |
| `useOnboardingStore` | `store/onboardingStore.ts` | Host onboarding draft state |

### Firestore Schema

```
users/{uid}
  weddingIds: string[]          ← always use arrayUnion; never overwrite

weddings/{weddingId}
  weddingDateTimeUTC: string    ← UTC ISO string for exact ceremony time
  weddingDateISO: string        ← YYYY-MM-DD fallback
  guestInviteCode / hostInviteCode
  ownerUid: string

weddings/{weddingId}/members/{uid}
  role: 'host' | 'guest'
  fcmToken: string | null       ← set by registerForPushNotifications
  isSingle: boolean             ← opt-in relationship status

weddings/{weddingId}/posts/{postId}
  type: 'photo' | 'announcement'
  authorId, authorName, authorPhotoURL
  likeCount, commentCount       ← maintained by Cloud Functions

weddings/{weddingId}/posts/{postId}/likes/{uid}
  likedAt: Date                 ← presence = liked; absence = not liked

weddings/{weddingId}/posts/{postId}/comments/{commentId}

weddingsByCode/{code}
  weddingId, role, preview      ← lookup by invite code
```

**Critical:** Always use `arrayUnion` when writing to `users/{uid}.weddingIds`. Using `setDoc` without merge will destroy existing wedding memberships for users in multiple weddings.

### Date/Time Handling

- Backend stores `weddingDateTimeUTC` as a UTC ISO string (e.g. `"2026-09-05T15:00:00.000Z"`)
- `configFromDoc` in `lib/weddingConfig.ts` parses it with `new Date(utcString)` — correct UTC
- Fallback: `weddingDateISO + 'T12:00:00Z'` (noon UTC) for weddings without a ceremony time
- All date parses must include `Z` suffix — bare `T12:00:00` is local time and causes off-by-one-day bugs in timezones behind UTC

### Cloud Functions (`functions/src/index.ts`)

| Function | Trigger | Behaviour |
|---|---|---|
| `sendResetEmail` | HTTPS callable | Sends branded password reset email via Gmail/nodemailer |
| `onPostCreated` | post created | Notifies all members except author; photo posts and announcements both notify |
| `onCommentCreated` | comment created | Notifies post author only (skips self-comments); increments `commentCount` |
| `onLikeCreated` | like created | Increments `likeCount` only — no push notification |
| `onLikeDeleted` | like deleted | Decrements `likeCount` |
| `onCommentDeleted` | comment deleted | Decrements `commentCount` |
| `onMemberUpdated` | member updated | Propagates displayName/photoURL changes to posts and comments |

### Push Notifications

- Token registration happens in `lib/notifications.ts` → `registerForPushNotifications(uid, weddingId)`
- Called on every wedding selection (refreshes stale tokens)
- If permission was **previously denied**: shows an in-app alert with "Open Settings" → `Linking.openSettings()` deep-links to iOS notification settings
- Foreground banners are enabled (`shouldShowAlert: true`) — do not set this to `false`
- iOS Simulator does **not** support push notifications — test on a physical device

---

## Common Patterns

### Adding a member to a wedding
```ts
await createMember(weddingId, uid, memberData);
await addWeddingToIndex(uid, weddingId);          // uses arrayUnion
setUserWeddingIds([...userWeddingIds, weddingId]);
```

### Leaving a wedding
```ts
await leaveWedding(uid, weddingId);               // deletes member doc + arrayRemove
```

### Wedding config from Firestore
```ts
import { configFromDoc } from '../lib/weddingConfig';
const config = configFromDoc(docData);            // parses all dates correctly
```

---

## Deploying Cloud Functions

```bash
cd functions && npm run build
firebase deploy --only functions
```

Secrets (`GMAIL_USER`, `GMAIL_APP_PASS`) are managed via Firebase Secret Manager — do not hardcode.

## Firestore / Storage Rules

```bash
firebase deploy --only firestore:rules,storage
```

---

## Periodic Codebase Cleanup

Run when prompted ("run cleanup"). Branch off main as `chore/codebase-cleanup`, work through all tracks, then commit. No tag needed — patch-level at most. Ask the user if they want a PR/merge after.

### Track 1 — Dead exports in lib/

```bash
npx knip
```

Verify each hit with `grep -r <name> .` before removing. Key files: `lib/firebase.ts`, `lib/firestore.ts`, `lib/secureAuth.ts`.

### Track 2 — Dead components

```bash
grep -r "<ComponentName>" --include="*.tsx" --include="*.ts" .
```

If zero imports outside the file itself, delete it.

### Track 3 — Strengthen `any` types

- `createdAt: any` → `Timestamp` (import from `firebase/firestore`)
- `startTime: any` → `Timestamp | null`
- `config: any` in component props → `WeddingConfig | null` (import from `lib/weddingConfig`)

Files to check: `components/PostCard.tsx`, `components/ScheduleEventCard.tsx`, `components/CommentSheet.tsx`, `app/(tabs)/manage.tsx`

When changing `config: any` → `WeddingConfig | null`, fix any `{ ...config }` spreads → `{ ...(config ?? {}), ...rest }`.

### Track 4 — Deduplicate onSnapshot error handlers

`lib/firestore.ts` exports `onSnapshotError`. Search for any remaining inline copies:

```bash
grep -rn "permission-denied" app/ components/ hooks/
```

Replace each `(err) => { if (err.code !== 'permission-denied') console.warn(err); }` with `onSnapshotError` and add it to the import from `lib/firestore`.

### Track 5 — Circular dependency check

```bash
npx madge --circular --extensions ts,tsx .
```

No action needed if output is empty.

### Track 6 — Commit

```bash
git add <changed files>
git commit -m "chore: codebase cleanup — types, dead code, error handler dedup"
```
