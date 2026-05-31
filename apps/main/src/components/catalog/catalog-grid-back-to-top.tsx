"use client";

import { GridBackToTop } from "@zoonk/ui/components/grid";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { CATALOG_TOP_TARGET_ID } from "./catalog-top-target";

export type CatalogGridItemKey = string | number | bigint;

type CatalogActiveTargetPosition = "ahead" | "unavailable";
type CatalogScrollActionMode = "active" | "top";
type CatalogScrollDirection = "down" | "up";

type CatalogScrollState = {
  activeTargetPosition: CatalogActiveTargetPosition;
  direction: CatalogScrollDirection;
  isVisible: boolean;
};

const BACK_TO_TOP_VISIBLE_SCROLL_Y = 360;

const DEFAULT_CATALOG_SCROLL_STATE = {
  activeTargetPosition: "unavailable",
  direction: "up",
  isVisible: false,
} satisfies CatalogScrollState;

/**
 * Catalog tiles need stable DOM anchors so the floating action can target the
 * current chapter or lesson without coupling scroll behavior to route URLs.
 */
export function getCatalogItemTargetId(itemKey: CatalogGridItemKey): string {
  return `catalog-item-${String(itemKey)}`;
}

/**
 * The floating top action should appear only after the reader has left the
 * page header; showing it immediately would add chrome before it can help.
 */
function isBackToTopVisible({ scrollY }: { scrollY: number }): boolean {
  return scrollY > BACK_TO_TOP_VISIBLE_SCROLL_Y;
}

/**
 * The scroll action follows the latest user intent: down means "take me to my
 * current item", while up means "take me back to the page header".
 */
function getCatalogScrollDirection({
  currentScrollY,
  previousDirection,
  previousScrollY,
}: {
  currentScrollY: number;
  previousDirection: CatalogScrollDirection;
  previousScrollY: number;
}): CatalogScrollDirection {
  if (currentScrollY > previousScrollY) {
    return "down";
  }

  if (currentScrollY < previousScrollY) {
    return "up";
  }

  return previousDirection;
}

/**
 * The active target is useful only before the learner reaches it. Once its top
 * edge is at or above the viewport, the downward shortcut would point back to
 * content they have already reached, so the floating action should recover up.
 */
function isCatalogActiveTargetAhead(element: Element): boolean {
  return element.getBoundingClientRect().top > 0;
}

/**
 * Catalog anchors are queried through CSS selectors, so ids must be escaped
 * before interpolation to keep unusual future keys from breaking the shortcut.
 */
function getCatalogScrollTargetElement(targetId: string | null) {
  if (!targetId) {
    return null;
  }

  return globalThis.document.querySelector(`#${globalThis.CSS.escape(targetId)}`);
}

/**
 * Active targets are optional because anonymous users, users without progress,
 * and filtered grids all need the same simple fallback: back to the page top.
 */
function getCatalogActiveTargetPosition({
  activeTargetId,
}: {
  activeTargetId: string | null;
}): CatalogActiveTargetPosition {
  if (!activeTargetId) {
    return "unavailable";
  }

  const activeTarget = getCatalogScrollTargetElement(activeTargetId);

  if (!activeTarget) {
    return "unavailable";
  }

  return isCatalogActiveTargetAhead(activeTarget) ? "ahead" : "unavailable";
}

/**
 * Visibility and direction are derived together from the same browser scroll
 * read so the floating action does not briefly show the wrong destination.
 */
function getCatalogScrollState({
  activeTargetId,
  currentScrollY,
  direction,
}: {
  activeTargetId: string | null;
  currentScrollY: number;
  direction: CatalogScrollDirection;
}): CatalogScrollState {
  return {
    activeTargetPosition: getCatalogActiveTargetPosition({ activeTargetId }),
    direction,
    isVisible: isBackToTopVisible({ scrollY: currentScrollY }),
  };
}

/**
 * React should only re-render the floating action when its visible behavior
 * changes; scroll events can fire many times with the same useful state.
 */
function isSameCatalogScrollState(left: CatalogScrollState, right: CatalogScrollState): boolean {
  return (
    left.activeTargetPosition === right.activeTargetPosition &&
    left.direction === right.direction &&
    left.isVisible === right.isVisible
  );
}

/**
 * The active shortcut is only useful while moving down toward a target that is
 * still ahead. Missing, reached, or passed targets keep the existing top action.
 */
function getCatalogScrollActionMode({
  activeTargetPosition,
  direction,
}: {
  activeTargetPosition: CatalogActiveTargetPosition;
  direction: CatalogScrollDirection;
}): CatalogScrollActionMode {
  if (activeTargetPosition === "ahead" && direction === "down") {
    return "active";
  }

  return "top";
}

/**
 * The href and JavaScript scroll target must stay identical so the anchor still
 * has a valid no-JS destination.
 */
function getCatalogScrollTargetId({
  activeTargetId,
  mode,
}: {
  activeTargetId: string | null;
  mode: CatalogScrollActionMode;
}) {
  if (mode === "active" && activeTargetId) {
    return activeTargetId;
  }

  return CATALOG_TOP_TARGET_ID;
}

/**
 * Users who reduce motion should still get the same destination without the
 * animated movement that can make scrolling feel uncomfortable.
 */
function getBackToTopScrollBehavior(): ScrollBehavior {
  if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "auto";
  }

  return "smooth";
}

/**
 * Search filtering can remove the active tile after the floating action has
 * already rendered, so clicks fall back to the permanent top anchor instead of
 * becoming a no-op.
 */
function getCatalogScrollDestination({ targetId }: { targetId: string }) {
  return (
    getCatalogScrollTargetElement(targetId) ?? getCatalogScrollTargetElement(CATALOG_TOP_TARGET_ID)
  );
}

/**
 * The anchor href stays as a no-JS fallback, but hydrated catalog pages can
 * scroll smoothly so floating-action jumps do not feel harsh.
 */
function handleCatalogScrollActionClick({
  event,
  targetId,
}: {
  event: MouseEvent<HTMLAnchorElement>;
  targetId: string;
}) {
  event.preventDefault();

  const catalogScrollTarget = getCatalogScrollDestination({ targetId });
  catalogScrollTarget?.scrollIntoView({ behavior: getBackToTopScrollBehavior(), block: "start" });
}

/**
 * Long generated course grids need a reachable escape hatch while scrolling,
 * so this centralized action follows the viewport instead of waiting for the
 * user to reach the end of the collection.
 */
export function CatalogGridBackToTop({
  activeItemKey,
  activeLabel,
}: {
  activeItemKey?: CatalogGridItemKey | null;
  activeLabel?: string;
}) {
  const t = useExtracted();

  const previousDirectionRef = useRef<CatalogScrollDirection>(
    DEFAULT_CATALOG_SCROLL_STATE.direction,
  );

  const previousScrollYRef = useRef(0);
  const [scrollState, setScrollState] = useState<CatalogScrollState>(DEFAULT_CATALOG_SCROLL_STATE);

  const activeTargetId =
    activeItemKey === null || activeItemKey === undefined
      ? null
      : getCatalogItemTargetId(activeItemKey);

  const actionMode = getCatalogScrollActionMode({
    activeTargetPosition: scrollState.activeTargetPosition,
    direction: scrollState.direction,
  });

  const targetId = getCatalogScrollTargetId({ activeTargetId, mode: actionMode });
  const label = actionMode === "active" ? (activeLabel ?? t("Current item")) : t("Back to top");

  useEffect(() => {
    /**
     * Scroll position lives outside React, so the listener keeps this utility
     * visible only when it can help without forcing every grid item to know
     * anything about viewport state.
     */
    function syncCatalogScrollState() {
      const currentScrollY = globalThis.scrollY;

      const direction = getCatalogScrollDirection({
        currentScrollY,
        previousDirection: previousDirectionRef.current,
        previousScrollY: previousScrollYRef.current,
      });

      const nextScrollState = getCatalogScrollState({ activeTargetId, currentScrollY, direction });

      previousDirectionRef.current = direction;
      previousScrollYRef.current = currentScrollY;

      setScrollState((currentScrollState) =>
        isSameCatalogScrollState(currentScrollState, nextScrollState)
          ? currentScrollState
          : nextScrollState,
      );
    }

    syncCatalogScrollState();
    globalThis.addEventListener("scroll", syncCatalogScrollState, { passive: true });

    return () => globalThis.removeEventListener("scroll", syncCatalogScrollState);
  }, [activeTargetId]);

  return (
    <GridBackToTop
      aria-label={label}
      className={cn(
        "bg-background/85 border-border/40 fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 border shadow-[0_8px_24px_rgb(0_0_0/0.08)] backdrop-blur-md transition-all duration-150 md:right-6 [&_svg]:transition-transform",
        actionMode === "active" && "[&_svg]:rotate-180",
        scrollState.isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
      href={`#${targetId}`}
      onClick={(event) => handleCatalogScrollActionClick({ event, targetId })}
      title={label}
    >
      <span className="hidden sm:inline">{label}</span>
    </GridBackToTop>
  );
}
