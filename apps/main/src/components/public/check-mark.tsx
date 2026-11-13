import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { type ReactNode } from "react";

const SIZES = {
  lg: { box: "size-7", icon: "size-4" },
  md: { box: "size-6", icon: "size-4" },
  sm: { box: "size-4", icon: "size-4" },
} as const;

/** Not blue: blue means a right answer in the app. */
export function CheckMark({ size }: { size: keyof typeof SIZES }) {
  return (
    <span className={cn("flex items-center justify-center", SIZES[size].box)}>
      <CheckIcon aria-hidden="true" className={cn("text-muted-foreground", SIZES[size].icon)} />
    </span>
  );
}

/** A list row that a check leads: the check on the list's edge, its text 28px in like every list row's. */
export function CheckItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className={cn("flex gap-3", className)}>
      <LineMarker>
        <CheckMark size="sm" />
      </LineMarker>
      <span className="text-pretty">{children}</span>
    </li>
  );
}
