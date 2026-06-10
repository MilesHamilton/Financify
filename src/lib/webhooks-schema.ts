import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared fields present on every Plaid webhook
// ---------------------------------------------------------------------------

const plaidEnvironment = z.enum(["sandbox", "production"]);

// ---------------------------------------------------------------------------
// TRANSACTIONS webhooks
// ---------------------------------------------------------------------------

export const syncUpdatesAvailableSchema = z
  .object({
    webhook_type: z.literal("TRANSACTIONS"),
    webhook_code: z.literal("SYNC_UPDATES_AVAILABLE"),
    item_id: z.string(),
    initial_update_complete: z.boolean(),
    historical_update_complete: z.boolean(),
    environment: plaidEnvironment,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// ITEM webhooks
// ---------------------------------------------------------------------------

// Plaid error object — only the fields we act on; passthrough for the rest
const plaidErrorSchema = z
  .object({
    error_type: z.string(),
    error_code: z.string(),
    error_message: z.string().optional(),
    display_message: z.string().nullable().optional(),
    request_id: z.string().optional(),
  })
  .passthrough();

export const itemErrorSchema = z
  .object({
    webhook_type: z.literal("ITEM"),
    webhook_code: z.literal("ERROR"),
    item_id: z.string(),
    error: plaidErrorSchema,
    environment: plaidEnvironment,
  })
  .passthrough();

export const itemLoginRepairedSchema = z
  .object({
    webhook_type: z.literal("ITEM"),
    webhook_code: z.literal("LOGIN_REPAIRED"),
    item_id: z.string(),
    environment: plaidEnvironment,
  })
  .passthrough();

export const itemPendingDisconnectSchema = z
  .object({
    webhook_type: z.literal("ITEM"),
    webhook_code: z.literal("PENDING_DISCONNECT"),
    item_id: z.string(),
    reason: z
      .enum(["INSTITUTION_MIGRATION", "INSTITUTION_TOKEN_EXPIRATION"])
      .optional(),
    environment: plaidEnvironment,
  })
  .passthrough();

export const itemUserPermissionRevokedSchema = z
  .object({
    webhook_type: z.literal("ITEM"),
    webhook_code: z.literal("USER_PERMISSION_REVOKED"),
    item_id: z.string(),
    environment: plaidEnvironment,
  })
  .passthrough();

export const itemNewAccountsAvailableSchema = z
  .object({
    webhook_type: z.literal("ITEM"),
    webhook_code: z.literal("NEW_ACCOUNTS_AVAILABLE"),
    item_id: z.string(),
    environment: plaidEnvironment,
  })
  .passthrough();

export const itemWebhookUpdateAcknowledgedSchema = z
  .object({
    webhook_type: z.literal("ITEM"),
    webhook_code: z.literal("WEBHOOK_UPDATE_ACKNOWLEDGED"),
    item_id: z.string(),
    environment: plaidEnvironment,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// LINK webhooks
// ---------------------------------------------------------------------------

export const linkSessionFinishedSchema = z
  .object({
    webhook_type: z.literal("LINK"),
    webhook_code: z.literal("SESSION_FINISHED"),
    link_session_id: z.string(),
    link_token: z.string(),
    status: z.string(),
    // public_tokens is present when status === 'SUCCESS'; Plaid sends an array
    public_tokens: z.array(z.string()).optional(),
    environment: plaidEnvironment,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Catch-all for unrecognized webhook_type / webhook_code combinations
// ---------------------------------------------------------------------------

export const unknownWebhookSchema = z
  .object({
    webhook_type: z.string(),
    webhook_code: z.string(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Combined discriminated union and parseWebhook helper
// ---------------------------------------------------------------------------

// We tag each variant with a `kind` discriminator so the caller can switch on
// a single string rather than the (webhook_type, webhook_code) pair.

const taggedSyncUpdatesAvailable = syncUpdatesAvailableSchema.transform(
  (v) => ({ kind: "sync_updates_available" as const, ...v })
);

const taggedItemError = itemErrorSchema.transform((v) => ({
  kind: "item_error" as const,
  ...v,
}));

const taggedItemLoginRepaired = itemLoginRepairedSchema.transform((v) => ({
  kind: "item_login_repaired" as const,
  ...v,
}));

const taggedItemPendingDisconnect = itemPendingDisconnectSchema.transform(
  (v) => ({ kind: "item_pending_disconnect" as const, ...v })
);

const taggedItemUserPermissionRevoked =
  itemUserPermissionRevokedSchema.transform((v) => ({
    kind: "item_user_permission_revoked" as const,
    ...v,
  }));

const taggedItemNewAccountsAvailable =
  itemNewAccountsAvailableSchema.transform((v) => ({
    kind: "item_new_accounts_available" as const,
    ...v,
  }));

const taggedItemWebhookUpdateAcknowledged =
  itemWebhookUpdateAcknowledgedSchema.transform((v) => ({
    kind: "item_webhook_update_acknowledged" as const,
    ...v,
  }));

const taggedLinkSessionFinished = linkSessionFinishedSchema.transform((v) => ({
  kind: "link_session_finished" as const,
  ...v,
}));

const taggedUnknownWebhook = unknownWebhookSchema.transform((v) => ({
  kind: "unknown" as const,
  ...v,
}));

// The ordered union — specific schemas first, catch-all last
const webhookUnion = z.union([
  taggedSyncUpdatesAvailable,
  taggedItemError,
  taggedItemLoginRepaired,
  taggedItemPendingDisconnect,
  taggedItemUserPermissionRevoked,
  taggedItemNewAccountsAvailable,
  taggedItemWebhookUpdateAcknowledged,
  taggedLinkSessionFinished,
  taggedUnknownWebhook,
]);

// ---------------------------------------------------------------------------
// Inferred types (use these in the webhook route handler)
// ---------------------------------------------------------------------------

export type SyncUpdatesAvailableWebhook = z.infer<
  typeof taggedSyncUpdatesAvailable
>;
export type ItemErrorWebhook = z.infer<typeof taggedItemError>;
export type ItemLoginRepairedWebhook = z.infer<typeof taggedItemLoginRepaired>;
export type ItemPendingDisconnectWebhook = z.infer<
  typeof taggedItemPendingDisconnect
>;
export type ItemUserPermissionRevokedWebhook = z.infer<
  typeof taggedItemUserPermissionRevoked
>;
export type ItemNewAccountsAvailableWebhook = z.infer<
  typeof taggedItemNewAccountsAvailable
>;
export type ItemWebhookUpdateAcknowledgedWebhook = z.infer<
  typeof taggedItemWebhookUpdateAcknowledged
>;
export type LinkSessionFinishedWebhook = z.infer<
  typeof taggedLinkSessionFinished
>;
export type UnknownWebhook = z.infer<typeof taggedUnknownWebhook>;

export type PlaidWebhook = z.infer<typeof webhookUnion>;

// ---------------------------------------------------------------------------
// parseWebhook — the single entry point used by the webhook route handler
//
// Never throws: unrecognized codes fall through to the `unknown` variant.
// Parse errors on known codes surface as a thrown ZodError (caller should
// return 400 and log them — malformed verified payloads are worth noise).
// ---------------------------------------------------------------------------

export function parseWebhook(json: unknown): PlaidWebhook {
  return webhookUnion.parse(json);
}
