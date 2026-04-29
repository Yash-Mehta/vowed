# Our Day — Multi-Tenant Architecture Plan

> **Current state:** Single-tenant wedding app for Yash & Vaani, fully functional.  
> **Target:** SaaS platform where any couple creates and customizes their own wedding app.

---

## Overview: 6 Phases

| Phase | Name | Goal | Breaking? |
|---|---|---|---|
| 1 | Foundation | New data model + data migration | No |
| 2 | Auth Layer | Wedding-aware auth, WEDDING.ts shim | No |
| 3 | Read Path Migration | All queries use new paths | Yes (needs app update) |
| 4 | Host Onboarding | Any couple can create a wedding | No |
| 5 | Theme System | Per-wedding colors + monogram | No |
| 6 | App Store | Submit to iOS + Android stores | — |

---

## 1. Firestore Data Model

### Top-Level Structure

```
/weddings/{weddingId}                              wedding config + settings
/weddings/{weddingId}/posts/{postId}               feed posts
/weddings/{weddingId}/posts/{postId}/likes/{uid}
/weddings/{weddingId}/posts/{postId}/comments/{commentId}
/weddings/{weddingId}/schedule/{eventId}           schedule events
/weddings/{weddingId}/members/{uid}                replaces /users
/weddingsByCode/{inviteCode}                       O(1) code → weddingId index
/users/{uid}                                       thin cross-wedding index
```

### Wedding Document `/weddings/{weddingId}`

```typescript
interface WeddingDoc {
  weddingId:          string;
  slug:               string;           // 'yash-vaani-2026'

  // Display
  coupleName:         string;           // 'Yash & Vaani'
  coupleNameFull:     string;           // 'Yash and Vaani'
  person1First:       string;           // 'Yash'
  person2First:       string;           // 'Vaani'
  monogramInitials:   string;           // 'Y&V'

  // Event details
  weddingDateISO:     string;           // '2026-12-05T18:00:00-05:00'
  firstEventDateISO:  string;           // '2026-12-02T00:00:00-05:00'
  dateStamp:          string;           // '12 · 05 · 26'
  shortDate:          string;           // 'Dec 5, 2026'
  displayDate:        string;           // 'Saturday, December 5, 2026'
  venue:              string;
  venueShort:         string;
  location:           string;
  hashtag:            string;
  registryUrl:        string | null;

  // Theme
  accentHex:          string;           // '#7A4A3F'
  accentDeepHex:      string;           // '#5C3329'
  accentSoftHex:      string;           // '#C58A7A'
  accentTintHex:      string;           // '#F1DFD6'
  coverPhotoURL:      string | null;

  // Invite codes
  guestInviteCode:    string;           // 'OURDAY2026'
  hostInviteCode:     string;

  // Ownership
  ownerUids:          string[];
  status:             'draft' | 'active' | 'archived';
  createdAt:          Timestamp;
  updatedAt:          Timestamp;
}
```

### Member Document `/weddings/{weddingId}/members/{uid}`

```typescript
interface MemberDoc {
  uid:          string;
  displayName:  string;
  photoURL:     string | null;
  howTheyKnow:  string;
  role:         'guest' | 'host';
  fcmToken:     string | null;
  joinedAt:     Timestamp;
  createdAt:    Timestamp;
}
```

### Code Index `/weddingsByCode/{inviteCode}`

```typescript
interface CodeIndexDoc {
  weddingId: string;
  role:      'guest' | 'host';
}
```

O(1) lookup — no collection scan needed. Maintained by `onWeddingUpdated` Cloud Function when invite codes change.

### User Index `/users/{uid}`

```typescript
interface UserIndexDoc {
  weddingIds: string[];   // all weddings this user belongs to
  createdAt:  Timestamp;
}
```

Retained as a thin cross-wedding index. Post-login: fetch this doc, read `weddingIds[0]`, route to that wedding.

---

## 2. Authentication & Wedding Membership

### Invite Code Resolution (new flow)

```
User enters "OURDAY2026"
  → query /weddingsByCode/OURDAY2026
  → returns { weddingId, role }
  → store in authStore: pendingWeddingId + pendingRole
  → register → profile-setup
  → createMember(weddingId, uid, { role, ... })
  → updateDoc(/users/uid, { weddingIds: arrayUnion(weddingId) })
```

### Post-Login Wedding Resolution

1. `onAuthStateChanged` fires → fetch `/users/{uid}.weddingIds`
2. If 1 entry → set `authStore.weddingId`, start `weddingStore` listener
3. If 0 entries → error screen ("contact your host")
4. If 2+ entries → "Select a wedding" screen (Phase 4+)

`weddingId` is persisted in `expo-secure-store` so auto-login restores it without a Firestore round-trip.

### New Couple Registration

A `createWedding` callable Cloud Function atomically:
1. Creates `/weddings/{weddingId}` doc
2. Writes `/weddingsByCode/{guestCode}` and `/weddingsByCode/{hostCode}` index entries
3. Creates the couple's member doc with `role: 'host'`
4. Updates `/users/{uid}.weddingIds`

---

## 3. Host Onboarding Flow

Route group: `app/(onboarding)/`

| Step | Screen | Data Collected |
|---|---|---|
| 1 | `create-account` | Email, password |
| 2 | `names` | Person 1 & 2 names, couple display name, monogram |
| 3 | `date-venue` | Wedding date, time, timezone, venue, location, first event date |
| 4 | `theme` | Accent color (8 presets + custom), cover photo, registry URL |
| 5 | `invite-codes` | Guest code (auto-generated), host code (auto-generated) |
| 6 | `confirm` | Review all → call `createWedding` → route to feed |

State held in `store/onboardingStore.ts` (Zustand). Nothing written to Firestore until step 6.

Uniqueness of invite codes validated via `checkInviteCode` callable before submission.

---

## 4. Dynamic Wedding Config

### Replacing `constants/WEDDING.ts`

**Phase 2 (shim):** `WEDDING.ts` becomes a proxy that reads from `weddingStore` if populated, falls back to hardcoded values.

**Phase 3 (cleanup):** `WEDDING.ts` deleted. All 4 import sites updated to use `useWeddingStore()` directly.

### New Files

```
lib/weddingConfig.ts        WeddingConfig interface
store/weddingStore.ts       Zustand store with onSnapshot listener
hooks/useWeddingConfig.ts   hook that attaches listener when weddingId is set
```

`getDaysUntilWedding()` and `getCountdownParts()` become computed getters on the store, derived from the live `weddingDate`.

---

## 5. Theme System

### `hooks/useTheme.ts`

```typescript
function useTheme() {
  const { config } = useWeddingStore();
  if (!config) return theme; // static fallback
  return {
    ...theme,
    colors: {
      ...theme.colors,
      accent:         config.accentHex,
      accentDeep:     config.accentDeepHex,
      accentSoft:     config.accentSoftHex,
      accentTint:     config.accentTintHex,
      countdownStart: config.accentDeepHex,
      countdownEnd:   config.accentHex,
      line:           hexWithAlpha(config.accentHex, 0.14),
      lineStrong:     hexWithAlpha(config.accentHex, 0.22),
    }
  };
}
```

All components migrated from `import { theme }` → `const theme = useTheme()`.

### Monogram Components

`MonogramLarge` and `MonogramSeal` accept a `monogram?: string` prop (defaults to `'Y&V'`). In production, sourced from `useWeddingStore().config.monogramInitials`.

---

## 6. Cloud Functions Changes

### Path Updates

| Current | New |
|---|---|
| `posts/{postId}` | `weddings/{weddingId}/posts/{postId}` |
| `posts/{postId}/comments/{commentId}` | `weddings/{weddingId}/posts/{postId}/comments/{commentId}` |
| `posts/{postId}/likes/{uid}` | `weddings/{weddingId}/posts/{postId}/likes/{uid}` |

FCM token lookup changes from scanning `/users` to scanning `/weddings/{weddingId}/members`.

### New Functions

| Function | Type | Purpose |
|---|---|---|
| `createWedding` | callable | Atomic wedding creation |
| `checkInviteCode` | callable | Validate code uniqueness during onboarding |
| `onWeddingUpdated` | Firestore trigger | Sync `/weddingsByCode` index when codes change |

`sendResetEmail` updated to accept `weddingId` and render the email with the specific couple's names and date.

---

## 7. Migration Strategy (Yash & Vaani)

`scripts/migrate-to-multitenant.ts` — runs once against production using Admin SDK.

### Steps

1. **Create wedding doc** at `/weddings/{newId}` with all current `WEDDING.ts` values
2. **Copy posts** from `/posts` → `/weddings/{weddingId}/posts` (including likes + comments subcollections)
3. **Copy schedule** from `/schedule` → `/weddings/{weddingId}/schedule`
4. **Copy users** from `/users` → `/weddings/{weddingId}/members`; write thin `/users/{uid}` index docs
5. **Write code index** `/weddingsByCode/OURDAY2026` and `/weddingsByCode/{hostCode}`
6. **Do not delete** old collections until Phase 3 is verified in production

Take a full Firestore export backup before running.

---

## 8. File Change Inventory

### Phase 1 — New files only
- `scripts/migrate-to-multitenant.ts`
- `lib/weddingConfig.ts`
- `store/weddingStore.ts`
- `hooks/useWeddingConfig.ts`
- `firestore.rules` (additive)
- `storage.rules` (additive)
- `functions/src/index.ts` (additive — new trigger paths alongside old)

### Phase 2 — Auth wiring
- `store/authStore.ts` — add `weddingId` field
- `lib/firestore.ts` — add wedding-aware `validateInviteCode`
- `lib/secureAuth.ts` — add `weddingId` helpers
- `lib/notifications.ts` — accept `weddingId`
- `app/_layout.tsx` — load weddingId post-auth
- `constants/WEDDING.ts` — convert to shim
- `functions/src/index.ts` — `sendResetEmail` uses wedding doc

### Phase 3 — Read path migration (breaking)
- `lib/firestore.ts` — weddingId-parameterized factories
- `app/(tabs)/feed.tsx`, `schedule.tsx`, `guests.tsx`, `manage.tsx`, `_layout.tsx`
- `app/compose.tsx`
- `app/(auth)/invite.tsx`
- `components/CommentSheet.tsx`, `MonogramLarge.tsx`, `MonogramSeal.tsx`
- `constants/WEDDING.ts` — **deleted**
- `firestore.rules` — legacy rules removed
- `functions/src/index.ts` — old triggers removed, `onWeddingUpdated` added
- `firestore.indexes.json` — add composite indexes for new paths

### Phase 4 — Onboarding (new files)
- `store/onboardingStore.ts`
- `app/(onboarding)/_layout.tsx`
- `app/(onboarding)/create-account.tsx`
- `app/(onboarding)/names.tsx`
- `app/(onboarding)/date-venue.tsx`
- `app/(onboarding)/theme.tsx`
- `app/(onboarding)/invite-codes.tsx`
- `app/(onboarding)/confirm.tsx`
- `app/index.tsx`, `app/(auth)/invite.tsx` (add "Create your wedding" entry)
- `functions/src/index.ts` — add `createWedding`, `checkInviteCode`

### Phase 5 — Theme system
- `hooks/useTheme.ts` (new)
- `utils/colorUtils.ts` (new)
- `constants/theme.ts` — neutral accent defaults
- All 9 components + 6 screens: `theme` import → `useTheme()` call
- `app/(tabs)/manage.tsx` — add "Settings" tab for wedding config editing

### Phase 6 — App Store
- `app.json` — bump version, verify IDs
- `eas.json` — production profiles (already configured)
- External: Apple Developer account, App Store Connect setup, screenshots, privacy policy page

---

## 9. App Store Requirements

### Apple ($99/yr)
- Apple Developer Program enrollment
- App Store Connect: create app record, bundle ID `com.ourday.app`
- Required: 1024×1024 icon, screenshots for 6.7" + 5.5" iPhone
- Required: Support URL + Privacy Policy URL (host a static page)
- Data disclosures: name, email, photos, device ID for push notifications
- APN key uploaded to Firebase Console

### Google ($25 one-time)
- Google Play Console account
- Feature graphic 1024×500, 512×512 icon, 2+ screenshots
- Data Safety section: photos, personal info, device IDs, shared with Firebase

### Build Commands
```bash
# iOS
eas build --platform ios --profile production
eas submit --platform ios

# Android
eas build --platform android --profile production
eas submit --platform android
```

---

## Key Architectural Decisions

**`/weddingsByCode/{code}` index** — O(1) lookup vs. Firestore query scan. Maintained by `onWeddingUpdated`.

**Thin `/users/{uid}` retained** — cheaper than a collection group query across all wedding member subcollections for post-login wedding resolution.

**WEDDING.ts shim in Phase 2** — avoids updating all 4 callsites in one PR. Phase 2 wires data flow; Phase 3 cleans callsites. Each phase independently deployable.

**`useTheme()` hook over Context** — Zustand store already exists; a hook merging store values with base theme is simpler than a Context provider tree.

**Credentials + weddingId in SecureStore** — consistent with current `secureAuth.ts` pattern. Not AsyncStorage.
