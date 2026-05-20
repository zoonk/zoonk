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
 * Lists share one centered browsing column, whether the page is only a list or
 * the list is one section below a richer page header.
 */
export function List({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("mx-auto flex w-full flex-col gap-4 pb-8 md:pb-10 lg:max-w-xl", className)}
      data-slot="list"
      {...props}
    />
  );
}

/**
 * Search, filters, and actions sit above rows, so the toolbar keeps that
 * spacing stable without coupling the shared list to any state.
 */
export function ListToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex gap-2 px-4", className)} data-slot="list-toolbar" {...props} />;
}

/**
 * The list frame separates toolbar-level content from row groups while leaving
 * callers free to compose search, empty states, and item groups inside it.
 */
export function ListContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-4", className)} data-slot="list-content" {...props} />
  );
}

/**
 * Empty messages should use the same quiet centered treatment anywhere a caller
 * decides there are no rows to show.
 */
export function ListEmpty({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground py-8 text-center text-sm", className)}
      data-slot="list-empty"
      {...props}
    />
  );
}

/**
 * List groups pull the first row's hover padding into the section gap, so the
 * spacing measures to visible content instead of the invisible hit area.
 */
export function ListGroup({ className, layout = "list", ...props }: ItemGroupProps) {
  return (
    <ItemGroup
      className={cn(layout === "list" && "-mt-2.5", className)}
      layout={layout}
      {...props}
    />
  );
}

/**
 * Rows are often links, but keeping the render target composable lets each app
 * provide its own router component.
 */
export function ListItem({ className, ...props }: ItemProps) {
  return <Item className={cn("group/list-item py-2.5", className)} {...props} />;
}

/**
 * Thumbnail media uses the same 64px square so rows from different domains keep
 * a consistent visual rhythm.
 */
export function ListItemImage({ className, ...props }: ItemMediaProps) {
  return <ItemMedia className={cn("size-16 shadow", className)} variant="image" {...props} />;
}

/**
 * Some rows do not have artwork, so the icon slot preserves the same footprint
 * without forcing every caller to invent placeholder spacing.
 */
export function ListItemIcon({ className, ...props }: ItemMediaProps) {
  return <ItemMedia className={cn("size-16 shadow", className)} variant="icon" {...props} />;
}

/**
 * Titles and descriptions should remain one vertical text block so status
 * details do not compete with the thumbnail or row action.
 */
export function ListItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return <ItemContent className={cn("gap-1", className)} {...props} />;
}

/**
 * Title-level status belongs beside the title instead of in a separate metadata
 * row, so rows stay compact while completion remains scannable.
 */
export function ListItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2", className)}
      data-slot="list-item-header"
      {...props}
    />
  );
}

/**
 * Generated lesson titles can be specific and long, so list titles wrap instead
 * of hiding important curriculum information.
 */
export function ListItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <ItemTitle className={cn("line-clamp-1 w-auto", className)} {...props} />;
}

/**
 * Descriptions stay secondary and capped; the title carries identity while this
 * copy gives just enough context to choose the next item.
 */
export function ListItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <ItemDescription className={className} {...props} />;
}

/**
 * Completed status uses a small success icon so completion reads as a state,
 * not as an extra piece of row metadata.
 */
export function ListItemStatusCompleted({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-success mt-0.5 flex size-4 shrink-0 items-center justify-center",
        className,
      )}
      data-slot="list-item-status"
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
export function ListItemStatusProgress({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center text-blue-500",
        className,
      )}
      data-slot="list-item-status"
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
 * rows, avoiding different loading states across list surfaces.
 */
export function ListSkeleton({ count = DEFAULT_LIST_COUNT }: { count?: number }) {
  return (
    <ListGroup>
      {Array.from({ length: count }).map((_, index) => (
        // oxlint-disable-next-line eslint/no-array-index-key -- Static skeleton placeholders.
        <ListItem key={index}>
          <ListItemImage className="translate-y-0.5 self-start">
            <Skeleton className="size-full" />
          </ListItemImage>

          <ListItemContent className="pt-1">
            <Skeleton className="h-4 w-full max-w-48" />
            <Skeleton className="h-4 w-full max-w-72" />
          </ListItemContent>
        </ListItem>
      ))}
    </ListGroup>
  );
}
