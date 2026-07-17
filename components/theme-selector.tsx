"use client";

import { useId, type ComponentType, type SVGProps } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

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

function ThemeSelector({ className, compact = false }: ThemeSelectorProps) {
  const selectId = useId();
  const { theme, setTheme } = useTheme();
  const currentIndex = themePreferences.indexOf(theme);
  const nextTheme = themePreferences[(currentIndex + 1) % themePreferences.length];
  const CurrentIcon = themeOptions[theme].icon;

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
        <CurrentIcon
          data-icon="inline-start"
          aria-hidden="true"
          strokeWidth={1.8}
        />
      </Button>
    );
  }

  return (
    <div className={cn("flex w-32 items-center gap-2", className)}>
      <CurrentIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
        strokeWidth={1.8}
      />
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
