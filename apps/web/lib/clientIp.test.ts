import { describe, expect, it } from "vitest";

import { clientIp } from "./clientIp";

describe("clientIp", () => {
  it("uses the last (proxy-appended) entry so a forged prefix cannot spoof the address", () => {
    expect(clientIp("1.2.3.4, 9.9.9.9, 203.0.113.7")).toBe("203.0.113.7");
    expect(clientIp("203.0.113.7")).toBe("203.0.113.7");
  });
  it("falls back when there is no header", () => {
    expect(clientIp(null)).toBe("unknown");
    expect(clientIp("")).toBe("unknown");
  });
});
