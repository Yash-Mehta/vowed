import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Must match the expo-splash-screen plugin backgroundColor in app.json so the
// native → JS handoff is invisible
const NATIVE_SPLASH_BG = '#FAF6F1';

// Must match the plugin's ios.imageWidth (asset is 780x480 → 260x160pt)
const LOCKUP_WIDTH = 260;
const LOCKUP_HEIGHT = 160;

// Even when auth restores instantly, keep the lockup up long enough to read as
// an intentional beat rather than a flash
const MIN_HOLD_MS = 900;

interface Props {
  // App is ready behind the overlay (fonts + auth restore done)
  ready: boolean;
  onDone: () => void;
}

// iOS renders the lockup image on the native splash, so the overlay opens on a
// pixel-identical frame with the lockup already visible. Android 12+ draws its
// own masked adaptive icon on the system splash (a wide lockup would be
// circle-cropped), so there the overlay opens on the plain cream field and the
// lockup fades in as the first beat.
const LOCKUP_VISIBLE_AT_MOUNT = Platform.OS === 'ios';

export function AnimatedSplash({ ready, onDone }: Props) {
  const lockup = useRef(new Animated.Value(LOCKUP_VISIBLE_AT_MOUNT ? 1 : 0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  const [heldLongEnough, setHeldLongEnough] = useState(false);
  const [lockupShown, setLockupShown] = useState(LOCKUP_VISIBLE_AT_MOUNT);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  // Hide the native splash only after this overlay has mounted on the
  // identical cream frame, then bring in the lockup where the system splash
  // couldn't show it (Android)
  useEffect(() => {
    if (reduceMotion === null) return;
    SplashScreen.hideAsync();

    if (lockupShown) return;
    if (reduceMotion) {
      lockup.setValue(1);
      setLockupShown(true);
      return;
    }
    Animated.timing(lockup, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setLockupShown(true));
  }, [reduceMotion]);

  useEffect(() => {
    const t = setTimeout(() => setHeldLongEnough(true), MIN_HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  // Lift the curtain once the lockup has had its moment AND the app is ready
  useEffect(() => {
    if (!lockupShown || !heldLongEnough || !ready) return;
    Animated.parallel([
      Animated.timing(exit, {
        toValue: 0,
        duration: reduceMotion ? 300 : 550,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exitScale, {
        toValue: reduceMotion ? 1 : 1.035,
        duration: 550,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(onDone);
  }, [lockupShown, heldLongEnough, ready]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { opacity: exit, transform: [{ scale: exitScale }] },
      ]}>
      <Animated.Image
        source={require('../assets/splash-lockup.png')}
        style={[styles.lockup, { opacity: lockup }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    backgroundColor: NATIVE_SPLASH_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockup: {
    width: LOCKUP_WIDTH,
    height: LOCKUP_HEIGHT,
  },
});
