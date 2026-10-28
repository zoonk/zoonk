"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { SNAP_ROW_CLASS } from "./landing-styles";
import { useScrollRowFocus } from "./use-scroll-row-focus";

/** Give it an `aria-label`: the row scrolls below `lg` and takes focus. */
export function Pair({ className, ...props }: React.ComponentProps<"div">) {
  const ref = useScrollRowFocus<HTMLDivElement>();

  return (
    <div
      className={cn(
        SNAP_ROW_CLASS,
        "*:min-w-0 *:snap-start lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-5",
        className,
      )}
      data-slot="pair"
      ref={ref}
      role="group"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A scrolling row takes focus to scroll.
      tabIndex={0}
      {...props}
    />
  );
}
