import { useEffect } from 'react';
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
      setFirebaseUser(user);
      if (user) {
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
          setUserDoc(memberDoc);
          registerForPushNotifications(user.uid, wId).catch(console.error);
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

    if (!firebaseUser && !inAuth && !inOnboarding) {
      router.replace('/');
    } else if (firebaseUser && inAuth) {
      router.replace(isProfileComplete ? '/(tabs)/feed' : '/(auth)/profile-setup');
    } else if (firebaseUser && !inOnboarding && !isProfileComplete) {
      router.replace('/(auth)/profile-setup');
    }
  }, [isLoading, fontsLoaded, firebaseUser, isProfileComplete, segments]);

  if (!fontsLoaded) return null;

  return <Slot />;
}
