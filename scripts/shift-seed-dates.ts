// One-off migration: shifts the two seed weddings' dates back into the
// future.
//
// scripts/seed.ts and scripts/seed2.ts now compute their wedding date
// relative to whenever they run, so a fresh seed can never go stale again.
// But the two seed weddings already live in production Firestore with the
// old hardcoded (and now past) dates, and re-running the seed scripts is not
// an option — they'd recreate posts and comments, duplicating everything.
// This script updates the existing documents in place instead.
//
// SCOPE: exactly seed-wedding-001 and seed-wedding-002, by hardcoded document
// id (see SEED_WEDDINGS below). There is no collection scan anywhere in this
// file and no id is ever read from Firestore and reused in a query — every
// path this script touches is built from the literal ids/codes in
// SEED_WEDDINGS, so it is structurally incapable of reaching any of the five
// real weddings in this database.
//
//   npx tsx scripts/shift-seed-dates.ts             # report only (default)
//   npx tsx scripts/shift-seed-dates.ts --write      # apply
//
// Report-then-apply, same pattern as scripts/backfill-party-roles.ts.
import * as admin from 'firebase-admin';
import * as path from 'path';
import { Timestamp } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--write');

admin.initializeApp({
  credential: admin.credential.cert(path.join(process.cwd(), 'serviceAccountKey.json')),
});
const db = admin.firestore();

interface SeedWeddingConfig {
  id: string;
  // Mirrors the constants of the same name in the matching seed script
  // (scripts/seed.ts for seed-wedding-001, scripts/seed2.ts for
  // seed-wedding-002) — duplicated rather than imported, since importing
  // either seed script would execute its top-level seed() call and write
  // brand-new posts/comments, which is exactly what this migration exists to
  // avoid.
  weddingOffsetDays: number;
  firstEventOffsetDays: number;
  ceremonyUtcHour: number;
  ceremonyUtcMinute: number;
  // weddingsByCode docs whose preview.dateStamp mirrors this wedding.
  codes: string[];
}

const SEED_WEDDINGS: SeedWeddingConfig[] = [
  {
    id: 'seed-wedding-001',
    weddingOffsetDays: 120,
    firstEventOffsetDays: -2,
    ceremonyUtcHour: 15,
    ceremonyUtcMinute: 30,
    codes: ['VOWED-GUEST', 'VOWED-HOST'],
  },
  {
    id: 'seed-wedding-002',
    weddingOffsetDays: 45,
    firstEventOffsetDays: -1,
    ceremonyUtcHour: 15,
    ceremonyUtcMinute: 0,
    codes: ['VOWED2-GUEST', 'VOWED2-HOST'],
  },
];

function addDaysUTC(base: Date, days: number): Date {
  return new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + days,
    base.getUTCHours(),
    base.getUTCMinutes(),
    base.getUTCSeconds(),
    base.getUTCMilliseconds(),
  ));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Same formatters as scripts/seed.ts / scripts/seed2.ts — see those files for
// why they're generated rather than hand-written.
function formatDateStamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

interface PlannedWeddingUpdate {
  weddingId: string;
  weddingRef: FirebaseFirestore.DocumentReference;
  fields: Record<string, string>;
  changes: FieldChange[];
  deltaMs: number;
}

interface PlannedCodeUpdate {
  code: string;
  codeRef: FirebaseFirestore.DocumentReference;
  dateStamp: string;
  change: FieldChange;
}

interface PlannedScheduleUpdate {
  weddingId: string;
  eventRef: FirebaseFirestore.DocumentReference;
  title: string;
  oldStartTime: Timestamp;
  newStartTime: Timestamp;
}

async function planWedding(cfg: SeedWeddingConfig): Promise<{
  weddingUpdate: PlannedWeddingUpdate | null;
  codeUpdates: PlannedCodeUpdate[];
}> {
  const weddingRef = db.doc(`weddings/${cfg.id}`);
  const snap = await weddingRef.get();
  if (!snap.exists) {
    console.log(`  ${cfg.id} — no wedding document found, skipping`);
    return { weddingUpdate: null, codeUpdates: [] };
  }
  const data = snap.data() ?? {};

  const now = new Date();
  const weddingDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + cfg.weddingOffsetDays,
    cfg.ceremonyUtcHour,
    cfg.ceremonyUtcMinute,
    0,
    0,
  ));
  const firstEventDate = addDaysUTC(weddingDate, cfg.firstEventOffsetDays);

  const newFields: Record<string, string> = {
    weddingDateISO: isoDate(weddingDate),
    weddingDateTimeUTC: weddingDate.toISOString(),
    firstEventDateISO: isoDate(firstEventDate),
    dateStamp: formatDateStamp(weddingDate),
    shortDate: formatShortDate(weddingDate),
    displayDate: formatDisplayDate(weddingDate),
  };

  const changes: FieldChange[] = Object.entries(newFields).map(([field, newValue]) => ({
    field,
    oldValue: String(data[field] ?? '(missing)'),
    newValue,
  }));

  const oldWeddingDateTimeUTC = typeof data.weddingDateTimeUTC === 'string' ? data.weddingDateTimeUTC : null;
  const oldInstantMs = oldWeddingDateTimeUTC ? new Date(oldWeddingDateTimeUTC).getTime() : NaN;
  const deltaMs = Number.isFinite(oldInstantMs) ? weddingDate.getTime() - oldInstantMs : 0;
  if (!Number.isFinite(oldInstantMs)) {
    console.log(`  ${cfg.id} — weddingDateTimeUTC missing or unparseable on the existing doc; schedule events (if any) will NOT be shifted`);
  }

  const codeUpdates: PlannedCodeUpdate[] = [];
  for (const code of cfg.codes) {
    const codeRef = db.doc(`weddingsByCode/${code}`);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) {
      console.log(`  ${cfg.id} — weddingsByCode/${code} not found, skipping`);
      continue;
    }
    const codeData = codeSnap.data() ?? {};
    // Belt-and-braces: only ever touch a code doc that actually points at
    // this exact seed wedding id.
    if (codeData.weddingId !== cfg.id) {
      console.log(`  ${cfg.id} — weddingsByCode/${code} points at ${codeData.weddingId ?? '(missing)'}, not ${cfg.id}; skipping`);
      continue;
    }
    const oldDateStamp = String(codeData.preview?.dateStamp ?? '(missing)');
    codeUpdates.push({
      code,
      codeRef,
      dateStamp: newFields.dateStamp,
      change: { field: `weddingsByCode/${code} preview.dateStamp`, oldValue: oldDateStamp, newValue: newFields.dateStamp },
    });
  }

  return {
    weddingUpdate: { weddingId: cfg.id, weddingRef, fields: newFields, changes, deltaMs },
    codeUpdates,
  };
}

// Only seed-wedding-001 has schedule events (seed2.ts never creates any).
async function planSchedule(weddingId: string, deltaMs: number): Promise<PlannedScheduleUpdate[]> {
  if (!deltaMs) return [];
  const snap = await db.collection(`weddings/${weddingId}/schedule`).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    const oldStartTime: Timestamp = data.startTime;
    const newStartTime = Timestamp.fromMillis(oldStartTime.toMillis() + deltaMs);
    return {
      weddingId,
      eventRef: doc.ref,
      title: String(data.title ?? doc.id),
      oldStartTime,
      newStartTime,
    };
  });
}

function printChange(c: FieldChange) {
  console.log(`    ${c.field}`);
  console.log(`      old: ${c.oldValue}`);
  console.log(`      new: ${c.newValue}`);
}

async function run() {
  console.log(`Mode: ${APPLY ? 'WRITE (applying changes)' : 'report only — re-run with --write to apply'}\n`);

  const weddingUpdates: PlannedWeddingUpdate[] = [];
  const codeUpdates: PlannedCodeUpdate[] = [];
  const scheduleUpdates: PlannedScheduleUpdate[] = [];

  for (const cfg of SEED_WEDDINGS) {
    console.log(`=== ${cfg.id} ===`);
    const { weddingUpdate, codeUpdates: codes } = await planWedding(cfg);
    if (!weddingUpdate) {
      console.log('');
      continue;
    }
    weddingUpdates.push(weddingUpdate);
    codeUpdates.push(...codes);

    console.log(`  weddings/${cfg.id}`);
    weddingUpdate.changes.forEach(printChange);

    codes.forEach((c) => printChange(c.change));

    const schedule = await planSchedule(cfg.id, weddingUpdate.deltaMs);
    scheduleUpdates.push(...schedule);
    if (schedule.length) {
      console.log(`  weddings/${cfg.id}/schedule (${schedule.length} event(s), shifted by ${Math.round(weddingUpdate.deltaMs / 3600000)}h)`);
      for (const s of schedule) {
        console.log(`    ${s.title}`);
        console.log(`      old: ${s.oldStartTime.toDate().toISOString()}`);
        console.log(`      new: ${s.newStartTime.toDate().toISOString()}`);
      }
    }
    console.log('');
  }

  console.log(
    `Summary: ${weddingUpdates.length} wedding doc(s), ${codeUpdates.length} weddingsByCode doc(s), ` +
    `${scheduleUpdates.length} schedule event(s) ${APPLY ? 'updated' : 'would be updated'}.`
  );

  if (!APPLY) {
    console.log('\nreport only — re-run with --write to apply');
    return;
  }

  for (const w of weddingUpdates) {
    await w.weddingRef.set(w.fields, { merge: true });
  }
  for (const c of codeUpdates) {
    await c.codeRef.set({ preview: { dateStamp: c.dateStamp } }, { merge: true });
  }
  for (const s of scheduleUpdates) {
    await s.eventRef.set({ startTime: s.newStartTime }, { merge: true });
  }
  console.log('\ndone');
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
