import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default async function DashboardPage() {
  await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  return <h1 className="sr-only">Dashboard home</h1>;
}
