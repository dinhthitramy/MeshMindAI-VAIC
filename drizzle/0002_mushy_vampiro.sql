CREATE TYPE "public"."education_level" AS ENUM('HIGH_SCHOOL', 'UNDERGRADUATE', 'GRADUATE');--> statement-breakpoint
CREATE TABLE "certificate_attachments" (
	"certificate_id" uuid PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_attachments_byte_size_positive" CHECK ("certificate_attachments"."byte_size" > 0),
	CONSTRAINT "certificate_attachments_byte_size_max" CHECK ("certificate_attachments"."byte_size" <= 5242880),
	CONSTRAINT "certificate_attachments_mime_type_valid" CHECK ("certificate_attachments"."mime_type" in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issued_year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_issued_year_valid" CHECK ("certificates"."issued_year" >= 1900)
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"award_name" text,
	"year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_year_valid" CHECK ("competitions"."year" >= 1900)
);
--> statement-breakpoint
CREATE TABLE "education_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level" "education_level" NOT NULL,
	"institution_name" text NOT NULL,
	"field_of_study" text,
	"transcript" text,
	"scientific_research" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workplace_name" text NOT NULL,
	"position" text,
	"start_month" integer NOT NULL,
	"start_year" integer NOT NULL,
	"end_month" integer,
	"end_year" integer,
	"is_current" boolean DEFAULT false NOT NULL,
	"learnings" text,
	"skills" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_experiences_start_month_valid" CHECK ("work_experiences"."start_month" between 1 and 12),
	CONSTRAINT "work_experiences_end_month_valid" CHECK ("work_experiences"."end_month" is null or "work_experiences"."end_month" between 1 and 12),
	CONSTRAINT "work_experiences_start_year_valid" CHECK ("work_experiences"."start_year" >= 1900),
	CONSTRAINT "work_experiences_end_year_valid" CHECK ("work_experiences"."end_year" is null or "work_experiences"."end_year" >= 1900),
	CONSTRAINT "work_experiences_end_date_consistent" CHECK (("work_experiences"."is_current" and "work_experiences"."end_month" is null and "work_experiences"."end_year" is null) or (not "work_experiences"."is_current" and "work_experiences"."end_month" is not null and "work_experiences"."end_year" is not null)),
	CONSTRAINT "work_experiences_date_order_valid" CHECK ("work_experiences"."is_current" or ("work_experiences"."end_year", "work_experiences"."end_month") >= ("work_experiences"."start_year", "work_experiences"."start_month"))
);
--> statement-breakpoint
ALTER TABLE "certificate_attachments" ADD CONSTRAINT "certificate_attachments_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_activities" ADD CONSTRAINT "profile_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificates_user_id_idx" ON "certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "competitions_user_id_idx" ON "competitions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "education_records_user_id_idx" ON "education_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "education_records_user_level_idx" ON "education_records" USING btree ("user_id","level");--> statement-breakpoint
CREATE INDEX "profile_activities_user_id_idx" ON "profile_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "work_experiences_user_id_idx" ON "work_experiences" USING btree ("user_id");
