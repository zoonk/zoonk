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

/** Keeps its room while hidden, so nothing beside it moves when it shows. */
export function ShownAfterScrollingPast({
  afterId,
  children,
  className,
  hideWhileVisibleIds = NO_IDS,
}: {
  afterId: string;
  children: ReactNode;
  className?: string;
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
        "transition-opacity duration-150 ease-out motion-reduce:transition-none",
        isShown ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
      inert={!isShown}
    >
      {children}
    </div>
  );
}

export function StickyStartBar(props: {
  afterId: string;
  children: ReactNode;
  hideWhileVisibleIds?: string[];
}) {
  return (
    <ShownAfterScrollingPast
      className="bg-background/90 supports-backdrop-filter:bg-background/75 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden"
      {...props}
    />
  );
}
