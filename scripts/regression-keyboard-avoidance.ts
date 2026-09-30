// Keyboard avoidance: geometry model + source invariants.
//
// v1.6.2 replaced a hand-rolled JS keyboard measurement with
// react-native-keyboard-controller. The Android half worked; the iOS half
// regressed, and the reason is pure geometry rather than anything platform-
// specific, so it is checkable here with no device.
//
// react-native-keyboard-controller's <KeyboardAvoidingView> derives the
// padding it applies (src/components/KeyboardAvoidingView/index.tsx):
//
//     keyboardY = screenHeight - keyboardHeight - keyboardVerticalOffset
//     padding   = max(frame.y + frame.height - keyboardY, 0)
//
// `screenHeight` is Dimensions.get('screen').height — the whole device screen
// (src/hooks/useWindowDimensions/index.ts). `frame` is the view's own onLayout
// rect, which RN reports RELATIVE TO ITS PARENT. Those two are only in the same
// coordinate space when the view is a full-screen root. Everywhere else the
// formula silently under-pads by however far the view's parent is inset from
// the top of the screen — which is exactly the failure users reported on iOS,
// where <Modal presentationStyle="pageSheet"> is inset from the top and the
// same Modal on Android is a full-screen Dialog.
//
// So the rule this suite enforces: <KeyboardAvoidingView> is allowed ONLY where
// it is the screen's full-screen root. Anything inset — a pageSheet, or a view
// nested under ScreenWrapper's SafeAreaView — must pad by the real keyboard
// height instead (useReanimatedKeyboardAnimation), or use
// <KeyboardAwareScrollView>, which works off the focused input's native
// ABSOLUTE screen coordinates (layout.absoluteY) and so is nesting-independent.
//
//   npx tsx scripts/regression-keyboard-avoidance.ts
//
// Needs no credentials and no device.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'app');
const COMPONENTS = path.join(ROOT, 'components');

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// Comments in these files quote the very constructs the source checks search
// for, because they explain what not to reintroduce. Strip them first, exactly
// as regression-back-navigation.ts does.
function stripComments(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

function read(file: string): string {
  return stripComments(fs.readFileSync(file, 'utf8'));
}

// ---------------------------------------------------------------------------
// Part 1 — the geometry, ported verbatim from the library.
// ---------------------------------------------------------------------------

interface Frame {
  y: number;
  height: number;
}

/** Exact port of KeyboardAvoidingView's relativeKeyboardHeight(). */
function libraryPadding(
  frame: Frame,
  screenHeight: number,
  keyboardHeight: number,
  keyboardVerticalOffset = 0
): number {
  const keyboardY = screenHeight - keyboardHeight - keyboardVerticalOffset;
  return Math.max(frame.y + frame.height - keyboardY, 0);
}

/**
 * What the padding actually has to be for the container's bottom edge to clear
 * the keyboard, computed in absolute screen coordinates. `containerTop` is
 * where the container's PARENT begins on screen — the term the library's
 * formula has no way to know.
 */
function requiredPadding(
  frame: Frame,
  containerTop: number,
  screenHeight: number,
  keyboardHeight: number
): number {
  const containerBottomAbsolute = containerTop + frame.y + frame.height;
  const gapBelowContainer = screenHeight - containerBottomAbsolute;
  return Math.max(keyboardHeight - gapBelowContainer, 0);
}

console.log('geometry — <KeyboardAvoidingView> is correct only as a full-screen root:');

const SCREEN = 852; // iPhone 15 Pro portrait, points
const KB = 336; // keyboard incl. predictive bar

{
  // The safe case: the view IS the screen. phone.tsx and invite.tsx are shaped
  // this way, which is why they were never part of the bug report.
  const frame: Frame = { y: 0, height: SCREEN };
  const got = libraryPadding(frame, SCREEN, KB);
  const want = requiredPadding(frame, 0, SCREEN, KB);
  check(
    'full-screen root: library padding equals the keyboard height',
    got === KB && got === want,
    `got ${got}, required ${want}`
  );
}

{
  // The reported iOS bug. A pageSheet is inset from the top, so frame.height is
  // short by that inset while screenHeight is not. Asserted across a range of
  // insets rather than one magic number, because the exact pageSheet inset is
  // device- and iOS-version-dependent; the shortfall tracks it either way.
  const insets = [10, 24, 40, 59, 60, 96];
  const shortfalls = insets.map((topInset) => {
    const frame: Frame = { y: 0, height: SCREEN - topInset };
    const got = libraryPadding(frame, SCREEN, KB);
    const want = requiredPadding(frame, topInset, SCREEN, KB);
    return { topInset, got, want, shortfall: want - got };
  });

  check(
    'pageSheet: library padding falls short by exactly the sheet top inset',
    shortfalls.every((s) => s.shortfall === s.topInset),
    shortfalls.map((s) => `${s.topInset}→short ${s.shortfall}`).join(', ')
  );
  check(
    'pageSheet: required padding is the full keyboard height (sheet bottom is flush with the screen bottom)',
    shortfalls.every((s) => s.want === KB),
    `required ${shortfalls[0].want}, keyboard ${KB}`
  );
  check(
    'pageSheet: the shortfall leaves the composer under the keyboard, i.e. it is never benign',
    shortfalls.every((s) => s.got < s.want && s.shortfall > 0)
  );
}

{
  // An Android <Modal> ignores presentationStyle and is a full-screen Dialog,
  // so the same component came out correct there. This is why the bug looked
  // platform-specific when it is really container-shape-specific.
  const frame: Frame = { y: 0, height: SCREEN };
  const got = libraryPadding(frame, SCREEN, KB);
  check('android full-screen Dialog: same component, no shortfall', got === KB, `got ${got}`);
}

{
  // A view nested under ScreenWrapper's SafeAreaView, below a header, inside a
  // bottom-tab screen. Under-pads on BOTH platforms.
  const insetTop = 59;
  const insetBottom = 34;
  const tabBar = 49;
  const header = 120;
  const contentHeight = SCREEN - insetTop - insetBottom - tabBar;
  const frame: Frame = { y: header, height: contentHeight - header };
  const got = libraryPadding(frame, SCREEN, KB);
  const want = requiredPadding(frame, insetTop, SCREEN, KB);
  check(
    'nested under SafeAreaView + tab bar: library padding under-pads on both platforms',
    got < want,
    `got ${got}, required ${want}`
  );
  check(
    'nested case: padding by the raw keyboard height would instead OVER-pad',
    KB > want,
    `keyboard ${KB}, required ${want} (gap below container ${insetBottom + tabBar})`
  );
}

// ---------------------------------------------------------------------------
// Part 2 — source invariants following from the geometry above.
// ---------------------------------------------------------------------------

console.log('\nsource — every keyboard-avoiding container uses a mechanism valid for its shape:');

const commentSheet = read(path.join(COMPONENTS, 'CommentSheet.tsx'));
const countryPicker = read(path.join(COMPONENTS, 'CountryCodePicker.tsx'));

check(
  'CommentSheet is still a pageSheet Modal (the shape that makes frame-derived padding wrong)',
  /presentationStyle=["']pageSheet["']/.test(commentSheet)
);
check(
  'CommentSheet does NOT use <KeyboardAvoidingView> — its frame is inset from the screen on iOS',
  !/<KeyboardAvoidingView\b/.test(commentSheet)
);
check(
  'CommentSheet pads by the real keyboard height via useReanimatedKeyboardAnimation',
  /useReanimatedKeyboardAnimation\s*\(/.test(commentSheet)
);
check(
  'CommentSheet applies that height as paddingBottom on the UI thread (useAnimatedStyle)',
  /useAnimatedStyle\s*\(/.test(commentSheet) && /paddingBottom/.test(commentSheet)
);
check(
  'CommentSheet has not reintroduced a JS keyboard measurement (Keyboard.addListener never fires in an Android Modal)',
  !/Keyboard\.addListener|Keyboard\.metrics/.test(commentSheet)
);
check(
  'CommentSheet does not reintroduce the useWindowDimensions shrink test (it compared a value against itself)',
  !/useWindowDimensions/.test(commentSheet)
);

check(
  'CountryCodePicker uses the same keyboard-height padding as CommentSheet',
  /useReanimatedKeyboardAnimation\s*\(/.test(countryPicker)
);
check(
  'CountryCodePicker does NOT use <KeyboardAvoidingView>',
  !/<KeyboardAvoidingView\b/.test(countryPicker)
);
check(
  'CountryCodePicker has not reintroduced a JS keyboard measurement',
  !/Keyboard\.addListener|Keyboard\.metrics/.test(countryPicker)
);

// Every remaining KeyboardAvoidingView in the app must be a screen's own
// full-screen root. Enumerated explicitly so a new nested one fails loudly
// rather than shipping an under-padded screen.
const FULL_SCREEN_ROOT_KAV = ['(auth)/phone.tsx', '(auth)/invite.tsx'];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx$/.test(e.name) ? [p] : [];
  });
}

const kavFiles = [...walk(APP), ...walk(COMPONENTS)]
  .filter((p) => /<KeyboardAvoidingView\b/.test(read(p)))
  .map((p) => path.relative(APP, p).replace(/\\/g, '/'))
  .sort();

check(
  'the only <KeyboardAvoidingView> usages left are the full-screen auth roots',
  JSON.stringify(kavFiles) === JSON.stringify([...FULL_SCREEN_ROOT_KAV].sort()),
  `found: ${kavFiles.length ? kavFiles.join(', ') : 'none'}`
);

for (const rel of FULL_SCREEN_ROOT_KAV) {
  const src = read(path.join(APP, rel));
  // "return (" immediately followed by the KAV is what makes it the root: no
  // SafeAreaView, no ScreenWrapper, nothing inset above it.
  check(
    `${rel}: <KeyboardAvoidingView> is the returned root, so frame === screen`,
    /return\s*\(\s*<KeyboardAvoidingView\b/.test(src)
  );
  check(
    `${rel}: is not wrapped in ScreenWrapper (which would inset it via SafeAreaView)`,
    !/<ScreenWrapper\b/.test(src)
  );
}

// manage.tsx's schedule tab previously wrapped a FlatList in a nested
// KeyboardAvoidingView. KeyboardAwareScrollView is the nesting-independent
// mechanism, so the schedule list has to use it.
const manage = read(path.join(APP, '(tabs)', 'manage.tsx'));
check(
  'manage.tsx does not nest a keyboard-avoiding container inside ScreenWrapper',
  !/<KeyboardAvoidingView\b/.test(manage)
);
check(
  'manage.tsx uses KeyboardAwareScrollView (absolute-coordinate based, nesting-independent)',
  /<KeyboardAwareScrollView\b/.test(manage)
);

// The provider has to sit above the Stack: mounted inside a screen it would
// work on plain screens and silently not inside a Modal.
const layout = read(path.join(APP, '_layout.tsx'));
check(
  '_layout.tsx mounts <KeyboardProvider>',
  /<KeyboardProvider\b/.test(layout)
);
check(
  '_layout.tsx mounts it OUTSIDE the <Stack>',
  layout.indexOf('<KeyboardProvider') < layout.indexOf('<Stack'),
  'provider must wrap the navigator, not live inside a screen'
);

// The deleted hook clamped scrollTo against a viewport that never shrinks
// under Expo 54's forced edge-to-edge, so its scroll was a no-op exactly when
// it was needed.
check(
  'the dead useKeyboardAwareScroll hook is gone',
  !fs.existsSync(path.join(ROOT, 'hooks', 'useKeyboardAwareScroll.ts'))
);

console.log(
  failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`
);
process.exit(failures === 0 ? 0 : 1);
