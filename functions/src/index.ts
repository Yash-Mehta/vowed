import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as nodemailer from 'nodemailer';
import twilio from 'twilio';

initializeApp();

const db = getFirestore();

const gmailUser = defineSecret('GMAIL_USER');
const gmailPass = defineSecret('GMAIL_APP_PASS');

const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID');
const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN');
const twilioVerifyServiceSid = defineSecret('TWILIO_VERIFY_SERVICE_SID');

// ── Email template ────────────────────────────────────────────────────────────

function resetEmailHtml(resetLink: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4ECE2;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4ECE2;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#FAF6F1;border-radius:22px;padding:48px 40px;font-family:Georgia,serif;">
        <tr><td align="center" style="padding-bottom:36px;">
          <div style="font-size:44px;color:#7A4A3F;font-style:italic;letter-spacing:-2px;">Vowed</div>
          <p style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#8C7064;margin:8px 0 0;">Wedding &amp; Celebration App</p>
        </td></tr>
        <tr><td style="padding-bottom:12px;">
          <h1 style="font-size:28px;font-weight:normal;color:#2A1D17;margin:0;line-height:1.2;">Reset your password</h1>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <p style="font-family:Arial,sans-serif;font-size:15px;color:#5C463C;line-height:1.7;margin:0;">
            Someone requested a password reset for your <strong>Vowed</strong> account. Tap the button below to choose a new password.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:32px;">
          <a href="${resetLink}"
             style="display:inline-block;background:#7A4A3F;color:#FAF6F1;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 36px;border-radius:9999px;letter-spacing:0.3px;">
            Reset my password
          </a>
        </td></tr>
        <tr><td style="padding-bottom:36px;">
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#8C7064;line-height:1.7;margin:0;">
            If you didn't request this, you can safely ignore this email — your password won't change.
            This link expires in <strong>1 hour</strong>.
          </p>
        </td></tr>
        <tr><td style="padding-bottom:36px;">
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#B59E91;line-height:1.7;margin:0;">
            Button not working? Copy and paste this link into your browser:<br>
            <a href="${resetLink}" style="color:#7A4A3F;word-break:break-all;">${resetLink}</a>
          </p>
        </td></tr>
        <tr><td align="center" style="border-top:0.5px solid rgba(122,74,63,0.14);padding-top:24px;">
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#B59E91;margin:0;">Vowed · Wedding &amp; Celebration App</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Send password reset email ─────────────────────────────────────────────────

export const sendResetEmail = onCall(
  { secrets: [gmailUser, gmailPass] },
  async (request) => {
    const email = (request.data?.email as string | undefined)?.trim().toLowerCase();
    if (!email) throw new HttpsError('invalid-argument', 'Email is required.');

    let resetLink: string;
    try {
      resetLink = await getAuth().generatePasswordResetLink(email);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        return { success: true };
      }
      throw new HttpsError('internal', 'Could not generate reset link.');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser.value(), pass: gmailPass.value() },
    });

    await transporter.sendMail({
      from: `"Vowed" <${gmailUser.value()}>`,
      to: email,
      subject: 'Reset your Vowed password',
      html: resetEmailHtml(resetLink),
    });

    return { success: true };
  }
);

// ── Phone auth via Twilio Verify ────────────────────────────────────────────────

const E164_FORMAT = /^\+[1-9]\d{6,14}$/;
const OTP_CODE_FORMAT = /^\d{4,10}$/;

// Separate keyspace from enforceInviteRateLimit's otpRateLimits-equivalent —
// OTP sends cost real money per attempt (Twilio Verify billing), so this is
// rate-limited on both the sender's IP (stop one client from targeting many
// numbers) and the target phone number (stop one number from being bombed).
async function enforceOtpRateLimit(key: string, maxAttempts: number, windowMs: number): Promise<void> {
  const window = Math.floor(Date.now() / windowMs);
  const safeKey = key.replace(/[^a-zA-Z0-9.:+_-]/g, '_').slice(0, 200) || 'unknown';
  const ref = db.doc(`otpRateLimits/${safeKey}_${window}`);

  const snap = await ref.get();
  const count = (snap.data()?.count as number | undefined) ?? 0;
  if (count >= maxAttempts) {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');
  }

  await ref.set(
    { count: FieldValue.increment(1), expiresAt: Timestamp.fromMillis((window + 1) * windowMs) },
    { merge: true }
  );
}

function twilioClient() {
  return twilio(twilioAccountSid.value(), twilioAuthToken.value());
}

export const sendPhoneOtp = onCall(
  { secrets: [twilioAccountSid, twilioAuthToken, twilioVerifyServiceSid] },
  async (request) => {
    const phoneNumber = (request.data?.phoneNumber as string | undefined)?.trim();
    if (!phoneNumber || !E164_FORMAT.test(phoneNumber)) {
      throw new HttpsError('invalid-argument', 'A valid phone number is required.');
    }

    const ip = request.rawRequest.ip ?? 'unknown';
    await enforceOtpRateLimit(`send_ip_${ip}`, 10, 15 * 60 * 1000);
    await enforceOtpRateLimit(`send_phone_${phoneNumber}`, 5, 15 * 60 * 1000);

    try {
      await twilioClient()
        .verify.v2.services(twilioVerifyServiceSid.value())
        .verifications.create({ to: phoneNumber, channel: 'sms' });
    } catch (e: any) {
      console.error('sendPhoneOtp: Twilio verifications.create failed', { code: e?.code, status: e?.status, message: e?.message });
      throw new HttpsError('internal', 'Could not send verification code.');
    }

    return { success: true };
  }
);

export const verifyPhoneOtp = onCall(
  { secrets: [twilioAccountSid, twilioAuthToken, twilioVerifyServiceSid] },
  async (request) => {
    const phoneNumber = (request.data?.phoneNumber as string | undefined)?.trim();
    const code = (request.data?.code as string | undefined)?.trim();
    if (!phoneNumber || !E164_FORMAT.test(phoneNumber)) {
      throw new HttpsError('invalid-argument', 'A valid phone number is required.');
    }
    if (!code || !OTP_CODE_FORMAT.test(code)) {
      throw new HttpsError('invalid-argument', 'A valid verification code is required.');
    }

    const ip = request.rawRequest.ip ?? 'unknown';
    await enforceOtpRateLimit(`verify_ip_${ip}`, 10, 15 * 60 * 1000);
    await enforceOtpRateLimit(`verify_phone_${phoneNumber}`, 8, 15 * 60 * 1000);

    let check;
    try {
      check = await twilioClient()
        .verify.v2.services(twilioVerifyServiceSid.value())
        .verificationChecks.create({ to: phoneNumber, code });
    } catch (e: any) {
      console.error('verifyPhoneOtp: Twilio verificationChecks.create failed', { code: e?.code, status: e?.status, message: e?.message });
      // Twilio throws (rather than returning a rejected check) once a
      // verification is expired, already approved, or otherwise no longer
      // live — e.g. a resend invalidated the code being submitted, or the
      // same code was checked twice (SMS autofill + manual submit racing).
      // That's a "get a new code" situation for the user, not a generic
      // failure, so surface it the same way as a wrong code rather than a
      // scary internal error.
      if (e?.status === 404) {
        throw new HttpsError('permission-denied', 'Invalid or expired code.');
      }
      throw new HttpsError('internal', 'Could not verify code.');
    }

    if (check.status !== 'approved') {
      throw new HttpsError('permission-denied', 'Invalid or expired code.');
    }

    // Reuse the existing account if this number was backfilled or previously
    // registered, so the person lands back on their own data — otherwise
    // this is a brand-new phone-only signup.
    let uid: string;
    try {
      const existing = await getAuth().getUserByPhoneNumber(phoneNumber);
      uid = existing.uid;
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') {
        throw new HttpsError('internal', 'Could not look up account.');
      }
      const created = await getAuth().createUser({ phoneNumber });
      uid = created.uid;
    }

    const customToken = await getAuth().createCustomToken(uid);
    return { customToken };
  }
);

// ── Invite code validation (rate-limited) ───────────────────────────────────────

const INVITE_RATE_LIMIT_MAX_ATTEMPTS = 8;
const INVITE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// Invite codes gate private wedding data (photos, guest list) and the host
// code additionally grants admin privileges, so lookups must be rate-limited
// server-side — clients can no longer read weddingsByCode directly.
//
// Fixed-window counter via atomic increment, keyed by IP + time bucket — NOT
// a transaction. A prior sliding-window-log version used runTransaction on a
// single per-IP document; a wedding invite code is sent to many guests who
// all try it around the same time, and a chunk of them commonly share an
// apparent IP (venue wifi, carrier-grade NAT), so concurrent requests piled
// onto that one document and Firestore serialized/retried the losers — under
// real contention that could burn most of the callable's 60s timeout,
// surfacing as an "infinite" loading spinner (v1.4.5 bug). FieldValue.increment
// is commutative and needs no read-modify-write cycle, so concurrent writers
// to the same document never contend. Trade-off: a fixed window allows a
// short burst across the window boundary that a true sliding log wouldn't —
// acceptable since the alternative broke legitimate onboarding, and this
// still bounds abuse to a small multiple of the limit per IP.
async function enforceInviteRateLimit(ip: string): Promise<void> {
  const window = Math.floor(Date.now() / INVITE_RATE_LIMIT_WINDOW_MS);
  const safeIp = ip.replace(/[^a-zA-Z0-9.:-]/g, '_').slice(0, 200) || 'unknown';
  const ref = db.doc(`inviteRateLimits/${safeIp}_${window}`);

  const snap = await ref.get();
  const count = (snap.data()?.count as number | undefined) ?? 0;
  if (count >= INVITE_RATE_LIMIT_MAX_ATTEMPTS) {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again in a few minutes.');
  }

  // Best-effort count, not a hard cap — concurrent requests can both pass
  // the check above before either increments. Verified against the Firestore
  // emulator under realistic staggered arrival (requests spaced over a 2s
  // window, modeling the DNS/TLS/dispatch jitter independent phones actually
  // produce): correctly capped at exactly the limit and resolved in ~2s.
  // Only a synthetic same-instant burst (all reads issued in one process
  // tick, which independent network clients can't produce) defeats the
  // check entirely — not a realistic production scenario, and reintroducing
  // a transaction to close that gap is exactly what caused the outage this
  // fix addresses. A hard cap isn't worth resurrecting that failure mode for.
  await ref.set(
    {
      count: FieldValue.increment(1),
      expiresAt: Timestamp.fromMillis((window + 1) * INVITE_RATE_LIMIT_WINDOW_MS),
    },
    { merge: true }
  );
}

const INVITE_CODE_FORMAT = /^[A-Z0-9-]{4,20}$/;

export const validateInviteCode = onCall(async (request) => {
  const code = (request.data?.code as string | undefined)?.trim().toUpperCase();
  if (!code || !INVITE_CODE_FORMAT.test(code)) {
    throw new HttpsError('invalid-argument', 'Invalid code format.');
  }

  await enforceInviteRateLimit(request.rawRequest.ip ?? 'unknown');

  const snap = await db.doc(`weddingsByCode/${code}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Invalid code.');

  const data = snap.data()!;
  return { weddingId: data.weddingId, role: data.role, preview: data.preview };
});

// ── Push notifications ────────────────────────────────────────────────────────

// prefField: member-doc boolean gating this notification type. Absent field = opted in,
// so only an explicit `false` filters a member out (backward compat with old member docs).
async function getWeddingPushTokens(
  weddingId: string,
  excludeUid?: string,
  prefField?: 'notifyPosts'
): Promise<string[]> {
  const snap = await db.collection('weddings').doc(weddingId).collection('members').get();
  const authorToken = excludeUid
    ? (snap.docs.find((d) => d.id === excludeUid)?.data().fcmToken as string | null) ?? null
    : null;
  return snap.docs
    .filter((d) => !excludeUid || d.id !== excludeUid)
    .filter((d) => !prefField || d.data()[prefField] !== false)
    .map((d) => d.data().fcmToken as string | null)
    .filter((t): t is string => !!t && t.length > 10 && t !== authorToken);
}

async function sendPushNotification(tokens: string[], title: string, body: string): Promise<void> {
  const unique = [...new Set(tokens)];
  if (unique.length === 0) return;

  const expoTokens = unique.filter((t) => t.startsWith('ExponentPushToken['));
  const fcmTokens = unique.filter((t) => !t.startsWith('ExponentPushToken['));

  if (expoTokens.length > 0) {
    const messages = expoTokens.map((to) => ({ to, title, body, sound: 'default' }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) console.error('Expo push error:', await res.text());
  }

  for (const token of fcmTokens) {
    try {
      await getMessaging().send({
        token,
        notification: { title, body },
        android: { priority: 'high', notification: { sound: 'default' } },
      });
    } catch (err) {
      console.error('FCM send error for token', token.slice(0, 20), err);
    }
  }
}

export const onPostCreated = onDocumentCreated(
  'weddings/{weddingId}/posts/{postId}',
  async (event) => {
    const post = event.data?.data();
    if (!post) return;
    const { weddingId } = event.params;
    const authorId = post.authorId as string | undefined;
    const isAnnouncement = post.type === 'announcement';
    // Announcements always notify everyone; photo posts respect the notifyPosts preference
    const tokens = await getWeddingPushTokens(
      weddingId,
      authorId,
      isAnnouncement ? undefined : 'notifyPosts'
    );
    if (tokens.length === 0) return;
    const authorName = (post.authorName as string | undefined) ?? 'Someone';
    const title = isAnnouncement ? 'Wedding announcement' : `New photo from ${authorName}`;
    const body = (post.caption as string | undefined)?.slice(0, 100) ?? '';
    await sendPushNotification(tokens, title, body);
  }
);

export const onCommentCreated = onDocumentCreated(
  'weddings/{weddingId}/posts/{postId}/comments/{commentId}',
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;
    const { weddingId, postId } = event.params;
    const postRef = db.doc(`weddings/${weddingId}/posts/${postId}`);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return;
    const post = postSnap.data()!;
    await postRef.update({ commentCount: FieldValue.increment(1) });
    if (post.authorId === comment.authorId) return;
    const authorSnap = await db.doc(`weddings/${weddingId}/members/${post.authorId}`).get();
    if (!authorSnap.exists) return;
    if (authorSnap.data()?.notifyComments === false) return;
    const token = authorSnap.data()?.fcmToken as string | null;
    if (!token || token.length < 10) return;
    const commentAuthorName = (comment.authorName as string | undefined) ?? 'Someone';
    await sendPushNotification(
      [token],
      `${commentAuthorName} commented on your post`,
      (comment.text as string | undefined)?.slice(0, 120) ?? ''
    );
  }
);

export const onLikeCreated = onDocumentCreated(
  'weddings/{weddingId}/posts/{postId}/likes/{uid}',
  async (event) => {
    const { weddingId, postId } = event.params;
    await db.doc(`weddings/${weddingId}/posts/${postId}`).update({
      likeCount: FieldValue.increment(1),
    });
  }
);

export const onLikeDeleted = onDocumentDeleted(
  'weddings/{weddingId}/posts/{postId}/likes/{uid}',
  async (event) => {
    const { weddingId, postId } = event.params;
    await db.doc(`weddings/${weddingId}/posts/${postId}`).update({
      likeCount: FieldValue.increment(-1),
    });
  }
);

export const onCommentDeleted = onDocumentDeleted(
  'weddings/{weddingId}/posts/{postId}/comments/{commentId}',
  async (event) => {
    const { weddingId, postId } = event.params;
    await db.doc(`weddings/${weddingId}/posts/${postId}`).update({
      commentCount: FieldValue.increment(-1),
    });
  }
);

async function deleteSubcollection(parentPath: string, colId: string): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await db.collection(`${parentPath}/${colId}`).limit(100).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// Firebase Storage download URLs encode the object path between "/o/" and
// the "?" query string, URL-encoded — this reverses that to get the path
// bucket.file() needs. Admin SDK bypasses storage.rules, so no rules change
// is needed for this deletion to work.
function storagePathFromDownloadURL(url: string): string | null {
  const match = url.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Deleting a post left its comments/likes subcollections and Storage photo
// file(s) orphaned — no function did this cleanup before v1.4.9, and no
// storage.rules delete permission existed for posts either. This closes that
// gap now that guests (not just hosts) can delete posts, since it will be
// exercised far more often.
export const onPostDeleted = onDocumentDeleted(
  'weddings/{weddingId}/posts/{postId}',
  async (event) => {
    const post = event.data?.data();
    if (!post) return;
    const { weddingId, postId } = event.params;
    const postPath = `weddings/${weddingId}/posts/${postId}`;

    await Promise.allSettled([
      deleteSubcollection(postPath, 'comments'),
      deleteSubcollection(postPath, 'likes'),
    ]);

    const urls: string[] = post.photoURLs?.length ? post.photoURLs : post.photoURL ? [post.photoURL] : [];
    const bucket = getStorage().bucket();
    await Promise.allSettled(
      urls.map(async (url) => {
        const path = storagePathFromDownloadURL(url);
        if (!path) return;
        await bucket.file(path).delete({ ignoreNotFound: true });
      })
    );
  }
);

// Profile (displayName/photoURL) is account-level, set once on users/{uid}
// and reused across every wedding a user joins (see lib/firestore.ts's
// setUserProfile). weddings/{weddingId}/members/{uid} keeps a denormalized
// copy — everything that displays a member's name/photo (guest directory,
// posts, comments) reads that copy, so this function is what keeps all of
// them in sync with the one account-level edit. Replaces the old
// onMemberUpdated, which only propagated within the single wedding a member
// doc happened to live in — a user editing their profile from one wedding's
// context never updated their profile in any other wedding they belonged to.
export const onProfileUpdated = onDocumentUpdated('users/{uid}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const nameChanged = before.displayName !== after.displayName;
  const photoChanged = before.photoURL !== after.photoURL;
  if (!nameChanged && !photoChanged) return;

  const { uid } = event.params;
  const weddingIds: string[] = after.weddingIds ?? [];
  if (weddingIds.length === 0) return;

  const memberUpdate: Record<string, string | null> = {};
  if (nameChanged) memberUpdate.displayName = after.displayName;
  if (photoChanged) memberUpdate.photoURL = after.photoURL ?? null;

  const postUpdate: Record<string, string | null> = {};
  if (nameChanged) postUpdate.authorName = after.displayName;
  if (photoChanged) postUpdate.authorPhotoURL = after.photoURL ?? null;

  // One settled-promise pass per wedding — a missing/broken member doc for
  // one wedding shouldn't block propagation to the user's other weddings.
  await Promise.allSettled(
    weddingIds.map(async (weddingId) => {
      await db.doc(`weddings/${weddingId}/members/${uid}`).update(memberUpdate);

      const postsSnap = await db
        .collection(`weddings/${weddingId}/posts`)
        .where('authorId', '==', uid)
        .get();
      if (postsSnap.size > 0) {
        const batch = db.batch();
        postsSnap.docs.forEach((d) => batch.update(d.ref, postUpdate));
        await batch.commit();
      }
    })
  );

  // Comments: authorId already scopes this to just this user's comments
  // across every wedding, so one collection-group query covers all of them
  // — no per-wedding path filtering needed now that the trigger itself is
  // account-level rather than wedding-scoped.
  const commentsSnap = await db.collectionGroup('comments').where('authorId', '==', uid).get();
  if (commentsSnap.size > 0) {
    const batch = db.batch();
    commentsSnap.docs.forEach((d) => batch.update(d.ref, postUpdate));
    await batch.commit();
  }
});
