import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useFonts } from 'expo-font';
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_500Medium_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import * as SplashScreen from 'expo-splash-screen';
import { auth } from '../lib/firebase';
import { getUserIndex } from '../lib/firestore';
import { useAuthStore } from '../store/authStore';
import { useWeddingConfig } from '../hooks/useWeddingConfig';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { theme } from '../constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const {
    setFirebaseUser,
    setUserDoc,
    setGlobalProfile,
    setLoading,
    setWeddingId,
    setUserWeddingIds,
    setPendingWeddingId,
    setPendingRole,
    isLoading,
    firebaseUser,
    weddingId,
    pendingWeddingId,
    userWeddingIds,
  } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [showOverlay, setShowOverlay] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const hasTransitioned = useRef(false);

  function playEntryTransition(navigate: () => void) {
    if (hasTransitioned.current) { navigate(); return; }
    hasTransitioned.current = true;
    setShowOverlay(true);
    overlayOpacity.setValue(1);
    navigate();
    setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }).start(() => setShowOverlay(false));
    }, 900);
  }

  const [fontsLoaded] = useFonts({
    'CormorantGaramond-Medium': CormorantGaramond_500Medium,
    'CormorantGaramond-Italic': CormorantGaramond_400Regular_Italic,
    'CormorantGaramond-MediumItalic': CormorantGaramond_500Medium_Italic,
  });

  useWeddingConfig(weddingId);

  // Native splash hide is owned by AnimatedSplash — it opens on an identical
  // frame, so the handoff is seamless.

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setFirebaseUser(user);
      if (user) {
        // Load user index to know which weddings they belong to.
        // We don't auto-select a wedding — user must choose from the party selection screen.
        // try/catch matters here: this whole callback is unawaited by the
        // SDK, so an unhandled rejection from getUserIndex would silently
        // leave isLoading stuck at true forever — the redirect effect below
        // bails out early while isLoading is true, so the app would be
        // stuck on the auth screen even though sign-in already succeeded.
        try {
          const idx = await getUserIndex(user.uid);
          const ids = idx?.weddingIds ?? [];
          setUserWeddingIds(ids);
          setWeddingId(null);
          setUserDoc(null);
          // Empty displayName means no global profile yet (brand-new user) —
          // checked as falsy by profile-setup.tsx/create-account.tsx to decide
          // whether to show the name/photo form.
          setGlobalProfile({
            displayName: idx?.displayName ?? '',
            photoURL: idx?.photoURL ?? null,
            phoneNumber: idx?.phoneNumber ?? user.phoneNumber ?? null,
          });
        } catch (e) {
          console.warn('Failed to load user index after sign-in', e);
          setUserWeddingIds([]);
          setWeddingId(null);
          setUserDoc(null);
          setGlobalProfile({ displayName: '', photoURL: null, phoneNumber: user.phoneNumber ?? null });
        } finally {
          setLoading(false);
        }
      } else {
        setUserWeddingIds([]);
        setUserDoc(null);
        setGlobalProfile(null);
        setWeddingId(null);
        // Also clear the pending join. Without this, a code validated by
        // whoever used the app last survives sign-out: the next person to
        // sign in on this device gets pushed into profile-setup for a
        // wedding they never had a code for, and "Switch wedding party"
        // bounces to that stale join form instead of the party picker.
        setPendingWeddingId(null);
        setPendingRole('guest');
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isLoading || !fontsLoaded) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inSelectWedding = segments[0] === 'select-wedding';
    const inSettings = segments[0] === 'settings';

    // create-account is the only onboarding screen a signed-out user has any
    // business on — it's where they sign up. The rest of the wizard (names,
    // date-venue, invite-codes, confirm) needs an account, and letting them
    // through meant filling in four screens before confirm.tsx failed with
    // "Please sign in again" at the very end.
    const onSignedOutOnboardingEntry = inOnboarding && segments[1] === 'create-account';
    // Cast: expo-router's generated segment type doesn't model the bare
    // index route, which is [] at runtime.
    const atRoot = (segments as string[]).length === 0;

    if (!firebaseUser && !inAuth && !onSignedOutOnboardingEntry) {
      router.replace('/');
    } else if (firebaseUser) {
      if (weddingId) {
        // Party selected — route to tabs. Includes the bare landing route,
        // which is otherwise an unguarded gap: a signed-in user with a
        // wedding selected would sit on the Sign in / Create account screen.
        if (inAuth || inSelectWedding || atRoot) {
          playEntryTransition(() => router.replace('/(tabs)/feed'));
        }
      } else if (pendingWeddingId) {
        // Mid-join: have a pending wedding to set up profile for
        if (!inAuth && !inOnboarding) {
          router.replace('/(auth)/profile-setup');
        } else if (
          inAuth &&
          segments[1] !== 'profile-setup' &&
          segments[1] !== 'invite'
        ) {
          router.replace('/(auth)/profile-setup');
        }
      } else if (userWeddingIds.length > 0) {
        // Has weddings but no party selected — go to party selection.
        // Allow invite so mid-join flow isn't interrupted.
        //
        // Deliberately NOT excluding 'phone': firebaseUser only becomes
        // truthy on that screen the instant sign-in completes, so excluding
        // it would permanently block this redirect while the user sits on
        // the now-irrelevant OTP screen.
        //
        // Deliberately NOT excluding 'profile-setup' either — this branch
        // only runs when pendingWeddingId is null, and profile-setup with
        // nothing to join is a dead end that can only report the problem
        // after the form is submitted.
        const onMidJoinScreen = segments[1] === 'invite';
        if (!inSelectWedding && !inSettings && !inOnboarding && !onMidJoinScreen) {
          router.replace('/select-wedding');
        }
      } else {
        // No weddings yet — needs to join via invite. Same reasoning as
        // above for why profile-setup is not excluded here.
        const onMidJoinScreen = segments[1] === 'invite';
        if (!inOnboarding && !onMidJoinScreen) {
          router.replace('/(auth)/invite');
        }
      }
    }
  }, [isLoading, fontsLoaded, firebaseUser, weddingId, pendingWeddingId, userWeddingIds, segments]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {showOverlay && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}>
          <Text style={styles.overlayTitle}>Vowed</Text>
        </Animated.View>
      )}
      {!splashDone && (
        <AnimatedSplash ready={!isLoading} onDone={() => setSplashDone(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: theme.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  overlayTitle: {
    fontSize: 52,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    letterSpacing: -0.5,
  },
});
