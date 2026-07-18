import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AVAILABLE_MODELS } from "@/lib/ai";
import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getPreferredCareerModel } from "@/lib/careerlens/preferences";

import { CareerSettingsForm } from "./_components/career-settings-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("metadataTitle") };
}

export default async function SettingsPage() {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (viewer.actor.kind !== "user") redirect("/dashboard");

  const [t, preferredModel] = await Promise.all([
    getTranslations("Settings"),
    getPreferredCareerModel(viewer.actor.userId),
  ]);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {t("description")}
        </p>
      </header>
      <CareerSettingsForm
        models={[...AVAILABLE_MODELS]}
        preferredModel={
          AVAILABLE_MODELS.includes(preferredModel)
            ? preferredModel
            : AVAILABLE_MODELS[0]
        }
      />
    </section>
  );
}
