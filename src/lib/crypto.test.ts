import { vi, describe, it, expect, beforeAll } from "vitest";

vi.mock("server-only", () => ({}));

import { encryptToken, decryptToken } from "./crypto";

// 32 bytes of zeros, base64-encoded
const VALID_KEY = Buffer.alloc(32).toString("base64");

beforeAll(() => {
  process.env.PLAID_TOKEN_ENC_KEY = VALID_KEY;
});

describe("encryptToken / decryptToken", () => {
  it("round-trips plaintext correctly", () => {
    const plaintext = "access-sandbox-abc123";
    const envelope = encryptToken(plaintext);
    expect(decryptToken(envelope)).toBe(plaintext);
  });

  it("envelope starts with v1: and has exactly 4 colon-separated segments", () => {
    const envelope = encryptToken("test-token");
    expect(envelope).toMatch(/^v1:/);
    expect(envelope.split(":")).toHaveLength(4);
  });

  it("decryptToken throws on a tampered ciphertext", () => {
    const envelope = encryptToken("sensitive");
    const parts = envelope.split(":");
    // Corrupt the ciphertext segment (last part)
    const corruptCt = Buffer.from(
      Buffer.from(parts[3], "base64").map((b) => b ^ 0xff)
    ).toString("base64");
    const tampered = [parts[0], parts[1], parts[2], corruptCt].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("decryptToken throws on an unknown version prefix", () => {
    const envelope = encryptToken("test");
    const withBadVersion = envelope.replace(/^v1:/, "v99:");
    expect(() => decryptToken(withBadVersion)).toThrow(/Unknown token envelope version/);
  });

  it("two encryptions of the same plaintext produce different envelopes (random IV)", () => {
    const a = encryptToken("same-plaintext");
    const b = encryptToken("same-plaintext");
    expect(a).not.toBe(b);
  });
});
