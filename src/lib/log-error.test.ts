import { describe, it, expect } from "vitest";
import { errInfo } from "./log-error";

describe("errInfo", () => {
  it("never leaks AxiosError config (access_token / PLAID-SECRET)", () => {
    // Shape of a real Plaid AxiosError: config.data carries the request body
    // (plaintext access_token), config.headers carries PLAID-SECRET.
    const axiosErr = Object.assign(new Error("Request failed with status code 400"), {
      name: "AxiosError",
      config: {
        data: JSON.stringify({ access_token: "access-production-SUPERSECRET" }),
        headers: { "PLAID-SECRET": "plaid-secret-LEAK", "PLAID-CLIENT-ID": "cid" },
      },
      response: { data: { error_code: "ITEM_LOGIN_REQUIRED", error_type: "ITEM_ERROR", request_id: "req_123" } },
    });
    const safe = errInfo(axiosErr);
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain("SUPERSECRET");
    expect(serialized).not.toContain("plaid-secret-LEAK");
    expect(serialized).not.toContain("access_token");
    // but keeps the useful Plaid error fields
    expect(safe.error_code).toBe("ITEM_LOGIN_REQUIRED");
    expect(safe.request_id).toBe("req_123");
    expect(safe.message).toBe("Request failed with status code 400");
  });

  it("handles plain errors and non-errors", () => {
    expect(errInfo(new Error("boom")).message).toBe("boom");
    expect(errInfo("string error").message).toBe("string error");
  });
});
