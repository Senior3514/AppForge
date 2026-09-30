export interface PushMessage { title: string; body: string }
export interface PushResult { sent: number; failed: number }

export interface PushProvider {
  readonly name: string;
  send(tokens: string[], msg: PushMessage): Promise<PushResult>;
}

export class MockPush implements PushProvider {
  readonly name = "mock";
  sentLog: { tokens: string[]; msg: PushMessage }[] = [];
  async send(tokens: string[], msg: PushMessage) { this.sentLog.push({ tokens, msg }); return { sent: tokens.length, failed: 0 }; }
}

/** Expo Push Service: one API for APNs and FCM tokens issued by expo-notifications. Batches of 100 per Expo's limit. */
export class ExpoPush implements PushProvider {
  readonly name = "expo";
  constructor(private o: { accessToken?: string; fetchImpl?: typeof fetch } = {}) {}
  async send(tokens: string[], msg: PushMessage): Promise<PushResult> {
    let sent = 0, failed = 0;
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      const res = await (this.o.fetchImpl ?? fetch)("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", ...(this.o.accessToken ? { authorization: `Bearer ${this.o.accessToken}` } : {}) },
        body: JSON.stringify(batch.map((to) => ({ to, title: msg.title, body: msg.body }))),
      });
      if (!res.ok) { failed += batch.length; continue; }
      const { data } = (await res.json()) as { data: { status: string }[] };
      for (const t of data) t.status === "ok" ? sent++ : failed++;
    }
    return { sent, failed };
  }
}
