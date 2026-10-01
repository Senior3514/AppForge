import type { ExpoConfig } from "expo/config";

/**
 * One codebase, every tenant app. Store builds set these env vars (see services/api EAS adapter), so each app gets its own
 * name, bundle id and published spec. With nothing set this is the generic "AppForge Previewer".
 */
const appId = process.env.APPFORGE_APP_ID;
const name = process.env.APPFORGE_APP_NAME ?? "AppForge Previewer";
const bundleId = process.env.APPFORGE_BUNDLE_ID ?? "app.appforge.previewer";

const config: ExpoConfig = {
  name,
  slug: appId ? `appforge-${appId.slice(0, 8)}` : "appforge-previewer",
  scheme: "appforge",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: { bundleIdentifier: bundleId, supportsTablet: true },
  android: { package: bundleId },
  plugins: ["expo-router", "expo-notifications"],
  extra: { appforgeAppId: appId ?? null },
  ...(appId ? { icon: "./assets/icon.png", splash: { image: "./assets/splash.png", resizeMode: "cover" } } : {}),
};
export default config;
