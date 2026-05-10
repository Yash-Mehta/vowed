import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Linking } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(
  uid: string,
  weddingId: string
): Promise<void> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    // iOS won't re-show the system prompt after denial — direct user to Settings
    if (existing === 'denied') {
      Alert.alert(
        'Notifications are off',
        'To stay updated on posts and comments, enable notifications for Vowed in your iPhone Settings.',
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
}
