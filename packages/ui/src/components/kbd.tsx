"use client";

import { useShortcutLabel } from "@zoonk/ui/hooks/shortcut-label";
import { SHORTCUTS, type ShortcutName, isModShortcut, pickKey } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, CornerDownLeftIcon } from "lucide-react";

const shortcutKbdVariants = cva("hidden pointer-fine:inline-flex", {
  defaultVariants: { tone: "default" },
  variants: {
    tone: { default: "", inverse: "text-compact bg-current/15 text-current ring-current/25" },
  },
});

type ShortcutKbdProps = {
  className?: string;
  /** With `shortcut="pick"`, the option's place: its keycap is that one number. */
  index?: number;
  shortcut: ShortcutName;
} & VariantProps<typeof shortcutKbdVariants>;

/** What a shortcut's keycap says: ⌘ or Ctrl before a `mod` key, one number for an option. */
export function useShortcutCap(shortcut: ShortcutName, index?: number): string {
  const { cap } = SHORTCUTS[shortcut];
  const modCap = useShortcutLabel(cap);

  if (index !== undefined) {
    return pickKey(index) ?? "";
  }

  return isModShortcut(shortcut) ? modCap : cap;
}

/** A key named by a symbol is drawn as Lucide's glyph: a font's ⏎ and arrows are a few pixels of ink. */
const KEY_GLYPHS: Partial<Record<string, typeof CornerDownLeftIcon>> = {
  "←": ArrowLeftIcon,
  "→": ArrowRightIcon,
  "↓": ArrowDownIcon,
  "⏎": CornerDownLeftIcon,
};

function KeyGlyph({ children }: { children: React.ReactNode }) {
  const Glyph = typeof children === "string" ? KEY_GLYPHS[children] : undefined;

  if (!Glyph) {
    return children;
  }

  return (
    <>
      <Glyph aria-hidden="true" />
      <span className="sr-only">{children}</span>
    </>
  );
}

function Kbd({ children, className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "bg-foreground/4 ring-foreground/12 in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background text-muted-foreground dark:in-data-[slot=tooltip-content]:bg-background/10 text-2xs pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-mono font-medium ring-1 select-none ring-inset in-data-[slot=tooltip-content]:ring-0 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      data-slot="kbd"
      {...props}
    >
      <KeyGlyph>{children}</KeyGlyph>
    </kbd>
  );
}

/**
 * A shortcut's keycap, shown where there is a keyboard. Visual only: the host control says the key
 * with `shortcutKeys`.
 */
function ShortcutKbd({ className, index, shortcut, tone }: ShortcutKbdProps) {
  const cap = useShortcutCap(shortcut, index);

  if (!cap) {
    return null;
  }

  return (
    <Kbd
      aria-hidden="true"
      className={shortcutKbdVariants({ className, tone })}
      data-shortcut={shortcut}
      data-slot="shortcut-kbd"
    >
      {cap}
    </Kbd>
  );
}

/** The same keycap inside a tooltip, where it shows on every device that can hover. */
function TooltipKbd({ shortcut }: { shortcut: ShortcutName }) {
  return (
    <Kbd className="ms-2" data-shortcut={shortcut}>
      {useShortcutCap(shortcut)}
    </Kbd>
  );
}

export { Kbd, ShortcutKbd, TooltipKbd };
