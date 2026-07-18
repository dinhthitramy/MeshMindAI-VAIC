import { readFileSync } from "node:fs";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  agentCitations,
  agentCitationSupportStatus,
  agentRuns,
  agentRunStatus,
  agentSources,
  agentToolCalls,
  chatMessages,
  chatMessageStatus,
  chatSessions,
} from "@/lib/db/schema";

function indexConfig(table: Parameters<typeof getTableConfig>[0], name: string) {
  const index = getTableConfig(table).indexes.find(
    (candidate) => candidate.config.name === name,
  );

  expect(index, `Missing index ${name}`).toBeDefined();
  return index!.config;
}

function indexColumnName(
  column: ReturnType<typeof indexConfig>["columns"][number],
) {
  return "name" in column ? column.name : undefined;
}

describe("agent lifecycle database schema", () => {
  it("keeps existing messages completed and exposes lifecycle statuses", () => {
    expect(chatMessages.status.default).toBe("completed");
    expect(chatMessages.status.notNull).toBe(true);
    expect(chatMessages.clientRequestId.notNull).toBe(false);
    expect(chatMessages.dataClasses.notNull).toBe(true);
    expect(chatMessages.dataClasses.hasDefault).toBe(true);
    expect(agentRuns.dataClasses.notNull).toBe(true);
    expect(agentRuns.dataClasses.hasDefault).toBe(true);
    expect(chatMessageStatus.enumValues).toEqual([
      "pending",
      "streaming",
      "completed",
      "cancelled",
      "failed",
    ]);
    expect(agentRunStatus.enumValues).toEqual([
      "pending",
      "running",
      "completed",
      "cancelled",
      "failed",
    ]);
    expect(agentCitationSupportStatus.enumValues).toEqual([
      "supported",
      "unsupported",
    ]);
  });

  it("creates provenance columns with public defaults and constraints", () => {
    const migration = readFileSync(
      new URL("../../drizzle/0006_hot_post.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain('CREATE TABLE "agent_runs"');
    expect(migration).toContain(
      '"data_classes" jsonb DEFAULT \'["public"]\'::jsonb NOT NULL',
    );
    expect(migration).toContain(
      'ALTER TABLE "chat_messages" ADD COLUMN "data_classes" jsonb DEFAULT \'["public"]\'::jsonb NOT NULL;',
    );
    expect(migration).toContain('CONSTRAINT "agent_runs_data_classes_valid"');
    expect(migration).toContain(
      'CONSTRAINT "chat_messages_data_classes_valid"',
    );
  });

  it("enforces request idempotency and one active run per session", () => {
    const requestIndex = indexConfig(
      agentRuns,
      "agent_runs_user_client_request_unique",
    );
    const activeRunIndex = indexConfig(
      agentRuns,
      "agent_runs_session_active_unique",
    );

    expect(requestIndex.unique).toBe(true);
    expect(requestIndex.columns.map(indexColumnName)).toEqual([
      "user_id",
      "client_request_id",
    ]);
    expect(activeRunIndex.unique).toBe(true);
    expect(activeRunIndex.columns.map(indexColumnName)).toEqual([
      "session_id",
    ]);
    expect(activeRunIndex.where).toBeDefined();
  });

  it("enforces composite ownership and run isolation", () => {
    expect(indexConfig(chatSessions, "chat_sessions_id_user_unique").unique).toBe(
      true,
    );
    expect(
      indexConfig(chatMessages, "chat_messages_id_session_unique").unique,
    ).toBe(true);
    expect(
      indexConfig(agentSources, "agent_sources_id_run_unique").unique,
    ).toBe(true);
    expect(agentCitations.runId.notNull).toBe(true);

    const runForeignKeys = getTableConfig(agentRuns).foreignKeys.map((foreignKey) =>
      foreignKey.getName(),
    );
    expect(runForeignKeys).toContain(
      "agent_runs_session_user_chat_sessions_id_user_fk",
    );
    expect(runForeignKeys).toContain(
      "agent_runs_user_message_session_chat_messages_id_session_fk",
    );
    expect(runForeignKeys).toContain(
      "agent_runs_assistant_message_session_chat_messages_id_session_fk",
    );

    const citationForeignKeys = getTableConfig(agentCitations).foreignKeys.map(
      (foreignKey) => foreignKey.getName(),
    );
    expect(citationForeignKeys).toEqual(
      expect.arrayContaining([
        "agent_citations_source_run_agent_sources_id_run_fk",
        "agent_citations_message_run_agent_runs_assistant_message_id_run_fk",
      ]),
    );
  });

  it("keeps source UUIDs internal and source keys unique within each run", () => {
    expect(agentSources.id.columnType).toBe("PgUUID");
    expect(agentSources.id.hasDefault).toBe(true);
    expect(agentSources.sourceKey.columnType).toBe("PgText");
    expect(agentSources.sourceKey.notNull).toBe(true);

    const sourceKeyIndex = indexConfig(
      agentSources,
      "agent_sources_run_source_key_unique",
    );
    expect(sourceKeyIndex.unique).toBe(true);
    expect(sourceKeyIndex.columns.map(indexColumnName)).toEqual([
      "run_id",
      "source_key",
    ]);
  });

  it("creates required source keys in the unified agent migration", () => {
    const migration = readFileSync(
      new URL("../../drizzle/0006_hot_post.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain('"source_key" text NOT NULL');
  });

  it.each([
    [agentRuns, 4],
    [agentToolCalls, 1],
    [agentSources, 1],
    [agentCitations, 2],
  ] as const)("cascades all foreign keys owned by %s", (table, count) => {
    const foreignKeys = getTableConfig(table).foreignKeys;

    expect(foreignKeys).toHaveLength(count);
    expect(foreignKeys.every((foreignKey) => foreignKey.onDelete === "cascade"))
      .toBe(true);
  });
});
