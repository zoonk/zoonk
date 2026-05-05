"use client";

import { Input } from "@zoonk/ui/components/input";
import { ListEmpty, ListItem } from "@zoonk/ui/components/list";
import { cn } from "@zoonk/ui/lib/utils";
import { normalizeString } from "@zoonk/utils/string";
import { SearchIcon } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { type ReactNode, useMemo } from "react";
import { CatalogListContext, useCatalogListContext } from "./catalog-list-context";

export function CatalogListSearch<T extends { id: string | number; title: string }>({
  className,
  items,
  placeholder,
  children,
}: {
  className?: string;
  items: T[];
  placeholder: string;
  children: ReactNode;
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

    const matching = items.filter((item) => normalizeString(item.title).includes(query));
    return { filteredIds: new Set(matching.map((item) => String(item.id))), isSearchActive: true };
  }, [items, search]);

  return (
    <CatalogListContext value={{ filteredIds, isSearchActive }}>
      <div className={cn("px-4", className)} data-slot="catalog-list-search">
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
    </CatalogListContext>
  );
}

/**
 * The main app decides whether search filtering produced an empty result, while
 * the shared UI component owns the paragraph styling.
 */
export function CatalogListEmpty({ className, ...props }: React.ComponentProps<"p">) {
  const context = useCatalogListContext();
  const filteredIds = context?.filteredIds ?? null;
  const isSearchActive = context?.isSearchActive ?? false;

  const isEmpty = isSearchActive && filteredIds?.size === 0;

  if (!isEmpty) {
    return null;
  }

  return <ListEmpty className={className} {...props} />;
}

export function CatalogListItem<Href extends string>({
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
  const context = useCatalogListContext();
  const filteredIds = context?.filteredIds ?? null;

  if (filteredIds && !filteredIds.has(String(id))) {
    return null;
  }

  return (
    <ListItem className={className} render={<Link href={href} prefetch={prefetch} />}>
      {children}
    </ListItem>
  );
}
