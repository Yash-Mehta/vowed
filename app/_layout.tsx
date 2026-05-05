import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
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
import { getMember, getUserIndex } from '../lib/firestore';
import { useAuthStore } from '../store/authStore';
import { useWeddingConfig } from '../hooks/useWeddingConfig';
import { registerForPushNotifications } from '../lib/notifications';
import { tryAutoLogin, clearCredentials, getWeddingId, saveWeddingId } from '../lib/secureAuth';
import { theme } from '../constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const {
    setFirebaseUser,
    setUserDoc,
    setLoading,
    setWeddingId,
    isLoading,
    firebaseUser,
    isProfileComplete,
    weddingId,
  } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [showOverlay, setShowOverlay] = useState(false);
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

  // Start wedding config listener whenever weddingId is available
  useWeddingConfig(weddingId);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setFirebaseUser(user);
      if (user) {
        // Skip Firestore lookups for unverified users — rules deny access
        if (!user.emailVerified) {
          setWeddingId(null);
          setUserDoc(null);
          setLoading(false);
          return;
        }

        // Resolve weddingId: SecureStore first, then /users index
        let wId = await getWeddingId();
        if (!wId) {
          const idx = await getUserIndex(user.uid);
          wId = idx?.weddingIds?.[0] ?? null;
          if (wId) await saveWeddingId(wId);
        }
        setWeddingId(wId);

        if (wId) {
          const memberDoc = await getMember(wId, user.uid);
          if (memberDoc) {
            setUserDoc(memberDoc);
            registerForPushNotifications(user.uid, wId).catch(() => {});
          } else {
            // Wedding was deleted or user removed — clear stale weddingId so
            // they get routed back to landing to re-onboard or join a new party.
            await clearCredentials();
            setWeddingId(null);
            setUserDoc(null);
          }
        } else {
          setUserDoc(null);
        }
        setLoading(false);
      } else {
        const loggedIn = await tryAutoLogin();
        if (!loggedIn) {
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

    const emailVerified = firebaseUser?.emailVerified ?? true;
    const onVerifyScreen = segments[1] === 'verify-email';

    if (!firebaseUser && !inAuth && !inOnboarding) {
      router.replace('/');
    } else if (firebaseUser && !emailVerified && !onVerifyScreen && !inOnboarding) {
      router.replace('/(auth)/verify-email');
    } else if (firebaseUser && inAuth && emailVerified) {
      if (isProfileComplete) {
        playEntryTransition(() => router.replace('/(tabs)/feed'));
      } else if (segments[1] !== 'profile-setup') {
        router.replace('/(auth)/profile-setup');
      }
    } else if (firebaseUser && !inOnboarding && emailVerified && !isProfileComplete) {
      router.replace('/(auth)/profile-setup');
    }
  }, [isLoading, fontsLoaded, firebaseUser, isProfileComplete, segments]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {showOverlay && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}>
          <Text style={styles.overlayTitle}>Vowed</Text>
        </Animated.View>
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
