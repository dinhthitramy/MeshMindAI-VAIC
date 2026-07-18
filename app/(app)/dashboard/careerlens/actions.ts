"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";

import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/ai";
import { generateCareerGuidance, type CareerGuidanceOutput } from "@/lib/careerlens";
import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  buildCareerGuidanceInput,
  careerLensFormSchema,
  careerLensStoredFormSchema,
  type CareerLensStoredFormValues,
} from "@/lib/careerlens/form";
import { getPreferredCareerModel } from "@/lib/careerlens/preferences";
import {
  saveCareerRoadmap,
  selectCareerRoadmapRecommendation,
} from "@/lib/careerlens/roadmaps";
import { getCareerStartingPointSnapshot } from "@/lib/careerlens/starting-point";

export type CareerLensActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  output?: CareerGuidanceOutput;
  roadmapId?: string;
  selectedRecommendationIndex?: number;
  formValues?: CareerLensStoredFormValues;
};

const roadmapIdSchema = z.string().uuid().optional();

export async function generateCareerPlanAction(
  _previousState: CareerLensActionState,
  formData: FormData,
): Promise<CareerLensActionState> {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  const [t, locale] = await Promise.all([getTranslations("Roadmap"), getLocale()]);

  if (viewer.actor.kind !== "user") {
    return {
      status: "error",
      message: t("actions.userOnly"),
    };
  }

  const parsed = careerLensFormSchema.safeParse({
    educationLevel: formData.get("educationLevel"),
    currentRegion: formData.get("currentRegion"),
    targetRegion: formData.get("targetRegion"),
    languages: formData.get("languages"),
    strongSubject: formData.get("strongSubject"),
    subjectScore: formData.get("subjectScore"),
    interests: formData.get("interests"),
    activity: formData.get("activity"),
    weeklyHours: formData.get("weeklyHours"),
    targetBudget: formData.get("targetBudget"),
    workEnvironment: formData.get("workEnvironment"),
    learningStyle: formData.get("learningStyle"),
    familyConstraints: formData.get("familyConstraints"),
    intent: formData.get("intent"),
    question: formData.get("question"),
    consent: formData.get("consent"),
  });

  if (!parsed.success) {
    const invalidFields = parsed.error.flatten().fieldErrors;
    const fieldMessages: Record<string, string> = {
      activity: t("actions.fields.activity"),
      consent: t("actions.fields.consent"),
      currentRegion: t("actions.fields.currentRegion"),
      educationLevel: t("actions.fields.educationLevel"),
      familyConstraints: t("actions.fields.familyConstraints"),
      interests: t("actions.fields.interests"),
      intent: t("actions.fields.intent"),
      languages: t("actions.fields.languages"),
      learningStyle: t("actions.fields.learningStyle"),
      question: t("actions.fields.question"),
      strongSubject: t("actions.fields.strongSubject"),
      subjectScore: t("actions.fields.subjectScore"),
      targetBudget: t("actions.fields.targetBudget"),
      targetRegion: t("actions.fields.targetRegion"),
      weeklyHours: t("actions.fields.weeklyHours"),
      workEnvironment: t("actions.fields.workEnvironment"),
    };

    return {
      status: "error",
      message: t("actions.checkFields"),
      fieldErrors: Object.fromEntries(
        Object.keys(invalidFields).map((field) => [
          field,
          [fieldMessages[field] ?? t("actions.invalidValue")],
        ]),
      ),
    };
  }

  const parsedRoadmapId = roadmapIdSchema.safeParse(
    formData.get("roadmapId") || undefined,
  );
  if (!parsedRoadmapId.success) {
    return {
      status: "error",
      message: t("actions.invalidValue"),
    };
  }

  const [startingPoint, savedModel] = await Promise.all([
    getCareerStartingPointSnapshot(viewer.actor.userId),
    getPreferredCareerModel(viewer.actor.userId),
  ]);
  const model = AVAILABLE_MODELS.includes(savedModel)
    ? savedModel
    : DEFAULT_MODEL;

  const input = buildCareerGuidanceInput(
    parsed.data,
    viewer.actor.userId,
    locale === "en" ? "en" : "vi",
    startingPoint,
  );

  try {
    const output = await generateCareerGuidance(input, {
      model,
      userId: viewer.actor.userId,
    });
    const { consent: _consent, ...rawStoredValues } = parsed.data;
    void _consent;
    const formValues = careerLensStoredFormSchema.parse(rawStoredValues);
    const roadmapId = await saveCareerRoadmap({
      roadmapId: parsedRoadmapId.data,
      userId: viewer.actor.userId,
      formValues,
      guidanceInput: input,
      guidanceOutput: output,
    });

    revalidatePath("/dashboard/careerlens");

    return {
      status: "success",
      message: t("actions.success"),
      output,
      roadmapId,
      selectedRecommendationIndex: 0,
      formValues,
    };
  } catch (error) {
    console.error("CareerLens plan generation failed", {
      userId: viewer.actor.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      status: "error",
      message: t("actions.failed"),
    };
  }
}

export async function selectCareerRecommendationAction(formData: FormData) {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (viewer.actor.kind !== "user") return;

  const parsed = z
    .object({
      roadmapId: z.string().uuid(),
      recommendationIndex: z.coerce.number().int().min(0).max(9),
    })
    .safeParse({
      roadmapId: formData.get("roadmapId"),
      recommendationIndex: formData.get("recommendationIndex"),
    });
  if (!parsed.success) return;

  await selectCareerRoadmapRecommendation({
    roadmapId: parsed.data.roadmapId,
    userId: viewer.actor.userId,
    recommendationIndex: parsed.data.recommendationIndex,
  });
  revalidatePath("/dashboard/careerlens");
  redirect("/dashboard/careerlens");
}
