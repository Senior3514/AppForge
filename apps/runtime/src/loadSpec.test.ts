import { describe, expect, it, vi } from "vitest";
import { loadSpec } from "./loadSpec";
import { SAMPLE_SPEC } from "./sample";
import { validateApp } from "@appforge/modules";

const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("loadSpec", () => {
  it("bundled sample is itself a valid spec", () => expect(validateApp(SAMPLE_SPEC).ok).toBe(true));
  it("no app id → sample", async () => expect(await loadSpec(undefined, {})).toBe(SAMPLE_SPEC));
  it("fetches and validates a spec, sending the token", async () => {
    const fetchImpl = respond({ spec: SAMPLE_SPEC });
    expect(await loadSpec("a b", { apiUrl: "http://api", token: "mock:t", fetchImpl })).toEqual(SAMPLE_SPEC);
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("http://api/v1/apps/a%20b");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer mock:t");
  });
  it("rejects invalid server JSON, HTTP errors and missing config", async () => {
    await expect(loadSpec("x", { apiUrl: "http://api", fetchImpl: respond({ spec: { version: 1 } }) })).rejects.toThrow(/invalid/);
    await expect(loadSpec("x", { apiUrl: "http://api", fetchImpl: respond({}, 404) })).rejects.toThrow(/404/);
    await expect(loadSpec("x", {})).rejects.toThrow(/EXPO_PUBLIC_API_URL/);
  });
});
