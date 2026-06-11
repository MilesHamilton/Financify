/**
 * Safe error serialization for logging.
 *
 * NEVER log a raw thrown error from a Plaid SDK call. Plaid uses axios, and an
 * AxiosError carries `config.data` (the request body — which for many calls is
 * the plaintext access_token) and `config.headers` (PLAID-CLIENT-ID +
 * PLAID-SECRET). `console.error(obj)` serializes with util.inspect, which would
 * print those secrets to stderr → the Vercel log drain. This helper whitelists
 * only non-sensitive fields, so it is the single sanctioned way to log any
 * caught error in server code.
 */

type PlaidErrorBody = {
  error_code?: string;
  error_type?: string;
  request_id?: string;
  display_message?: string;
};

/**
 * Returns a plain object containing only safe, non-sensitive fields extracted
 * from an unknown thrown value. Crucially, it never references `.config` or any
 * other field that could carry credentials.
 */
export function errInfo(err: unknown): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};

  if (err instanceof Error) {
    out.name = err.name;
    out.message = err.message;
  } else {
    out.message = String(err);
  }

  // Plaid error responses live at err.response.data and contain only Plaid's
  // own error codes (no secrets). Safe to surface for debugging.
  const data = (err as { response?: { data?: PlaidErrorBody } })?.response?.data;
  if (data && typeof data === "object") {
    out.error_code = data.error_code;
    out.error_type = data.error_type;
    out.request_id = data.request_id;
    out.display_message = data.display_message;
  }

  return out;
}
