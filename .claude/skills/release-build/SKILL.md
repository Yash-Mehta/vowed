---
name: release-build
description: Full Vowed release pipeline — preflight checks, parallel iOS IPA + Android AAB local builds, artifacts to Desktop, release notes and beta testing instructions for App Store and Google Play. Use when the user asks for a build, a release, or to ship a version.
---

# Vowed Release Build

Run the complete two-platform release pipeline. Invoked as `/release-build [version]`.
If no version is given, derive it: patch bump for fixes, minor for features — confirm with the user before proceeding.

## Step 1 — Preflight (all before any build)

1. **Clean tree**: `git status --short` — uncommitted feature work should be committed first (ask user). Version-bump edits from this pipeline are fine.
2. **Disk space**: `df -h /` — need **≥10GB available** for parallel builds.
   If under 10GB, clear in this order and re-check:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
   rm -rf /private/var/folders/*/T/eas-build-local-nodejs/* 2>/dev/null
   npm cache clean --force
   rm -rf ~/.gradle/caches/*   # ONLY if still short — forces slow re-download
   pkill -f GradleDaemon        # MANDATORY after clearing gradle caches,
                                # otherwise next build fails on missing metadata.bin
   ```
   If still under 10GB after cleanup, run builds sequentially instead of parallel and tell the user why.
3. **Type-check**: `npx tsc --noEmit --pretty false` — must be clean.
4. **Version bump** in `app.json`:
   - `expo.version` → target version
   - `expo.ios.buildNumber` → `"1"` for a new version string (increment only when re-uploading the same version)
   - `expo.android.versionCode` → **always increment** (never reuse)
5. **Commit + tag**: commit the bump (with any release changes), tag `vX.Y.Z`. Merge to main first if on a branch. Confirm bump level with user if not already specified.

## Step 2 — Build (parallel, background)

Launch BOTH in the same message as background tasks:

```bash
eas build --platform ios --profile production --local --non-interactive
eas build --platform android --profile production --local --non-interactive
```

- EAS free tier is exhausted — always `--local`.
- Android production profile builds an **app-bundle (.aab)** — required by Play Console testing/production tracks. If the user also wants a sideloadable APK, temporarily set `eas.json` production.android.buildType to `"apk"`, build, then revert.
- If a build fails with "No space left on device": clean per Step 1.2, then retry **sequentially**.

## Step 3 — Artifacts to Desktop

```bash
mv build-*.ipa ~/Desktop/Vowed-vX.Y.Z-buildN.ipa
mv build-*.aab ~/Desktop/Vowed-vX.Y.Z-versionCodeM.aab
```

Never leave `build-*` artifacts in the project root.

## Step 4 — Release notes + testing info (always produce both)

Determine what changed: `git log <last-store-tag>..HEAD --oneline` — cover everything since the **last store release**, not just the last commit.

Produce all four blocks:

### A. App Store / TestFlight "What's New" (user-facing)
- Bulleted, benefit-first, no internal jargon
- Wedding-guest friendly tone (the audience is non-technical)
- End with "Fixes and polish throughout" when applicable

### B. Google Play release notes (user-facing)
- Same content as A; Play limit is 500 chars — trim if needed

### C. TestFlight "What to Test" (tester-facing)
- Numbered, concrete steps per feature: what to tap, what should happen
- Include multi-device scenarios where relevant (e.g., "post from device B, device A should…")

### D. Play closed-testing instructions (tester-facing)
- Same as C, plus the opt-in link reminder (Play Console → Testing → Closed testing → Testers tab → copy opt-in link)

## Step 5 — Wrap-up checklist (report to user)

- [ ] IPA + AAB on Desktop with versioned names
- [ ] Release notes + testing info delivered (all four blocks)
- [ ] Cloud Functions / Firestore rules deployed if this release depends on them (list what's pending — deploys need the user's explicit go-ahead)
- [ ] Remind: `git push origin main --tags` (needs user)
- [ ] Upload paths: IPA → Transporter → TestFlight · AAB → Play Console → Testing → Closed testing

## Seed accounts for testers (internal only — never in store notes)

| Email | Password | Role |
|---|---|---|
| james.carter@example.com | Vowed123! | Host — Tuscany |
| emma.shaw@example.com | Vowed123! | Host — Lake Como |
| sophia.lane@example.com | Vowed123! | Guest in both |
| test.empty@example.com | Test123! | No weddings |

Invite codes: `VOWED-GUEST` / `VOWED-HOST` · `VOWED2-GUEST` / `VOWED2-HOST`
