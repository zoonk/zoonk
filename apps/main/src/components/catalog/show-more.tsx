import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode } from "react";

/**
 * The rest of a list one tap away, after the part in sight: a native `<details>`, so it's in the
 * page's HTML for search engines and opens before any script loads. Its toggle is drawn after what
 * it holds, where the list ends, and folds it back from there ("Show fewer"). Its group is named,
 * so it opens on its own inside another disclosure (an outline's level). `className` places the
 * toggle (on the list's text edge).
 */
export function ShowMore({
  children,
  className,
  less,
  more,
}: {
  children: ReactNode;
  className?: string;
  /** The toggle once open, such as "Show fewer". */
  less: string;
  /** The toggle while folded, with how much it holds: "Show 3 more". */
  more: string;
}) {
  return (
    <details className="group/more flex flex-col">
      <summary
        className={cn(
          "hit-area text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 relative order-1 inline-flex cursor-pointer list-none items-center gap-1 self-start rounded-md text-sm font-medium transition-colors outline-none select-none group-open/more:mt-3 focus-visible:ring-[3px] motion-reduce:transition-none [&::-webkit-details-marker]:hidden",
          className,
        )}
      >
        {/* Above the toggle's wider hit area, so a tap on the words lands on them. */}
        <span className="relative group-open/more:hidden">{more}</span>
        <span className="relative hidden group-open/more:inline">{less}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 transition-transform group-open/more:rotate-180 motion-reduce:transition-none"
        />
      </summary>

      {children}
    </details>
  );
}
