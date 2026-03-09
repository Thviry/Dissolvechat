import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export async function registerForPush(): Promise<string | null> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = await Notifications.getDevicePushTokenAsync();
  return token.data;
}

export async function showLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // immediate
  });
}

export function onNotificationReceived(callback: () => Promise<void>) {
  return Notifications.addNotificationReceivedListener(() => {
    callback();
  });
}

export function onNotificationTapped(callback: () => void) {
  return Notifications.addNotificationResponseReceivedListener(() => {
    callback();
  });
}
