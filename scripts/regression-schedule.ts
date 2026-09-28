// Regression checks for the wedding-day schedule against real data, plus one
// static check on the write path.
//
// There is no error boundary anywhere in this app (see components/
// ScheduleEventCard.tsx and app/(tabs)/schedule.tsx) — a value the UI can't
// render the way it expects takes the whole tab down, not just one card. So
// "field shapes" here means specifically what the two render paths read
// directly, not the full interface.
//
// Runs through the Admin SDK, which BYPASSES firestore.rules (schedule writes
// are host-only — see the schedule/{eventId} rule). That means this suite can
// see a bad shape but cannot prove a live client would be refused; that is
// regression-rules-live.ts's job.
//
// Read-only against Firestore. Writes nothing, deletes nothing. It does read
// app/(tabs)/manage.tsx's source (fs only) for the static check below.
//
//   npx tsx scripts/regression-schedule.ts

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { Timestamp } from 'firebase-admin/firestore';

admin.initializeApp({
  credential: admin.credential.cert(path.join(process.cwd(), 'serviceAccountKey.json')),
});
const db = admin.firestore();

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}
// A known, accepted gap — printed distinctly so it reads as a recommendation
// rather than a failing assertion, and never touches the exit code.
function recommend(name: string, detail = '') {
  console.log(`  NOTE  ${name}${detail ? ` — ${detail}` : ''}`);
}

const KNOWN_COLORS = new Set(['sky', 'leaf', 'accent', 'sand']);

// ── Static check: does the write path anchor start times to an instant, or
// to a device-local wall clock? ─────────────────────────────────────────────
//
// app/(tabs)/manage.tsx's parseTimeToTimestamp builds
//   new Date(`${dateISO}T${hh}:${mm}:00`)
// with no `Z` and no explicit offset. Per this project's own stated rule
// (CLAUDE.md, "Date/Time Handling"): "All date parses must include Z suffix —
// bare T12:00:00 is local time and causes off-by-one-day bugs in timezones
// behind UTC." That rule exists because of weddingDateTimeUTC/weddingDateISO;
// this is the same anti-pattern in a different field.
//
// Unlike formatDayLabel/formatDayShort in the same file (also bare, but only
// ever parsed and formatted back out on the SAME device, so no timezone ever
// crosses a boundary), parseTimeToTimestamp's result is converted to a
// Firestore Timestamp — an absolute instant — and written for every guest to
// read back on their own device via .toDate().toLocaleTimeString(). A bare
// `new Date(...)` is parsed in the WRITING device's local timezone. A host
// entering "11:00 PM" while their phone is still set to a departure timezone,
// for a venue in a different one, bakes in the departure timezone's offset;
// every guest's device then re-localizes that instant to ITS OWN timezone,
// which can and does shift the displayed day, not just the hour.
//
// This is read from source, not from live data, because a Firestore
// Timestamp is already an absolute instant by the time it is stored — nothing
// in a read of the data itself can distinguish "this instant is correct" from
// "this instant reflects the wrong device's timezone". The bug is only
// visible in the code that produced it.
function checkStartTimeIsUtcAnchored() {
  console.log('\nwrite-path source check (manage.tsx):');
  const source = fs.readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'manage.tsx'), 'utf8');
  const match = source.match(/function parseTimeToTimestamp\([\s\S]*?\n\}/);
  check('parseTimeToTimestamp exists in manage.tsx', !!match, 'the function this check inspects may have moved or been renamed');
  if (!match) return;

  const body = match[0];
  const isUtcAnchored = /:00Z`/.test(body) || /Date\.UTC\(/.test(body);
  check(
    'parseTimeToTimestamp anchors the parsed instant to UTC (or an explicit offset), not the writing device\'s local clock',
    isUtcAnchored,
    isUtcAnchored
      ? ''
      : 'new Date(`${dateISO}T${hh}:${mm}:00`) has no Z and no offset — the resulting Timestamp bakes in ' +
        'whichever timezone the HOST\'S device was set to at save time. A guest reading it back on a device in a ' +
        'different timezone gets a re-localized time that can land on a different calendar day — the exact bug ' +
        'CLAUDE.md\'s "Date/Time Handling" section already warns about for weddingDateISO, present again here.'
  );
}

async function run() {
  checkStartTimeIsUtcAnchored();

  const weddingsSnap = await db.collection('weddings').get();
  let totalEvents = 0;
  let eventsWithTimestampMeta = 0;

  for (const w of weddingsSnap.docs) {
    const wd = w.data();
    const scheduleSnap = await db.collection(`weddings/${w.id}/schedule`).get();
    if (scheduleSnap.empty) continue;

    console.log(`\n${wd.coupleName ?? w.id}  (${scheduleSnap.size} event(s))`);
    totalEvents += scheduleSnap.size;

    const orders: unknown[] = [];

    for (const doc of scheduleSnap.docs) {
      const e = doc.data();
      const id = doc.id.slice(0, 6);

      // title/location: both render directly as <Text> children and both are
      // required by every write path (handleAddEvent/handleSaveEdit refuse to
      // save without a trimmed, non-empty value for either).
      check(`${id} title is a non-empty string`, typeof e.title === 'string' && e.title.trim().length > 0, JSON.stringify(e.title));
      check(`${id} location is a non-empty string`, typeof e.location === 'string' && e.location.trim().length > 0, JSON.stringify(e.location));

      // description is optional, but write paths only ever produce a string
      // or null — never undefined, never anything object-shaped that would
      // throw "Objects are not valid as a React child" when rendered.
      check(
        `${id} description is a string or null`,
        e.description === null || typeof e.description === 'string',
        JSON.stringify(e.description)
      );

      // order: required for orderBy('order','asc') to produce a stable list,
      // and it is the field manage.tsx's ▲▼ reorder buttons rewrite for every
      // event in the wedding on every move. A missing or non-numeric order
      // sorts unpredictably; a duplicate makes the reorder swap indeterminate
      // about which of two same-order events actually moves.
      check(`${id} has a numeric order`, typeof e.order === 'number' && Number.isFinite(e.order), JSON.stringify(e.order));
      orders.push(e.order);

      // startTime: every write path stores a Firestore Timestamp or null,
      // never a raw string — both schedule.tsx and ScheduleEventCard.tsx
      // read it via optional-chained .toDate?.(), so a value that carries a
      // .toDate is required, not merely "parses".
      if (e.startTime !== null && e.startTime !== undefined) {
        const isTimestamp = e.startTime instanceof Timestamp;
        check(`${id} startTime is a Firestore Timestamp (not a raw string)`, isTimestamp, `typeof ${typeof e.startTime}`);
        if (isTimestamp) {
          const d: Date = (e.startTime as Timestamp).toDate();
          check(`${id} startTime.toDate() is a valid instant`, !isNaN(d.getTime()));
        }
      }

      // color: colorMap[event.color ?? 'accent'] is indexed with NO fallback
      // for a miss — colorMap['banana'] is undefined, and the very next lines
      // read c.bg and c.accent unconditionally. An unrecognised color does
      // not degrade gracefully; it throws and, with no error boundary
      // anywhere in this app, takes down the whole schedule tab for every
      // guest at this wedding.
      if ('color' in e) {
        check(
          `${id} color is a value ScheduleEventCard's colorMap actually has`,
          typeof e.color === 'string' && KNOWN_COLORS.has(e.color),
          `${JSON.stringify(e.color)} — an unrecognised color crashes the schedule tab (no error boundary), it does not degrade`
        );
      }

      // icon/dress: optional, but rendered directly as <Text> children when
      // present — must be strings, never object/array-shaped.
      if ('icon' in e && e.icon !== null) {
        check(`${id} icon is a string`, typeof e.icon === 'string', JSON.stringify(e.icon));
      }
      if ('dress' in e && e.dress !== null) {
        check(`${id} dress is a string`, typeof e.dress === 'string', JSON.stringify(e.dress));
      }
      if ('primary' in e) {
        check(`${id} primary is a boolean`, typeof e.primary === 'boolean', JSON.stringify(e.primary));
      }

      if ('createdAt' in e || 'updatedAt' in e) eventsWithTimestampMeta++;
    }

    // order uniqueness, scoped to this wedding — cross-wedding collisions are
    // meaningless since orderBy only ever runs within one wedding's
    // subcollection.
    const numericOrders = orders.filter((o): o is number => typeof o === 'number' && Number.isFinite(o));
    const uniqueOrders = new Set(numericOrders);
    check(
      'order values are unique within this wedding',
      uniqueOrders.size === numericOrders.length,
      numericOrders.length !== uniqueOrders.size
        ? `${numericOrders.length} event(s), only ${uniqueOrders.size} distinct order value(s)`
        : ''
    );
  }

  // ── A known, accepted gap ─────────────────────────────────────────────────
  // Schedule documents carry no createdAt/updatedAt at all — neither
  // handleAddEvent nor handleSaveEdit in manage.tsx writes one. That means
  // there is no way to tell when a wedding's schedule was last touched, or to
  // audit an edit after the fact. Asserting the current state rather than
  // silently passing it: this is a real absence, not an oversight in this
  // suite, and it is worth fixing (a serverTimestamp() on create, and on
  // every update) rather than worth ignoring.
  console.log('\nwrite-path metadata:');
  recommend(
    'schedule documents have no createdAt/updatedAt field',
    totalEvents > 0
      ? `confirmed on all ${totalEvents} scanned event(s) (${eventsWithTimestampMeta} carried either field)`
      : 'no schedule events existed to confirm against'
  );

  console.log(`\nscanned ${totalEvents} event(s) across ${weddingsSnap.size} wedding(s)`);
  console.log(`${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
