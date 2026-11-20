"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { SuggestionMark } from "../_components/suggestion";
import { SURFACE_CLASS } from "../_components/surface";

export function TodaySuggestionCard({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(SURFACE_CLASS, "flex items-start gap-3 p-4", className)}
      data-slot="suggestion-card"
      {...props}
    >
      <SuggestionMark />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">{children}</div>
    </div>
  );
}
