import * as Notifications from 'expo-notifications';
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
  if (finalStatus !== 'granted') return;

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } catch {
    return;
  }
  await updateDoc(doc(db, 'weddings', weddingId, 'members', uid), { fcmToken: token });
}
