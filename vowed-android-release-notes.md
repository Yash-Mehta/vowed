Vowed v1.5.1 (versionCode 21) — Android Production Release Notes

Last live Play version: v1.5.0. Covers the phone-only authentication rewrite (email/password removed entirely), a routing audit across every auth and wedding-join path, a codebase cleanup pass, and a security hardening pass.

v1.5.1 is a fix release on top of v1.5.0, which is live. Use the SHORT v1.5.1 block below for the Play listing.

## Google Play "What's new" — v1.5.1 (use this)

Fixes: signing in on a shared device no longer picks up an invite code someone else entered; an interrupted join now completes when you re-enter your code; the welcome screen can no longer appear without its buttons; better text contrast; and the keyboard no longer covers the country list when searching on some Android phones.

---

## Google Play "What's New" — v1.5.0 (already published, for reference)

Signing in has changed: Vowed now uses your phone number instead of an email and password. Enter your number, get a 6-digit code by text, and you're in. Your account, wedding parties and photos are exactly where you left them. Also new: a Settings screen with sign out and account deletion, host invite codes that upgrade you from guest to host, a fix for the keyboard covering the country list, a redesigned welcome screen, and security improvements.

## Play internal/closed-testing instructions (tester-facing, internal only)

This build replaces email/password sign-in with phone + SMS code. Test 1 is the one that matters most — everything else is downstream of it.

Sign-in and account continuity:
1. CRITICAL — Sign in with the phone number already on your account. You should land on your existing wedding(s) with all photos, posts and your name/photo intact. If you land on an empty new account instead, STOP and report the phone number used.
2. Sign in with a never-used phone number. Expect a fresh account and profile setup, not an error.
3. Enter a wrong code, then a code from an older text you already used. Both should say "invalid or expired".
4. Request codes repeatedly for the same number — after a few, sends should be refused rather than continuing to text you.
5. Check the country code picker defaults to US; try a non-US number if you have one.
6. CRITICAL — After the code verifies, confirm you are moved off the OTP screen. Getting stuck there is the exact bug this build fixes. Also confirm the Android back button behaves sensibly throughout the phone flow.

Joining and roles:
7. As an existing member, re-enter that wedding's invite code — you should be told immediately you're already in, not shown the join form and bounced.
8. As an existing guest, enter the HOST code — you should be elevated to host.
9. As an existing host, enter the GUEST code — you should stay host.
10. Sign out, sign in as someone else. The second user must NOT be dropped into a join form for the first user's wedding.
11. Turn on airplane mode on the profile-setup screen and submit. It must surface a real error, not silently overwrite membership or demote a host to guest.

Creating weddings:
12. As a host who already has a wedding, create a SECOND wedding — the wizard should run normally.
13. While signed out, try to reach the host wizard directly — you should be sent to account creation.

Account deletion:
14. Settings -> delete account: all weddings and the sign-in itself should be gone.
15. Per-wedding "Remove account" while in two or more weddings: only that wedding is left, account survives.

Welcome screen (new in versionCode 20):
16. Force-quit and relaunch. Watch the opening logo fade — "Vowed Social" should settle in place, not jump upward.
17. Confirm the three options read correctly and each lands where its label promises.
18. Tap Sign in and check there is no colour flash between screens.

Country picker:
19. On the phone number screen, tap the flag/dial-code button, then tap the search field and type. The list and search box must stay visible above the keyboard. Test on Android 15 if you have a device — keyboard handling changed in that release and this fix has to work both ways.
20. Scroll the list with the keyboard up — it should dismiss as you drag. Press the Android back button with the keyboard open, then again; the first should close the keyboard, the second the sheet.
21. Pick a country, reopen the picker — the search box must be empty.
22. Close the picker by tapping the dimmed area, reopen — search must be cleared.

Visual:
23. Check the feed countdown card's leaf sprig and the leaf dividers — artwork was redrawn, should be clean at large and small sizes.

Regression check:
24. Post a photo, add a long comment, delete your own post as a guest.
25. Confirm invite codes resolve quickly with no long spinner.
26. As a host, edit the couple name or venue in Admin, then have someone open the invite screen with your code — the preview should show the UPDATED details (previously frozen at original values).

Opt-in link: Play Console -> Testing -> Internal/Closed testing -> Testers tab -> copy opt-in link.
