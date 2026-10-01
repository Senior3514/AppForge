import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number }) => Promise<Buffer>;
const N = 16384;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32, { N });
  return `scrypt$${N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !n || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length, { N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Opaque random token for sessions / magic links / preview links. Only its hash is stored. */
export const newToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Authenticated encryption for secrets at rest (AES-256-GCM). Output: v1.<iv>.<tag>.<ciphertext>, all base64url. */
export function sealer(secret: string) {
  const key = createHash("sha256").update(`appforge:secrets:${secret}`).digest();
  return {
    seal(plain: string): string {
      const iv = randomBytes(12);
      const c = createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
      return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
    },
    open(sealed: string): string {
      const [v, iv, tag, enc] = sealed.split(".");
      if (v !== "v1" || !iv || !tag || !enc) throw new Error("bad sealed value");
      const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
      d.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
    },
  };
}
export type Sealer = ReturnType<typeof sealer>;
