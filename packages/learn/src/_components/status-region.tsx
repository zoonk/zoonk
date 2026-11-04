import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps } from "react";

/**
 * Screen readers only read changes to a live region that was already in the page, so this one stays
 * rendered while empty, out of the layout, for a line that appears later (such as a refused Start).
 */
export function StatusRegion({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={cn("empty:sr-only", className)}
      role="status"
      {...props}
    />
  );
}
