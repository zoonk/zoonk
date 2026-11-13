import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { Skeleton } from "./skeleton";

const buttonVariants = cva(
  "group/button focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 hit-area press relative inline-flex shrink-0 items-center justify-center rounded-lg border text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress aria-disabled:not-aria-busy:pointer-events-none aria-disabled:not-aria-busy:opacity-50 aria-invalid:ring-[3px] *:data-[slot=shortcut-kbd]:order-last [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon-size,1rem)",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      edge: { end: "edge -me-(--edge-pull)", start: "edge -ms-(--edge-start)" },
      size: {
        adaptive:
          "size-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 sm:h-9 sm:w-auto",
        bar: "text-reading h-11 gap-1.5 px-4 [--edge-text:calc(--spacing(4)+1px)] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-end]:[--edge-text-end:calc(--spacing(3)+1px)] has-data-[icon=inline-start]:pl-3 has-data-[icon=inline-start]:[--edge-text-start:calc(--spacing(3)+1px)] lg:h-10 lg:text-sm",
        default:
          "h-9 gap-1.5 px-3 [--edge-text:calc(--spacing(3)+1px)] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-end]:[--edge-text-end:calc(--spacing(2.5)+1px)] has-data-[icon=inline-start]:pl-2.5 has-data-[icon=inline-start]:[--edge-text-start:calc(--spacing(2.5)+1px)]",
        icon: "size-(--control-size) [--control-size:--spacing(9)]",
        "icon-bar":
          "size-(--control-size) [--control-size:--spacing(11)] [--edge-under:1.875rem] [--icon-size:--spacing(5)] lg:[--control-size:--spacing(10)]",
        "icon-lg": "size-(--control-size) [--control-size:--spacing(10)]",
        "icon-sm": "size-(--control-size) rounded-md [--control-size:--spacing(7.5)]",
        "icon-xs":
          "size-(--control-size) rounded-md [--control-size:--spacing(6)] [--icon-size:--spacing(3)]",
        lg: "text-reading h-11 gap-2 px-4 [--edge-text:calc(--spacing(4)+1px)] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-end]:[--edge-text-end:calc(--spacing(3)+1px)] has-data-[icon=inline-start]:pl-3 has-data-[icon=inline-start]:[--edge-text-start:calc(--spacing(3)+1px)]",
        sm: "text-compact h-7.5 gap-1 rounded-md px-2.5 [--edge-text:calc(--spacing(2.5)+1px)] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-end]:[--edge-text-end:calc(--spacing(2)+1px)] has-data-[icon=inline-start]:pl-2 has-data-[icon=inline-start]:[--edge-text-start:calc(--spacing(2)+1px)]",
        xl: "text-reading h-11 gap-2 px-5 [--edge-text:calc(--spacing(5)+1px)] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-end]:[--edge-text-end:calc(--spacing(4)+1px)] has-data-[icon=inline-start]:pl-4 has-data-[icon=inline-start]:[--edge-text-start:calc(--spacing(4)+1px)]",
        xs: "h-6 gap-1 rounded-md px-2.5 text-xs [--edge-text:calc(--spacing(2.5)+1px)] [--icon-size:--spacing(3)] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-end]:[--edge-text-end:calc(--spacing(2)+1px)] has-data-[icon=inline-start]:pl-2 has-data-[icon=inline-start]:[--edge-text-start:calc(--spacing(2)+1px)]",
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

const BUSY_HIDDEN_WITHOUT_KEYS =
  "not-pointer-fine:group-aria-busy/busy:opacity-0 not-pointer-fine:group-has-data-busy/busy:opacity-0";

const BUSY_CONTENT_CLASS =
  "[display:inherit] min-w-0 grow [flex-direction:inherit] [flex-wrap:inherit] [place-content:inherit] [place-items:inherit] gap-[inherit]";

function BusySpinner({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-has-data-busy/busy:opacity-100 group-aria-busy/busy:opacity-100",
        className,
      )}
      data-slot="busy-spinner"
    >
      <Loader2Icon
        className={cn(
          "group-has-data-busy/busy:animate-spin group-aria-busy/busy:animate-spin",
          iconClassName,
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
      <BusySpinner iconClassName="size-full" />
    </span>
  );
}

/**
 * A button shows its label and at most one glyph: an `icon`, or the `keyHint` of the key that
 * presses it, never both.
 */
type GlyphProps = {
  icon?: React.ReactNode;
  iconPosition?: "end" | "start";
  /**
   * The keycap of the key that presses it, after the label, where there is a keyboard. Without
   * one (a touch screen) the button is its label alone.
   */
  keyHint?: React.ReactNode;
};

/** The one glyph that trails a label that goes forward (next, continue, see the result). */
const FORWARD_ICON = {
  icon: <ChevronRightIcon aria-hidden="true" />,
  iconPosition: "end",
} as const satisfies GlyphProps;

/**
 * For a control that carries `group/busy relative` and is busy while it's `aria-busy` or holds a
 * `data-busy` mark (a link that learns it's pending inside, as main's `LearningLink` does). CSS
 * draws it, so it works before the page hydrates. The spinner takes the glyph's place (the `icon`,
 * or the `keyHint` where it shows); with no glyph on screen, the content turns invisible under a
 * centered spinner, keeping its place and still read. Either way nothing changes size.
 */
function BusyContent({
  children,
  icon,
  iconPosition = "start",
  keyHint,
}: GlyphProps & { children: React.ReactNode }) {
  if (keyHint) {
    return (
      <>
        <span className={cn(BUSY_CONTENT_CLASS, BUSY_HIDDEN_WITHOUT_KEYS)} data-slot="busy-content">
          {children}
        </span>

        <span className="relative hidden pointer-fine:inline-flex" data-slot="key-hint">
          <span className={cn("inline-flex", BUSY_HIDDEN)}>{keyHint}</span>
          <BusySpinner />
        </span>

        <BusySpinner className="pointer-fine:hidden" />
      </>
    );
  }

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
      <span className={cn(BUSY_CONTENT_CLASS, BUSY_HIDDEN)} data-slot="busy-content">
        {children}
      </span>

      <BusySpinner />
    </>
  );
}

/**
 * `busy` while its own action runs: from the press it ignores presses and keeps focus and its look,
 * and a spinner takes its glyph's place, or covers its label when it shows none.
 *
 * `edge` is for a bare (ghost) button that is the first or last thing in a bar, a header or a row:
 * it puts the glyph's or the label's ink, not the button's box, on that edge.
 */
function Button({
  busy,
  children,
  className,
  disabled,
  edge,
  focusableWhenDisabled,
  icon,
  iconPosition,
  keyHint,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & GlyphProps & { busy?: boolean }) {
  const canBeBusy = busy !== undefined;

  return (
    <ButtonPrimitive
      aria-busy={busy || undefined}
      className={cn(buttonVariants({ className, edge, size, variant }), canBeBusy && "group/busy")}
      data-slot="button"
      disabled={busy || disabled}
      focusableWhenDisabled={busy || focusableWhenDisabled}
      {...props}
    >
      {canBeBusy || icon || keyHint ? (
        <BusyContent icon={icon} iconPosition={iconPosition} keyHint={keyHint}>
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
  "children" | "className" | "edge" | "size" | "variant"
>;

function ButtonSkeleton({ children, className, edge, size, variant }: ButtonSkeletonProps) {
  return (
    <Button
      aria-hidden="true"
      className={cn(
        "bg-background hover:bg-background text-transparent disabled:opacity-100 [&_svg]:opacity-0",
        className,
      )}
      disabled
      edge={edge}
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
