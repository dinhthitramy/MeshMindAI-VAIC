import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoPlaceholderProps = {
  className?: string;
};

function LogoPlaceholder({ className }: LogoPlaceholderProps) {
  return (
    <Link
      href="/"
      aria-label="MeshMind home"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-7 rounded-md border border-dashed border-foreground/20"
      />
    </Link>
  );
}

export { LogoPlaceholder };
