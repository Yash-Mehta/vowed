# Vowed

A private, invite-only wedding app for couples and their guests.

Couples create their wedding in minutes and share invite codes with guests. Guests join and get access to a live photo feed, the weekend schedule, and announcements. Hosts get an admin panel to post announcements, manage the schedule, and moderate guests. One account can belong to multiple wedding parties.

Live on the [App Store](https://apps.apple.com/us/app/vowed-social/id6766561614) and [Google Play](https://play.google.com/store/apps/details?id=com.vowed.app) · [vowedsocial.com](https://vowedsocial.com)

---

## Features

- **Phone sign-in** — one phone number is the whole account; a six-digit SMS code signs you in or creates the account, with no password to set or reset
- **Invite-only access** — guest and host roles via separate invite codes, validated server-side
- **Multi-wedding** — one account can join multiple wedding parties; a party selection screen lets users switch between them
- **Live feed** — photo posts and announcements with likes, comments, and host pin/delete controls
- **Countdown** — live days · hours · minutes banner counting down to the exact ceremony time set by the host (stored UTC, displayed in device local time)
- **Schedule** — full wedding weekend itinerary with event icons, dress codes, and live countdown to the next event
- **Host admin panel** — add/edit/reorder schedule events, promote/demote guests, upload wedding logo
- **Global profile** — name and photo are set once and shared across every wedding you belong to
- **Push notifications** — new posts and comments via FCM (iOS and Android)
- **Multi-tenant** — each wedding is fully isolated; one app serves many couples

---

## Tech Stack

| Layer | Technology |
|---|---|
| App | React Native 0.81 · Expo SDK 54 · expo-router 6 · New Architecture |
| Platforms | iOS 15.1+ · Android |
| Backend | Firebase (Auth · Firestore · Storage · Cloud Functions v2, Node 22) |
| Auth | Phone + OTP via Twilio Verify, exchanged for a Firebase custom token |
| State | Zustand |
| Notifications | Firebase Cloud Messaging |
| Builds | EAS Build (local) for both platforms |

Firebase is used through the **plain JS SDK**, not `@react-native-firebase`. That is why phone auth runs through Twilio rather than Firebase's native provider — the native one requires `RecaptchaVerifier`, a DOM widget with no equivalent here.

---

## Getting Started

### Prerequisites

- Node 22+
- Xcode (iOS) and/or Android SDK
- A Firebase project with Auth, Firestore, Storage, and Functions enabled
- A Twilio account with a Verify service, for phone sign-in

### Install

```bash
npm install
```

### Environment

Firebase config is injected via `EXPO_PUBLIC_*` environment variables. For local development, create a `.env` file:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

These are public by design — they identify the project, they do not authorise anything. All access control lives in `firestore.rules` and `storage.rules`.

Server-side secrets (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`) are managed with Firebase Secret Manager and never committed.

### Run

```bash
npx expo start          # Metro, against a dev build
npx expo run:ios        # build and launch on a simulator
```

---

## Project Structure

```
app/
  _layout.tsx        root layout — auth listener, routing rules, animated splash
  index.tsx          landing screen (sign in / join with a code / create a wedding)
  (auth)/            phone (number + OTP), invite, profile-setup
  (onboarding)/      host onboarding (account → names → date/venue → codes → confirm)
  (tabs)/            feed, manage (host only), profile
  select-wedding.tsx party selection screen
  settings.tsx       global account settings
  compose.tsx        post composer
  privacy.tsx        privacy policy
components/          shared UI (PostCard, CommentSheet, CountryCodePicker, AnimatedSplash, …)
constants/
  theme.ts           colours, type scale, spacing, radii, motion, shadows
  countries.ts       dial codes for the phone entry screen
functions/src/       Cloud Functions — phone auth, invite codes, notifications, counters
lib/                 Firebase init, Firestore helpers, phoneAuth, weddingConfig, notifications
store/               Zustand stores (auth, wedding, onboarding)
scripts/             seed / wipe / migration scripts (Admin SDK)
landing-site/        marketing site served at vowedsocial.com
public/              Firebase Hosting compliance pages
  delete-account.html  account & data deletion request form (store compliance)
  csae-policy.html     child safety policy (required for Google Play)
firestore.rules      authorization — with storage.rules, the only server-side check
storage.rules
```

---

## Authentication

There is no server tier. The app talks directly to Firestore and Storage, so **`firestore.rules` and `storage.rules` are the only authorization boundary** — the UI is a client, not a lock.

Sign-in flow:

1. The user enters a phone number; `sendPhoneOtp` asks Twilio Verify to text a code, rate-limited per IP and per number.
2. The user enters the code; `verifyPhoneOtp` checks it with Twilio, finds the account by phone number or creates one, and mints a Firebase custom token.
3. The client calls `signInWithCustomToken`.

Signing in and creating an account are the same operation — the server decides which it is based on whether the number already has an account.

Roles are server-controlled. Clients may only ever write `role: 'guest'`; host access comes from the `claimHostRole` callable, which validates the invite code with the Admin SDK before granting it. The one exception is the admin panel, where an existing host promotes someone else — authorized by the promoter's own member document.

---

## Seed Data

Seed accounts are keyed by **phone number**, since that is what sign-in resolves. Defaults use the `+1 (212) 555-01xx` range reserved for fiction, which cannot receive SMS — they seed data, they do not grant access.

| Account | Email (record only) | Weddings |
|---|---|---|
| Wedding 1 host | `james.carter@example.com` | James & Olivia · Tuscany |
| Wedding 2 host | `emma.shaw@example.com` | Emma & Ryan · Lake Como |
| Both weddings | `sophia.lane@example.com` | Both (party-switch testing) |
| Empty account | `test.empty@example.com` | None |

Invite codes: `VOWED-GUEST` / `VOWED-HOST` and `VOWED2-GUEST` / `VOWED2-HOST`.

```bash
npx tsx scripts/wipe-db.ts
npx tsx scripts/seed.ts
npx tsx scripts/seed2.ts
npx tsx scripts/seed-empty-user.ts
```

To sign in as a seed user, point one at a phone you can receive SMS on and re-run:

```bash
SEED_PHONE_JAMES_CARTER=+447700900123 npx tsx scripts/seed.ts
```

The variable is `SEED_PHONE_` plus the local part of the address, uppercased with non-letters as underscores. Only one account may hold a number at a time — move the override rather than copying it. See `scripts/seedIdentities.ts`.

`wipe-db.ts` targets only the named seed weddings and known seed accounts; it never touches real user data.

---

## Deploying

Order matters when a release changes both: **functions first, then rules.** Rules that depend on a new callable will break the live app if they land before it exists.

### Cloud Functions

```bash
cd functions && npm run build
firebase deploy --only functions
```

### Firestore + Storage Rules

```bash
firebase deploy --only firestore:rules,storage
```

Both take effect immediately on every installed copy, including versions already in the stores.

### Firebase Hosting

```bash
firebase deploy --only hosting
```

| Site | Target | Purpose |
|---|---|---|
| Compliance pages | default | `/delete-account.html`, `/csae-policy.html` |
| Marketing site | `landing` | vowedsocial.com, sources in `landing-site/` |

### Builds

Build the platforms **one after the other** — parallel local builds starve each other.

```bash
npx eas-cli build --platform ios     --profile production --local
npx eas-cli build --platform android --profile production --local
```

iOS is uploaded to App Store Connect with **Transporter**, not `eas submit`. Bump `version`, iOS `buildNumber`, and Android `versionCode` in `app.json` before every build — once a number is uploaded it is consumed forever. Verify the artifact rather than trusting the exit code:

```bash
unzip -p build-*.ipa 'Payload/*.app/Info.plist' | plutil -extract CFBundleVersion raw -o - -
```

---

## Versioning

Current version: **v1.5.0** (iOS build 16 · Android versionCode 20)

Semver: patch for fixes, minor for features. Branch per feature off `main`, merge, then tag.

| Version | Notes |
|---|---|
| v1.5.0 | Phone-only sign-in via Twilio Verify, authorization hardening, server-side host elevation, landing screen redesign |
| v1.4.x | Settings screen, global profiles, guest post-delete, photo aspect ratios, invite-code rate limiting |
| v1.3.x | Android support — FCM, Play Store build, custom fonts |
| v1.2.x | Push notifications, host controls, schedule improvements |
| v1.1.x | Multi-wedding party selection, leave wedding, routing overhaul |
| v1.0.x | Initial release |
