"use client";

import { useId, type ComponentType, type SVGProps } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  themePreferences,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

type ThemeOption = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const themeOptions: Record<ThemePreference, ThemeOption> = {
  system: { label: "System", icon: Monitor },
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
};

type ThemeSelectorProps = {
  className?: string;
  compact?: boolean;
};

function ThemeIcon({
  theme,
  inline = false,
}: {
  theme: ThemePreference;
  inline?: boolean;
}) {
  const Icon = themeOptions[theme].icon;

  return (
    <span
      aria-hidden="true"
      className="relative flex size-4 shrink-0 items-center justify-center"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -8 }}
          animate={{ opacity: 1, rotate: 0 }}
          exit={{ opacity: 0, rotate: 8 }}
          transition={{ duration: 0.12 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Icon
            data-icon={inline ? "inline-start" : undefined}
            aria-hidden="true"
            className={inline ? undefined : "size-4 text-muted-foreground"}
            strokeWidth={1.8}
          />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function ThemeSelector({ className, compact = false }: ThemeSelectorProps) {
  const selectId = useId();
  const { theme, setTheme } = useTheme();
  const currentIndex = themePreferences.indexOf(theme);
  const nextTheme = themePreferences[(currentIndex + 1) % themePreferences.length];

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={`Theme: ${themeOptions[theme].label}`}
        aria-label={`Theme: ${themeOptions[theme].label}. Switch to ${themeOptions[nextTheme].label}.`}
        onClick={() => setTheme(nextTheme)}
        className={className}
      >
        <ThemeIcon theme={theme} inline />
      </Button>
    );
  }

  return (
    <div className={cn("flex w-32 items-center gap-2", className)}>
      <ThemeIcon theme={theme} />
      <label htmlFor={selectId} className="sr-only">
        Theme preference
      </label>
      <Select
        id={selectId}
        value={theme}
        onChange={(event) => setTheme(event.target.value as ThemePreference)}
        className="h-8 min-w-0 flex-1"
      >
        {themePreferences.map((preference) => (
          <option key={preference} value={preference}>
            {themeOptions[preference].label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export { ThemeSelector };
