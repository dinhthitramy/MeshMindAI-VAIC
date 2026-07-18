ALTER TABLE "agent_runs" ADD COLUMN "data_classes" jsonb DEFAULT '["public"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "data_classes" jsonb DEFAULT '["public"]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "agent_runs" SET "data_classes" = '["private_document"]'::jsonb;--> statement-breakpoint
UPDATE "chat_messages" SET "data_classes" = '["private_document"]'::jsonb;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_data_classes_valid" CHECK (jsonb_typeof("agent_runs"."data_classes") = 'array'
        and jsonb_array_length("agent_runs"."data_classes") > 0
        and "agent_runs"."data_classes" <@ '["public", "personal_data", "private_document"]'::jsonb);--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_data_classes_valid" CHECK (jsonb_typeof("chat_messages"."data_classes") = 'array'
        and jsonb_array_length("chat_messages"."data_classes") > 0
        and "chat_messages"."data_classes" <@ '["public", "personal_data", "private_document"]'::jsonb);
