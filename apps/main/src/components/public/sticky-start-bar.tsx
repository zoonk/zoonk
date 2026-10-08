"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode, useEffect, useState } from "react";

type ObservedState = { isAbove: boolean; isIntersecting: boolean };

const NO_IDS: string[] = [];

function getElements(ids: string[]): Element[] {
  return ids.flatMap((id) => {
    const element = document.querySelector(`#${CSS.escape(id)}`);
    return element ? [element] : [];
  });
}

/**
 * Watches where the page's own start controls are, so the bottom bar only
 * appears once the first one has scrolled up out of view and never while one
 * of them (or the footer) is on screen.
 */
function useShowAfterScrollingPast({
  afterId,
  hideWhileVisibleIds,
}: {
  afterId: string;
  hideWhileVisibleIds: string;
}) {
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    const [after] = getElements([afterId]);
    const hiders = getElements(hideWhileVisibleIds.split(" ").filter(Boolean));

    if (!after) {
      return;
    }

    const states = new Map<Element, ObservedState>();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        states.set(entry.target, {
          isAbove: entry.boundingClientRect.bottom <= 0,
          isIntersecting: entry.isIntersecting,
        });
      });

      const isHidden = hiders.some((element) => states.get(element)?.isIntersecting);
      setIsShown(Boolean(states.get(after)?.isAbove) && !isHidden);
    });

    [after, ...hiders].forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [afterId, hideWhileVisibleIds]);

  return isShown;
}

/**
 * On phones, a page's one action stays one thumb away: once the control that
 * holds it (`afterId`) scrolls away, this bar offers it at the bottom of the
 * screen, and it steps aside while any element in `hideWhileVisibleIds` is on
 * screen, like a second goal box or the footer.
 */
export function StickyStartBar({
  afterId,
  children,
  hideWhileVisibleIds = NO_IDS,
}: {
  afterId: string;
  children: ReactNode;
  hideWhileVisibleIds?: string[];
}) {
  const isShown = useShowAfterScrollingPast({
    afterId,
    hideWhileVisibleIds: hideWhileVisibleIds.join(" "),
  });

  return (
    <div
      aria-hidden={!isShown}
      className={cn(
        "from-background fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-60% to-transparent px-4 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none sm:hidden",
        isShown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
      inert={!isShown}
    >
      {children}
    </div>
  );
}
