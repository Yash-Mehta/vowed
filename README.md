# Vowed

A private, invite-only wedding app for couples and their guests.

Couples create their wedding in minutes and share invite codes with guests. Guests join and get access to a live photo feed, the weekend schedule, and announcements. Hosts get an admin panel to post announcements, manage the schedule, and moderate guests. One account can belong to multiple wedding parties.

---

## Features

- **Invite-only access** — guest and host roles via separate invite codes
- **Multi-wedding** — one account can join multiple wedding parties; a party selection screen lets users switch between them
- **Live feed** — photo posts and announcements with likes, comments, and host pin/delete controls
- **Countdown** — live days · hours · minutes banner counting down to the exact ceremony time set by the host (stored UTC, displayed in device local time)
- **Schedule** — full wedding weekend itinerary with event icons, dress codes, and live countdown to the next event
- **Host admin panel** — add/edit/reorder schedule events, promote/demote guests, upload wedding logo
- **Push notifications** — new posts and comments via FCM (iOS and Android)
- **Multi-tenant** — each wedding is fully isolated; one app serves many couples

---

## Tech Stack

| Layer | Technology |
|---|---|
| App | React Native · Expo SDK 54 · expo-router |
| Platforms | iOS · Android |
| Backend | Firebase (Auth · Firestore · Storage · Cloud Functions v2) |
| State | Zustand |
| Notifications | Firebase Cloud Messaging |
| Builds | EAS Build (iOS) · Gradle (Android) |

---

## Getting Started

### Prerequisites

- Node 18+
- Expo Go app or iOS/Android simulator
- Firebase project with Auth, Firestore, Storage, and Functions enabled

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

### Run

```bash
npx expo start
```

---

## Project Structure

```
app/
  (auth)/            invite, login, register, profile-setup, forgot-password, verify-email
  (onboarding)/      host onboarding flow (account → names → date/venue → codes → confirm)
  (tabs)/            feed, schedule, guests, profile, manage (host only)
  select-wedding.tsx party selection screen (shown after every sign-in)
  compose.tsx        host post composer
  privacy.tsx        privacy policy
components/          shared UI (PostCard, AnnouncementCard, CommentSheet, ScheduleEventCard, …)
constants/
  theme.ts           colors, fonts, radii, shadows
functions/src/       Cloud Functions — notifications, like/comment counters
lib/                 Firebase init, Firestore helpers, weddingConfig, notifications
store/               Zustand stores (auth, wedding, onboarding)
scripts/             seed.ts, seed2.ts, seed-empty-user.ts, wipe-db.ts
public/              Firebase Hosting pages
  delete-account.html  Account & data deletion request form (Play Store / App Store compliance)
  csae-policy.html     Child safety policy (required for Google Play submission)
```

---

## Seed Data

Four test accounts for development:

| Account | Email | Password | Weddings |
|---|---|---|---|
| Wedding 1 host | `james.carter@example.com` | `Vowed123!` | James & Olivia · Tuscany |
| Wedding 2 host | `emma.shaw@example.com` | `Vowed123!` | Emma & Ryan · Lake Como |
| Both weddings | `sophia.lane@example.com` | `Vowed123!` | Both (party-switch testing) |
| Empty account | `test.empty@example.com` | `Test123!` | None |

```bash
npx tsx scripts/wipe-db.ts
npx tsx scripts/seed.ts
npx tsx scripts/seed2.ts
npx tsx scripts/seed-empty-user.ts
```

---

## Deploying

### Firestore + Storage Rules

```bash
firebase deploy --only firestore:rules,storage
```

### Cloud Functions

```bash
cd functions && npm run build
firebase deploy --only functions
```

### Firebase Hosting

```bash
firebase deploy --only hosting
```

Hosted pages (live at `https://our-day-39d9d.web.app`):

| Page | URL | Purpose |
|---|---|---|
| Account deletion | `/delete-account.html` | Users can request account + data deletion |
| Child safety policy | `/csae-policy.html` | CSAE policy required by Google Play |

### iOS Build

```bash
eas build --platform ios --profile production --local
# Upload to App Store via Transporter
```

### Android Build

```bash
# Generate android/ native directory
npx expo prebuild --platform android --clean

# APK (sideload / testing)
ANDROID_HOME=$HOME/Library/Android/sdk ./android/gradlew :app:assembleRelease -p android

# AAB (Play Store)
ANDROID_HOME=$HOME/Library/Android/sdk ./android/gradlew :app:bundleRelease -p android
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Versioning

Current version: **v1.3.0**

| Version | Notes |
|---|---|
| v1.3.0 | Android support — FCM, Play Store build, heart icon fix, custom fonts, OptionsSheet |
| v1.2.7 | Live on iOS App Store |
| v1.2.x | Push notifications, host controls, schedule improvements |
| v1.1.x | Multi-wedding party selection, leave wedding, routing overhaul |
| v1.0.x | Initial release |
