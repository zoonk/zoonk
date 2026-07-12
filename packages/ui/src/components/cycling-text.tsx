"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps, useState } from "react";

type CyclingTextProps = Omit<ComponentProps<"span">, "children" | "onAnimationEnd"> & {
  children: readonly string[];
};

/**
 * Advances one item after the current text has faded out. Keeping one span in
 * the DOM makes overlap impossible and lets any caller reuse the same timing
 * without calculating animation delays or durations from its item count.
 */
export function CyclingText({ children, className, ...props }: CyclingTextProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultipleItems = children.length > 1;
  const visibleIndex = children.length === 0 ? 0 : activeIndex % children.length;

  /**
   * Changes the content only after the finite animation has ended at zero
   * opacity. The keyed span then starts a fresh animation for the next item,
   * without relying on React to commit during an active iteration boundary.
   */
  function handleAnimationEnd() {
    setActiveIndex((currentIndex) => {
      if (!hasMultipleItems) {
        return 0;
      }

      return (currentIndex + 1) % children.length;
    });
  }

  return (
    <span
      className={cn(hasMultipleItems && "animate-text-cycle motion-reduce:animate-none", className)}
      data-slot="cycling-text"
      key={visibleIndex}
      onAnimationEnd={handleAnimationEnd}
      {...props}
    >
      {children[visibleIndex]}
    </span>
  );
}
