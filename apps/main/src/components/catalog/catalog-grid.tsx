"use client";

import {
  GridBackToTop,
  GridContent,
  GridEmpty,
  GridGroupItem,
  GridItem,
} from "@zoonk/ui/components/grid";
import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import { normalizeString } from "@zoonk/utils/string";
import { SearchIcon } from "lucide-react";
import { type Route } from "next";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { CatalogGridContext, useCatalogGridContext } from "./catalog-grid-context";
import { CATALOG_TOP_TARGET_ID } from "./catalog-top-target";

type CatalogGridSearchItem = {
  description?: string | null;
  id: string | number | bigint;
  title: string;
};

const BACK_TO_TOP_VISIBLE_SCROLL_Y = 360;

/**
 * Catalog search should match the text learners scan inside each tile. Generated
 * chapters and lessons often put the disambiguating detail in the description,
 * so filtering only by title hides relevant results.
 */
function getCatalogSearchText(item: CatalogGridSearchItem): string {
  return [item.title, item.description].filter(Boolean).join(" ");
}

/**
 * Normalizing the combined tile text once per candidate keeps chapter and lesson
 * search accent-insensitive without each page rebuilding the same rules.
 */
function matchesCatalogSearchQuery({
  item,
  query,
}: {
  item: CatalogGridSearchItem;
  query: string;
}): boolean {
  return normalizeString(getCatalogSearchText(item)).includes(query);
}

/**
 * The floating top action should appear only after the reader has left the
 * page header; showing it immediately would add chrome before it can help.
 */
function isBackToTopVisible({ scrollY }: { scrollY: number }): boolean {
  return scrollY > BACK_TO_TOP_VISIBLE_SCROLL_Y;
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
 * The anchor href stays as a no-JS fallback, but hydrated catalog pages should
 * scroll smoothly so the jump back to the sticky navigation does not feel harsh.
 */
function handleBackToTopClick(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();

  const catalogTopTarget = globalThis.document.querySelector(`#${CATALOG_TOP_TARGET_ID}`);
  catalogTopTarget?.scrollIntoView({ behavior: getBackToTopScrollBehavior(), block: "start" });
}

/**
 * Long generated course grids need a reachable escape hatch while scrolling,
 * so this centralized action follows the viewport instead of waiting for the
 * user to reach the end of the collection.
 */
function CatalogGridBackToTop() {
  const t = useExtracted();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    /**
     * Scroll position lives outside React, so the listener keeps this utility
     * visible only when it can help without forcing every grid item to know
     * anything about viewport state.
     */
    function syncBackToTopVisibility() {
      const nextIsVisible = isBackToTopVisible({ scrollY: globalThis.scrollY });

      setIsVisible((currentIsVisible) =>
        currentIsVisible === nextIsVisible ? currentIsVisible : nextIsVisible,
      );
    }

    syncBackToTopVisibility();
    globalThis.addEventListener("scroll", syncBackToTopVisibility, { passive: true });

    return () => globalThis.removeEventListener("scroll", syncBackToTopVisibility);
  }, []);

  return (
    <GridBackToTop
      aria-label={t("Back to top")}
      className={cn(
        "bg-background/85 border-border/40 fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 border shadow-[0_8px_24px_rgb(0_0_0/0.08)] backdrop-blur-md transition-all duration-150 md:right-6",
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
      href={`#${CATALOG_TOP_TARGET_ID}`}
      onClick={handleBackToTopClick}
      title={t("Back to top")}
    >
      <span className="hidden sm:inline">{t("Back to top")}</span>
    </GridBackToTop>
  );
}

/**
 * Catalog grids share the same floating utility action so course, chapter, and
 * lesson pages can offer quick scroll recovery without duplicating viewport
 * listeners or page-specific positioning.
 */
export function CatalogGridContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <GridContent className={className}>
      {children}
      <CatalogGridBackToTop />
    </GridContent>
  );
}

/**
 * The catalog grid search owns query-string filtering so course, chapter, and
 * lesson grids can share one search behavior while each page keeps its own data
 * fetching on the server.
 */
export function CatalogGridSearch({
  children,
  className,
  items,
  placeholder,
}: {
  children: ReactNode;
  className?: string;
  items: CatalogGridSearchItem[];
  placeholder: string;
}) {
  const [search, setSearch] = useQueryState("q", {
    defaultValue: "",
    shallow: true,
    throttleMs: 300,
  });

  const { filteredIds, isSearchActive } = useMemo(() => {
    const query = normalizeString(search);

    if (!query) {
      return { filteredIds: null, isSearchActive: false };
    }

    const matching = items.filter((item) => matchesCatalogSearchQuery({ item, query }));
    return { filteredIds: new Set(matching.map((item) => String(item.id))), isSearchActive: true };
  }, [items, search]);

  return (
    <CatalogGridContext value={{ filteredIds, isSearchActive }}>
      <div className={cn("w-full", className)} data-slot="catalog-grid-search">
        <div className="relative">
          <SearchIcon className="text-muted-foreground/60 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            aria-label={placeholder}
            className="border-border/40 placeholder:text-muted-foreground/50 focus-visible:border-border h-10 bg-transparent pl-9 focus-visible:ring-0"
            onChange={(event) => setSearch(event.target.value || null)}
            placeholder={placeholder}
            type="search"
            value={search}
          />
        </div>
      </div>
      {children}
    </CatalogGridContext>
  );
}

/**
 * Grid empty state stays tied to the shared search context so filtered empty
 * results do not require every catalog page to duplicate visibility logic. The
 * empty frame keeps mobile scroll from collapsing under a focused search field.
 */
export function CatalogGridEmpty({ className, ...props }: React.ComponentProps<"p">) {
  const context = useCatalogGridContext();
  const filteredIds = context?.filteredIds ?? null;
  const isSearchActive = context?.isSearchActive ?? false;

  const isEmpty = isSearchActive && filteredIds?.size === 0;

  if (!isEmpty) {
    return null;
  }

  return (
    <GridEmpty
      className={cn(
        "flex min-h-[calc(100dvh-8rem)] items-center justify-center md:min-h-64",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Grid items keep search filtering and Next.js navigation in one link wrapper,
 * while tile contents remain fully composable through children.
 */
export function CatalogGridItem<Href extends string>({
  children,
  className,
  href,
  id,
  prefetch,
}: {
  children: ReactNode;
  className?: string;
  href: Route<Href>;
  id: string | number | bigint;
  prefetch?: boolean;
}) {
  const context = useCatalogGridContext();
  const filteredIds = context?.filteredIds ?? null;

  if (filteredIds && !filteredIds.has(String(id))) {
    return null;
  }

  return (
    <GridGroupItem>
      <GridItem className={className} render={<Link href={href} prefetch={prefetch} />}>
        {children}
      </GridItem>
    </GridGroupItem>
  );
}
