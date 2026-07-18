"use server";

import { desc, eq, and } from "drizzle-orm";

import { requireViewer } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { chatSessions, chatMessages, type ChatSession, type ChatMessage } from "@/lib/db/schema";
import { AVAILABLE_MODELS } from "@/lib/ai";

export async function getAvailableModelsAction() {
  return AVAILABLE_MODELS;
}

export async function getSessionsAction(): Promise<ChatSession[]> {
  const viewer = await requireViewer();
  if (viewer.actor.kind !== "user") return [];

  const db = getDb();
  return db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, viewer.actor.userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(50);
}

export async function createSessionAction(model: string): Promise<ChatSession> {
  const viewer = await requireViewer();
  if (viewer.actor.kind !== "user") throw new Error("Forbidden");

  const db = getDb();
  const [session] = await db
    .insert(chatSessions)
    .values({ userId: viewer.actor.userId, title: "New Chat", model })
    .returning();

  return session;
}

export async function loadMessagesAction(sessionId: string): Promise<ChatMessage[]> {
  const viewer = await requireViewer();
  if (viewer.actor.kind !== "user") return [];

  const db = getDb();

  // Verify ownership
  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, viewer.actor.userId)),
    )
    .limit(1);

  if (!session) return [];

  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
}

export async function deleteSessionAction(sessionId: string): Promise<void> {
  const viewer = await requireViewer();
  if (viewer.actor.kind !== "user") throw new Error("Forbidden");

  const db = getDb();
  await db
    .delete(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, viewer.actor.userId)),
    );
}
