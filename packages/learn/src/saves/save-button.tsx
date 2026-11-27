"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutTooltip } from "@zoonk/ui/components/shortcut-tooltip";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { BookmarkIcon } from "lucide-react";

export type SaveToggle = { onToggle: () => void; saved: boolean };

export function SavedBookmarkIcon({ className, saved }: { className?: string; saved: boolean }) {
  return <BookmarkIcon aria-hidden="true" className={cn(saved && "fill-current", className)} />;
}

export type SaveButtonProps = SaveToggle &
  Pick<React.ComponentProps<typeof Button>, "edge" | "size" | "variant"> & {
    /** A keycap, after the label. */
    children?: React.ReactNode;
    className?: string;
    /** False draws the bookmark alone, where there's no room for the word. */
    labelled?: boolean;
    /** True where S saves it: the button says so, in its tooltip when it's the bookmark alone. */
    shortcut?: boolean;
  };

/**
 * The label says the state, so it reads the same to everyone: "Save" until it's "Saved". Each kind
 * of thing brings its own words, since "Saved" agrees with what was saved in some languages.
 */
export function SaveButton({
  children,
  className,
  labelled = true,
  labels,
  onToggle,
  saved,
  shortcut = false,
  size = "bar",
  slot,
  variant = "outline",
  ...props
}: SaveButtonProps & { labels: { save: React.ReactNode; saved: React.ReactNode }; slot: string }) {
  const label = saved ? labels.saved : labels.save;

  const button = (
    <Button
      aria-keyshortcuts={shortcut ? shortcutKeys("save") : undefined}
      aria-pressed={saved}
      className={className}
      data-slot={slot}
      icon={<SavedBookmarkIcon saved={saved} />}
      onClick={onToggle}
      size={size}
      variant={variant}
      {...props}
    >
      <span className={cn(!labelled && "sr-only")}>{label}</span>
      {children}
    </Button>
  );

  if (!shortcut || labelled) {
    return button;
  }

  return (
    <ShortcutTooltip align="end" label={label} shortcut="save">
      {button}
    </ShortcutTooltip>
  );
}
