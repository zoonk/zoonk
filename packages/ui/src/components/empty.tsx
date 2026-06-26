import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-lg border-dashed p-12 text-center text-balance",
        className,
      )}
      data-slot="empty"
      {...props}
    />
  );
}

const emptyHeaderVariants = cva("flex max-w-sm flex-col gap-2", {
  defaultVariants: { align: "center" },
  variants: { align: { center: "items-center", start: "items-start text-left" } },
});

function EmptyHeader({
  align,
  className,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyHeaderVariants>) {
  return (
    <div
      className={emptyHeaderVariants({ align, className })}
      data-slot="empty-header"
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: { variant: "default" },
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
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
      className={cn("text-lg font-medium tracking-tight", className)}
      data-slot="empty-title"
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      className={cn(
        "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
        className,
      )}
      data-slot="empty-description"
      {...props}
    />
  );
}

const emptyContentVariants = cva(
  "flex w-full max-w-sm min-w-0 flex-col gap-4 text-sm text-balance",
  {
    defaultVariants: { align: "center" },
    variants: { align: { center: "items-center", stretch: "items-stretch" } },
  },
);

function EmptyContent({
  align,
  className,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyContentVariants>) {
  return (
    <div
      className={emptyContentVariants({ align, className })}
      data-slot="empty-content"
      {...props}
    />
  );
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
