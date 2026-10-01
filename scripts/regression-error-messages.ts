// Pins the invariant that no Firebase/Firestore/Storage error message ever
// reaches the UI.
//
// Firebase writes its messages for developers. Firestore says "Missing or
// insufficient permissions."; Storage names the exact object it could not
// reach ("User does not have permission to access
// 'weddings/<id>/coverPhoto.jpg'"), which discloses the storage layout to a
// guest; an offline read narrates the SDK's cache state. Eleven call sites
// used to pass those straight into Alert.alert, and select-wedding.tsx still
// carries a comment about having shipped the raw "Missing or insufficient
// permissions" to guests who had been removed from a wedding.
//
// The `e.message ?? 'friendly copy'` form those sites used looked safe and was
// not: FirebaseError extends Error, so `message` is always a non-empty string
// and the nullish branch could never run. That is the specific mistake this
// suite exists to catch, because it reads as handled.
//
// Two halves:
//   1. Behavioural — run userMessage against real FirebaseError instances
//      carrying the actual SDK strings, and assert nothing from them survives.
//   2. Structural — assert no Alert.alert anywhere passes a raw `.message`,
//      and that the app's own Error subclasses are built from literals.
//
// Credential-free by design: no firebase-admin import, so regression-all.ts
// runs it by default.

import * as fs from 'fs';
import * as path from 'path';
import { FirebaseError } from 'firebase/app';
import { userMessage } from '../lib/errors';

const ROOT = path.join(__dirname, '..');
let failures = 0;

function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// userMessage deliberately console.warns the real error so it stays
// debuggable. That is correct behaviour, and noise here — silence it.
const realWarn = console.warn;
console.warn = () => {};

// ── 1. Behavioural ─────────────────────────────────────────────────────────────

console.log('\nuserMessage never returns anything derived from the SDK message:');

// The real strings, verbatim. Firestore's comes from the server status rather
// than a client literal, which is why it does not appear in the SDK bundle.
const RAW: ReadonlyArray<{ code: string; message: string; fallback: string }> = [
  { code: 'permission-denied', message: 'Missing or insufficient permissions.', fallback: 'Could not save changes.' },
  { code: 'unavailable', message: 'Failed to get document because the client is offline.', fallback: 'Could not load this wedding.' },
  { code: 'storage/unauthorized', message: "User does not have permission to access 'weddings/abc123/coverPhoto.jpg'.", fallback: 'Could not upload photo.' },
  { code: 'resource-exhausted', message: 'Quota exceeded for quota metric ...', fallback: 'Could not save changes.' },
  { code: 'not-found', message: 'No document to update: projects/vowed/databases/(default)/documents/weddings/abc123', fallback: 'Could not save changes.' },
];

for (const { code, message, fallback } of RAW) {
  const out = userMessage(new FirebaseError(code, message), fallback);
  check(`${code}: the raw message does not appear`, !out.includes(message));
  // The substantive half — a leaked Firestore path or Storage object name is
  // worse than ugly copy, so assert on the identifying fragments too.
  const fragments = ['insufficient permissions', 'coupleName', 'weddings/', 'projects/', 'databases/', 'client is offline', 'Quota exceeded'];
  const leaked = fragments.filter((f) => out.includes(f));
  check(`${code}: no internal fragment leaks`, leaked.length === 0, leaked.join(', '));
  check(`${code}: returns non-empty copy`, out.trim().length > 0);
}

// A plain Error carries no code, so there is nothing safe to map — the
// caller's fallback must win rather than the internal detail.
check(
  'a non-Firebase Error falls back instead of exposing its message',
  userMessage(new Error('connection reset by peer at 10.0.0.1:5432'), 'Could not save changes.') ===
    'Could not save changes.'
);
check(
  'a thrown string falls back',
  userMessage('raw string failure', 'Could not save changes.') === 'Could not save changes.'
);
check('null falls back', userMessage(null, 'Could not save changes.') === 'Could not save changes.');

console.warn = realWarn;

// ── 2. Structural ──────────────────────────────────────────────────────────────

// Comments in these files quote the very constructs the checks search for,
// because they explain what not to reintroduce. Strip them first, exactly as
// regression-keyboard-avoidance.ts does and for the same reason.
function stripComments(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

const SOURCE = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))];

// The only sanctioned readers of `.message`. Both screens narrow with
// `instanceof OtpRateLimitedError | OtpInvalidCodeError` first, and
// lib/phoneAuth.ts constructs both with hardcoded literals — so the message
// shown is app-authored, not Firebase's. Checked below, so this allowlist
// cannot rot into a loophole.
const OTP_SCREENS = ['app/(auth)/phone.tsx', 'app/(onboarding)/create-account.tsx'];

console.log('\nno Alert.alert passes a raw error message:');

for (const file of SOURCE) {
  const rel = path.relative(ROOT, file);
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  // Matches an Alert.alert argument that reads .message off a caught error —
  // `e.message`, `e?.message`, `err.message`, with or without a `?? fallback`.
  const alertCalls = src.match(/Alert\.alert\([^;]*?\)/gs) ?? [];
  const offenders = alertCalls.filter((c) => /\b\w+\??\.message\b/.test(c));
  if (OTP_SCREENS.includes(rel)) {
    // Allowed, but only because of the instanceof narrowing — assert it.
    check(
      `${rel}: .message is guarded by an instanceof check on an app error class`,
      /instanceof Otp(RateLimited|InvalidCode)Error/.test(src)
    );
    continue;
  }
  check(`${rel}: no raw .message in an Alert`, offenders.length === 0, offenders.join(' | ').slice(0, 160));
}

console.log('\nthe app\'s own Error subclasses are built from literals, never e.message:');

const LIB = walk(path.join(ROOT, 'lib'));
for (const file of LIB) {
  const rel = path.relative(ROOT, file);
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  // `throw new SomeError(e.message)` re-wraps Firebase's wording in an
  // app-looking class, which defeats the instanceof allowlist above: the
  // class is ours but the sentence is still Firebase's.
  const rewraps = src.match(/new \w*Error\(\s*\w+\??\.message/g) ?? [];
  check(`${rel}: no Error constructed from a caught .message`, rewraps.length === 0, rewraps.join(', '));
}

// If the helper itself ever reads .message, every guarantee above collapses at
// the one point they all route through.
const errorsSrc = stripComments(fs.readFileSync(path.join(ROOT, 'lib', 'errors.ts'), 'utf8'));
check('lib/errors.ts never reads .message', !/\.message\b/.test(errorsSrc));
check('lib/errors.ts exports userMessage', /export function userMessage/.test(errorsSrc));

console.log('\nevery userMessage call site imports it:');

for (const file of SOURCE) {
  const rel = path.relative(ROOT, file);
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  if (!/\buserMessage\(/.test(src)) continue;
  check(`${rel}: imports userMessage`, /import \{[^}]*\buserMessage\b[^}]*\} from '[^']*lib\/errors'/.test(src));
}

console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
