import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { Skeleton } from "./skeleton";

const KEYCAP_LAST_CLASS = "*:data-[slot=shortcut-kbd]:order-last";

const buttonVariants = cva(
  [
    "group/button focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 hit-area press relative inline-flex shrink-0 items-center justify-center rounded-lg border text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress aria-disabled:not-aria-busy:pointer-events-none aria-disabled:not-aria-busy:opacity-50 aria-invalid:ring-[3px] data-held:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--icon-size,1rem)",
    KEYCAP_LAST_CLASS,
  ],
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      // Hung past its column, so its focus ring is drawn inside the box, never past the screen's edge.
      edge: {
        end: "edge -me-(--edge-pull) focus-visible:ring-inset",
        start: "edge -ms-(--edge-start) focus-visible:ring-inset",
      },
      size: {
        bar: "h-control gap-1.5 px-(--control-pad) text-(length:--control-text) [--edge-text:calc(var(--control-pad)+1px)] has-data-[icon=inline-end]:pr-[calc(var(--control-pad)-2px)] has-data-[icon=inline-end]:[--edge-text-end:calc(var(--control-pad)-1px)] has-data-[icon=inline-start]:pl-[calc(var(--control-pad)-2px)] has-data-[icon=inline-start]:[--edge-text-start:calc(var(--control-pad)-1px)]",
        default:
          "h-9 gap-1.5 px-3 [--edge-text:calc(--spacing(3)+1px)] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-end]:[--edge-text-end:calc(--spacing(2.5)+1px)] has-data-[icon=inline-start]:pl-2.5 has-data-[icon=inline-start]:[--edge-text-start:calc(--spacing(2.5)+1px)]",
        icon: "size-(--control-size) [--control-size:--spacing(9)]",
        "icon-bar":
          "size-(--control-size) [--control-size:var(--control-height)] [--edge-under:1.875rem] [--icon-size:--spacing(5)]",
        "icon-lg": "size-(--control-size) [--control-size:var(--control-height)]",
        "icon-sm": "size-(--control-size) rounded-md [--control-size:--spacing(7.5)]",
        "icon-xs":
          "size-(--control-size) rounded-md [--control-size:--spacing(6)] [--icon-size:--spacing(3)]",
        // As tall as a field: 44px on touch and 36px with a mouse, except where `keep-touch-size` holds 44px.
        lg: "h-control gap-(--control-gap) px-(--control-pad) text-(length:--control-text) [--edge-text:calc(var(--control-pad)+1px)] has-data-[icon=inline-end]:pr-[calc(var(--control-pad)-2px)] has-data-[icon=inline-end]:[--edge-text-end:calc(var(--control-pad)-1px)] has-data-[icon=inline-start]:pl-[calc(var(--control-pad)-2px)] has-data-[icon=inline-start]:[--edge-text-start:calc(var(--control-pad)-1px)]",
        sm: "text-compact h-7.5 gap-1 rounded-md px-2.5 [--edge-text:calc(--spacing(2.5)+1px)] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-end]:[--edge-text-end:calc(--spacing(2)+1px)] has-data-[icon=inline-start]:pl-2 has-data-[icon=inline-start]:[--edge-text-start:calc(--spacing(2)+1px)]",
        xl: "h-control gap-(--control-gap) px-[calc(var(--control-pad)+4px)] text-(length:--control-text) [--edge-text:calc(var(--control-pad)+5px)] has-data-[icon=inline-end]:pr-[calc(var(--control-pad)+2px)] has-data-[icon=inline-end]:[--edge-text-end:calc(var(--control-pad)+3px)] has-data-[icon=inline-start]:pl-[calc(var(--control-pad)+2px)] has-data-[icon=inline-start]:[--edge-text-start:calc(var(--control-pad)+3px)]",
        xs: "h-6 gap-1 rounded-md px-2.5 text-xs [--edge-text:calc(--spacing(2.5)+1px)] [--icon-size:--spacing(3)] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-end]:[--edge-text-end:calc(--spacing(2)+1px)] has-data-[icon=inline-start]:pl-2 has-data-[icon=inline-start]:[--edge-text-start:calc(--spacing(2)+1px)]",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/80 disabled:bg-secondary disabled:text-muted-foreground aria-disabled:not-aria-busy:bg-secondary aria-disabled:not-aria-busy:text-muted-foreground border-transparent [--button-variant:default] disabled:opacity-100 aria-disabled:not-aria-busy:opacity-100",
        destructive:
          "bg-destructive/10 text-destructive-text hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 dark:hover:bg-destructive/30 border-transparent [--button-variant:destructive]",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground held-menu:bg-muted held-menu:text-foreground dark:hover:bg-muted/50 border-transparent [--button-variant:ghost]",
        // Underlined at rest: a touch screen has no hover to show it's a link.
        link: "text-foreground decoration-foreground/30 hover:decoration-foreground inline h-auto rounded-sm border-0 p-0 text-start whitespace-normal underline underline-offset-4 [--button-variant:link] in-[p]:text-[length:inherit] has-data-[icon=inline-end]:pr-0 has-data-[icon=inline-start]:pl-0",
        outline:
          "border-input hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground held-menu:bg-muted held-menu:text-foreground bg-transparent [--button-variant:outline]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground held-menu:bg-secondary held-menu:text-secondary-foreground border-transparent [--button-variant:secondary]",
      },
    },
  },
);

const BUSY_HIDDEN =
  "group-aria-busy/busy:opacity-0 in-held:opacity-0 group-has-data-busy/busy:opacity-0";

const BUSY_HIDDEN_WITHOUT_KEYS =
  "not-pointer-fine:group-aria-busy/busy:opacity-0 not-pointer-fine:in-held:opacity-0 not-pointer-fine:group-has-data-busy/busy:opacity-0";

// A `<button>` makes an inline span atomic, out of reach of the link variant's underline.
const BUSY_CONTENT_CLASS =
  "[display:inherit] min-w-0 [flex-direction:inherit] [flex-wrap:inherit] [place-content:inherit] [place-items:inherit] gap-[inherit] [text-decoration:inherit]";

/**
 * The one spinner, over the box it sits in (a positioned parent), while the `group/busy` around it
 * is busy or the control around it holds a press (`data-held`).
 */
function BusySpinner({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "in-held:opacity-100 pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-has-data-busy/busy:opacity-100 group-aria-busy/busy:opacity-100",
        className,
      )}
      data-slot="busy-spinner"
    >
      <Loader2Icon
        className={cn(
          "in-held:animate-spin group-has-data-busy/busy:animate-spin group-aria-busy/busy:animate-spin",
          iconClassName,
        )}
      />
    </span>
  );
}

/**
 * An icon that gives way to the spinner, in its own box, while the `group/busy` around it is busy or
 * the control around it holds a press (`data-held`).
 */
function BusyIcon({ children, className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn("relative inline-flex", className)} {...props}>
      <span className={cn("inline-flex size-full", BUSY_HIDDEN)}>{children}</span>
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
 * `data-busy` mark (a link that learns it's pending inside, as main's `LearningLink` does), and for
 * any control `HELD_PRESS_SCRIPT` marks `data-held` until the page hydrates. CSS draws it, so it
 * works before the page hydrates. The spinner takes the glyph's place (the `icon`,
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
      <span
        className={cn(BUSY_CONTENT_CLASS, KEYCAP_LAST_CLASS, BUSY_HIDDEN)}
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
 * and a spinner takes its glyph's place, or covers its label when it shows none. A press made before
 * the page hydrates shows the same spinner from the tap, whether or not it takes `busy`; a menu's
 * trigger keeps its glyph and draws its menu open instead.
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
  return (
    <ButtonPrimitive
      aria-busy={busy || undefined}
      className={cn(buttonVariants({ className, edge, size, variant }), "group/busy")}
      data-size={size}
      data-slot="button"
      disabled={busy || disabled}
      focusableWhenDisabled={busy || focusableWhenDisabled}
      // A press made before the page hydrates marks it held.
      suppressHydrationWarning
      {...props}
    >
      <BusyContent icon={icon} iconPosition={iconPosition} keyHint={keyHint}>
        {children}
      </BusyContent>
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

export { BusyContent, BusyIcon, BusySpinner, Button, ButtonSkeleton, FORWARD_ICON, buttonVariants };
