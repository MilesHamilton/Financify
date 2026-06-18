CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"monthly_savings_target" numeric(14, 2) DEFAULT '0' NOT NULL,
	"monthly_income_override" numeric(14, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_id_check" CHECK ("app_settings"."id" = 'app'),
	CONSTRAINT "app_settings_target_check" CHECK ("app_settings"."monthly_savings_target" >= 0)
);
