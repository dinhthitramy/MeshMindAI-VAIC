ALTER TABLE "oauth_accounts" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "refresh_token" text;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;