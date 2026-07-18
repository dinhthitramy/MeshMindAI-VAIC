ALTER TABLE "agent_citations" DROP CONSTRAINT "agent_citations_source_id_agent_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_citations" DROP CONSTRAINT "agent_citations_message_id_chat_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_session_id_chat_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_user_message_id_chat_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_assistant_message_id_chat_messages_id_fk";
--> statement-breakpoint
DROP INDEX "agent_citations_source_id_idx";--> statement-breakpoint
ALTER TABLE "agent_citations" ADD COLUMN "run_id" uuid;--> statement-breakpoint
UPDATE "agent_citations" SET "run_id" = "agent_sources"."run_id"
FROM "agent_sources" WHERE "agent_citations"."source_id" = "agent_sources"."id";--> statement-breakpoint
ALTER TABLE "agent_citations" ALTER COLUMN "run_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_assistant_message_id_run_unique" ON "agent_runs" USING btree ("assistant_message_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sources_id_run_unique" ON "agent_sources" USING btree ("id","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_id_session_unique" ON "chat_messages" USING btree ("id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_sessions_id_user_unique" ON "chat_sessions" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "agent_citations" ADD CONSTRAINT "agent_citations_source_run_agent_sources_id_run_fk" FOREIGN KEY ("source_id","run_id") REFERENCES "public"."agent_sources"("id","run_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_citations" ADD CONSTRAINT "agent_citations_message_run_agent_runs_assistant_message_id_run_fk" FOREIGN KEY ("message_id","run_id") REFERENCES "public"."agent_runs"("assistant_message_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_session_user_chat_sessions_id_user_fk" FOREIGN KEY ("session_id","user_id") REFERENCES "public"."chat_sessions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_message_session_chat_messages_id_session_fk" FOREIGN KEY ("user_message_id","session_id") REFERENCES "public"."chat_messages"("id","session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_assistant_message_session_chat_messages_id_session_fk" FOREIGN KEY ("assistant_message_id","session_id") REFERENCES "public"."chat_messages"("id","session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_citations_run_id_idx" ON "agent_citations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_citations_source_id_idx" ON "agent_citations" USING btree ("source_id","run_id");
