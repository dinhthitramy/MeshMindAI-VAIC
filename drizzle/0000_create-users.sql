CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"salt" text NOT NULL,
	"birth_year" smallint NOT NULL,
	"birth_month" smallint NOT NULL,
	CONSTRAINT "users_birth_year_positive" CHECK ("users"."birth_year" > 0),
	CONSTRAINT "users_birth_month_valid" CHECK ("users"."birth_month" between 1 and 12)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));