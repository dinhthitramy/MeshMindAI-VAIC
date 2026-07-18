"use server";

import { getLocale, getTranslations } from "next-intl/server";

import { AVAILABLE_MODELS } from "@/lib/ai";
import { generateCareerGuidance, type CareerGuidanceOutput } from "@/lib/careerlens";
import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { buildCareerGuidanceInput, careerLensFormSchema } from "@/lib/careerlens/form";

export type CareerLensActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  output?: CareerGuidanceOutput;
};

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
    targetCareer: formData.get("targetCareer"),
    question: formData.get("question"),
    model: formData.get("model"),
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
      model: t("actions.fields.model"),
      question: t("actions.fields.question"),
      strongSubject: t("actions.fields.strongSubject"),
      subjectScore: t("actions.fields.subjectScore"),
      targetBudget: t("actions.fields.targetBudget"),
      targetCareer: t("actions.fields.targetCareer"),
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

  if (!AVAILABLE_MODELS.includes(parsed.data.model)) {
    return {
      status: "error",
      message: t("actions.modelUnavailable"),
      fieldErrors: { model: [t("actions.chooseModel")] },
    };
  }

  const input = buildCareerGuidanceInput(
    parsed.data,
    viewer.actor.userId,
    locale === "en" ? "en" : "vi",
  );

  try {
    const output = await generateCareerGuidance(input, {
      model: parsed.data.model,
      userId: viewer.actor.userId,
    });

    return {
      status: "success",
      message: t("actions.success"),
      output,
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
