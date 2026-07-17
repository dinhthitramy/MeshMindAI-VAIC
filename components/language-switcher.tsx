"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { setUserLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
};

function LanguageSwitcher({
  className,
  compact = false,
}: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("Common.language");
  const [pending, startTransition] = useTransition();
  const nextLocale: Locale = locale === "vi" ? "en" : "vi";
  const currentLanguage = locale === "vi" ? t("vietnamese") : t("english");
  const nextLanguage =
    nextLocale === "vi" ? t("vietnamese") : t("english");
  const shortLabel =
    nextLocale === "vi" ? t("shortVietnamese") : t("shortEnglish");

  function switchLanguage() {
    startTransition(async () => {
      await setUserLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "sm"}
      title={
        compact
          ? t("currentSwitch", {
              language: currentLanguage,
              nextLanguage,
            })
          : undefined
      }
      aria-label={t("currentSwitch", {
        language: currentLanguage,
        nextLanguage,
      })}
      disabled={pending}
      onClick={switchLanguage}
      className={cn(!compact && "w-full justify-start", className)}
    >
      {compact ? (
        <span className="text-xs font-semibold">{shortLabel}</span>
      ) : (
        <>
          <Languages data-icon="inline-start" aria-hidden="true" />
          <span>{t("switchTo", { language: nextLanguage })}</span>
        </>
      )}
    </Button>
  );
}

export { LanguageSwitcher };
