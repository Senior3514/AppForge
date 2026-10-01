import { validateApp, type AppSpec } from "@appforge/modules";
import { SAMPLE_SPEC } from "./sample";

export interface Source { app?: string; token?: string }
interface Config { apiUrl?: string; fetchImpl?: typeof fetch }

/**
 * Loads the AppSpec to render and validates it fully (the runtime never trusts server JSON blindly).
 *  - `token`: a share link's live draft (Previewer)
 *  - `app`: the published version of an app (what store builds ship)
 *  - neither: the bundled sample, so the runtime boots with no backend
 */
export async function loadSpec(src: Source, { apiUrl, fetchImpl = fetch }: Config): Promise<AppSpec> {
  if (!src.app && !src.token) return SAMPLE_SPEC;
  if (!apiUrl) throw new Error("EXPO_PUBLIC_API_URL is not set");
  const path = src.token ? `/v1/public/preview/${encodeURIComponent(src.token)}` : `/v1/public/apps/${encodeURIComponent(src.app!)}`;
  const res = await fetchImpl(`${apiUrl}${path}`);
  if (!res.ok) throw new Error(`Could not load app (${res.status})`);
  const v = validateApp(((await res.json()) as { spec: unknown }).spec);
  if (!v.ok) throw new Error(`App spec is invalid: ${v.errors[0]}`);
  return v.spec;
}
