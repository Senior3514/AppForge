import type { GenerateResult, LlmClient } from "@appforge/generator";
import type { Adapters } from "./adapters";
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
}
