import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

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

// An empty state's one mark is 24 px. Lucide draws its ink 2 to 3 px inside that box, so the icon
// variant pulls it 2 px out to start the ink on the text's edge.
const emptyMediaVariants = cva(
  "text-muted-foreground mb-2 flex shrink-0 items-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: { variant: "default" },
    variants: { variant: { default: "", icon: "-ms-0.5 [&_svg:not([class*='size-'])]:size-6" } },
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
      className={cn("text-reading leading-snug font-semibold tracking-[-0.01em]", className)}
      data-slot="empty-title"
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      className={cn(
        "text-muted-foreground [&>a:hover]:text-foreground text-compact leading-snug text-pretty [&>a]:underline [&>a]:underline-offset-4",
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
