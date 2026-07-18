"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { AVAILABLE_MODELS } from "@/lib/ai";
import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { savePreferredCareerModel } from "@/lib/careerlens/preferences";

export type CareerSettingsActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function saveCareerSettingsAction(
  _previousState: CareerSettingsActionState,
  formData: FormData,
): Promise<CareerSettingsActionState> {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  const t = await getTranslations("Settings");
  if (viewer.actor.kind !== "user") {
    return { status: "error", message: t("actions.userOnly") };
  }

  const parsed = z.object({ model: z.string().trim().min(1).max(120) }).safeParse({
    model: formData.get("model"),
  });
  if (!parsed.success || !AVAILABLE_MODELS.includes(parsed.data.model)) {
    return {
      status: "error",
      message: t("actions.invalidModel"),
      fieldErrors: { model: [t("actions.invalidModel")] },
    };
  }

  await savePreferredCareerModel(viewer.actor.userId, parsed.data.model);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/careerlens");
  return { status: "success", message: t("actions.saved") };
}
