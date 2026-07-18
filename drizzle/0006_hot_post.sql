CREATE TYPE "public"."agent_citation_support_status" AS ENUM('supported', 'unsupported');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('pending', 'running', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."agent_tool_call_status" AS ENUM('pending', 'running', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."chat_message_status" AS ENUM('pending', 'streaming', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TABLE "agent_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"quote" text NOT NULL,
	"support_status" "agent_citation_support_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_citations_ordinal_nonnegative" CHECK ("agent_citations"."ordinal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"client_request_id" text NOT NULL,
	"model" text NOT NULL,
	"force_web" boolean DEFAULT false NOT NULL,
	"status" "agent_run_status" DEFAULT 'pending' NOT NULL,
	"user_message_id" uuid NOT NULL,
	"assistant_message_id" uuid NOT NULL,
	"error_code" text,
	"error_message" text,
	"usage" jsonb,
	"data_classes" jsonb DEFAULT '["public"]'::jsonb NOT NULL,
	"tool_call_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_runs_distinct_messages" CHECK ("agent_runs"."user_message_id" <> "agent_runs"."assistant_message_id"),
	CONSTRAINT "agent_runs_tool_call_count_nonnegative" CHECK ("agent_runs"."tool_call_count" >= 0),
	CONSTRAINT "agent_runs_lifecycle_timestamps_valid" CHECK (("agent_runs"."status" = 'pending' and "agent_runs"."started_at" is null and "agent_runs"."finished_at" is null)
        or ("agent_runs"."status" = 'running' and "agent_runs"."started_at" is not null and "agent_runs"."finished_at" is null)
        or ("agent_runs"."status" in ('completed', 'cancelled', 'failed') and "agent_runs"."started_at" is not null and "agent_runs"."finished_at" is not null)),
	CONSTRAINT "agent_runs_error_valid" CHECK (("agent_runs"."status" = 'failed' and "agent_runs"."error_code" is not null and "agent_runs"."error_message" is not null)
        or ("agent_runs"."status" <> 'failed' and "agent_runs"."error_code" is null and "agent_runs"."error_message" is null)),
	CONSTRAINT "agent_runs_data_classes_valid" CHECK (jsonb_typeof("agent_runs"."data_classes") = 'array'
        and jsonb_array_length("agent_runs"."data_classes") > 0
        and "agent_runs"."data_classes" <@ '["public", "personal_data", "private_document"]'::jsonb)
);
--> statement-breakpoint
CREATE TABLE "agent_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"published_at" timestamp with time zone,
	"accessed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"call_id" text NOT NULL,
	"name" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"result" jsonb,
	"status" "agent_tool_call_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "agent_tool_calls_lifecycle_timestamps_valid" CHECK (("agent_tool_calls"."status" = 'pending' and "agent_tool_calls"."started_at" is null and "agent_tool_calls"."finished_at" is null)
        or ("agent_tool_calls"."status" = 'running' and "agent_tool_calls"."started_at" is not null and "agent_tool_calls"."finished_at" is null)
        or ("agent_tool_calls"."status" in ('completed', 'cancelled', 'failed') and "agent_tool_calls"."started_at" is not null and "agent_tool_calls"."finished_at" is not null)),
	CONSTRAINT "agent_tool_calls_error_valid" CHECK (("agent_tool_calls"."status" = 'failed' and "agent_tool_calls"."error_message" is not null)
        or ("agent_tool_calls"."status" <> 'failed' and "agent_tool_calls"."error_message" is null))
);
--> statement-breakpoint
DROP INDEX "chat_messages_session_id_idx";--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "status" "chat_message_status" DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "data_classes" jsonb DEFAULT '["public"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "client_request_id" text;--> statement-breakpoint
ALTER TABLE "agent_citations" ADD CONSTRAINT "agent_citations_source_run_agent_sources_id_run_fk" FOREIGN KEY ("source_id","run_id") REFERENCES "public"."agent_sources"("id","run_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_citations" ADD CONSTRAINT "agent_citations_message_run_agent_runs_assistant_message_id_run_fk" FOREIGN KEY ("message_id","run_id") REFERENCES "public"."agent_runs"("assistant_message_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_session_user_chat_sessions_id_user_fk" FOREIGN KEY ("session_id","user_id") REFERENCES "public"."chat_sessions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_message_session_chat_messages_id_session_fk" FOREIGN KEY ("user_message_id","session_id") REFERENCES "public"."chat_messages"("id","session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_assistant_message_session_chat_messages_id_session_fk" FOREIGN KEY ("assistant_message_id","session_id") REFERENCES "public"."chat_messages"("id","session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sources" ADD CONSTRAINT "agent_sources_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_citations_message_ordinal_unique" ON "agent_citations" USING btree ("message_id","ordinal");--> statement-breakpoint
CREATE INDEX "agent_citations_run_id_idx" ON "agent_citations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_citations_source_id_idx" ON "agent_citations" USING btree ("source_id","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_user_client_request_unique" ON "agent_runs" USING btree ("user_id","client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_assistant_message_id_run_unique" ON "agent_runs" USING btree ("assistant_message_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_session_active_unique" ON "agent_runs" USING btree ("session_id") WHERE "agent_runs"."status" in ('pending', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_user_message_unique" ON "agent_runs" USING btree ("user_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_assistant_message_unique" ON "agent_runs" USING btree ("assistant_message_id");--> statement-breakpoint
CREATE INDEX "agent_runs_user_created_at_idx" ON "agent_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runs_session_created_at_idx" ON "agent_runs" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sources_id_run_unique" ON "agent_sources" USING btree ("id","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sources_run_source_key_unique" ON "agent_sources" USING btree ("run_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sources_run_url_hash_unique" ON "agent_sources" USING btree ("run_id","url_hash");--> statement-breakpoint
CREATE INDEX "agent_sources_run_id_idx" ON "agent_sources" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tool_calls_run_call_unique" ON "agent_tool_calls" USING btree ("run_id","call_id");--> statement-breakpoint
CREATE INDEX "agent_tool_calls_run_id_idx" ON "agent_tool_calls" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_id_session_unique" ON "chat_messages" USING btree ("id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_session_client_request_unique" ON "chat_messages" USING btree ("session_id","client_request_id") WHERE "chat_messages"."client_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_sessions_id_user_unique" ON "chat_sessions" USING btree ("id","user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id","created_at","id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_data_classes_valid" CHECK (jsonb_typeof("chat_messages"."data_classes") = 'array'
        and jsonb_array_length("chat_messages"."data_classes") > 0
        and "chat_messages"."data_classes" <@ '["public", "personal_data", "private_document"]'::jsonb);