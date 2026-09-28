// Runs every regression suite in scripts/ and prints one summary table.
//
// Suites are DISCOVERED from disk (scripts/regression-*.ts, excluding this
// file) rather than hardcoded, so a suite added later — regression-members-
// roles.ts, regression-schedule.ts, whatever comes next — is picked up
// automatically. Whether a suite needs Firebase credentials is also detected
// from its source (a static `from 'firebase-admin'` import) rather than by
// name, for the same reason.
//
// Default run is credential-free only. `--live` also runs the suites that
// import firebase-admin, and only if serviceAccountKey.json is present —
// otherwise each is skipped with a printed reason, never silently dropped.
// `--write` is never forwarded unless passed explicitly here; it only means
// anything to a suite that itself accepts --write (currently
// regression-rules-live.ts, whose --write canary uploads and deletes one
// object). Both flags are forwarded verbatim to every suite that actually
// runs, so a suite is free to check for either of them itself even if it
// isn't purely live/pure — see regression-wedding-config.ts, which stays
// credential-free by default but has an opt-in live section gated on --live.
//
// Every discovered suite runs — a failure does not stop the sweep. The exit
// code is non-zero only if a suite that ACTUALLY RAN failed; skipped suites
// never affect it.
//
//   npx tsx scripts/regression-all.ts                 # credential-free suites only
//   npx tsx scripts/regression-all.ts --live          # also run suites needing serviceAccountKey.json
//   npx tsx scripts/regression-all.ts --live --write   # also run their --write canaries

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');
const SELF = path.basename(__filename);

const argv = process.argv.slice(2);
const RUN_LIVE = argv.includes('--live');
const RUN_WRITE = argv.includes('--write');

// Matches a static ES import of the Admin SDK — e.g. `import * as admin from
// 'firebase-admin';`. Deliberately does NOT match a runtime `require(...)`
// call, so a suite can lazily require firebase-admin inside an `if (--live)`
// branch and still be treated as credential-free by default. That is exactly
// how regression-wedding-config.ts stays runnable with no credentials while
// still offering an opt-in live section.
const ADMIN_IMPORT_RE = /from\s+['"]firebase-admin['"]/;

function needsCredentials(file: string): boolean {
  const raw = fs.readFileSync(path.join(SCRIPTS_DIR, file), 'utf8');
  // Strip comments before matching — a suite that merely TALKS about the
  // Admin SDK import (this file does, and so does regression-wedding-
  // config.ts, which explains its own lazy require() in a comment) must not
  // be misclassified as needing credentials because of prose, not code. Same
  // approach as regression-back-navigation.ts's comment-stripping, and for
  // the same reason: a comment can legitimately contain the literal text a
  // structural check is looking for.
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  return ADMIN_IMPORT_RE.test(src);
}

interface SuiteResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  durationMs: number;
  note?: string;
}

function discoverSuites(): string[] {
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => /^regression-.*\.ts$/.test(f) && f !== SELF)
    .sort();
}

function runSuite(file: string): SuiteResult {
  const args = ['tsx', path.join('scripts', file)];
  if (RUN_LIVE) args.push('--live');
  if (RUN_WRITE) args.push('--write');

  const start = Date.now();
  const res = spawnSync('npx', args, { stdio: 'inherit', cwd: process.cwd() });
  const durationMs = Date.now() - start;
  const status: SuiteResult['status'] = res.status === 0 ? 'PASS' : 'FAIL';
  return { name: file, status, durationMs };
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function printTable(results: SuiteResult[]) {
  const nameWidth = Math.max(5, ...results.map((r) => r.name.length));
  const statusWidth = 4;
  const header = `${'SUITE'.padEnd(nameWidth)}  ${'PASS/FAIL'.padEnd(statusWidth)}  DURATION  NOTE`;
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const r of results) {
    const status = r.status.padEnd(statusWidth);
    const duration = r.status === 'SKIP' ? '-'.padEnd(8) : formatMs(r.durationMs).padEnd(8);
    console.log(`${r.name.padEnd(nameWidth)}  ${status}  ${duration}  ${r.note ?? ''}`);
  }
}

function main() {
  const suites = discoverSuites();
  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const hasKey = fs.existsSync(keyPath);

  console.log(`Discovered ${suites.length} suite(s): ${suites.join(', ')}`);
  console.log(`Mode: ${RUN_LIVE ? 'live (credentialed suites included)' : 'default (credential-free only)'}${RUN_WRITE ? ', --write forwarded' : ''}`);
  if (RUN_LIVE && !hasKey) {
    console.log(`Note: --live was passed but serviceAccountKey.json was not found in ${process.cwd()} — every credentialed suite below will be skipped.`);
  }

  const results: SuiteResult[] = [];

  for (const file of suites) {
    const credNeeded = needsCredentials(file);

    if (credNeeded && !RUN_LIVE) {
      console.log(`\n=== ${file} ===`);
      console.log('  SKIPPED — imports firebase-admin; pass --live to run it');
      results.push({ name: file, status: 'SKIP', durationMs: 0, note: 'needs credentials — rerun with --live' });
      continue;
    }

    if (credNeeded && RUN_LIVE && !hasKey) {
      console.log(`\n=== ${file} ===`);
      console.log(`  SKIPPED — serviceAccountKey.json not found in ${process.cwd()}`);
      results.push({ name: file, status: 'SKIP', durationMs: 0, note: 'serviceAccountKey.json not found' });
      continue;
    }

    console.log(`\n=== ${file} ===`);
    results.push(runSuite(file));
  }

  console.log('\n\nSUMMARY');
  printTable(results);

  const ran = results.filter((r) => r.status !== 'SKIP');
  const failed = results.filter((r) => r.status === 'FAIL');
  const skipped = results.filter((r) => r.status === 'SKIP');

  console.log(`\n${ran.length} suite(s) ran, ${failed.length} failed, ${skipped.length} skipped.`);
  if (skipped.length > 0) {
    console.log('Skipped:');
    for (const s of skipped) console.log(`  - ${s.name}: ${s.note}`);
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main();
