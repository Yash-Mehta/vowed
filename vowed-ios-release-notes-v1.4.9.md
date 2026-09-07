Vowed v1.4.9 — App Store / TestFlight Release Notes

Last live App Store version: v1.4.4. Covers everything since: invite code hang fix, account-flow "create account" prompt fix, global user profiles (v1.4.5-v1.4.7), plus this round's guest post-delete, Instagram-style photo display, and comment input wrapping (v1.4.9).

App Store "What's New" (user-facing)

Guests can now delete their own posts — no need to ask a host.

Photos in the feed now show at their real size and shape instead of being force-cropped, matching the way Instagram displays photos.

Fixed a bug where longer comments wouldn't wrap properly while typing.

Also includes: faster, more reliable invite code entry, clearer messaging when signing in with an existing account, and a single profile (name & photo) shared across every wedding you're part of.

TestFlight "What to Test" (tester-facing)

New this build:
1. As a guest, tap the ... menu on a post you authored — you should see only "Delete post" (no Pin/Edit) and it should delete successfully. Tap the ... menu on someone else's post — no menu button should appear at all.
2. As a host, confirm you still see Pin / Edit caption / Delete on every post regardless of author.
3. Post a very wide (panorama) photo and a very tall (portrait) photo — neither should get cropped. Expect letterboxing (black bars) on shapes outside the normal range, and no forced crop screen when picking from camera or library.
4. Open the comment sheet on any post and type a long comment — it should wrap across multiple lines and grow the input box (up to a cap) instead of scrolling sideways.

Regression check (carried over from earlier versions):
5. Enter an invite code and confirm it resolves quickly (no long spinner).
6. Try creating an account with an email that already has one — confirm you're told clearly you should sign in instead.
7. Edit your name/photo from Profile and confirm it updates across every wedding you're part of.
