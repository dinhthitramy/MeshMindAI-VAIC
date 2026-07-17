"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type LogoPlaceholderProps = {
  className?: string;
};

type LogoMarkProps = {
  className?: string;
};

function LogoMark({ className }: LogoMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-7 rounded-md border border-dashed border-foreground/20",
        className,
      )}
    />
  );
}

function LogoPlaceholder({ className }: LogoPlaceholderProps) {
  const t = useTranslations("Common");

  return (
    <Link
      href="/"
      aria-label={t("homeAria")}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
    >
      <LogoMark />
    </Link>
  );
}

export { LogoMark, LogoPlaceholder };
