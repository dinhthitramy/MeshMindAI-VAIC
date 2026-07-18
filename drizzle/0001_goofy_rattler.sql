CREATE TABLE "personality_test_results" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"result_type" text NOT NULL,
	"answers" jsonb NOT NULL,
	"scores" jsonb NOT NULL,
	"test_version" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personality_test_results_type_valid" CHECK ("personality_test_results"."result_type" in ('INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP')),
	CONSTRAINT "personality_test_results_version_positive" CHECK ("personality_test_results"."test_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "personality_test_results" ADD CONSTRAINT "personality_test_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personality_test_results_completed_at_idx" ON "personality_test_results" USING btree ("completed_at");