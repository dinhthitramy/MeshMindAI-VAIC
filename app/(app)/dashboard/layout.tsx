import type { Metadata } from "next";

import { requirePermission, requireViewer } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";

import { DashboardShell } from "./_components/dashboard-shell";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await requireViewer();
  await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);

  return (
    <DashboardShell
      viewer={{
        displayName: viewer.displayName,
        roleLabel: viewer.roles.join(", "),
      }}
    >
      {children}
    </DashboardShell>
  );
}
