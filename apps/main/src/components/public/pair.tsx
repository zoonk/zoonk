"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { SNAP_ROW_CLASS } from "./landing-styles";
import { useScrollRowFocus } from "./use-scroll-row-focus";

/**
 * Two unequal cards side by side from `lg` (seven twelfths and five): an action and its result,
 * such as a question and the mock it leads to. Below `lg` they swipe as a row, like `Frames`, so a
 * phone isn't one long card after the other. `aria-label` names the pair, since the row scrolls.
 */
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
      // The row scrolls below `lg`, so the keyboard can reach it there (and only there).
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A scrolling row takes focus to scroll.
      tabIndex={0}
      {...props}
    />
  );
}
