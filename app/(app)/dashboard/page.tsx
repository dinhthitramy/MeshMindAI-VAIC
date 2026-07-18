import { AVAILABLE_MODELS } from "@/lib/ai";
import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getTranslations } from "next-intl/server";

import { AIChat } from "./ai-assistant/_components/ai-chat";

export default async function DashboardPage() {
  const [viewer, t] = await Promise.all([
    requirePermission(PERMISSIONS.DASHBOARD_ACCESS),
    getTranslations("Dashboard"),
  ]);

  return (
    <div className="ai-workspace-surface h-[calc(100dvh-3.5rem)] overflow-hidden bg-background md:h-dvh">
      <h1 className="sr-only">{t("homeHeading")}</h1>
      <AIChat initialModels={AVAILABLE_MODELS} viewerName={viewer.displayName} />
    </div>
  );
}
