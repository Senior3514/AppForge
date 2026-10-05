import type { AppSpec } from "@appforge/modules";
import type { Plan } from "@appforge/plans";

export interface AppView {
  id: string; name: string; spec: AppSpec; canUndo: boolean; canRedo: boolean;
  history: { seq: number; label: string; source: string; at: string; applied: boolean }[];
  publishedAt: string | null; shared: boolean; updatedAt: string;
}
export interface ServerInfo { llm: string; local?: boolean; payments?: string; push?: string; builds?: string; billing?: string }
export interface Me {
  user: { email: string | null; anonymous: boolean; verified?: boolean; operator?: boolean } | null;
  tenant?: { plan: Plan; status: string; effectivePlan: Plan; trialEndsAt: string | null };
  entitlements?: { maxApps: number; storePublishing: boolean };
  usage?: { apps: number };
  aiSource?: "user" | "platform" | "mock";
  server: ServerInfo;
}
export interface AppSummary { id: string; name: string; primary: string; locale: string; published: boolean; updatedAt: string }
