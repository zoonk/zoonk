import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { type ReactNode } from "react";

/**
 * A list row that a check leads: the check on the list's edge, its text 28px in like every list
 * row's. The check isn't blue: blue means a right answer in the app.
 */
export function CheckItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className={cn("flex gap-3", className)}>
      <LineMarker>
        {/* The glyph's ink starts 2px inside its box: the pull puts it on the list's edge. */}
        <CheckIcon aria-hidden="true" className="text-muted-foreground size-4 -translate-x-0.5" />
      </LineMarker>
      <span className="text-pretty">{children}</span>
    </li>
  );
}
