// Seed accounts are identified by phone number, because that is the only thing
// verifyPhoneOtp looks up — v1.5.0 removed email/password auth entirely. Emails
// are still written to the Auth record so wipe-db.ts can keep finding these
// accounts by address.
//
// The numbers below are in the +1 (212) 555-01xx range reserved for fiction, so
// they can never reach a real handset. That also means Twilio cannot text them:
// you cannot complete an OTP as a seed user with the defaults.
//
// To actually sign in as one, override its number with a phone you can receive
// SMS on, then re-run the seed:
//
//   SEED_PHONE_JAMES_CARTER=+447700900123 npx tsx scripts/seed.ts
//
// The env var is SEED_PHONE_ plus the local part of the address, uppercased with
// non-letters as underscores (james.carter@example.com → SEED_PHONE_JAMES_CARTER).
// Only one account can hold a given number at a time — Firebase rejects
// duplicates — so move the override rather than copying it.

const DEFAULT_SEED_PHONES: Record<string, string> = {
  // seed-wedding-001 — James & Olivia
  'james.carter@example.com': '+12125550101',
  'sophia.lane@example.com': '+12125550102',
  'ethan.brooks@example.com': '+12125550103',
  'maya.patel@example.com': '+12125550104',
  'lucas.wright@example.com': '+12125550105',
  'chloe.morgan@example.com': '+12125550106',
  'noah.davis@example.com': '+12125550107',

  // seed-wedding-002 — Emma & Ryan
  'emma.shaw@example.com': '+12125550111',
  'liam.chen@example.com': '+12125550112',
  'ava.jones@example.com': '+12125550113',
  'oliver.park@example.com': '+12125550114',

  // no weddings — lands on the empty party-selection screen
  'test.empty@example.com': '+12125550199',
};

export function envKeyFor(email: string): string {
  return `SEED_PHONE_${email.split('@')[0].replace(/[^a-zA-Z]/g, '_').toUpperCase()}`;
}

export function phoneFor(email: string): string {
  const override = process.env[envKeyFor(email)];
  const fallback = DEFAULT_SEED_PHONES[email];
  const phone = override ?? fallback;
  if (!phone) throw new Error(`No seed phone number configured for ${email}`);
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new Error(`Seed phone for ${email} is not valid E.164: ${phone}`);
  }
  return phone;
}

// Creates the account if it is missing, and reconciles the phone number on an
// account that already exists — so re-running a seed after setting an override
// moves the number rather than silently keeping the old one.
export async function ensureSeedUser(
  auth: import('firebase-admin').auth.Auth,
  email: string
): Promise<import('firebase-admin').auth.UserRecord> {
  const phoneNumber = phoneFor(email);
  try {
    return await auth.createUser({ email, phoneNumber, emailVerified: true });
  } catch (e: any) {
    if (e.code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(email);
      if (existing.phoneNumber !== phoneNumber) {
        return await auth.updateUser(existing.uid, { phoneNumber });
      }
      return existing;
    }
    if (e.code === 'auth/phone-number-already-exists') {
      return await auth.getUserByPhoneNumber(phoneNumber);
    }
    throw e;
  }
}
