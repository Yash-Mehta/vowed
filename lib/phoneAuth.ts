import { httpsCallable, FunctionsError } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, functions } from './firebase';

export class OtpRateLimitedError extends Error {}
export class OtpInvalidCodeError extends Error {}

// Matches the callables' own timeout budget — see validateInviteCode in
// firestore.ts for why this class of guard exists (v1.4.5 rate-limiter
// contention incident).
const OTP_CALL_TIMEOUT_MS = 15000;

// Combines an explicit country dial code (from CountryCodePicker) with the
// local number the user typed.
export function buildE164(dialCode: string, localNumber: string): string | null {
  const digits = localNumber.trim().replace(/\D/g, '');
  if (digits.length < 4) return null;
  const combined = `${dialCode}${digits}`;
  return /^\+[1-9]\d{6,14}$/.test(combined) ? combined : null;
}

export async function sendPhoneOtp(phoneNumber: string): Promise<void> {
  const call = httpsCallable<{ phoneNumber: string }, { success: true }>(functions, 'sendPhoneOtp', {
    timeout: OTP_CALL_TIMEOUT_MS,
  });
  try {
    await call({ phoneNumber });
  } catch (e: unknown) {
    if (e instanceof FunctionsError && e.code === 'functions/resource-exhausted') {
      throw new OtpRateLimitedError('Too many attempts. Please try again later.');
    }
    throw e;
  }
}

export async function verifyPhoneOtp(phoneNumber: string, code: string): Promise<{ uid: string }> {
  const call = httpsCallable<{ phoneNumber: string; code: string }, { customToken: string }>(
    functions,
    'verifyPhoneOtp',
    { timeout: OTP_CALL_TIMEOUT_MS }
  );
  let res: Awaited<ReturnType<typeof call>>;
  try {
    res = await call({ phoneNumber, code });
  } catch (e: unknown) {
    if (e instanceof FunctionsError && e.code === 'functions/resource-exhausted') {
      throw new OtpRateLimitedError('Too many attempts. Please try again later.');
    }
    if (e instanceof FunctionsError && e.code === 'functions/permission-denied') {
      throw new OtpInvalidCodeError('Invalid or expired code. Please try again.');
    }
    throw e;
  }
  const cred = await signInWithCustomToken(auth, res.data.customToken);
  return { uid: cred.user.uid };
}
