import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode } from "react";

/**
 * A native `<details>`, so the rest is in the HTML for search engines and opens before any script.
 * Its group is named, so it opens on its own inside another disclosure.
 */
export function ShowMore({
  children,
  className,
  less,
  more,
}: {
  children: ReactNode;
  className?: string;
  less: string;
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
