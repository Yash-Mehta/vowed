import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

// This screen is what AnimatedSplash's curtain lifts onto, so it opens on the
// same cream the native splash and the sign-in screen use. The lockup dissolves
// straight into the wordmark instead of cutting to a different field.
const SPLASH_BG = theme.colors.bg;

// AnimatedSplash holds for 900ms then fades out over 550ms. Starting the stage
// partway through that fade means the page has already settled by the time the
// curtain is gone — one continuous movement rather than two sequential ones.
const ENTRANCE_DELAY_MS = 260;
const ENTRANCE_STAGGER_MS = 90;

// AnimatedSplash centres its lockup on the screen, so the wordmark has to sit
// there too or the cross-fade reads as a swap rather than a dissolve. The
// masthead is therefore centred on the full screen, not in the space above the
// buttons — and nudged down by half the rule+tagline block so it is the
// WORDMARK, not the group, that lands on the lockup's centre. Derived from the
// style values below so it stays correct if the spacing tokens change.
const RULE_BLOCK_HEIGHT = theme.space.l * 2 + 0.5;
const TAGLINE_LINE_HEIGHT = 26;
const WORDMARK_CENTRING_OFFSET = (RULE_BLOCK_HEIGHT + TAGLINE_LINE_HEIGHT) / 2;

// Opacity + transform only, so the whole sequence stays on the compositor.
function useEntrance(steps: number) {
  const progress = useRef(
    Array.from({ length: steps }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    let cancelled = false;

    const settle = () => progress.forEach((v) => v.setValue(1));

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        settle();
        return;
      }
      Animated.stagger(
        ENTRANCE_STAGGER_MS,
        progress.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            delay: ENTRANCE_DELAY_MS,
            duration: theme.motion.slow,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ).start();
    }).catch(() => {
      // A rejection here used to leave the rule, tagline and both buttons at
      // opacity 0 forever — the screen would render with no way forward.
      // AnimatedSplash guards the same call the same way.
      if (!cancelled) settle();
    });

    return () => {
      cancelled = true;
    };
  }, [progress]);

  return (index: number, rise = 12) => ({
    opacity: progress[index],
    transform: [
      {
        translateY: progress[index].interpolate({
          inputRange: [0, 1],
          outputRange: [rise, 0],
        }),
      },
    ],
  });
}

interface ActionProps {
  label: string;
  onPress: () => void;
  variant: 'solid' | 'ghost';
}

function Action({ label, onPress, variant }: ActionProps) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        solid ? styles.actionSolid : styles.actionGhost,
        pressed && styles.actionPressed,
      ]}>
      <Text style={[styles.actionLabel, solid ? styles.actionLabelSolid : styles.actionLabelGhost]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function IndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [linkPressed, setLinkPressed] = useState(false);
  const step = useEntrance(4);

  return (
    <View style={styles.container}>
      {/* Cream at the top is identical to the splash field; the warmth only
          gathers toward the bottom, so the handoff frame stays seamless. */}
      <LinearGradient
        colors={[SPLASH_BG, SPLASH_BG, theme.colors.surface2]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Centred on the screen, matching the splash lockup. pointerEvents none
          so it never intercepts taps meant for the buttons underneath. */}
      <View style={styles.mastheadLayer} pointerEvents="none">
        <View style={styles.masthead}>
          {/* Deliberately not animated: the splash lockup fades out over this
              exact spot, so the wordmark is already in place underneath it. */}
          <Text style={styles.wordmark} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
            Vowed Social
          </Text>

          <Animated.View style={[styles.rule, step(0)]} />

          <Animated.Text style={[styles.tagline, step(1)]} maxFontSizeMultiplier={1.3}>
            The story is just beginning
          </Animated.Text>
        </View>
      </View>

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + theme.space.section, paddingBottom: insets.bottom + theme.space.xxl },
        ]}>
        <View style={styles.spacer} />

        <Animated.View style={[styles.actions, step(2, 16)]}>
          <Action label="Sign in" variant="solid" onPress={() => router.push('/(auth)/phone')} />
          <Action
            label="Join with an invite code"
            variant="ghost"
            onPress={() => router.push('/(auth)/invite')}
          />
        </Animated.View>

        <Animated.View style={step(3, 10)}>
          <Pressable
            onPress={() => router.push('/(onboarding)/create-account')}
            onPressIn={() => setLinkPressed(true)}
            onPressOut={() => setLinkPressed(false)}
            accessibilityRole="button"
            style={styles.createLink}>
            <Text style={[styles.createLinkText, linkPressed && styles.createLinkTextPressed]}>
              Planning a wedding? <Text style={styles.createLinkStrong}>Create yours</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SPLASH_BG },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.xl + theme.space.s,
  },

  mastheadLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  masthead: {
    alignItems: 'center',
    paddingHorizontal: theme.space.xl,
    transform: [{ translateY: WORDMARK_CENTRING_OFFSET }],
  },
  spacer: { flex: 1 },
  wordmark: {
    fontSize: 54,
    lineHeight: 62,
    fontFamily: theme.fonts.serif,
    color: theme.colors.accentDeep,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  rule: {
    width: 72,
    height: 0.5,
    backgroundColor: theme.colors.gold,
    opacity: 0.6,
    marginTop: theme.space.l,
    marginBottom: theme.space.l,
  },
  tagline: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: theme.fonts.serifItalic,
    color: theme.colors.ink3,
    textAlign: 'center',
  },

  actions: { gap: theme.space.m },
  action: {
    borderRadius: theme.radii.pill,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionSolid: {
    backgroundColor: theme.colors.accentDeep,
    borderColor: theme.colors.accentDeep,
    ...theme.shadows.s2,
  },
  actionGhost: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.lineStrong,
  },
  // Pressed states are designed, not incidental: the surface dips and settles.
  actionPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  actionLabel: { fontSize: 16, fontWeight: '600', fontFamily: theme.fonts.sans },
  actionLabelSolid: { color: theme.colors.bg },
  actionLabelGhost: { color: theme.colors.accentDeep },

  createLink: { paddingVertical: theme.space.m, alignItems: 'center' },
  createLinkText: {
    fontSize: 14,
    fontFamily: theme.fonts.sans,
    // ink3 measures 4.23:1 on this cream field — under AA for text this size.
    color: theme.colors.ink2,
  },
  createLinkTextPressed: { color: theme.colors.ink },
  createLinkStrong: { color: theme.colors.accentDeep, fontWeight: '600' },
});
