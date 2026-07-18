import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  const t = await getTranslations("Dashboard");
  return <h1 className="sr-only">{t("homeHeading")}</h1>;
}
