import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const shortcutKbdVariants = cva("", {
  defaultVariants: { tone: "default", variant: "inline" },
  variants: {
    tone: { default: "", inverse: "bg-primary-foreground/15 text-primary-foreground" },
    variant: {
      badge:
        "bg-background text-muted-foreground ring-border/60 absolute -top-1 -right-1 hidden h-4 min-w-4 rounded-full px-1 text-[9px] leading-none shadow-sm ring-1 lg:pointer-fine:inline-flex",
      inline: "hidden opacity-70 lg:pointer-fine:inline-flex",
    },
  },
});

type ShortcutKbdProps = { children: React.ReactNode; className?: string } & VariantProps<
  typeof shortcutKbdVariants
>;

type ShortcutKbdVariant = NonNullable<ShortcutKbdProps["variant"]>;
type ShortcutKbdTone = NonNullable<ShortcutKbdProps["tone"]>;

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "bg-muted in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background text-muted-foreground dark:in-data-[slot=tooltip-content]:bg-background/10 pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

/**
 * Shows keyboard shortcut hints only when keyboard input is useful. The host
 * control owns `aria-keyshortcuts`; this component is visual-only.
 */
function ShortcutKbd({ children, className, tone, variant }: ShortcutKbdProps) {
  return (
    <Kbd
      aria-hidden="true"
      className={shortcutKbdVariants({ className, tone, variant })}
      data-slot={variant === "badge" ? "shortcut-kbd-badge" : "shortcut-kbd"}
    >
      {children}
    </Kbd>
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}

export { Kbd, KbdGroup, ShortcutKbd, type ShortcutKbdTone, type ShortcutKbdVariant };
