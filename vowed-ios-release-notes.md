Vowed v1.5.1 (build 1) — App Store / TestFlight Release Notes

Last live App Store version: v1.5.0. Covers the phone-only authentication rewrite (email/password removed entirely), a routing audit across every auth and wedding-join path, a codebase cleanup pass, and a security hardening pass.

v1.5.1 is a fix release on top of v1.5.0, which is live. The notes below still describe the whole v1.5.0 change for reference, but the App Store copy should be the SHORT v1.5.1 block immediately following.

## App Store "What's New" — v1.5.1 (use this)

Fixes and safeguards:

Signing in on a shared device no longer risks picking up a wedding invite someone else entered before you.

If a join was interrupted part-way, re-entering your invite code now finishes it properly instead of saying you had already joined.

Fixed a rare case where the welcome screen could appear without its buttons.

Improved text contrast on the welcome screen, and fixed the keyboard covering the country list when searching on some Android phones.

---

## App Store "What's New" — v1.5.0 (already published, for reference)

Signing in has changed.

Vowed now uses your phone number instead of an email and password. Enter your number, we text you a 6-digit code, and you're in — nothing to remember, nothing to reset. Your account, your wedding parties, and every photo you've shared are exactly where you left them.

Also in this release:

A new Settings screen puts your phone number, sign out, and account deletion in one place.

Entering a host invite code now upgrades you to host if you'd already joined that wedding as a guest.

Fixed several ways you could get stuck mid sign-in or while joining a wedding party with no way forward.

Fixed a bug where being removed from a wedding party showed a permissions error instead of telling you what happened.

Fixed the country picker on the sign-in screen — the keyboard no longer covers the country list while you search.

A redesigned welcome screen, and clearer buttons: the invite-code option now says so, instead of hiding behind "Create account".

Security improvements to how host access is granted and how wedding photos are protected.

## TestFlight "What to Test" (tester-facing)

This build replaces email/password sign-in with phone + SMS code. Test 1 is the one that matters most — everything else is downstream of it.

Sign-in and account continuity:
1. CRITICAL — Sign in with the phone number already on your account. You should land on your existing wedding(s) with all photos, posts and your name/photo intact. If you land on an empty new account instead, STOP and report the phone number used — it means the account wasn't matched.
2. Sign in with a phone number that has never been used. Expect a fresh account and the profile-setup flow, not an error.
3. Enter a wrong 6-digit code, then a code from an older text that you already used. Both should say "invalid or expired" — no crash, no distinct wording that reveals which case it was.
4. Request codes repeatedly for the same number. After a few, sends should be refused (rate limiting) rather than continuing to text you.
5. Tap through the country code picker — it should default to US. Try a non-US number if you have one.
6. CRITICAL — After the code verifies, confirm you are moved off the OTP screen. Getting stuck there with no back button is the exact bug this build fixes.

Joining and roles:
7. As someone already in a wedding, enter that wedding's invite code again. You should be told immediately that you're already a member — not shown the join form and bounced after filling it in.
8. As an existing guest, enter that wedding's HOST code. You should be elevated to host.
9. As an existing host, enter that wedding's GUEST code. You should stay host.
10. Sign out, then sign in as a different person. The second user must NOT be dropped into a join form for the first user's wedding.
11. Turn on airplane mode on the profile-setup screen and submit. It should surface a real error — it must not silently overwrite your membership or demote a host to guest.

Creating weddings:
12. As a host who already has a wedding, create a SECOND wedding. The wizard should run normally — it previously refused.
13. While signed out, try to reach the host wizard directly. You should be sent to account creation rather than walking the whole wizard and failing at the last screen.

Account deletion:
14. In Settings, delete your account. Confirm all weddings and the sign-in itself are gone.
15. On a per-wedding profile, use "Remove account" while you belong to two or more weddings. Only that wedding should be left; the account survives.

Welcome screen (new in build 16):
16. Force-quit and relaunch the app. Watch the moment the opening logo fades — "Vowed Social" should appear to settle in place, not jump upward. This is the specific thing to judge.
17. Confirm the three options read correctly: Sign in, Join with an invite code, and the "Planning a wedding? Create yours" link. Tap each and confirm it lands where the label promises.
18. Tap Sign in and watch the transition — both screens are cream, so there should be no colour flash.

Country picker:
19. On the phone number screen, tap the flag/dial-code button, then tap the search field and type. The country list and search box must stay visible above the keyboard — this is the bug being fixed, so check it carefully.
20. Scroll the country list while the keyboard is up; it should dismiss the keyboard as you drag.
21. Pick a country, reopen the picker — the search box must be empty, not showing your previous search.
22. Close the picker by tapping the dimmed area above it, reopen it — again, the search must be cleared.

Visual:
23. On the feed, check the countdown card's leaf sprig and the leaf dividers between sections. The sprig artwork was redrawn — it should look clean at both large and small sizes, not stretched or clipped.

Regression check:
24. Post a photo, add a long comment, and delete your own post as a guest.
25. Confirm invite codes still resolve quickly with no long spinner.
26. As a host, edit the couple name or venue in Admin, then have someone open the invite screen with your code — the preview should show the UPDATED details (previously it stayed frozen at the original values).
