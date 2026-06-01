"use client";

import { GridContent, GridEmpty, GridGroupItem, GridItem } from "@zoonk/ui/components/grid";
import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import { normalizeString } from "@zoonk/utils/string";
import { SearchIcon } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { type ReactNode, useMemo } from "react";
import { CatalogGridBackToTop } from "./catalog-grid-back-to-top";
import { CatalogGridContext, useCatalogGridContext } from "./catalog-grid-context";
import { type CatalogGridItemKey, getCatalogItemTargetId } from "./catalog-item-target";

export type CatalogGridSearchItem = {
  description?: string | null;
  id: CatalogGridItemKey;
  title: string;
};

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
export function matchesCatalogSearchQuery({
  item,
  query,
}: {
  item: CatalogGridSearchItem;
  query: string;
}): boolean {
  return normalizeString(getCatalogSearchText(item)).includes(query);
}

/**
 * Catalog grids share the same floating utility action so course, chapter, and
 * lesson pages can offer quick scroll recovery without duplicating viewport
 * listeners or page-specific positioning.
 */
export function CatalogGridContent({
  activeItemKey,
  activeLabel,
  children,
  className,
}: {
  activeItemKey?: CatalogGridItemKey | null;
  activeLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <GridContent className={className}>
      {children}
      <CatalogGridBackToTop activeItemKey={activeItemKey} activeLabel={activeLabel} />
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

  const { filteredIds, isFilterActive } = useMemo(() => {
    const query = normalizeString(search);

    if (!query) {
      return { filteredIds: null, isFilterActive: false };
    }

    const matching = items.filter((item) => matchesCatalogSearchQuery({ item, query }));
    return { filteredIds: new Set(matching.map((item) => String(item.id))), isFilterActive: true };
  }, [items, search]);

  return (
    <CatalogGridContext value={{ filteredIds, isFilterActive }}>
      <CatalogGridSearchField
        className={className}
        onSearchChange={(value) => setSearch(value || null)}
        placeholder={placeholder}
        search={search}
      />
      {children}
    </CatalogGridContext>
  );
}

/**
 * Search controls keep the same icon, sizing, and responsive row behavior while
 * letting specialized catalog pages place small filter actions beside the field.
 */
export function CatalogGridSearchField({
  children,
  className,
  onSearchChange,
  placeholder,
  search,
}: {
  children?: ReactNode;
  className?: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  search: string;
}) {
  return (
    <div
      className={cn("flex w-full min-w-0 items-center gap-2", className)}
      data-slot="catalog-grid-search"
    >
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="text-muted-foreground/60 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          aria-label={placeholder}
          className="border-border/40 placeholder:text-muted-foreground/50 focus-visible:border-border h-10 bg-transparent pl-9 focus-visible:ring-0"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={search}
        />
      </div>
      {children}
    </div>
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
  const isFilterActive = context?.isFilterActive ?? false;

  const isEmpty = isFilterActive && filteredIds?.size === 0;

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
  id: CatalogGridItemKey;
  prefetch?: boolean;
}) {
  const context = useCatalogGridContext();
  const filteredIds = context?.filteredIds ?? null;

  if (filteredIds && !filteredIds.has(String(id))) {
    return null;
  }

  return (
    <GridGroupItem id={getCatalogItemTargetId(id)}>
      <GridItem className={className} render={<Link href={href} prefetch={prefetch} />}>
        {children}
      </GridItem>
    </GridGroupItem>
  );
}
