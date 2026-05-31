import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const isExpoGo = Constants.appOwnership === 'expo';

// expo-notifications push APIs are unavailable in Expo Go on Android (SDK 53+).
// Guard the top-level handler so the module can be imported without crashing.
try {
  if (!isExpoGo) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch {
  // Silently ignore — running in Expo Go where push is not supported.
}

export async function registerForPushNotifications(
  uid: string,
  weddingId: string
): Promise<void> {
  // Skip silently when running inside Expo Go (push notifications not supported).
  if (isExpoGo) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Vowed',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7A4A3F',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      if (existing === 'denied') {
        Alert.alert(
          'Notifications are off',
          `To stay updated on posts and comments, enable notifications for Vowed in your ${Platform.OS === 'ios' ? 'iPhone' : 'device'} Settings.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;

    let token: string;
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch {
      return;
    }
    await updateDoc(doc(db, 'weddings', weddingId, 'members', uid), { fcmToken: token });
  } catch {
    // Silently ignore any unexpected notification errors to avoid crashing the app.
    return;
  }
}
