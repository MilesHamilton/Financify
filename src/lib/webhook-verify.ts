import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import type { JWK, ProtectedHeaderParameters } from "jose";
import type { JWKPublicKey } from "plaid";
import { plaidClient } from "@/lib/plaid";

// Module-scope JWK cache keyed by kid. Warm instances reuse this across requests.
const jwkCache = new Map<string, JWK>();

/**
 * Verifies a Plaid webhook request using the ES256 JWT in the Plaid-Verification header.
 *
 * Implements all 9 verification steps from TR.md § 4.2:
 * 1. Reject if header is missing.
 * 2. Decode JWT header (unverified), require alg === "ES256".
 * 3. Extract kid from header.
 * 4. Resolve JWK from module-scope cache or Plaid API; refuse expired keys.
 * 5. Verify JWT signature with jose (importJWK + jwtVerify, algorithms ["ES256"]).
 * 6. Reject if iat is older than 5 minutes.
 * 7. Compute SHA-256 of rawBody and compare to request_body_sha256 claim (constant-time).
 * 8. Returns true only when every step passes.
 * 9. Never throws to the caller — catches internally, logs structured reason, returns false.
 *
 * @param rawBody - The raw request body string (read via request.text() before any JSON.parse).
 * @param plaidVerificationHeader - The value of the Plaid-Verification header, or null if absent.
 * @returns true if the webhook is authentic, false otherwise.
 */
export async function verifyWebhook(
  rawBody: string,
  plaidVerificationHeader: string | null
): Promise<boolean> {
  try {
    // Step 1: Reject if header is missing.
    if (!plaidVerificationHeader) {
      console.error({ msg: "webhook_verify_failed", reason: "missing_plaid_verification_header" });
      return false;
    }

    // Step 2: Decode JWT header without verification; require alg === "ES256".
    let protectedHeader: ProtectedHeaderParameters;
    try {
      protectedHeader = decodeProtectedHeader(plaidVerificationHeader);
    } catch (err) {
      console.error({ msg: "webhook_verify_failed", reason: "jwt_header_decode_error", err });
      return false;
    }

    if (protectedHeader.alg !== "ES256") {
      console.error({
        msg: "webhook_verify_failed",
        reason: "unexpected_alg",
        alg: protectedHeader.alg,
      });
      return false;
    }

    // Step 3: Extract kid.
    const kid = protectedHeader.kid;
    if (!kid) {
      console.error({ msg: "webhook_verify_failed", reason: "missing_kid" });
      return false;
    }

    // Step 4: Resolve JWK from cache; on miss fetch from Plaid and cache.
    let cachedKey = jwkCache.get(kid);
    if (!cachedKey) {
      let plaidKey: JWKPublicKey;
      try {
        const response = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
        plaidKey = response.data.key;
      } catch (err) {
        console.error({ msg: "webhook_verify_failed", reason: "jwk_fetch_error", kid, err });
        return false;
      }

      // Refuse keys that Plaid has marked expired.
      if (plaidKey.expired_at !== null) {
        console.error({ msg: "webhook_verify_failed", reason: "jwk_expired", kid, expired_at: plaidKey.expired_at });
        return false;
      }

      // Build a jose-compatible JWK from Plaid's response.
      const joseJwk: JWK = {
        kty: plaidKey.kty,
        crv: plaidKey.crv,
        x: plaidKey.x,
        y: plaidKey.y,
        kid: plaidKey.kid,
        use: plaidKey.use,
        alg: plaidKey.alg,
      };

      jwkCache.set(kid, joseJwk);
      cachedKey = joseJwk;
    }

    // Step 5: Verify JWT signature.
    let payload: Record<string, unknown>;
    try {
      const importedKey = await importJWK(cachedKey, "ES256");
      const result = await jwtVerify(plaidVerificationHeader, importedKey, {
        algorithms: ["ES256"],
      });
      payload = result.payload as Record<string, unknown>;
    } catch (err) {
      console.error({ msg: "webhook_verify_failed", reason: "jwt_signature_invalid", kid, err });
      return false;
    }

    // Step 6: Reject if iat is older than 5 minutes (300 seconds).
    const iat = payload["iat"];
    if (typeof iat !== "number") {
      console.error({ msg: "webhook_verify_failed", reason: "missing_iat" });
      return false;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds - iat > 300) {
      console.error({ msg: "webhook_verify_failed", reason: "iat_too_old", iat, now: nowSeconds, delta: nowSeconds - iat });
      return false;
    }

    // Step 7: Constant-time comparison of SHA-256(rawBody) against request_body_sha256 claim.
    const claimedHash = payload["request_body_sha256"];
    if (typeof claimedHash !== "string") {
      console.error({ msg: "webhook_verify_failed", reason: "missing_request_body_sha256" });
      return false;
    }

    const computedHashHex = createHash("sha256").update(rawBody, "utf8").digest("hex");

    // timingSafeEqual requires equal-length buffers.
    const computedBuf = Buffer.from(computedHashHex, "hex");
    const claimedBuf = Buffer.from(claimedHash, "hex");
    if (computedBuf.length !== claimedBuf.length) {
      console.error({ msg: "webhook_verify_failed", reason: "body_hash_length_mismatch" });
      return false;
    }
    if (!timingSafeEqual(computedBuf, claimedBuf)) {
      console.error({ msg: "webhook_verify_failed", reason: "body_hash_mismatch" });
      return false;
    }

    // Step 8: All steps passed.
    return true;
  } catch (err) {
    // Step 9: Never throw to the caller. Log loudly so broken verification is visible.
    console.error({ msg: "webhook_verify_unexpected_error", err });
    return false;
  }
}
