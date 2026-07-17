import { SkipLink } from "@/components/skip-link";

import { LandingHeader } from "./_components/landing-header";

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink href="#landing-content" />
      <LandingHeader />
      <main id="landing-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
