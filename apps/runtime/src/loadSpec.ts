import { validateApp, type AppSpec } from "@appforge/modules";
import { SAMPLE_SPEC } from "./sample";

interface Config { apiUrl?: string; token?: string; fetchImpl?: typeof fetch }

/**
 * Loads the AppSpec to render. With an app id it fetches and fully validates the spec from the API
 * (the runtime never trusts server JSON blindly); without one it renders the bundled sample.
 */
export async function loadSpec(appId: string | undefined, { apiUrl, token, fetchImpl = fetch }: Config): Promise<AppSpec> {
  if (!appId) return SAMPLE_SPEC;
  if (!apiUrl) throw new Error("EXPO_PUBLIC_API_URL is not set");
  const res = await fetchImpl(`${apiUrl}/v1/apps/${encodeURIComponent(appId)}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Could not load app (${res.status})`);
  const v = validateApp(((await res.json()) as { spec: unknown }).spec);
  if (!v.ok) throw new Error(`App spec is invalid: ${v.errors[0]}`);
  return v.spec;
}
