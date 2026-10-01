import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { AppSpec } from "@appforge/modules";
import { Backend, newDeviceId } from "../src/backend";
import { registerForPush } from "../src/push";
import { Renderer } from "../src/Renderer";
import { loadSpec } from "../src/loadSpec";
import { loadString, saveString } from "../src/storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
// White-label store builds bake the app id in (see app.config.ts); the Previewer takes it from the link instead.
const BAKED_APP_ID = process.env.EXPO_PUBLIC_APPFORGE_APP_ID;

/** `appforge://?token=<share token>` previews a live draft; `?app=<id>` (or a baked-in id) runs the published app. */
export default function Home() {
  const params = useLocalSearchParams<{ app?: string; token?: string }>();
  const appId = params.app ?? BAKED_APP_ID;
  const [spec, setSpec] = useState<AppSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      let id = await loadString("device-id");
      if (!id) { id = newDeviceId(); await saveString("device-id", id); }
      setDeviceId(id);
    })();
  }, []);

  useEffect(() => {
    let live = true;
    loadSpec({ app: params.token ? undefined : appId, token: params.token }, { apiUrl: API_URL })
      .then((s) => live && setSpec(s))
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [appId, params.token]);

  // Previews (token) are sandboxes: only a published app talks to the real backend.
  const backend = useMemo(() => (deviceId ? new Backend({ apiUrl: API_URL, appId: params.token ? undefined : appId }, deviceId) : null), [deviceId, appId, params.token]);
  useEffect(() => { if (backend) void registerForPush(backend); }, [backend]);

  if (error) return <View style={{ flex: 1, justifyContent: "center", padding: 24 }}><Text accessibilityRole="alert">{error}</Text></View>;
  if (!spec || !backend) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  return <Renderer spec={spec} backend={backend} />;
}
