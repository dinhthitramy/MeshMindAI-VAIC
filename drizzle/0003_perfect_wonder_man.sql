CREATE TYPE "public"."transcript_stage" AS ENUM('GRADE_10', 'GRADE_11', 'GRADE_12', 'CUMULATIVE');--> statement-breakpoint
CREATE TABLE "transcript_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"education_record_id" uuid NOT NULL,
	"stage" "transcript_stage" NOT NULL,
	"subject_name" text NOT NULL,
	"credits" double precision,
	"score" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcript_entries_score_nonnegative" CHECK ("transcript_entries"."score" >= 0),
	CONSTRAINT "transcript_entries_credits_positive" CHECK ("transcript_entries"."credits" is null or "transcript_entries"."credits" > 0)
);
--> statement-breakpoint
ALTER TABLE "education_records" RENAME COLUMN "scientific_research" TO "research_description";--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "start_month" integer;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "start_year" integer;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "end_month" integer;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "end_year" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "start_month" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "start_year" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "end_month" integer;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "end_year" integer;--> statement-breakpoint
ALTER TABLE "education_records" ADD COLUMN "start_month" integer;--> statement-breakpoint
ALTER TABLE "education_records" ADD COLUMN "start_year" integer;--> statement-breakpoint
ALTER TABLE "education_records" ADD COLUMN "end_month" integer;--> statement-breakpoint
ALTER TABLE "education_records" ADD COLUMN "end_year" integer;--> statement-breakpoint
ALTER TABLE "education_records" ADD COLUMN "score_scale" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "education_records" ADD COLUMN "research_title" text;--> statement-breakpoint
ALTER TABLE "profile_activities" ADD COLUMN "start_month" integer;--> statement-breakpoint
ALTER TABLE "profile_activities" ADD COLUMN "start_year" integer;--> statement-breakpoint
ALTER TABLE "profile_activities" ADD COLUMN "end_month" integer;--> statement-breakpoint
ALTER TABLE "profile_activities" ADD COLUMN "end_year" integer;--> statement-breakpoint
UPDATE "certificates" SET "start_month" = 1, "start_year" = "issued_year", "end_month" = 12, "end_year" = "issued_year";--> statement-breakpoint
UPDATE "competitions" SET "start_month" = 1, "start_year" = "year", "end_month" = 12, "end_year" = "year";--> statement-breakpoint
UPDATE "education_records" SET "start_month" = extract(month from "created_at")::integer, "start_year" = extract(year from "created_at")::integer, "end_month" = extract(month from "created_at")::integer, "end_year" = extract(year from "created_at")::integer;--> statement-breakpoint
UPDATE "profile_activities" SET "start_month" = extract(month from "created_at")::integer, "start_year" = extract(year from "created_at")::integer, "end_month" = extract(month from "created_at")::integer, "end_year" = extract(year from "created_at")::integer;--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "start_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "start_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "end_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "end_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "start_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "start_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "end_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ALTER COLUMN "end_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "education_records" ALTER COLUMN "start_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "education_records" ALTER COLUMN "start_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "education_records" ALTER COLUMN "end_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "education_records" ALTER COLUMN "end_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_activities" ALTER COLUMN "start_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_activities" ALTER COLUMN "start_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_activities" ALTER COLUMN "end_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_activities" ALTER COLUMN "end_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transcript_entries" ADD CONSTRAINT "transcript_entries_education_record_id_education_records_id_fk" FOREIGN KEY ("education_record_id") REFERENCES "public"."education_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_entries_subject_stage_unique" ON "transcript_entries" USING btree ("education_record_id","stage",lower("subject_name"));--> statement-breakpoint
CREATE INDEX "transcript_entries_education_record_id_idx" ON "transcript_entries" USING btree ("education_record_id");--> statement-breakpoint
ALTER TABLE "education_records" DROP COLUMN "transcript";--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_start_month_valid" CHECK ("certificates"."start_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_end_month_valid" CHECK ("certificates"."end_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_start_year_valid" CHECK ("certificates"."start_year" >= 1900);--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_end_year_valid" CHECK ("certificates"."end_year" >= 1900);--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_date_order_valid" CHECK (("certificates"."end_year", "certificates"."end_month") >= ("certificates"."start_year", "certificates"."start_month"));--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_start_month_valid" CHECK ("competitions"."start_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_end_month_valid" CHECK ("competitions"."end_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_start_year_valid" CHECK ("competitions"."start_year" >= 1900);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_end_year_valid" CHECK ("competitions"."end_year" >= 1900);--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_date_order_valid" CHECK (("competitions"."end_year", "competitions"."end_month") >= ("competitions"."start_year", "competitions"."start_month"));--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_start_month_valid" CHECK ("education_records"."start_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_end_month_valid" CHECK ("education_records"."end_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_start_year_valid" CHECK ("education_records"."start_year" >= 1900);--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_end_year_valid" CHECK ("education_records"."end_year" >= 1900);--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_date_order_valid" CHECK (("education_records"."end_year", "education_records"."end_month") >= ("education_records"."start_year", "education_records"."start_month"));--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_score_scale_valid" CHECK ("education_records"."score_scale" in (4, 10));--> statement-breakpoint
UPDATE "education_records" SET "research_title" = null, "research_description" = null WHERE "level" = 'HIGH_SCHOOL';--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_high_school_research_empty" CHECK ("education_records"."level" <> 'HIGH_SCHOOL' or ("education_records"."research_title" is null and "education_records"."research_description" is null));--> statement-breakpoint
ALTER TABLE "profile_activities" ADD CONSTRAINT "profile_activities_start_month_valid" CHECK ("profile_activities"."start_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "profile_activities" ADD CONSTRAINT "profile_activities_end_month_valid" CHECK ("profile_activities"."end_month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "profile_activities" ADD CONSTRAINT "profile_activities_start_year_valid" CHECK ("profile_activities"."start_year" >= 1900);--> statement-breakpoint
ALTER TABLE "profile_activities" ADD CONSTRAINT "profile_activities_end_year_valid" CHECK ("profile_activities"."end_year" >= 1900);--> statement-breakpoint
ALTER TABLE "profile_activities" ADD CONSTRAINT "profile_activities_date_order_valid" CHECK (("profile_activities"."end_year", "profile_activities"."end_month") >= ("profile_activities"."start_year", "profile_activities"."start_month"));
