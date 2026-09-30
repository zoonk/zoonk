import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { buttonVariants } from "@zoonk/ui/components/button";
import { WIDE_CONTENT_MAX_WIDTH_CLASS } from "@zoonk/ui/components/layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { ArrowUpIcon } from "lucide-react";

/**
 * Grid frames provide the shared wide browsing column for tile-based pages, so
 * callers can change the catalog width in one component instead of repeating
 * page-level padding and max-width classes.
 */
const gridVariants = cva("flex w-full flex-col gap-5", {
  defaultVariants: { variant: "default" },
  variants: {
    variant: {
      default: cn("mx-auto px-4 pb-8 md:pb-10", WIDE_CONTENT_MAX_WIDTH_CLASS),
      pane: "pb-0 md:pb-0",
    },
  },
});

type GridProps = React.ComponentProps<"section"> & VariantProps<typeof gridVariants>;

export function Grid({ className, variant, ...props }: GridProps) {
  return (
    <section className={cn(gridVariants({ variant }), className)} data-slot="grid" {...props} />
  );
}

/**
 * Grid content separates toolbar-level controls from the tile group while
 * keeping the larger grid spacing consistent across catalog surfaces.
 */
export function GridContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} data-slot="grid-content" {...props} />
  );
}

type GridBackToTopProps = Omit<React.ComponentProps<"a">, "href"> & { href?: string };

/**
 * Back-to-top is a normal anchor because grid pages only need a quiet way back
 * to the page header, and keeping the behavior browser-native avoids scroll
 * state or page-specific client logic.
 */
export function GridBackToTop({
  children,
  className,
  href = "#top",
  ...props
}: GridBackToTopProps) {
  return (
    <a
      className={cn(
        buttonVariants({ size: "sm", variant: "ghost" }),
        "text-muted-foreground hover:text-foreground px-2 text-xs",
        className,
      )}
      data-slot="grid-back-to-top"
      href={href}
      {...props}
    >
      <ArrowUpIcon aria-hidden="true" className="size-3.5" />
      {children}
    </a>
  );
}

/**
 * Grid groups define the shared responsive browsing rhythm for tile-based
 * collections without coupling the layout to any app-specific data or routing.
 * The pane variant keeps card widths stable when a collection shares the
 * viewport with a persistent info rail.
 */
const gridGroupVariants = cva("grid grid-cols-1 gap-4", {
  defaultVariants: { variant: "default" },
  variants: {
    variant: {
      default: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
      pane: "sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
    },
  },
});

type GridGroupVariant = NonNullable<VariantProps<typeof gridGroupVariants>["variant"]>;

type GridGroupProps = React.ComponentProps<"div"> & VariantProps<typeof gridGroupVariants>;

export function GridGroup({ className, variant, ...props }: GridGroupProps) {
  return (
    <div
      className={cn(gridGroupVariants({ variant }), className)}
      data-slot="grid-group"
      role="list"
      {...props}
    />
  );
}

/**
 * Grid group items keep list semantics separate from the clickable tile so a
 * card can be both part of a collection and still expose its natural link role.
 */
export function GridGroupItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0", className)}
      data-slot="grid-group-item"
      role="listitem"
      {...props}
    />
  );
}

/**
 * Grid items are often links, but keeping the render target composable lets
 * each app provide its own router while preserving one shared tile treatment.
 */
export function GridItem({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "group/grid-item bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-card dark:ring-border/50 dark:hover:ring-border flex h-full min-h-60 w-full min-w-0 flex-col justify-between rounded-3xl p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_rgb(0_0_0/0.06)] transition-all duration-150 outline-none hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(0_0_0/0.05),0_14px_36px_rgb(0_0_0/0.08)] focus-visible:ring-[3px] dark:shadow-[0_1px_2px_rgb(0_0_0/0.35),0_16px_40px_rgb(0_0_0/0.3)] dark:ring-1 dark:hover:shadow-[0_2px_4px_rgb(0_0_0/0.45),0_20px_52px_rgb(0_0_0/0.42)]",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "grid-item" },
  });
}

/**
 * Tile media keeps artwork in a stable circular frame so mixed asset sizes
 * still feel intentional without adding another colored surface.
 */
export function GridItemMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full sm:size-32 [&_img]:size-[86%] [&_img]:rounded-[2rem] [&_img]:object-cover",
        className,
      )}
      data-slot="grid-item-media"
      {...props}
    />
  );
}

/**
 * Tile content stretches between media and status so cards of different copy
 * lengths keep a consistent bottom rhythm.
 */
export function GridItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col items-start gap-2 pt-5", className)}
      data-slot="grid-item-content"
      {...props}
    />
  );
}

/**
 * Tile titles wrap because grid items need enough identity to be scannable
 * without forcing every collection into dense list rows.
 */
export function GridItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "line-clamp-2 text-base leading-tight font-bold text-balance sm:text-lg",
        className,
      )}
      data-slot="grid-item-title"
      {...props}
    />
  );
}

/**
 * Descriptions give just enough supporting context to choose a tile while the
 * title remains the primary identity. Pass a short summary (e.g. a first
 * sentence): the tile shows all of it rather than cutting it off mid-thought.
 */
export function GridItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground text-sm leading-relaxed text-pretty sm:text-base",
        className,
      )}
      data-slot="grid-item-description"
      {...props}
    />
  );
}

const DEFAULT_GRID_SKELETON_COUNT = 6;

/**
 * The shared skeleton mirrors the same circular media, text block, and footer
 * rhythm as real grid items so loading states do not invent a second layout.
 */
export function GridSkeleton({
  count = DEFAULT_GRID_SKELETON_COUNT,
  variant,
}: {
  count?: number;
  variant?: GridGroupVariant;
}) {
  return (
    <GridGroup variant={variant}>
      {Array.from({ length: count }).map((_, index) => (
        // oxlint-disable-next-line eslint/no-array-index-key -- Static skeleton placeholders.
        <GridGroupItem key={index}>
          <GridItem>
            <Skeleton className="mx-auto size-28 rounded-full sm:size-32" />
            <div className="flex flex-1 flex-col items-start gap-2 pt-5">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="mt-1 h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="mt-4 h-7 w-24 rounded-full" />
          </GridItem>
        </GridGroupItem>
      ))}
    </GridGroup>
  );
}
