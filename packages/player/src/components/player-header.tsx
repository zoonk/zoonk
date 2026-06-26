"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type PlayerRoute } from "../player-context";
import { PlayerLink } from "../player-link";

export function PlayerHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "relative flex items-center justify-between px-3 py-1.5 sm:py-2.5 xl:p-4",
        className,
      )}
      data-slot="player-header"
      {...props}
    />
  );
}

export function PlayerCloseLink({ className, href }: { className?: string; href: PlayerRoute }) {
  const t = useExtracted();

  return (
    <PlayerLink
      aria-keyshortcuts="Escape"
      className={cn("relative", buttonVariants({ size: "icon", variant: "ghost" }), className)}
      href={href}
    >
      <XIcon />
      <ShortcutKbd variant="badge">Esc</ShortcutKbd>
      <span className="sr-only">{t("Close")}</span>
    </PlayerLink>
  );
}
