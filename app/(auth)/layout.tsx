import { redirect } from "next/navigation";

import { getViewer } from "@/lib/auth/dal";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();

  if (viewer) {
    redirect("/dashboard");
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/25 px-4 py-8 sm:px-6">
      <main className="w-full max-w-108">{children}</main>
    </div>
  );
}
