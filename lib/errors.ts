// Turns a thrown error into copy that is safe to put in front of a guest.
//
// Firebase writes its messages for developers, not for the person holding the
// phone. A rejected Firestore write reads "Missing or insufficient
// permissions."; a rejected upload names the exact Storage object it could not
// reach ("User does not have permission to access
// 'weddings/<id>/coverPhoto.jpg'"); an offline read explains the SDK's
// internal cache state. All of that reached the UI verbatim wherever a catch
// block did `Alert.alert('Error', e.message)` — select-wedding.tsx still
// carries a comment about having shipped the raw "Missing or insufficient
// permissions" to guests who had been removed from a wedding.
//
// The `?? 'friendly copy'` fallbacks those sites paired it with were never
// reachable: FirebaseError extends Error, so `message` is always a non-empty
// string and the nullish branch never ran. The fallback only looked like a
// safety net.
//
// So this never returns anything derived from an SDK message. A recognised
// code maps to copy written for a guest; everything else gets the caller's
// fallback, which is why `fallback` is required rather than defaulted — the
// sentence should fit what the user was actually trying to do. The real error
// still reaches the console, which is where it was always the useful thing.
//
// lib/phoneAuth.ts already did this correctly by hardcoding its strings; this
// generalises that pattern to the paths that had not caught up.

import { FirebaseError } from 'firebase/app';

// Keyed on the SDK's own code strings. Firestore codes are bare
// ('permission-denied'); Storage, Auth and Functions namespace theirs
// ('storage/unauthorized'). Only codes a guest can actually hit and act on
// are listed — anything else is noise to them and belongs in the fallback.
const COPY_BY_CODE: Readonly<Record<string, string>> = {
  // Reachable offline or on a flaky venue wifi, which is the common case at
  // an actual wedding and the one worth naming precisely.
  unavailable: 'Could not reach the server. Please check your connection and try again.',
  'deadline-exceeded': 'That took too long. Please check your connection and try again.',
  'storage/retry-limit-exceeded':
    'The upload timed out. Please check your connection and try again.',

  // Almost always "you were removed from this wedding" or "the host changed
  // something". Never phrased as a permissions error — that tells a guest
  // nothing they can act on and reads like a bug.
  'permission-denied': 'You no longer have access to this wedding. Please ask the host to re-invite you.',
  'storage/unauthorized': 'You do not have permission to change this photo. Please ask the host.',
  'storage/unauthenticated': 'Please sign in again and retry.',
  unauthenticated: 'Please sign in again and retry.',

  'resource-exhausted': 'Too many attempts. Please wait a few minutes and try again.',
  'storage/quota-exceeded': 'There is no storage space left for this wedding. Please contact the host.',
  'storage/canceled': 'The upload was cancelled.',
  'not-found': 'That is no longer available — it may have been deleted.',
  'already-exists': 'That already exists.',
} as const;

// `fallback` is what the user sees unless the error is one of the recognised,
// actionable cases above. Write it to describe the attempted action, e.g.
// 'Could not save changes. Please try again.'
export function userMessage(e: unknown, fallback: string): string {
  // Keep the real error available for debugging — this is the only place it
  // should go. `context` is the fallback because it reads as a short label
  // for the operation that failed.
  console.warn(`[error] ${fallback}`, e);

  const code = e instanceof FirebaseError ? e.code : (e as { code?: unknown })?.code;
  if (typeof code === 'string' && code in COPY_BY_CODE) return COPY_BY_CODE[code];

  return fallback;
}
