"use client";

import { ClientLink } from "@/i18n/client-link";
import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import { normalizeString } from "@zoonk/utils/string";
import { CheckIcon, SearchIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { type ReactNode, createContext, use, useMemo } from "react";

const CatalogListContext = createContext<{
  filteredIds: Set<string> | null;
  isSearchActive: boolean;
} | null>(null);

export function CatalogList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)} data-slot="catalog-list">
      {children}
    </div>
  );
}

export function CatalogListSearch<T extends { id: string | number; title: string }>({
  className,
  items,
  placeholder,
  ariaLabel,
  children,
}: {
  className?: string;
  items: T[];
  placeholder: string;
  ariaLabel: string;
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
    return {
      filteredIds: new Set(matching.map((item) => String(item.id))),
      isSearchActive: true,
    };
  }, [items, search]);

  return (
    <CatalogListContext value={{ filteredIds, isSearchActive }}>
      <div className={cn("relative", className)} data-slot="catalog-list-search">
        <SearchIcon className="text-muted-foreground/60 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          aria-label={ariaLabel}
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

export function CatalogListContent({
  children,
  className,
  emptyMessage,
}: {
  children: ReactNode;
  className?: string;
  emptyMessage?: string;
}) {
  const context = use(CatalogListContext);
  const filteredIds = context?.filteredIds ?? null;
  const isSearchActive = context?.isSearchActive ?? false;

  const isEmpty = isSearchActive && filteredIds?.size === 0;

  if (isEmpty && emptyMessage) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm" data-slot="catalog-list-empty">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-col", className)} data-slot="catalog-list-content" role="list">
      {children}
    </ul>
  );
}

export function CatalogListItem({
  children,
  className,
  href,
  id,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  id: string | number | bigint;
}) {
  const context = use(CatalogListContext);
  const filteredIds = context?.filteredIds ?? null;

  if (filteredIds && !filteredIds.has(String(id))) {
    return null;
  }

  return (
    <li data-slot="catalog-list-item">
      <ClientLink
        className={cn(
          "hover:bg-muted/30 -mx-3 flex items-start gap-3 rounded-lg px-3 py-3.5 text-left transition-colors",
          className,
        )}
        href={href}
      >
        {children}
      </ClientLink>
    </li>
  );
}

export function CatalogListItemPosition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-muted-foreground/40 w-6 shrink-0 pt-0.5 font-mono text-sm leading-snug tabular-nums",
        className,
      )}
      data-slot="catalog-list-item-position"
    >
      {children}
    </span>
  );
}

export function CatalogListItemIndicator({
  className,
  completed,
  completedLabel,
  notCompletedLabel,
}: {
  className?: string;
  completed: boolean;
  completedLabel: string;
  notCompletedLabel: string;
}) {
  if (completed) {
    return (
      <div
        aria-label={completedLabel}
        className={cn(
          "bg-success/60 text-background mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full",
          className,
        )}
        data-slot="catalog-list-item-indicator"
        role="img"
      >
        <CheckIcon aria-hidden="true" className="size-3" />
      </div>
    );
  }

  return (
    <div
      aria-label={notCompletedLabel}
      className={cn(
        "border-muted-foreground/30 mt-0.5 size-3.5 shrink-0 rounded-full border-2",
        className,
      )}
      data-slot="catalog-list-item-indicator"
      role="img"
    />
  );
}

export function CatalogListItemContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
      data-slot="catalog-list-item-content"
    >
      {children}
    </div>
  );
}

export function CatalogListItemTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("text-foreground/90 text-sm leading-snug font-medium", className)}
      data-slot="catalog-list-item-title"
    >
      {children}
    </span>
  );
}

export function CatalogListItemDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("text-muted-foreground line-clamp-2 pt-0.5 text-sm leading-snug", className)}
      data-slot="catalog-list-item-description"
    >
      {children}
    </span>
  );
}
