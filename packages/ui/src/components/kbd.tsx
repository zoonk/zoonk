import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

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

/** Visual only: the host control owns `aria-keyshortcuts`. */
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

export { Kbd, ShortcutKbd };
