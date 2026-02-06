"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Popover, PopoverContent, PopoverTrigger } from "@zoonk/ui/components/popover";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon, SparklesIcon } from "lucide-react";

export function MediaCard({ children, className }: React.ComponentProps<"header">) {
  return (
    <Popover>
      <header
        className={cn("mx-auto flex w-full items-start gap-4 px-4 lg:max-w-xl", className)}
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
      className={cn("relative size-20 shrink-0 overflow-hidden rounded-xl sm:size-24", className)}
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
        "bg-muted/70 flex size-20 shrink-0 items-center justify-center rounded-xl sm:size-24",
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
    <div className={cn("flex min-w-0 flex-1 flex-col", className)} data-slot="media-card-content">
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
        "text-foreground/90 text-base leading-none font-semibold tracking-tight text-balance sm:text-lg md:text-xl",
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
        "text-muted-foreground mt-0.5 line-clamp-2 text-sm leading-snug text-pretty md:leading-relaxed",
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
      {
        className: cn("hover:text-foreground transition-colors", className),
      },
      props,
    ),
    render,
    state: {
      slot: "media-card-popover-source-link",
    },
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

export function MediaCardPopoverAIWarning({ children, className }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-md p-2.5 text-xs leading-relaxed",
        className,
      )}
      data-slot="media-card-popover-ai-warning"
    >
      <SparklesIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function MediaCardSkeleton({ className }: { className?: string }) {
  return (
    <header
      className={cn("mx-auto flex w-full items-start gap-4 px-4 lg:max-w-xl", className)}
      data-slot="media-card"
    >
      <Skeleton className="size-20 shrink-0 rounded-xl sm:size-24" />
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
