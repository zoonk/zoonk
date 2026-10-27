import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

/**
 * A place with nothing in it yet, said plainly on the page: a quiet glyph, a short title, one line
 * and the one thing to do, aligned to the column's edge like the content it stands in for. No
 * card, no tile.
 */
function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col items-start gap-4 text-left text-balance",
        className,
      )}
      data-slot="empty"
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex max-w-sm flex-col gap-1", className)}
      data-slot="empty-header"
      {...props}
    />
  );
}

/** A bare, muted glyph above the title; `icon` is the same glyph, kept for its callers. */
const emptyMediaVariants = cva(
  "text-muted-foreground mb-2 flex shrink-0 items-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: { variant: "default" },
    variants: { variant: { default: "", icon: "[&_svg:not([class*='size-'])]:size-5" } },
  },
);

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      className={cn(emptyMediaVariants({ className, variant }))}
      data-slot="empty-icon"
      data-variant={variant}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-[0.9375rem] leading-snug font-[560] tracking-[-0.01em]", className)}
      data-slot="empty-title"
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      className={cn(
        "text-muted-foreground [&>a:hover]:text-foreground text-[0.8125rem] leading-snug text-pretty [&>a]:underline [&>a]:underline-offset-4",
        className,
      )}
      data-slot="empty-description"
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-sm min-w-0 flex-col items-start gap-3 text-sm", className)}
      data-slot="empty-content"
      {...props}
    />
  );
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
