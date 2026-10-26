import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";

const SIZES = {
  lg: { box: "size-7", icon: "size-4" },
  md: { box: "size-6", icon: "size-4" },
  sm: { box: "size-5", icon: "size-3.5" },
} as const;

/**
 * The public pages' check: something included or taught, a plain muted check centered in the room
 * a marker takes. It's not blue, since blue means a right answer in the app. Put it in a
 * `LineMarker` to sit on the first line of a list item's text.
 */
export function CheckMark({ size }: { size: keyof typeof SIZES }) {
  return (
    <span className={cn("flex items-center justify-center", SIZES[size].box)}>
      <CheckIcon
        aria-hidden="true"
        className={cn("text-muted-foreground", SIZES[size].icon)}
        strokeWidth={2.5}
      />
    </span>
  );
}
