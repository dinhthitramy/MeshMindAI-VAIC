import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { careerRoadmaps } from "@/lib/db/schema";

import {
  careerLensStoredFormSchema,
  type CareerLensStoredFormValues,
} from "./form";
import {
  careerGuidanceInputSchema,
  careerGuidanceOutputSchema,
  type CareerGuidanceInput,
  type CareerGuidanceOutput,
} from "./schemas";

export type SavedCareerRoadmap = {
  id: string;
  title: string;
  formValues: CareerLensStoredFormValues;
  guidanceInput: CareerGuidanceInput;
  guidanceOutput: CareerGuidanceOutput;
  selectedRecommendationIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type CareerRoadmapSummary = Pick<
  SavedCareerRoadmap,
  "id" | "title" | "updatedAt"
>;

function parseRoadmap(
  row: typeof careerRoadmaps.$inferSelect,
): SavedCareerRoadmap {
  const guidanceOutput = careerGuidanceOutputSchema.parse(row.guidanceOutput);
  const selectedRecommendationIndex = guidanceOutput.recommendations[
    row.selectedRecommendationIndex
  ]
    ? row.selectedRecommendationIndex
    : 0;

  return {
    id: row.id,
    title: row.title,
    formValues: careerLensStoredFormSchema.parse(row.formValues),
    guidanceInput: careerGuidanceInputSchema.parse(row.guidanceInput),
    guidanceOutput,
    selectedRecommendationIndex,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getLatestCareerRoadmap(
  userId: string,
): Promise<SavedCareerRoadmap | null> {
  const [row] = await getDb()
    .select()
    .from(careerRoadmaps)
    .where(eq(careerRoadmaps.userId, userId))
    .orderBy(desc(careerRoadmaps.updatedAt))
    .limit(1);

  return row ? parseRoadmap(row) : null;
}

export async function getLatestCreatedCareerRoadmap(
  userId: string,
): Promise<SavedCareerRoadmap | null> {
  const [row] = await getDb()
    .select()
    .from(careerRoadmaps)
    .where(eq(careerRoadmaps.userId, userId))
    .orderBy(desc(careerRoadmaps.createdAt))
    .limit(1);

  return row ? parseRoadmap(row) : null;
}

export async function getCareerRoadmap(
  userId: string,
  roadmapId: string,
): Promise<SavedCareerRoadmap | null> {
  const parsedId = z.string().uuid().safeParse(roadmapId);
  if (!parsedId.success) return null;

  const [row] = await getDb()
    .select()
    .from(careerRoadmaps)
    .where(
      and(
        eq(careerRoadmaps.id, parsedId.data),
        eq(careerRoadmaps.userId, userId),
      ),
    )
    .limit(1);

  return row ? parseRoadmap(row) : null;
}

export async function getCareerRoadmapSummaries(
  userId: string,
): Promise<CareerRoadmapSummary[]> {
  const rows = await getDb()
    .select({
      id: careerRoadmaps.id,
      title: careerRoadmaps.title,
      updatedAt: careerRoadmaps.updatedAt,
    })
    .from(careerRoadmaps)
    .where(eq(careerRoadmaps.userId, userId))
    .orderBy(desc(careerRoadmaps.updatedAt))
    .limit(20);

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function saveCareerRoadmap({
  roadmapId,
  userId,
  formValues,
  guidanceInput,
  guidanceOutput,
}: {
  roadmapId?: string;
  userId: string;
  formValues: CareerLensStoredFormValues;
  guidanceInput: CareerGuidanceInput;
  guidanceOutput: CareerGuidanceOutput;
}) {
  const selectedRecommendationIndex = 0;
  const title =
    guidanceOutput.recommendations[selectedRecommendationIndex]?.path_title ??
    "Lộ trình hướng nghiệp";
  const values = {
    title,
    formValues,
    guidanceInput,
    guidanceOutput,
    selectedRecommendationIndex,
    updatedAt: new Date(),
  };

  if (roadmapId) {
    const [updated] = await getDb()
      .update(careerRoadmaps)
      .set(values)
      .where(
        and(
          eq(careerRoadmaps.id, roadmapId),
          eq(careerRoadmaps.userId, userId),
        ),
      )
      .returning({ id: careerRoadmaps.id });

    if (updated) return updated.id;
  }

  const [created] = await getDb()
    .insert(careerRoadmaps)
    .values({ userId, ...values })
    .returning({ id: careerRoadmaps.id });

  if (!created) throw new Error("Could not save career roadmap");
  return created.id;
}

export async function selectCareerRoadmapRecommendation({
  roadmapId,
  userId,
  recommendationIndex,
}: {
  roadmapId: string;
  userId: string;
  recommendationIndex: number;
}) {
  const [row] = await getDb()
    .select({ guidanceOutput: careerRoadmaps.guidanceOutput })
    .from(careerRoadmaps)
    .where(
      and(
        eq(careerRoadmaps.id, roadmapId),
        eq(careerRoadmaps.userId, userId),
      ),
    )
    .limit(1);

  if (!row) return false;
  const output = careerGuidanceOutputSchema.parse(row.guidanceOutput);
  const selected = output.recommendations[recommendationIndex];
  if (!selected) return false;

  const [updated] = await getDb()
    .update(careerRoadmaps)
    .set({
      selectedRecommendationIndex: recommendationIndex,
      title: selected.path_title,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(careerRoadmaps.id, roadmapId),
        eq(careerRoadmaps.userId, userId),
      ),
    )
    .returning({ id: careerRoadmaps.id });

  return Boolean(updated);
}
