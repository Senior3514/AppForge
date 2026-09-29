import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { AppSpec } from "@appforge/modules";
import { Renderer } from "../src/Renderer";
import { loadSpec } from "../src/loadSpec";

/** Previewer entry: `appforge://?app=<id>` loads that app's spec; no id renders the bundled sample. */
export default function Home() {
  const { app } = useLocalSearchParams<{ app?: string }>();
  const [spec, setSpec] = useState<AppSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadSpec(app, { apiUrl: process.env.EXPO_PUBLIC_API_URL, token: process.env.EXPO_PUBLIC_PREVIEW_TOKEN })
      .then((s) => live && setSpec(s))
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [app]);

  if (error) return <View style={{ flex: 1, justifyContent: "center", padding: 24 }}><Text accessibilityRole="alert">{error}</Text></View>;
  if (!spec) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  return <Renderer spec={spec} />;
}
