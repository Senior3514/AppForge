import { describe, expect, it, vi } from "vitest";
import { validateApp } from "@appforge/modules";
import { loadSpec } from "./loadSpec";
import { SAMPLE_SPEC } from "./sample";

const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const url = (f: typeof fetch) => (f as unknown as { mock: { calls: [string][] } }).mock.calls[0]![0];

describe("loadSpec", () => {
  it("bundled sample is itself a valid spec", () => expect(validateApp(SAMPLE_SPEC).ok).toBe(true));
  it("no source → sample", async () => expect(await loadSpec({}, {})).toBe(SAMPLE_SPEC));
  it("token loads the live draft from the public preview endpoint", async () => {
    const f = respond({ spec: SAMPLE_SPEC });
    expect(await loadSpec({ token: "tok/en" }, { apiUrl: "http://api", fetchImpl: f })).toEqual(SAMPLE_SPEC);
    expect(url(f)).toBe("http://api/v1/public/preview/tok%2Fen");
  });
  it("app id loads the published version", async () => {
    const f = respond({ spec: SAMPLE_SPEC });
    await loadSpec({ app: "a b" }, { apiUrl: "http://api", fetchImpl: f });
    expect(url(f)).toBe("http://api/v1/public/apps/a%20b");
  });
  it("rejects invalid server JSON, HTTP errors and missing config", async () => {
    await expect(loadSpec({ app: "x" }, { apiUrl: "http://api", fetchImpl: respond({ spec: { version: 1 } }) })).rejects.toThrow(/invalid/);
    await expect(loadSpec({ app: "x" }, { apiUrl: "http://api", fetchImpl: respond({}, 404) })).rejects.toThrow(/404/);
    await expect(loadSpec({ app: "x" }, {})).rejects.toThrow(/EXPO_PUBLIC_API_URL/);
  });
});
