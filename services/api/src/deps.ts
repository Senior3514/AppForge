import type { GenerateResult, LlmClient } from "@appforge/generator";
import type { Adapters } from "./adapters";
import type { Sealer } from "./crypto";
import type { Db } from "./db";
import type { RateLimiter } from "./http";

export interface Deps {
  db: Db;
  llm: LlmClient;
  cache: Map<string, GenerateResult>;
  adapters: Adapters;
  limiter: RateLimiter;
  /** Where the web app is reachable by users (used in emails, checkout return URLs, share links). */
  publicUrl: string;
  secureCookies: boolean;
  /** Outbound fetch for user-supplied AI keys; tests inject a fake. */
  fetchImpl?: typeof fetch;
  /** Encrypts per-tenant secrets (AI keys). Null when no APPFORGE_SECRET is configured for a real database: the feature is then off. */
  sealer: Sealer | null;
  /** Emails allowed into the operator console (must also be verified). */
  operatorEmails: Set<string>;
}
