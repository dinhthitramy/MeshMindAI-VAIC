import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSelector } from "@/components/theme-selector";
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
    <div className="relative grid min-h-dvh place-items-center bg-muted/25 px-4 pb-8 pt-20 sm:px-6">
      <div className="absolute right-4 top-4 flex items-center gap-1 sm:right-6 sm:top-6">
        <LanguageSwitcher compact />
        <ThemeSelector className="hidden sm:flex" />
        <ThemeSelector compact className="sm:hidden" />
      </div>
      <main className="w-full max-w-108">{children}</main>
    </div>
  );
}
