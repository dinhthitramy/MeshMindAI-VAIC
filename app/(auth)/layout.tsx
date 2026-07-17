import { ThemeSelector } from "@/components/theme-selector";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative grid min-h-dvh place-items-center bg-muted/25 px-4 pb-8 pt-20 sm:px-6">
      <ThemeSelector className="absolute right-4 top-4 sm:right-6 sm:top-6" />
      <main className="w-full max-w-108">{children}</main>
    </div>
  );
}
