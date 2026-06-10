CREATE TABLE "account_balance_snapshots" (
	"account_id" text NOT NULL,
	"as_of_date" date NOT NULL,
	"current_balance" numeric(14, 2),
	"available_balance" numeric(14, 2),
	"credit_limit" numeric(14, 2),
	CONSTRAINT "account_balance_snapshots_account_id_as_of_date_pk" PRIMARY KEY("account_id","as_of_date")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"name" text NOT NULL,
	"official_name" text,
	"mask" text,
	"type" text NOT NULL,
	"subtype" text,
	"current_balance" numeric(14, 2),
	"available_balance" numeric(14, 2),
	"credit_limit" numeric(14, 2),
	"iso_currency_code" text DEFAULT 'USD' NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"effective_month" date NOT NULL,
	CONSTRAINT "budgets_amount_check" CHECK ("budgets"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"group" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "categories_group_check" CHECK ("categories"."group" IN ('expense','income','transfer'))
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"merchant_entity_id" text,
	"merchant_name_like" text,
	"account_id" text,
	"pfc_detailed" text,
	"pfc_primary" text,
	"amount_min" numeric(14, 2),
	"amount_max" numeric(14, 2),
	"set_category_id" text,
	"set_excluded" boolean,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token_enc" text NOT NULL,
	"institution_id" text NOT NULL,
	"institution_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sync_status" text DEFAULT 'IDLE' NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"resync_requested" boolean DEFAULT false NOT NULL,
	"transactions_cursor" text,
	"initial_update_complete" boolean DEFAULT false NOT NULL,
	"historical_update_complete" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_status_check" CHECK ("items"."status" IN ('active','login_required','pending_disconnect','revoked')),
	CONSTRAINT "items_sync_status_check" CHECK ("items"."sync_status" IN ('IDLE','SYNCING'))
);
--> statement-breakpoint
CREATE TABLE "plaid_category_map" (
	"pfc_detailed" text PRIMARY KEY NOT NULL,
	"pfc_primary" text NOT NULL,
	"category_id" text NOT NULL,
	"exclude_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"item_id" text,
	"kind" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"iso_currency_code" text DEFAULT 'USD' NOT NULL,
	"date" date NOT NULL,
	"datetime" timestamp with time zone,
	"authorized_date" date,
	"pending" boolean DEFAULT false NOT NULL,
	"pending_transaction_id" text,
	"name" text NOT NULL,
	"merchant_name" text,
	"merchant_entity_id" text,
	"logo_url" text,
	"website" text,
	"payment_channel" text,
	"pfc_primary" text,
	"pfc_detailed" text,
	"pfc_confidence" text,
	"pfc_icon_url" text,
	"category_id" text DEFAULT 'uncategorized' NOT NULL,
	"category_source" text DEFAULT 'plaid' NOT NULL,
	"is_excluded" boolean DEFAULT false NOT NULL,
	"note" text,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_category_source_check" CHECK ("transactions"."category_source" IN ('plaid','rule','user'))
);
--> statement-breakpoint
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_set_category_id_categories_id_fk" FOREIGN KEY ("set_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_category_map" ADD CONSTRAINT "plaid_category_map_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_category_month_uniq" ON "budgets" USING btree ("category_id","effective_month");--> statement-breakpoint
CREATE INDEX "rules_priority" ON "category_rules" USING btree ("priority") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "sync_events_item_time" ON "sync_events" USING btree ("item_id","created_at" DESC NULLS LAST) WHERE item_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tx_date_idx" ON "transactions" USING btree ("date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tx_account_date" ON "transactions" USING btree ("account_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tx_category_date" ON "transactions" USING btree ("category_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tx_merchant_entity" ON "transactions" USING btree ("merchant_entity_id") WHERE merchant_entity_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tx_pending_link" ON "transactions" USING btree ("pending_transaction_id") WHERE pending_transaction_id IS NOT NULL;