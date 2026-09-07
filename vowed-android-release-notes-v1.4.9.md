Vowed v1.4.9 — Android Production Release Notes

Last live version: v1.4.4. Covers everything since: invite code hang fix, account-flow "create account" prompt fix, global user profiles (v1.4.5-v1.4.7), plus this round's guest post-delete, Instagram-style photo display, and comment input wrapping (v1.4.9).

Google Play "What's New" (user-facing, <=500 chars)

Guests can now delete their own posts. Photos in the feed display at their real shape instead of being cropped. Fixed comments not wrapping long messages while typing. Also: faster invite code entry, clearer sign-in messaging, and one shared profile across every wedding you're part of.

Character count: 291 (well under the 500 limit)

Play internal/closed-testing instructions (tester-facing, internal only)

New this build:
1. As a guest, tap the ... menu on a post you authored — you should see only "Delete post" (no Pin/Edit) and it should delete successfully. Tap the ... menu on someone else's post — no menu button should appear at all.
2. As a host, confirm you still see Pin / Edit caption / Delete on every post regardless of author.
3. Post a very wide (panorama) photo and a very tall (portrait) photo — neither should get cropped, expect letterboxing on out-of-range shapes.
4. Open the comment sheet on any post and type a long comment — it should wrap across multiple lines instead of scrolling sideways.

Regression check (carried over from earlier versions):
5. Enter an invite code and confirm it resolves quickly.
6. Try creating an account with an email that already has one — confirm you're told to sign in instead.
7. Edit your name/photo from Profile and confirm it updates across every wedding you're part of.

Opt-in link: Play Console -> Testing -> Internal/Closed testing -> Testers tab -> copy opt-in link.
