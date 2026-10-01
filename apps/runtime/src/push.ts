import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Backend } from "./backend";

/** Asks permission and registers this device's Expo push token. Silently does nothing on simulators or when denied. */
export async function registerForPush(backend: Backend): Promise<void> {
  if (!backend.live || !Device.isDevice) return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const status = existing === "granted" ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const { data } = await Notifications.getExpoPushTokenAsync();
    await backend.registerPush(data, Platform.OS === "ios" ? "ios" : "android");
  } catch { /* push is optional: never block the app */ }
}
