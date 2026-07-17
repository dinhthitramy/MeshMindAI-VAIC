import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-2xl border border-border/80 bg-card text-card-foreground shadow-[0_24px_70px_-42px_oklch(0.145_0_0_/_0.45)]",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
