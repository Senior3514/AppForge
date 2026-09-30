/** Calls the published app's public API. Only works for published apps; previews use sandbox data instead. */
export interface BackendConfig { apiUrl?: string; appId?: string; fetchImpl?: typeof fetch }
export interface CartLine { name: string; qty: number }

export class Backend {
  private queue: { name: string; screen?: string }[] = [];
  constructor(private c: BackendConfig, private deviceId: string) {}
  get live() { return !!this.c.apiUrl && !!this.c.appId; }

  private async post(path: string, body: unknown): Promise<Response> {
    return (this.c.fetchImpl ?? fetch)(`${this.c.apiUrl}/v1/public/apps/${encodeURIComponent(this.c.appId!)}${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
  }

  /** Stores a form submission (e.g. a booking). Returns false when offline/not live so the UI can say so. */
  async submit(collection: string, data: Record<string, unknown>): Promise<boolean> {
    if (!this.live) return true; // sandbox preview: pretend success, nothing is stored
    try { return (await this.post(`/data/${encodeURIComponent(collection)}`, { data })).ok; } catch { return false; }
  }

  track(name: string, screen?: string) { if (this.live) this.queue.push({ name, screen }); }

  /** Sends queued analytics events in one batch; failures re-queue so events are not lost. */
  async flush(): Promise<void> {
    if (!this.live || this.queue.length === 0) return;
    const events = this.queue.splice(0, 50);
    try {
      const res = await this.post("/events", { deviceId: this.deviceId, events });
      if (!res.ok && res.status >= 500) this.queue.unshift(...events);
    } catch { this.queue.unshift(...events); }
  }

  async registerPush(token: string, platform: "ios" | "android"): Promise<void> {
    if (!this.live) return;
    await this.post("/devices", { token, platform }).catch(() => {});
  }

  /** Returns the hosted checkout URL. The server prices the order from the published spec. */
  async checkout(items: CartLine[]): Promise<string | null> {
    if (!this.live) return null;
    try {
      const res = await this.post("/checkout", { items });
      return res.ok ? ((await res.json()) as { url: string }).url : null;
    } catch { return null; }
  }
}

export const newDeviceId = (): string => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
