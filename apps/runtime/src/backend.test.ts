import { describe, expect, it, vi } from "vitest";
import { Backend } from "./backend";

const ok = (body: unknown = {}, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const calls = (f: typeof fetch) => (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;

describe("Backend", () => {
  it("is a harmless sandbox without a live app id", async () => {
    const f = ok();
    const b = new Backend({ apiUrl: "http://api", fetchImpl: f }, "device-12345678");
    expect(b.live).toBe(false);
    expect(await b.submit("bookings", { name: "x" })).toBe(true);
    b.track("screen_view", "home"); await b.flush(); await b.registerPush("t".repeat(12), "ios");
    expect(await b.checkout([{ name: "a", qty: 1 }])).toBeNull();
    expect(calls(f)).toHaveLength(0);
  });

  it("submits forms and reports failure honestly", async () => {
    const good = ok({ id: "1" }, 201);
    expect(await new Backend({ apiUrl: "http://api", appId: "app 1", fetchImpl: good }, "d").submit("bookings", { name: "Dana" })).toBe(true);
    expect(calls(good)[0]![0]).toBe("http://api/v1/public/apps/app%201/data/bookings");
    expect(JSON.parse(calls(good)[0]![1].body as string)).toEqual({ data: { name: "Dana" } });
    expect(await new Backend({ apiUrl: "http://api", appId: "a", fetchImpl: ok({}, 400) }, "d").submit("bookings", {})).toBe(false);
    const down = vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await new Backend({ apiUrl: "http://api", appId: "a", fetchImpl: down }, "d").submit("bookings", {})).toBe(false);
  });

  it("batches events with the device id and re-queues on server errors", async () => {
    let status = 500;
    const f = vi.fn(async () => new Response("{}", { status })) as unknown as typeof fetch;
    const b = new Backend({ apiUrl: "http://api", appId: "a", fetchImpl: f }, "device-abcdef12");
    b.track("screen_view", "home"); b.track("screen_view", "menu");
    await b.flush();
    status = 202;
    await b.flush(); // the retry carries the same two events
    expect(calls(f)).toHaveLength(2);
    expect(JSON.parse(calls(f)[1]![1].body as string)).toEqual({ deviceId: "device-abcdef12", events: [{ name: "screen_view", screen: "home" }, { name: "screen_view", screen: "menu" }] });
    await b.flush();
    expect(calls(f)).toHaveLength(2); // queue drained
  });

  it("checkout returns the hosted URL or null; the client never sends prices", async () => {
    const f = ok({ url: "https://pay.test/x" }, 201);
    const b = new Backend({ apiUrl: "http://api", appId: "a", fetchImpl: f }, "d");
    expect(await b.checkout([{ name: "Tee", qty: 2 }])).toBe("https://pay.test/x");
    expect(JSON.parse(calls(f)[0]![1].body as string)).toEqual({ items: [{ name: "Tee", qty: 2 }] });
    expect(await new Backend({ apiUrl: "http://api", appId: "a", fetchImpl: ok({}, 400) }, "d").checkout([{ name: "x", qty: 1 }])).toBeNull();
  });
});
