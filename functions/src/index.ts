import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as nodemailer from 'nodemailer';

initializeApp();

const db = getFirestore();

const gmailUser = defineSecret('GMAIL_USER');
const gmailPass = defineSecret('GMAIL_APP_PASS');

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

export const onMemberUpdated = onDocumentUpdated(
  'weddings/{weddingId}/members/{uid}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const nameChanged = before.displayName !== after.displayName;
    const photoChanged = before.photoURL !== after.photoURL;
    if (!nameChanged && !photoChanged) return;

    const { weddingId, uid } = event.params;
    const update: Record<string, string | null> = {};
    if (nameChanged) update.authorName = after.displayName;
    if (photoChanged) update.authorPhotoURL = after.photoURL ?? null;

    // Update all posts by this author in this wedding
    const postsSnap = await db
      .collection(`weddings/${weddingId}/posts`)
      .where('authorId', '==', uid)
      .get();

    if (postsSnap.size > 0) {
      const batch = db.batch();
      postsSnap.docs.forEach((d) => batch.update(d.ref, update));
      await batch.commit();
    }

    // Update all comments by this author in this wedding
    const commentsSnap = await db
      .collectionGroup('comments')
      .where('authorId', '==', uid)
      .get();

    const weddingPrefix = `weddings/${weddingId}/`;
    const toUpdate = commentsSnap.docs.filter((d) => d.ref.path.startsWith(weddingPrefix));
    if (toUpdate.length > 0) {
      const batch = db.batch();
      toUpdate.forEach((d) => batch.update(d.ref, update));
      await batch.commit();
    }
  }
);
