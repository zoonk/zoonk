"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { type PlayerRoute } from "../player-context";
import { PlayerLink } from "../player-link";

export function PrimaryKbd({ children }: { children: React.ReactNode }) {
  return <ShortcutKbd tone="inverse">{children}</ShortcutKbd>;
}

export function SecondaryKbd({ children }: { children: React.ReactNode }) {
  return <ShortcutKbd className="opacity-60">{children}</ShortcutKbd>;
}

/**
 * Completion buttons use the short visible key label, but ARIA expects the
 * canonical key name for keys like Escape. Keeping the conversion here avoids
 * every completion action restating the same mapping.
 */
function getAriaKeyboardShortcut(shortcut: string): string {
  if (shortcut === "Esc") {
    return "Escape";
  }

  if (shortcut === "R") {
    return "r";
  }

  return shortcut;
}

export function PrimaryActionLink({
  children,
  className,
  href,
  shortcut,
}: {
  children: React.ReactNode;
  className?: string;
  href: PlayerRoute;
  shortcut: string;
}) {
  return (
    <PlayerLink
      aria-keyshortcuts={getAriaKeyboardShortcut(shortcut)}
      className={cn(buttonVariants({ size: "lg" }), "w-full", className)}
      href={href}
    >
      {children}
      <PrimaryKbd>{shortcut}</PrimaryKbd>
    </PlayerLink>
  );
}

export function SecondaryActionLink({
  children,
  className,
  href,
  shortcut,
}: {
  children: React.ReactNode;
  className?: string;
  href: PlayerRoute;
  shortcut: string;
}) {
  return (
    <PlayerLink
      aria-keyshortcuts={getAriaKeyboardShortcut(shortcut)}
      className={cn(buttonVariants({ variant: "outline" }), "w-full", className)}
      href={href}
    >
      {children}
      <SecondaryKbd>{shortcut}</SecondaryKbd>
    </PlayerLink>
  );
}
