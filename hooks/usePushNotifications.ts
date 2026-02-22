import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PushNotificationState {
  /** Raw ExpoPushToken object returned by Expo SDK */
  expoPushToken?: Notifications.ExpoPushToken;
  /** Extracted string value – safe to send to backend directly */
  pushTokenString?: string;
  /** true once the token (or a definitive failure) has been resolved */
  isReady: boolean;
  /** Last received notification while app is foregrounded */
  notification?: Notifications.Notification;
  /** Hardware device identifier (Android ID / iOS vendor ID) */
  deviceId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global notification handler (foreground)
// ─────────────────────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely extracts the push token string regardless of whether the SDK
 * returned a raw string or an object shaped { data: string }.
 */
function extractTokenString(token: Notifications.ExpoPushToken | undefined): string | undefined {
  if (!token) return undefined;
  // Expo SDK >= 50 returns { data: string, type: 'expo' }
  if (typeof token === 'object' && 'data' in token && typeof token.data === 'string') {
    return token.data;
  }
  // Older versions may return a plain string (cast through unknown for safety)
  if (typeof (token as unknown) === 'string') {
    return token as unknown as string;
  }
  return undefined;
}

/**
 * Returns the per-device hardware identifier.
 * Android → Android Advertising ID
 * iOS     → Vendor Identifier
 */
async function getHardwareDeviceId(): Promise<string> {
  try {
    if (Platform.OS === 'android') {
      const id = Application.getAndroidId();
      return id ?? 'unknown-android-device';
    } else {
      const id = await Application.getIosIdForVendorAsync();
      return id ?? 'unknown-ios-device';
    }
  } catch {
    return 'unknown-device';
  }
}

/**
 * Requests push notification permissions and returns the Expo push token.
 * Returns undefined when running on a simulator or when permission is denied.
 */
async function registerForPushNotificationsAsync(): Promise<Notifications.ExpoPushToken | undefined> {
  // Android: create the notification channel first
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#06b6d4',
      sound: 'default',
      enableVibrate: true,
    });
  }

  if (!Device.isDevice) {
    // Simulators cannot receive push notifications
    console.log('[PushToken] Skipped: running on simulator/emulator.');
    return undefined;
  }

  // Request / confirm permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[PushToken] Permission denied. Push notifications will not work.');
    return undefined;
  }

  // Resolve projectId from app config or EAS config
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    console.warn('[PushToken] No EAS projectId found. Check app.config.js / eas.json.');
    return undefined;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[PushToken] Token acquired:', token.data);
    return token;
  } catch (error) {
    console.error('[PushToken] Failed to acquire token:', error);
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const usePushNotifications = (): PushNotificationState => {
  const [expoPushToken, setExpoPushToken] = useState<Notifications.ExpoPushToken | undefined>();
  const [pushTokenString, setPushTokenString] = useState<string | undefined>();
  const [isReady, setIsReady] = useState<boolean>(false);
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const [deviceId, setDeviceId] = useState<string | undefined>();

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      // Fetch token and device ID concurrently
      const [token, hwId] = await Promise.all([
        registerForPushNotificationsAsync(),
        getHardwareDeviceId(),
      ]);

      if (!isMounted) return;

      const tokenStr = extractTokenString(token);

      setExpoPushToken(token);
      setPushTokenString(tokenStr);
      setDeviceId(hwId);
      // Mark as ready regardless of whether we got a token —
      // callers decide what to do when pushTokenString is undefined.
      setIsReady(true);

      console.log('[PushToken] Init complete. tokenString:', tokenStr, '| deviceId:', hwId);
    };

    init();

    // Foreground notification listener
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      setNotification(n);
    });

    // Notification tap / response listener
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[PushToken] Notification tapped:', response.notification.request.identifier);
    });

    return () => {
      isMounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken, pushTokenString, isReady, notification, deviceId };
};
