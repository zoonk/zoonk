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
  const context = use(CatalogListContext);
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

export function CatalogListContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      {...props}
      className={cn("-mt-3.5 flex flex-col", className)}
      data-slot="catalog-list-content"
      role="list"
    />
  );
}

export function CatalogListItem({
  children,
  className,
  href,
  id,
  prefetch,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  id: string | number | bigint;
  prefetch?: boolean;
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
        prefetch={prefetch}
      >
        {children}
      </ClientLink>
    </li>
  );
}

export function CatalogListItemPosition({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      {...props}
      className={cn(
        "text-muted-foreground/40 w-6 shrink-0 pt-0.5 font-mono text-sm leading-snug tabular-nums",
        className,
      )}
      data-slot="catalog-list-item-position"
    />
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
          "bg-success/60 text-background flex size-3.5 shrink-0 items-center justify-center self-center rounded-full",
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
        "border-muted-foreground/30 size-3.5 shrink-0 self-center rounded-full border-2",
        className,
      )}
      data-slot="catalog-list-item-indicator"
      role="img"
    />
  );
}

export function CatalogListItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
      data-slot="catalog-list-item-content"
    />
  );
}

export function CatalogListItemTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      {...props}
      className={cn("text-foreground/90 text-sm leading-snug font-medium", className)}
      data-slot="catalog-list-item-title"
    />
  );
}

export function CatalogListItemDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      {...props}
      className={cn("text-muted-foreground line-clamp-2 pt-0.5 text-sm leading-snug", className)}
      data-slot="catalog-list-item-description"
    />
  );
}

export function CatalogListItemProgress({
  completed,
  completedLabel,
  total,
}: {
  completed: number;
  completedLabel: string;
  total: number;
}) {
  if (total === 0 || completed === 0) {
    return null;
  }

  if (completed >= total) {
    return (
      <CatalogListItemIndicator completed completedLabel={completedLabel} notCompletedLabel="" />
    );
  }

  return (
    <span
      aria-label={`${completed} of ${total} completed`}
      className="text-muted-foreground/60 shrink-0 self-center font-mono text-xs tabular-nums"
      data-slot="catalog-list-item-progress"
    >
      {completed}/{total}
    </span>
  );
}
