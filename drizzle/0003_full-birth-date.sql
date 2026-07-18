ALTER TABLE "users" DROP CONSTRAINT "users_birth_year_positive";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_birth_month_valid";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birth_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "birth_year";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "birth_month";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_birth_date_valid" CHECK ("users"."birth_date" between date '1900-01-01' and current_date);
