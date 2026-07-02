import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const isExpoGo = Constants.appOwnership === 'expo';

// Use require() instead of a static import so we can guard it — the static
// import itself throws in Expo Go on Android (SDK 53+) before any code runs.
let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications!.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Silently ignore — unsupported environment.
  }
}

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

// 'unavailable' = Expo Go or unsupported environment where push never works anyway
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (isExpoGo || !Notifications) return 'unavailable';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as NotificationPermissionStatus;
  } catch {
    return 'unavailable';
  }
}

export async function registerForPushNotifications(
  uid: string,
  weddingId: string
): Promise<void> {
  if (isExpoGo || !Notifications) return;

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

    let token: string;
    try {
      if (Platform.OS === 'android') {
        // Use the native FCM token so Cloud Functions can deliver via Firebase Admin
        // without needing Expo FCM credentials.
        token = (await Notifications.getDevicePushTokenAsync()).data;
      } else {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        if (!projectId) return;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
    } catch {
      return;
    }
    await updateDoc(doc(db, 'weddings', weddingId, 'members', uid), { fcmToken: token });
  } catch {
    return;
  }
}
