import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { Skeleton } from "./skeleton";

const buttonVariants = cva(
  "group/button focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 hit-area press relative inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress aria-disabled:not-aria-busy:pointer-events-none aria-disabled:not-aria-busy:opacity-50 aria-invalid:ring-[3px] *:data-[slot=shortcut-kbd]:order-last disabled:**:data-[slot=shortcut-kbd]:invisible aria-disabled:not-aria-busy:**:data-[slot=shortcut-kbd]:invisible [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        adaptive:
          "size-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 sm:h-9 sm:w-auto",
        bar: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 lg:h-10",
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "size-9",
        "icon-bar": "size-11 lg:size-10",
        "icon-lg": "size-10",
        "icon-sm": "size-8 rounded-md",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        lg: "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        sm: "h-7.5 gap-1 rounded-md px-2.5 text-[0.8125rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xl: "h-11 gap-2 px-5 text-[0.9375rem] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-6 gap-1 rounded-md px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/80 disabled:bg-muted disabled:text-muted-foreground aria-disabled:not-aria-busy:bg-muted aria-disabled:not-aria-busy:text-muted-foreground border-transparent disabled:opacity-100 aria-disabled:not-aria-busy:opacity-100",
        destructive:
          "bg-destructive/10 text-destructive-text hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 dark:hover:bg-destructive/30 border-transparent",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 border-transparent",
        inverse:
          "bg-primary-foreground text-primary hover:bg-primary-foreground/90 focus-visible:border-primary-foreground/60 focus-visible:ring-primary-foreground/30 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 dark:focus-visible:border-primary/60 dark:focus-visible:ring-primary/30 border-transparent",
        "inverse-outline":
          "border-primary-foreground/30 bg-primary-foreground/5 text-primary-foreground hover:border-primary-foreground hover:bg-primary-foreground hover:text-primary focus-visible:border-primary-foreground/60 focus-visible:ring-primary-foreground/30 dark:border-primary/30 dark:bg-primary/5 dark:text-primary dark:hover:border-primary dark:hover:bg-primary dark:hover:text-primary-foreground dark:focus-visible:border-primary/60 dark:focus-visible:ring-primary/30",
        // Underlined at rest: a touch screen has no hover to show it's a link.
        link: "text-foreground decoration-foreground/30 hover:decoration-foreground inline h-auto rounded-sm border-0 p-0 text-start whitespace-normal underline underline-offset-4 in-[p]:text-[length:inherit] has-data-[icon=inline-end]:pr-0 has-data-[icon=inline-start]:pl-0",
        outline:
          "border-input hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground bg-transparent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground border-transparent",
      },
    },
  },
);

const BUSY_HIDDEN = "group-aria-busy/busy:opacity-0 group-has-data-busy/busy:opacity-0";

function BusySpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-has-data-busy/busy:opacity-100 group-aria-busy/busy:opacity-100"
      data-slot="busy-spinner"
    >
      <Loader2Icon
        className={cn(
          "group-has-data-busy/busy:animate-spin group-aria-busy/busy:animate-spin",
          className,
        )}
      />
    </span>
  );
}

/** An icon that gives way to the spinner, in its own box, while the `group/busy` around it is busy. */
function BusyIcon({ children, className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn("relative inline-flex", className)} {...props}>
      <span className={cn("inline-flex", BUSY_HIDDEN)}>{children}</span>
      <BusySpinner className="size-full" />
    </span>
  );
}

type IconProps = { icon?: React.ReactNode; iconPosition?: "end" | "start" };

/** The one icon that trails its label: go forward (next, continue, see the result). ⏎ still comes last. */
const FORWARD_ICON = {
  icon: <ArrowRightIcon aria-hidden="true" />,
  iconPosition: "end",
} as const satisfies IconProps;

/**
 * For a control that carries `group/busy relative` and is busy while it's `aria-busy` or holds a
 * `data-busy` mark (a link that learns it's pending inside, as main's `LearningLink` does). CSS
 * draws it, so it works before the page hydrates. The spinner takes the `icon`'s place; without
 * one, the content turns invisible under a centered spinner, keeping its place and still read.
 */
function BusyContent({
  children,
  icon,
  iconPosition = "start",
}: IconProps & { children: React.ReactNode }) {
  if (icon) {
    const busyIcon = (
      <BusyIcon data-icon={children ? `inline-${iconPosition}` : undefined}>{icon}</BusyIcon>
    );

    return iconPosition === "end" ? (
      <>
        {children}
        {busyIcon}
      </>
    ) : (
      <>
        {busyIcon}
        {children}
      </>
    );
  }

  return (
    <>
      <span
        className={cn(
          "[display:inherit] min-w-0 grow [flex-direction:inherit] [flex-wrap:inherit] [place-content:inherit] [place-items:inherit] gap-[inherit]",
          BUSY_HIDDEN,
        )}
        data-slot="busy-content"
      >
        {children}
      </span>

      <BusySpinner />
    </>
  );
}

/**
 * `busy` while its own action runs: from the press it ignores presses and keeps focus and its look,
 * and a spinner takes its `icon`'s place, or covers its content when it has none.
 */
function Button({
  busy,
  children,
  className,
  disabled,
  focusableWhenDisabled,
  icon,
  iconPosition,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & IconProps & { busy?: boolean }) {
  const canBeBusy = busy !== undefined;

  return (
    <ButtonPrimitive
      aria-busy={busy || undefined}
      className={cn(buttonVariants({ className, size, variant }), canBeBusy && "group/busy")}
      data-slot="button"
      disabled={busy || disabled}
      focusableWhenDisabled={busy || focusableWhenDisabled}
      {...props}
    >
      {canBeBusy || icon ? (
        <BusyContent icon={icon} iconPosition={iconPosition}>
          {children}
        </BusyContent>
      ) : (
        children
      )}
    </ButtonPrimitive>
  );
}

type ButtonSkeletonProps = Pick<
  React.ComponentProps<typeof Button>,
  "children" | "className" | "size" | "variant"
>;

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

export { BusyContent, BusyIcon, Button, ButtonSkeleton, FORWARD_ICON, buttonVariants };
