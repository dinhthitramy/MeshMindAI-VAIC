ALTER TABLE "agent_sources" ADD COLUMN "source_key" text;--> statement-breakpoint
UPDATE "agent_sources" SET "source_key" = "id"::text;--> statement-breakpoint
ALTER TABLE "agent_sources" ALTER COLUMN "source_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sources_run_source_key_unique" ON "agent_sources" USING btree ("run_id","source_key");
