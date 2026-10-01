import AsyncStorage from "@react-native-async-storage/async-storage";

/** Tiny persistence layer. Storage can fail (full disk, private mode); the app must keep working without it. */
export async function loadNumber(key: string): Promise<number> {
  try { const v = Number(await AsyncStorage.getItem(key)); return Number.isFinite(v) ? v : 0; } catch { return 0; }
}
export async function saveNumber(key: string, value: number): Promise<void> {
  try { await AsyncStorage.setItem(key, String(value)); } catch { /* best effort */ }
}
export async function loadString(key: string): Promise<string | null> {
  try { return await AsyncStorage.getItem(key); } catch { return null; }
}
export async function saveString(key: string, value: string): Promise<void> {
  try { await AsyncStorage.setItem(key, value); } catch { /* best effort */ }
}
