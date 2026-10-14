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
 * On phones a long collection reads best as a list: one surface of rows, each
 * with its picture beside its title and description, set apart by their spacing
 * and pictures rather than lines between them. From `sm` it's a grid of as many columns of at
 * least 14rem as the width holds, so a full-width grid fills large screens while
 * each tile's text keeps a readable measure. The pane variant keeps card widths
 * stable when a collection shares the viewport with a persistent info rail.
 */
const gridGroupVariants = cva("grid sm:gap-4", {
  defaultVariants: { variant: "default" },
  variants: {
    variant: {
      default: cn(
        "grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] max-sm:[&>*+*]:border-t",
      ),
      pane: "gap-3 sm:grid-cols-2 xl:grid-cols-3",
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
 * A tile is a card with its picture as the anchor, then the title and a short
 * description, so browsing feels like picking the next thing to learn. On phones
 * it's a row of its group's list instead: the picture on the left, the words
 * beside it.
 */
export function GridItem({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "group/grid-item focus-visible:border-ring focus-visible:ring-ring/50 flex h-full w-full min-w-0 outline-none focus-visible:ring-[3px]",
          "items-center gap-3 transition-colors max-sm:rounded-lg max-sm:focus-visible:ring-inset",
          "sm:bg-card sm:ring-border sm:hover:ring-input sm:flex-col sm:items-stretch sm:gap-0 sm:rounded-xl sm:p-4 sm:ring-1 sm:transition-[--tw-ring-color] sm:duration-150",
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
 * Tile media centers the artwork at the top of the card without a frame, so the
 * picture itself is the anchor and mixed asset sizes still feel intentional.
 */
export function GridItemMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-option flex size-12 shrink-0 items-center justify-center overflow-hidden max-sm:bg-white max-sm:ring-1 max-sm:ring-black/5 sm:mx-auto sm:size-28 sm:rounded-2xl dark:max-sm:ring-white/10 [&_img]:size-full [&_img]:object-contain",
        className,
      )}
      data-slot="grid-item-media"
      {...props}
    />
  );
}

/**
 * Tile content sits under the media and takes the card's remaining height; on
 * phones it sits beside the picture.
 */
export function GridItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-start gap-1 py-3.5 sm:gap-1.5 sm:px-1 sm:pt-3 sm:pb-0",
        className,
      )}
      data-slot="grid-item-content"
      {...props}
    />
  );
}

/** Tile titles lead the text and wrap to a second line before they're cut. */
export function GridItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "line-clamp-2 text-[0.9375rem] leading-snug font-semibold text-balance sm:text-base sm:leading-tight sm:tracking-[-0.01em]",
        className,
      )}
      data-slot="grid-item-title"
      {...props}
    />
  );
}

/**
 * Descriptions give just enough supporting context to choose a tile while the
 * title remains the primary identity.
 */
export function GridItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground line-clamp-2 text-[0.8125rem] leading-snug text-pretty sm:line-clamp-3 sm:text-sm sm:leading-relaxed",
        className,
      )}
      data-slot="grid-item-description"
      {...props}
    />
  );
}

const DEFAULT_GRID_SKELETON_COUNT = 6;

/**
 * The shared skeleton mirrors the same media and text block as real grid items
 * so loading states do not invent a second layout.
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
            <Skeleton className="rounded-option size-12 shrink-0 sm:mx-auto sm:size-28 sm:rounded-2xl" />
            <div className="flex flex-1 flex-col items-start gap-2 py-3.5 sm:pt-3 sm:pb-0">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </GridItem>
        </GridGroupItem>
      ))}
    </GridGroup>
  );
}
