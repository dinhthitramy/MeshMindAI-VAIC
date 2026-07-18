import Link from "next/link";
import { ChevronDown, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BrandLink } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSelector } from "@/components/theme-selector";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getViewer } from "@/lib/auth/dal";

async function LandingHeader() {
  const [viewer, t] = await Promise.all([
    getViewer().catch(() => null),
    getTranslations("Landing"),
  ]);
  const categories = [t("category1"), t("category2"), t("category3")];

  return (
    <header className="border-b border-border/80 bg-background/95">
      <nav
        aria-label={t("primaryNavigation")}
        className="mx-auto flex h-16 w-full max-w-360 items-center gap-4 px-4 sm:px-6 lg:px-8"
      >
        <BrandLink compact className="sm:hidden" />
        <BrandLink className="hidden sm:inline-flex" />

        <div className="hidden items-center gap-1 md:flex">
          {categories.map((category) => (
            <span
              key={category}
              aria-disabled="true"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground"
            >
              {category}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <details className="group relative md:hidden">
            <summary className="flex h-9 cursor-pointer list-none items-center rounded-full px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
              {t("categories")}
              <ChevronDown
                aria-hidden="true"
                className="ml-1 size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid min-w-44 gap-1 rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
              {categories.map((category) => (
                <span
                  key={category}
                  aria-disabled="true"
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
                >
                  {category}
                </span>
              ))}
            </div>
          </details>

          <LanguageSwitcher compact />
          <ThemeSelector />

          <Link
            href={viewer ? "/dashboard" : "/login"}
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            <UserRound data-icon="inline-start" aria-hidden="true" />
            {t("account")}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export { LandingHeader };
