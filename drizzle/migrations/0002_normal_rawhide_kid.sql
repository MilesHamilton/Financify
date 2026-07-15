CREATE TABLE "recurring_streams" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"description" text NOT NULL,
	"merchant_name" text,
	"category" text,
	"frequency" text NOT NULL,
	"average_amount" numeric(14, 2) NOT NULL,
	"last_amount" numeric(14, 2),
	"last_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_bill" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'mature' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_streams_frequency_check" CHECK ("recurring_streams"."frequency" IN ('WEEKLY','BIWEEKLY','SEMI_MONTHLY','MONTHLY','ANNUALLY')),
	CONSTRAINT "recurring_streams_status_check" CHECK ("recurring_streams"."status" IN ('mature','early_detection','unknown'))
);
--> statement-breakpoint
ALTER TABLE "recurring_streams" ADD CONSTRAINT "recurring_streams_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_streams_active" ON "recurring_streams" USING btree ("is_active","is_bill");