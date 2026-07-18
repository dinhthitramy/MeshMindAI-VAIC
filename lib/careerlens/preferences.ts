import "server-only";

import { eq } from "drizzle-orm";

import { DEFAULT_MODEL } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";

export async function getPreferredCareerModel(userId: string) {
  const [preference] = await getDb()
    .select({ model: userPreferences.preferredCareerModel })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return preference?.model ?? DEFAULT_MODEL;
}

export async function savePreferredCareerModel(userId: string, model: string) {
  await getDb()
    .insert(userPreferences)
    .values({
      userId,
      preferredCareerModel: model,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        preferredCareerModel: model,
        updatedAt: new Date(),
      },
    });
}
