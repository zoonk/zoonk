import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";

const SIZES = {
  lg: { circle: "size-7", icon: "size-4" },
  md: { circle: "size-6", icon: "size-3.5" },
  sm: { circle: "size-5", icon: "size-3" },
} as const;

/**
 * The public pages' green check in a circle: something done or included. Put it in a
 * `LineMarker` to sit on the first line of a list item's text.
 */
export function CheckCircle({ size }: { size: keyof typeof SIZES }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        SIZES[size].circle,
      )}
    >
      <CheckIcon aria-hidden="true" className={SIZES[size].icon} strokeWidth={2.5} />
    </span>
  );
}
