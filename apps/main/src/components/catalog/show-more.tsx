"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

/**
 * The rest of a list one tap away, after the part in sight: in the page's HTML all along, for
 * search engines, hidden until the toggle under it opens it, and folded back from the same toggle,
 * which stays where it was. `className` places the toggle (on the list's text edge).
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
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <div hidden={!open} id={id}>
        {children}
      </div>

      <button
        aria-controls={id}
        aria-expanded={open}
        className={cn(
          "hit-area text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 relative inline-flex items-center gap-1 self-start rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] motion-reduce:transition-none",
          className,
        )}
        onClick={() => setOpen(!open)}
        type="button"
      >
        {open ? less : more}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "size-4 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
    </>
  );
}
