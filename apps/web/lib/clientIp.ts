/**
 * Client IP for rate limiting. The API trusts the single value we send, so we must not forward a client-supplied chain:
 * a reverse proxy in front appends the real peer to X-Forwarded-For, so we take the LAST entry, which a client cannot forge.
 */
export function clientIp(xff: string | null): string {
  const last = xff?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
  return last ?? "unknown";
}
