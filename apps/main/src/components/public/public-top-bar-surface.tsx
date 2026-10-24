"use client";

import { useScrolled } from "@zoonk/ui/hooks/scrolled";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The public top bar's surface: sticky over the page, its hairline drawn once the page scrolls, as
 * the app's bars draw theirs, so what passes under the blur keeps an edge.
 */
export function PublicTopBarSurface({ className, ...props }: React.ComponentProps<"header">) {
  const scrolled = useScrolled();

  return (
    <header
      className={cn(
        "bg-background/85 supports-backdrop-filter:bg-background/70 sticky top-0 z-40 border-b backdrop-blur-md transition-colors motion-reduce:transition-none",
        scrolled ? "border-border" : "border-transparent",
        className,
      )}
      {...props}
    />
  );
}
