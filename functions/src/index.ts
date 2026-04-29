import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as nodemailer from 'nodemailer';

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

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
        <!-- Monogram -->
        <tr><td align="center" style="padding-bottom:8px;">
          <div style="font-size:44px;color:#7A4A3F;font-style:italic;letter-spacing:-2px;">Y&amp;V</div>
        </td></tr>
        <tr><td align="center" style="padding-bottom:8px;">
          <div style="height:0.5px;background:rgba(122,74,63,0.25);margin:0 auto;width:60%;"></div>
        </td></tr>
        <tr><td align="center" style="padding-bottom:36px;">
          <p style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#8C7064;margin:8px 0 0;">Yash &amp; Vaani &nbsp;·&nbsp; Dec 5, 2026</p>
        </td></tr>

        <!-- Heading -->
        <tr><td style="padding-bottom:12px;">
          <h1 style="font-size:28px;font-weight:normal;color:#2A1D17;margin:0;line-height:1.2;">Reset your password</h1>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <p style="font-family:Arial,sans-serif;font-size:15px;color:#5C463C;line-height:1.7;margin:0;">
            Someone requested a password reset for your <strong>Our Day</strong> account. Tap the button below to choose a new password.
          </p>
        </td></tr>

        <!-- CTA button -->
        <tr><td align="center" style="padding-bottom:32px;">
          <a href="${resetLink}"
             style="display:inline-block;background:#7A4A3F;color:#FAF6F1;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 36px;border-radius:9999px;letter-spacing:0.3px;">
            Reset my password
          </a>
        </td></tr>

        <!-- Fine print -->
        <tr><td style="padding-bottom:36px;">
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#8C7064;line-height:1.7;margin:0;">
            If you didn't request this, you can safely ignore this email — your password won't change.
            This link expires in <strong>1 hour</strong>.
          </p>
        </td></tr>

        <!-- Fallback link -->
        <tr><td style="padding-bottom:36px;">
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#B59E91;line-height:1.7;margin:0;">
            Button not working? Copy and paste this link into your browser:<br>
            <a href="${resetLink}" style="color:#7A4A3F;word-break:break-all;">${resetLink}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="border-top:0.5px solid rgba(122,74,63,0.14);padding-top:24px;">
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#B59E91;margin:0;">
            Our Day &nbsp;·&nbsp; Hard Rock · Punta Cana &nbsp;·&nbsp; December 5, 2026
          </p>
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
        // Don't reveal whether an account exists — succeed silently
        return { success: true };
      }
      throw new HttpsError('internal', 'Could not generate reset link.');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser.value(), pass: gmailPass.value() },
    });

    await transporter.sendMail({
      from: `"Our Day" <${gmailUser.value()}>`,
      to: email,
      subject: 'Reset your Our Day password',
      html: resetEmailHtml(resetLink),
    });

    return { success: true };
  }
);

// ── Push notifications ────────────────────────────────────────────────────────

async function getAllFcmTokens(): Promise<string[]> {
  const snap = await db.collection('users').get();
  return snap.docs
    .map((d) => d.data().fcmToken as string | null)
    .filter((t): t is string => !!t);
}

export const onPostCreated = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post) return;
  const tokens = await getAllFcmTokens();
  if (tokens.length === 0) return;
  const isAnnouncement = post.type === 'announcement';
  const title = isAnnouncement ? '📢 New announcement' : `${post.authorName} posted a photo`;
  const body = (post.caption as string | undefined)?.slice(0, 120) ?? '';
  await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    apns: { payload: { aps: { sound: 'default' } } },
  });
});

export const onCommentCreated = onDocumentCreated(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;
    const postRef = db.doc(`posts/${event.params.postId}`);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return;
    const post = postSnap.data()!;
    await postRef.update({ commentCount: FieldValue.increment(1) });
    if (post.authorId === comment.authorId) return;
    const authorSnap = await db.doc(`users/${post.authorId}`).get();
    if (!authorSnap.exists) return;
    const token = authorSnap.data()?.fcmToken as string | null;
    if (!token) return;
    await messaging.send({
      token,
      notification: {
        title: `${comment.authorName} commented on your post`,
        body: (comment.text as string | undefined)?.slice(0, 120) ?? '',
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  }
);

export const onLikeCreated = onDocumentCreated(
  'posts/{postId}/likes/{uid}',
  async (event) => {
    await db.doc(`posts/${event.params.postId}`).update({ likeCount: FieldValue.increment(1) });
  }
);

export const onLikeDeleted = onDocumentDeleted(
  'posts/{postId}/likes/{uid}',
  async (event) => {
    await db.doc(`posts/${event.params.postId}`).update({ likeCount: FieldValue.increment(-1) });
  }
);
