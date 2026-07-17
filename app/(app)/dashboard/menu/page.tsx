import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Menu",
};

export default async function DashboardMenuPage() {
  await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  return <h1 className="sr-only">Menu</h1>;
}
