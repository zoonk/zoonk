"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { WIDE_CONTENT_MAX_WIDTH_CLASS } from "@zoonk/ui/components/layout";
import { Popover, PopoverContent, PopoverTrigger } from "@zoonk/ui/components/popover";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { ChevronRightIcon, SparklesIcon } from "lucide-react";

const mediaCardVariants = cva(
  "mx-auto grid w-full grid-cols-[auto_minmax(0,1fr)] items-stretch gap-3 px-4 sm:gap-4",
  {
    defaultVariants: { variant: "default" },
    variants: {
      variant: {
        default: WIDE_CONTENT_MAX_WIDTH_CLASS,
        sidebar:
          "max-w-none px-0 lg:grid-cols-1 lg:items-start lg:**:data-[slot=media-card-description]:line-clamp-5 lg:**:data-[slot=media-card-icon]:h-auto lg:**:data-[slot=media-card-icon]:min-h-0 lg:**:data-[slot=media-card-icon]:w-full lg:**:data-[slot=media-card-icon]:min-w-0 lg:**:data-[slot=media-card-image]:h-auto lg:**:data-[slot=media-card-image]:min-h-0 lg:**:data-[slot=media-card-image]:w-full lg:**:data-[slot=media-card-image]:min-w-0 lg:**:data-[slot=media-card-title]:text-2xl",
      },
    },
  },
);

type MediaCardVariantProps = VariantProps<typeof mediaCardVariants>;

export function MediaCard({
  children,
  className,
  variant,
}: React.ComponentProps<"header"> & MediaCardVariantProps) {
  return (
    <Popover>
      <header
        className={cn(mediaCardVariants({ variant }), className)}
        data-variant={variant}
        data-slot="media-card"
      >
        {children}
      </header>
    </Popover>
  );
}

export function MediaCardTrigger({ children, className }: React.ComponentProps<"div">) {
  return (
    <PopoverTrigger
      className={cn("w-full cursor-pointer text-left", className)}
      data-slot="media-card-trigger"
      nativeButton={false}
      render={<div />}
    >
      {children}
    </PopoverTrigger>
  );
}

export function MediaCardImage({ children, className }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative aspect-square h-full min-h-20 min-w-20 overflow-hidden rounded-xl sm:min-h-32 sm:min-w-32",
        className,
      )}
      data-slot="media-card-image"
    >
      {children}
    </div>
  );
}

export function MediaCardIcon({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted/70 flex aspect-square h-full min-h-20 min-w-20 items-center justify-center rounded-xl sm:min-h-32 sm:min-w-32",
        className,
      )}
      data-slot="media-card-icon"
      {...props}
    >
      {children}
    </div>
  );
}

export function MediaCardIconText({ children, className }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground/60 font-mono text-2xl tracking-tight tabular-nums",
        className,
      )}
      data-slot="media-card-icon-text"
    >
      {children}
    </span>
  );
}

export function MediaCardContent({ children, className }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col [&:has([data-slot=media-card-breadcrumb])_[data-slot=media-card-description]]:line-clamp-2",
        className,
      )}
      data-slot="media-card-content"
    >
      {children}
    </div>
  );
}

export function MediaCardBreadcrumb({ children, className }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="breadcrumb"
      className={cn("text-muted-foreground pb-1 text-xs", className)}
      data-slot="media-card-breadcrumb"
    >
      {children}
    </nav>
  );
}

export function MediaCardHeader({ children, className }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-[1fr_auto] items-center gap-1 pb-1", className)}
      data-slot="media-card-header"
    >
      {children}
    </div>
  );
}

export function MediaCardTitle({ children, className }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "text-foreground/90 line-clamp-2 text-base leading-none font-semibold tracking-tight text-balance sm:line-clamp-none sm:text-2xl sm:leading-tight md:text-3xl",
        className,
      )}
      data-slot="media-card-title"
    >
      {children}
    </h1>
  );
}

export function MediaCardDescription({ children, className }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground mt-1.5 line-clamp-3 text-sm leading-snug text-pretty sm:text-base sm:leading-relaxed",
        className,
      )}
      data-slot="media-card-description"
    >
      {children}
    </p>
  );
}

export function MediaCardIndicator({ className }: { className?: string }) {
  return (
    <ChevronRightIcon
      aria-hidden="true"
      className={cn("text-muted-foreground/40 size-4 shrink-0", className)}
      data-slot="media-card-indicator"
    />
  );
}

export function MediaCardPopover({ children, className }: React.ComponentProps<"div">) {
  return (
    <PopoverContent
      align="start"
      className={cn(
        "max-h-80 w-[calc(100vw-2rem)] max-w-sm overflow-y-auto overscroll-contain sm:w-96",
        className,
      )}
      data-slot="media-card-popover"
    >
      <div
        className="flex flex-col outline-none"
        data-slot="media-card-popover-inner"
        tabIndex={-1}
      >
        {children}
      </div>
    </PopoverContent>
  );
}

export function MediaCardPopoverText({ children, className }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-pretty", className)}
      data-slot="media-card-popover-text"
    >
      {children}
    </p>
  );
}

export function MediaCardPopoverMeta({ children, className }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-3 flex flex-col gap-2 border-t pt-3", className)}
      data-slot="media-card-popover-meta"
    >
      {children}
    </div>
  );
}

export function MediaCardPopoverSource({ children, className }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground flex flex-wrap items-center text-xs", className)}
      data-slot="media-card-popover-source"
    >
      {children}
    </span>
  );
}

export function MediaCardPopoverSourceLink({
  className,
  render,
  ...props
}: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      { className: cn("hover:text-foreground transition-colors", className) },
      props,
    ),
    render,
    state: { slot: "media-card-popover-source-link" },
  });
}

export function MediaCardPopoverSourceSeparator({
  children,
  className,
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("text-muted-foreground/40 mx-1.5", className)}
      data-slot="media-card-popover-source-separator"
    >
      {children ?? "/"}
    </span>
  );
}

export function MediaCardPopoverBadges({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} data-slot="media-card-popover-badges">
      {children}
    </div>
  );
}

export function MediaCardPopoverAILabel({ children, className }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground flex items-center gap-1.5 text-xs", className)}
      data-slot="media-card-popover-ai-label"
    >
      <SparklesIcon aria-hidden="true" className="size-3 shrink-0" />
      {children}
    </span>
  );
}

export function MediaCardSkeleton({
  className,
  variant,
}: { className?: string } & MediaCardVariantProps) {
  const skeletonImageClassName =
    variant === "sidebar" ? "lg:h-auto lg:min-h-0 lg:min-w-0 lg:w-full" : undefined;

  return (
    <header
      className={cn(mediaCardVariants({ variant }), className)}
      data-variant={variant}
      data-slot="media-card"
    >
      <Skeleton
        className={cn(
          "aspect-square h-full min-h-20 min-w-20 rounded-xl sm:min-h-32 sm:min-w-32",
          skeletonImageClassName,
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="grid grid-cols-[1fr_auto] items-center gap-1">
          <Skeleton className="h-5 w-3/4 sm:h-6" />
          <Skeleton className="size-4 shrink-0 rounded-full" />
        </div>
        <Skeleton className="mt-1 h-12 w-full sm:h-14" />
      </div>
    </header>
  );
}
