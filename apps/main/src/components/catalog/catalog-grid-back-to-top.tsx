"use client";

import { GridBackToTop } from "@zoonk/ui/components/grid";
import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type MouseEvent, useEffect, useState } from "react";
import { CATALOG_TOP_TARGET_ID } from "./catalog-top-target";

const BACK_TO_TOP_VISIBLE_SCROLL_Y = 360;

/**
 * The floating top action should appear only after the reader has left the
 * page header; showing it immediately would add chrome before it can help.
 */
function isBackToTopVisible(): boolean {
  return globalThis.scrollY > BACK_TO_TOP_VISIBLE_SCROLL_Y;
}

/**
 * The anchor href stays as a no-JS fallback, but hydrated catalog pages can
 * scroll smoothly so the jump does not feel harsh.
 */
function scrollToCatalogTop(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();

  globalThis.document
    .querySelector(`#${CATALOG_TOP_TARGET_ID}`)
    ?.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
}

/**
 * Long course grids need a reachable escape hatch while scrolling, so this
 * action follows the viewport instead of waiting for the reader to reach the
 * end of the collection.
 */
export function CatalogGridBackToTop() {
  const t = useExtracted();
  const [isVisible, setIsVisible] = useState(false);
  const label = t("Back to top");

  useEffect(() => {
    function syncVisibility() {
      setIsVisible(isBackToTopVisible());
    }

    syncVisibility();
    globalThis.addEventListener("scroll", syncVisibility, { passive: true });

    return () => globalThis.removeEventListener("scroll", syncVisibility);
  }, []);

  return (
    <GridBackToTop
      aria-label={label}
      className={cn(
        "bg-background/85 border-border/40 fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 border shadow-[0_8px_24px_rgb(0_0_0/0.08)] backdrop-blur-md transition-all duration-150 md:right-6",
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
      href={`#${CATALOG_TOP_TARGET_ID}`}
      onClick={scrollToCatalogTop}
      title={label}
    >
      <span className="hidden sm:inline">{label}</span>
    </GridBackToTop>
  );
}
