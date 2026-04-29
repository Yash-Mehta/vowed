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
import { getUser } from '../lib/firestore';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../lib/notifications';
import { tryAutoLogin, clearCredentials } from '../lib/secureAuth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { setFirebaseUser, setUserDoc, setLoading, isLoading, firebaseUser, isProfileComplete } =
    useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  const [fontsLoaded] = useFonts({
    'CormorantGaramond-Medium': CormorantGaramond_500Medium,
    'CormorantGaramond-Italic': CormorantGaramond_400Regular_Italic,
    'CormorantGaramond-MediumItalic': CormorantGaramond_500Medium_Italic,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const doc = await getUser(user.uid);
        setUserDoc(doc);
        registerForPushNotifications(user.uid).catch(console.error);
        setLoading(false);
      } else {
        const loggedIn = await tryAutoLogin();
        if (!loggedIn) {
          setUserDoc(null);
          setLoading(false);
        }
        // if loggedIn, onAuthStateChanged fires again with the user
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isLoading || !fontsLoaded) return;
    const inAuth = segments[0] === '(auth)';
    if (!firebaseUser && !inAuth) {
      router.replace('/(auth)/invite');
    } else if (firebaseUser && inAuth) {
      router.replace(isProfileComplete ? '/(tabs)/feed' : '/(auth)/profile-setup');
    } else if (firebaseUser && !isProfileComplete && !inAuth) {
      router.replace('/(auth)/profile-setup');
    }
  }, [isLoading, fontsLoaded, firebaseUser, isProfileComplete, segments]);

  if (!fontsLoaded) return null;

  return <Slot />;
}
