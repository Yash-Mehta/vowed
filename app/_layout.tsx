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
import { tryAutoLogin } from '../lib/secureAuth';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { theme } from '../constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const {
    setFirebaseUser,
    setUserDoc,
    setLoading,
    setWeddingId,
    setUserWeddingIds,
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
        if (!user.emailVerified) {
          setUserWeddingIds([]);
          setWeddingId(null);
          setUserDoc(null);
          setLoading(false);
          return;
        }
        // Load user index to know which weddings they belong to.
        // We don't auto-select a wedding — user must choose from the party selection screen.
        const idx = await getUserIndex(user.uid);
        const ids = idx?.weddingIds ?? [];
        setUserWeddingIds(ids);
        setWeddingId(null);
        setUserDoc(null);
        setLoading(false);
      } else {
        const loggedIn = await tryAutoLogin();
        if (!loggedIn) {
          setUserWeddingIds([]);
          setUserDoc(null);
          setWeddingId(null);
          setLoading(false);
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isLoading || !fontsLoaded) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inSelectWedding = segments[0] === 'select-wedding';

    const emailVerified = firebaseUser?.emailVerified ?? true;
    const onVerifyScreen = segments[1] === 'verify-email';

    if (!firebaseUser && !inAuth && !inOnboarding) {
      router.replace('/');
    } else if (firebaseUser && !emailVerified && !onVerifyScreen && !inOnboarding) {
      router.replace('/(auth)/verify-email');
    } else if (firebaseUser && emailVerified) {
      if (weddingId) {
        // Party selected — route to tabs
        if (inAuth || inSelectWedding) {
          playEntryTransition(() => router.replace('/(tabs)/feed'));
        }
      } else if (pendingWeddingId) {
        // Mid-join: have a pending wedding to set up profile for
        if (!inAuth && !inOnboarding) {
          router.replace('/(auth)/profile-setup');
        } else if (
          inAuth &&
          segments[1] !== 'profile-setup' &&
          segments[1] !== 'invite' &&
          segments[1] !== 'register' &&
          segments[1] !== 'verify-email'
        ) {
          router.replace('/(auth)/profile-setup');
        }
      } else if (userWeddingIds.length > 0) {
        // Has weddings but no party selected — go to party selection.
        // Allow invite/profile-setup/register/verify-email so mid-join flow isn't interrupted.
        const onMidJoinScreen =
          segments[1] === 'invite' ||
          segments[1] === 'profile-setup' ||
          segments[1] === 'register' ||
          segments[1] === 'verify-email';
        if (!inSelectWedding && !inOnboarding && !onMidJoinScreen) {
          router.replace('/select-wedding');
        }
      } else {
        // No weddings yet — needs to join via invite.
        const onMidJoinScreen =
          segments[1] === 'invite' ||
          segments[1] === 'profile-setup' ||
          segments[1] === 'register' ||
          segments[1] === 'verify-email';
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
