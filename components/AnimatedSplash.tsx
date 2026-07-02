import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Sprig } from './Sprig';
import { theme } from '../constants/theme';

// Must match app.json splash.backgroundColor so the native → JS handoff is invisible
const NATIVE_SPLASH_BG = '#5C1A1A';

interface Props {
  // App is ready behind the overlay (fonts + auth restore done)
  ready: boolean;
  onDone: () => void;
}

// Android 12+ renders its own adaptive icon in a circular mask on the system
// splash, so a square splash-icon in the overlay would visibly swap at handoff.
// There the overlay opens on the plain wine field instead; the system icon's
// disappearance reads as the first beat of the animation. iOS matches exactly.
const SHOW_ICON = Platform.OS === 'ios';

export function AnimatedSplash({ ready, onDone }: Props) {
  const icon = useRef(new Animated.Value(SHOW_ICON ? 1 : 0)).current;
  const cream = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const wordmarkRise = useRef(new Animated.Value(16)).current;
  const sprigs = useRef(new Animated.Value(0)).current;
  const sprigDrift = useRef(new Animated.Value(6)).current;
  const rule = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  const [sequenceDone, setSequenceDone] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  // Start once we know the motion preference; hide the native splash only after
  // this overlay has mounted (it opens on the identical wine field + logo)
  useEffect(() => {
    if (reduceMotion === null) return;
    SplashScreen.hideAsync();

    if (reduceMotion) {
      // Calm path: single crossfade to the composed lockup, no movement
      icon.setValue(0);
      cream.setValue(1);
      wordmarkRise.setValue(0);
      sprigDrift.setValue(0);
      Animated.parallel([
        Animated.timing(wordmark, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(sprigs, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(rule, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(tagline, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start(() => setSequenceDone(true));
      return;
    }

    const easeOut = Easing.out(Easing.cubic);
    Animated.stagger(0, [
      Animated.parallel([
        Animated.timing(icon, { toValue: 0, duration: 300, delay: 120, useNativeDriver: true }),
        Animated.timing(cream, {
          toValue: 1,
          duration: 550,
          delay: 120,
          easing: easeOut,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wordmark, {
          toValue: 1,
          duration: 700,
          delay: 350,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkRise, {
          toValue: 0,
          duration: 700,
          delay: 350,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(sprigs, {
          toValue: 1,
          duration: 650,
          delay: 480,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(sprigDrift, {
          toValue: 0,
          duration: 650,
          delay: 480,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(rule, {
          toValue: 1,
          duration: 600,
          delay: 700,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(tagline, {
          toValue: 1,
          duration: 550,
          delay: 850,
          easing: easeOut,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => setSequenceDone(true));
  }, [reduceMotion]);

  // Lift the curtain once the intro has composed AND the app is ready behind it
  useEffect(() => {
    if (!sequenceDone || !ready) return;
    const hold = setTimeout(() => {
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
    }, 250);
    return () => clearTimeout(hold);
  }, [sequenceDone, ready]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { opacity: exit, transform: [{ scale: exitScale }] },
      ]}>
      {/* Wine base — identical to the native splash — with cream washing over it */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: NATIVE_SPLASH_BG }]} />
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg, opacity: cream }]}
      />

      {SHOW_ICON && (
        <Animated.Image
          source={require('../assets/splash-icon.png')}
          style={[styles.icon, { opacity: icon }]}
          resizeMode="contain"
        />
      )}

      <View style={styles.lockup}>
        <View style={styles.sprigRow}>
          <Animated.View
            style={{ opacity: sprigs, transform: [{ translateX: Animated.multiply(sprigDrift, -1) }] }}>
            <Sprig size={44} color={theme.colors.accentSoft} flip />
          </Animated.View>
          <Animated.View style={{ opacity: sprigs, transform: [{ translateX: sprigDrift }] }}>
            <Sprig size={44} color={theme.colors.accentSoft} />
          </Animated.View>
        </View>

        <Animated.Text
          style={[styles.wordmark, { opacity: wordmark, transform: [{ translateY: wordmarkRise }] }]}>
          Vowed
        </Animated.Text>

        <Animated.View style={[styles.rule, { opacity: rule, transform: [{ scaleX: rule }] }]} />

        <Animated.Text style={[styles.tagline, { opacity: tagline }]}>
          the story is just beginning
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    position: 'absolute',
    width: 160,
    height: 160,
  },
  lockup: { alignItems: 'center' },
  sprigRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 6,
  },
  wordmark: {
    fontSize: 56,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    letterSpacing: 1,
    lineHeight: 66,
  },
  rule: {
    width: 84,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: theme.colors.accentSoft,
    marginTop: 10,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 15,
    fontFamily: theme.fonts.serifItalic,
    color: theme.colors.ink3,
    letterSpacing: 0.4,
  },
});
