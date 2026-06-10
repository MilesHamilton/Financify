import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey(): Buffer {
  const raw = process.env.PLAID_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error("PLAID_TOKEN_ENC_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.byteLength !== 32) {
    throw new Error(
      `PLAID_TOKEN_ENC_KEY must decode to exactly 32 bytes (got ${key.byteLength})`
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptToken(envelope: string): string {
  const parts = envelope.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid token envelope: expected 4 colon-separated segments");
  }
  const [version, ivB64, tagB64, ctB64] = parts;
  if (version !== "v1") {
    throw new Error(`Unknown token envelope version: "${version}"`);
  }
  const key = getKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
