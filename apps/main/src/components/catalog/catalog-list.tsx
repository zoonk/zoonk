"use client";

import { CatalogListItem as CatalogListItemRoot } from "@zoonk/ui/components/catalog-list";
import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import { normalizeString } from "@zoonk/utils/string";
import { SearchIcon } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { type ReactNode, useMemo } from "react";
import { CatalogListContext, useCatalogListContext } from "./catalog-list-context";

export function CatalogContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "mx-auto flex w-full flex-col gap-4 px-4 pt-4 pb-8 md:pb-10 lg:max-w-xl",
        className,
      )}
      data-slot="catalog-container"
    />
  );
}

export function CatalogToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} className={cn("flex gap-2", className)} data-slot="catalog-toolbar" />;
}

export function CatalogList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div {...props} className={cn("flex flex-col gap-4", className)} data-slot="catalog-list" />
  );
}

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
      <div className={cn("relative", className)} data-slot="catalog-list-search">
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
      {children}
    </CatalogListContext>
  );
}

export function CatalogListEmpty({ className, ...props }: React.ComponentProps<"p">) {
  const context = useCatalogListContext();
  const filteredIds = context?.filteredIds ?? null;
  const isSearchActive = context?.isSearchActive ?? false;

  const isEmpty = isSearchActive && filteredIds?.size === 0;

  if (!isEmpty) {
    return null;
  }

  return (
    <p
      {...props}
      className={cn("text-muted-foreground py-8 text-center text-sm", className)}
      data-slot="catalog-list-empty"
    />
  );
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
    <CatalogListItemRoot className={className} render={<Link href={href} prefetch={prefetch} />}>
      {children}
    </CatalogListItemRoot>
  );
}
