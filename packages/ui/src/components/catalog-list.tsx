import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  type ItemGroupProps,
  ItemMedia,
  type ItemMediaProps,
  type ItemProps,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";

/**
 * Catalog surfaces all use the same calm list rhythm, so this group keeps the
 * spacing consistent for courses, chapters, and lessons.
 */
export function CatalogListGroup({ className, layout = "list", ...props }: ItemGroupProps) {
  return <ItemGroup className={className} layout={layout} {...props} />;
}

/**
 * Catalog rows are links in most products, but keeping the render target
 * composable lets each app provide its own router component.
 */
export function CatalogListItem({ className, ...props }: ItemProps) {
  return <Item className={cn("group/catalog-list-item -mx-3 px-3", className)} {...props} />;
}

/**
 * Thumbnail media uses the same 64px square as the course directory so nested
 * catalog pages feel like part of the same browsing system.
 */
export function CatalogListItemImage({ className, ...props }: ItemMediaProps) {
  return <ItemMedia className={cn("size-16", className)} variant="image" {...props} />;
}

/**
 * Some catalog rows do not have artwork yet, so the icon slot preserves the
 * same footprint without forcing every caller to invent placeholder spacing.
 */
export function CatalogListItemIcon({ className, ...props }: ItemMediaProps) {
  return <ItemMedia className={cn("size-16", className)} variant="icon" {...props} />;
}

/**
 * Titles and descriptions should remain one vertical text block so status
 * details do not compete with the thumbnail or row action.
 */
export function CatalogListItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return <ItemContent className={cn("gap-1", className)} {...props} />;
}

/**
 * Title-level status belongs beside the title instead of in a separate metadata
 * row, so rows stay compact while completion remains scannable.
 */
export function CatalogListItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2", className)}
      data-slot="catalog-list-item-header"
      {...props}
    />
  );
}

/**
 * Generated lesson titles can be specific and long, so list titles wrap instead
 * of hiding important curriculum information.
 */
export function CatalogListItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <ItemTitle className={cn("line-clamp-none w-auto", className)} {...props} />;
}

/**
 * Descriptions stay secondary and capped; the title carries identity while this
 * copy gives just enough context to choose the next item.
 */
export function CatalogListItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <ItemDescription className={cn(className)} {...props} />;
}

/**
 * Completed status uses a small success icon so completion reads as a state,
 * not as an extra piece of row metadata.
 */
export function CatalogListItemStatusCompleted({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-success mt-0.5 flex size-4 shrink-0 items-center justify-center",
        className,
      )}
      data-slot="catalog-list-item-status"
      role="img"
      {...props}
    >
      <CircleCheckIcon aria-hidden="true" className="size-3.5" />
    </span>
  );
}

/**
 * Partial progress uses a dashed progress icon so it feels unfinished without
 * looking like an error or warning.
 */
export function CatalogListItemStatusProgress({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center text-blue-500",
        className,
      )}
      data-slot="catalog-list-item-status"
      role="img"
      {...props}
    >
      <CircleDashedIcon aria-hidden="true" className="size-3.5" />
    </span>
  );
}

const DEFAULT_LIST_COUNT = 5;

/**
 * The shared skeleton mirrors the same thumbnail and text rhythm as the real
 * rows, avoiding different loading states across catalog surfaces.
 */
export function CatalogListSkeleton({ count = DEFAULT_LIST_COUNT }: { count?: number }) {
  return (
    <ItemGroup>
      {Array.from({ length: count }).map((_, index) => (
        // oxlint-disable-next-line eslint/no-array-index-key -- Static skeleton placeholders.
        <Item className="-mx-3 px-3" key={index}>
          <ItemMedia className="size-16 translate-y-0.5 self-start" variant="image">
            <Skeleton className="size-full" />
          </ItemMedia>

          <ItemContent className="pt-1">
            <Skeleton className="h-4 w-full max-w-48" />
            <Skeleton className="h-4 w-full max-w-72" />
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
