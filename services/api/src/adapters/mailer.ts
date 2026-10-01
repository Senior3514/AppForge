export interface Mailer { readonly name: string; send(to: string, subject: string, text: string): Promise<void> }

/** Dev mailer: keeps messages in memory (tests read `outbox`) and logs them so a magic link can be clicked from the console. */
export class MockMailer implements Mailer {
  readonly name = "mock";
  outbox: { to: string; subject: string; text: string }[] = [];
  constructor(private log: (m: string) => void = console.log) {}
  async send(to: string, subject: string, text: string) {
    this.outbox.push({ to, subject, text });
    this.log(`[mail → ${to}] ${subject}\n${text}`);
  }
}

/** Resend (https://resend.com) HTTP API. */
export class ResendMailer implements Mailer {
  readonly name = "resend";
  constructor(private o: { apiKey: string; from: string; fetchImpl?: typeof fetch }) {}
  async send(to: string, subject: string, text: string) {
    const res = await (this.o.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.o.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: this.o.from, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`mail provider ${res.status}`);
  }
}
