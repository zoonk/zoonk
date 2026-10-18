import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

// No extra fading: the muted colors already keep hints quiet and readable (AA).
const shortcutKbdVariants = cva("hidden pointer-fine:inline-flex", {
  defaultVariants: { tone: "default" },
  variants: {
    tone: {
      default: "",
      inverse: "bg-primary-foreground/12 text-primary-foreground/80 ring-primary-foreground/20",
    },
  },
});

type ShortcutKbdProps = { children: React.ReactNode; className?: string } & VariantProps<
  typeof shortcutKbdVariants
>;

type ShortcutKbdTone = NonNullable<ShortcutKbdProps["tone"]>;

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "bg-foreground/4 ring-foreground/12 in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background text-muted-foreground dark:in-data-[slot=tooltip-content]:bg-background/10 pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-[0.3125rem] px-1 font-mono text-[0.6875rem] font-medium ring-1 select-none ring-inset in-data-[slot=tooltip-content]:ring-0 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

/**
 * Shows keyboard shortcut hints only on devices with a mouse or trackpad, where a keyboard is at
 * hand. Keys are glyphs (`⏎`, `Esc`, `⌘K`). The host control owns `aria-keyshortcuts`; this
 * component is visual-only.
 */
function ShortcutKbd({ children, className, tone }: ShortcutKbdProps) {
  return (
    <Kbd
      aria-hidden="true"
      className={shortcutKbdVariants({ className, tone })}
      data-slot="shortcut-kbd"
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

export { Kbd, KbdGroup, ShortcutKbd, type ShortcutKbdTone };
