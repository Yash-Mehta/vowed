// Static checks on the write paths for posts, announcements and comments.
//
// These read source rather than data, on purpose. The live suite
// (regression-posts.ts) runs through the Admin SDK, which BYPASSES
// firestore.rules and storage.rules entirely — so it cannot catch a write the
// rules would refuse from a real client. That is exactly the bug that shipped:
// compose.tsx was the only uploader in the app not passing a contentType, a
// blob from a file:// URI carries no type, Firebase sent
// application/octet-stream, and storage.rules requires
// contentType.matches('image/.*'). Every photo post failed for every member,
// while announcements — which skip the upload — kept working.
//
// Nothing that talks to Firestore could have found that. These checks would
// have, on the commit that introduced it.
//
//   npx tsx scripts/regression-upload-contract.ts
//
// Needs no credentials and no device.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name === 'node_modules' || d.name.startsWith('.')) return [];
    const full = path.join(dir, d.name);
    return d.isDirectory() ? walk(full) : full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : [];
  });
}

const sources = ['app', 'components', 'lib', 'hooks']
  .map((d) => path.join(ROOT, d))
  .filter(fs.existsSync)
  .flatMap(walk);

console.log('every upload declares an image contentType:');
// storage.rules gates BOTH avatars and post media on
// contentType.matches('image/.*'). An upload without one is refused before a
// byte moves, and the failure surfaces as an unrelated-looking error.
let uploadSites = 0;
for (const file of sources) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  // uploadBytes(ref, blob, { ... }) — the third argument is the metadata.
  const calls = src.match(/uploadBytes\s*\([\s\S]{0,400}?\)\s*;/g) ?? [];
  for (const call of calls) {
    uploadSites++;
    const at = src.indexOf(call);
    const line = src.slice(0, at).split('\n').length;
    // The type may be a literal in the call, or a variable computed just
    // above it, so the preceding lines count as part of the declaration.
    const context = src.slice(Math.max(0, at - 700), at + call.length);
    check(
      `${rel}:${line} passes a contentType`,
      /contentType/.test(call),
      'storage.rules refuses an upload without one'
    );
    check(
      `${rel}:${line} constrains it to an image type`,
      /['\`]image\//.test(context),
      "the rule is contentType.matches('image/.*')"
    );
  }
}
check('at least one upload site was found to check', uploadSites > 0, `${uploadSites} found`);

console.log('\nno undefined can reach a Firestore write:');
// Firestore rejects an undefined field value outright and fails the WHOLE
// write. A member document predating a field is enough to produce one, so
// every value read off a document needs a fallback at the write site.
const compose = fs.readFileSync(path.join(ROOT, 'app/compose.tsx'), 'utf8');
const payload = compose.slice(compose.indexOf('addDoc('), compose.indexOf('});', compose.indexOf('addDoc(')));
for (const field of ['authorName', 'authorPhotoURL', 'photoAspectRatio']) {
  const row = payload.split('\n').find((l) => l.trim().startsWith(field + ':')) ?? '';
  check(
    `compose writes ${field} with a fallback`,
    /\?\?/.test(row) || /null,?$/.test(row.trim()),
    row.trim() || 'field not found in the addDoc payload'
  );
}

console.log('\nfailures are reported, not swallowed:');
// The original catch took no argument and printed one sentence for every
// possible cause, which is why a refused upload looked like a refused write.
check(
  'the compose catch binds the error',
  /catch\s*\(\s*e/.test(compose),
  'a bare `catch {` discards the only evidence of what went wrong'
);
check(
  'the compose catch surfaces a code or message',
  /\bcode\b/.test(compose) && /console\.(warn|error)/.test(compose)
);
check(
  'upload and save failures are distinguishable',
  /stage/.test(compose),
  'they need different fixes, so they cannot share one message'
);
// goBack() inside the try meant a navigation error was reported as a failed
// post — on a post that had already been written. The obvious response to
// that message is to post again.
const tryBlock = compose.slice(compose.indexOf('try {'), compose.indexOf('} catch'));
check(
  'navigation does not sit inside the posting try block',
  !/goBack\(\)/.test(tryBlock),
  'otherwise a nav error reports a successful post as failed, inviting a duplicate'
);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
