import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { Skeleton } from "./skeleton";

const buttonVariants = cva(
  "group/button focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 hit-area press relative inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:ring-[3px] disabled:**:data-[slot=shortcut-kbd]:invisible [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        adaptive:
          "size-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 sm:h-9 sm:w-auto",
        // Every control in a top bar shares one height: a touch target on phones and tablets.
        bar: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 lg:h-10",
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "size-9",
        "icon-bar": "size-11 lg:size-10",
        "icon-lg": "size-10",
        "icon-sm": "size-8 rounded-md",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        // A screen's main action, and the actions beside it.
        lg: "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        // A small action beside a line of text (a suggestion's "See", a header's "Adjust plan").
        sm: "h-7.5 gap-1 rounded-md px-2.5 text-[0.8125rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xl: "h-11 gap-2 px-5 text-[0.9375rem] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-6 gap-1 rounded-md px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
      },
      variant: {
        // Disabled until it can act (nothing picked yet): a quiet fill, not a faded black slab.
        default:
          "bg-primary text-primary-foreground hover:bg-primary/80 disabled:bg-muted disabled:text-muted-foreground border-transparent disabled:opacity-100",
        destructive:
          "bg-destructive/10 text-destructive-text hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 dark:hover:bg-destructive/30 border-transparent",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 border-transparent",
        inverse:
          "bg-primary-foreground text-primary hover:bg-primary-foreground/90 focus-visible:border-primary-foreground/60 focus-visible:ring-primary-foreground/30 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 dark:focus-visible:border-primary/60 dark:focus-visible:ring-primary/30 border-transparent",
        "inverse-outline":
          "border-primary-foreground/30 bg-primary-foreground/5 text-primary-foreground hover:border-primary-foreground hover:bg-primary-foreground hover:text-primary focus-visible:border-primary-foreground/60 focus-visible:ring-primary-foreground/30 dark:border-primary/30 dark:bg-primary/5 dark:text-primary dark:hover:border-primary dark:hover:bg-primary dark:hover:text-primary-foreground dark:focus-visible:border-primary/60 dark:focus-visible:ring-primary/30",
        // The secondary action: see-through with the stronger line, so it sits on any surface.
        outline:
          "border-input hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground bg-transparent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground border-transparent",
      },
    },
  },
);

/**
 * A button that waits on a save takes `focusableWhenDisabled` with `disabled`: it stays in the tab
 * order as `aria-disabled` and ignores presses, so keyboard focus isn't dropped to the page.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ className, size, variant }))}
      data-slot="button"
      {...props}
    />
  );
}

type ButtonSkeletonProps = Pick<
  React.ComponentProps<typeof Button>,
  "children" | "className" | "size" | "variant"
>;

/**
 * Uses the real button layout with invisible content so loading placeholders
 * always reserve the exact intrinsic width of their eventual action.
 */
function ButtonSkeleton({ children, className, size, variant }: ButtonSkeletonProps) {
  return (
    <Button
      aria-hidden="true"
      className={cn(
        "bg-background hover:bg-background text-transparent disabled:opacity-100 [&_svg]:opacity-0",
        className,
      )}
      disabled
      size={size}
      tabIndex={-1}
      type="button"
      variant={variant}
    >
      {children}
      <Skeleton className="pointer-events-none absolute inset-0 rounded-[inherit]" />
    </Button>
  );
}

export { Button, ButtonSkeleton, buttonVariants };
