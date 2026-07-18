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
    <div className="ai-workspace-surface flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden p-2 md:h-dvh md:p-3">
      <h1 className="sr-only">{t("homeHeading")}</h1>
      <div className="flex-1 overflow-hidden rounded-[1.75rem] bg-background ring-1 ring-foreground/5 shadow-[0_24px_80px_-50px_oklch(0.145_0_0_/_0.55)]">
        <AIChat initialModels={AVAILABLE_MODELS} viewerName={viewer.displayName} />
      </div>
    </div>
  );
}
