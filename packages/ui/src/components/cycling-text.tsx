"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps, useState } from "react";

type CyclingTextProps = Omit<ComponentProps<"span">, "children" | "onAnimationIteration"> & {
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
   * Changes the content at the animation boundary, when the shared keyframe is
   * fully transparent, so the next item fades in through the same single span.
   */
  function handleAnimationIteration() {
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
      onAnimationIteration={handleAnimationIteration}
      {...props}
    >
      {children[visibleIndex]}
    </span>
  );
}
